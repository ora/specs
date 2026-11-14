#!/usr/bin/env node
/*
 * spec-drift - watch the agent protocol specs in this registry for changes
 * nobody has reviewed yet. This is the only copy: every repo that used to
 * carry one (the Ora ranker, ax.guide, poppy.ax) now reads this registry
 * through the @ora-ai/specs package instead.
 *
 * Every spec (specs/<id>/spec.yaml) has one or more SOURCES, each with a PIN:
 * the exact state someone last reviewed (a Git object SHA, a revision name, a
 * draft number, an RFC status, or a digest of a page's text). `check` resolves
 * each source's live state and compares it with the pin. A spec whose live
 * state differs from its pin has DRIFTED: it changed since its last review.
 * Moving a pin is the record that someone reviewed the change. A spec with
 * `reviewed: null` is watched only: its pins are the state seen when it was
 * added, so drift there means "changed since we started watching".
 *
 * Usage:
 *   node scripts/spec-drift.mjs check <specs-dir> [--only <id>] [--out <report.json>] [--dry-run]
 *       Resolve every source and print pin vs live. Exits 1 when a source
 *       could not be resolved (the report still lists the rest). --dry-run
 *       prints only and writes no report.
 *   node scripts/spec-drift.mjs issues <report.json> --repo <owner/name> [--label <label>]
 *         [--status-in <status.json>] [--status-out <status.json>] [--opened-out <opened.json>]
 *         [--escalate-after <days> --escalate-label <label> [--escalate-mention <@handle>]]
 *       Open or refresh one issue per drifted spec and close the issue of a
 *       spec whose pins all match again. Needs the gh CLI and GH_TOKEN.
 *       --status-out writes the public status (each spec's live upstream
 *       values, whether it changed, and the issue that tracks it), which the
 *       watch publishes to the `status` branch; --opened-out lists the issues
 *       this run opened, so the workflow can start the fix agent for each. An
 *       issue still open after --escalate-after days gets the escalate label
 *       and one comment.
 *   node scripts/spec-drift.mjs context <specs-dir> --title-file <title.txt> --out <dir>
 *       For the fix workflow: find the drifted spec whose issue has this title
 *       and write what changed into <dir> (Git diffs between the pin and the
 *       live state, both IETF revisions, a page's text, a JSON document), so
 *       the agent that drafts a review needs no network. Exits 1 when no
 *       drifted spec has that title.
 *   node scripts/spec-drift.mjs apply-pins <specs-dir> --entry <entry.json>
 *       For the fix workflow: set each moved pin listed in entry.json (written
 *       by `context`) to its live value in specs/<id>/spec.yaml. No model
 *       writes anything that gets committed.
 *   node scripts/spec-drift.mjs vet-staged --allow <regex> [--pins-only <regex>] [--json-pins <regex>]
 *       For the fix workflow, after the pins are staged: ask git what is staged
 *       and refuse anything but plain added or modified files under --allow;
 *       in --pins-only files every removed line must be a pin line paired with
 *       an added pin line of the same name; in --json-pins files only string
 *       `pin` values may differ.
 *   node scripts/spec-drift.mjs pr-body <in.md> --out <out.md>
 *       For the fix workflow: the agent's review with HTML and Markdown
 *       comments removed, closing keywords and @mentions defused and length
 *       capped. Exits 1 when it holds something shaped like a secret.
 *   node scripts/spec-drift.mjs health --failed <true|false> --run-url <url> --out <report.json>
 *       A one-entry report for the watcher's own health: `issues` then opens
 *       an issue when a run failed and closes it after the next good run.
 *   node scripts/spec-drift.mjs page-text <file.html|https-url>
 *   node scripts/spec-drift.mjs page-digest <file.html|https-url>
 *       Print a page's normalized text, or its digest (the pin of a `page`
 *       source). Diff the text of two versions to see what changed.
 *
 * The source kinds and their state shapes live in src/kinds.mjs, shared with
 * the build and the published package.
 *
 * Upstream content is untrusted. Git and HTTP results are only ever matched
 * against strict shapes (hex SHAs, dated names, the source's own tag pattern,
 * two-digit revisions, RFC statuses); page bodies never leave this process
 * except as a digest. Commands run through execFileSync with argument arrays,
 * never a shell.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import { KINDS, sourceKey, validateSource, valueShapeOk } from "../src/kinds.mjs";

export { sourceKey };

const USER_AGENT = "OraBot/1.0 (+https://ora.ai/bot)";
const FETCH_TIMEOUT_MS = 30_000;
const MAX_PAGE_BYTES = 5_000_000;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[0-9a-f]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A release tag or file name that may appear in an issue: Git allows backticks and brackets in names, so the source's own `match` is not enough.
const TAG = /^[A-Za-z0-9][A-Za-z0-9._+/-]{0,99}$/;
// The path part of a redirect target shown in an issue ("served from /docs/0.2/spec").
const SAFE_PATH = /^\/[A-Za-z0-9._~/-]{0,200}$/;
const RUN_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/\d+$/;
const SPEC_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DAY_MS = 86_400_000;
/** Where a spec's file is shown in its issue. */
const SPEC_FILE_URL = "https://github.com/ora/specs/blob/main/specs/{id}/spec.yaml";

// ---------------------------------------------------------------- page text

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, ref) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[ref.toLowerCase()] ?? match;
  });
}

/** The index just past the first "<tag" at or after `from` that ends at a word boundary, or -1. Case-insensitive. */
function findOpen(html, tag, from) {
  const re = new RegExp(`<${tag}\\b`, "gi");
  re.lastIndex = from;
  const m = re.exec(html);
  return m ? m.index : -1;
}

/** The start of the last "</tag>" in `html`, or -1. Case-insensitive. */
function findLastClose(html, tag) {
  const re = new RegExp(`</${tag}>`, "gi");
  let last = -1;
  for (let m = re.exec(html); m; m = re.exec(html)) last = m.index;
  return last;
}

// Each scanner below gives exactly what its regular expression gives
// (`<tag\b[^>]*>([\s\S]*)</tag>`, `<!--[\s\S]*?-->`, ...) but in linear time:
// the regexes rescan to the end of the page from every unclosed opener, which
// a crafted page can make quadratic. Same output, so existing pins stay valid.

function extractContent(html) {
  for (const tag of ["article", "main"]) {
    const open = findOpen(html, tag, 0);
    if (open === -1) continue;
    const openEnd = html.indexOf(">", open);
    const close = findLastClose(html, tag);
    // A later opener ends later still, so if the first cannot fit before the last close, none can.
    if (openEnd === -1 || close === -1 || openEnd + 1 > close) continue;
    return html.slice(openEnd + 1, close);
  }
  return null;
}

/** Replace every `start ... end` run (shortest, left to right) with a space; an unclosed start is left as text. */
function replaceRuns(text, startRe, end) {
  const endRe = new RegExp(end.replace(/[/]/g, "\\/"), "gi");
  let out = "";
  let pos = 0;
  startRe.lastIndex = 0;
  for (let m = startRe.exec(text); m; m = startRe.exec(text)) {
    endRe.lastIndex = m.index + m[0].length;
    const close = endRe.exec(text);
    // No end after this start means none after any later start either.
    if (!close) break;
    out += `${text.slice(pos, m.index)} `;
    pos = close.index + close[0].length;
    startRe.lastIndex = pos;
  }
  return out + text.slice(pos);
}

/**
 * A page's text without markup: the <article> element (else <main>), minus
 * comments, scripts and styles, every tag replaced with a space, basic
 * entities decoded, whitespace collapsed. Hashing the article rather than the
 * whole response keeps build ids, asset hashes and navigation out of the pin.
 * Returns null when the page has neither element.
 */
export function normalizePage(html) {
  const content = extractContent(html);
  if (content === null) return null;
  let stripped = replaceRuns(content, /<!--/g, "-->");
  stripped = replaceRuns(stripped, /<script\b/gi, "</script>");
  stripped = replaceRuns(stripped, /<style\b/gi, "</style>");
  stripped = replaceRuns(stripped, /</g, ">");
  return decodeEntities(stripped).replace(/\s+/g, " ").trim();
}

export function pageDigest(html) {
  const text = normalizePage(html);
  if (!text) return null;
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ---------------------------------------------------------------- registry

function fill(template, standard) {
  return String(template ?? "").replace(/\{(id|name|page|file)\}/g, (_, key) => standard[key] ?? "");
}

/** A spec's watched sources: the reviewed ones, or the `watch` list of a spec nobody has reviewed yet. */
export function specSources(spec) {
  return spec?.reviewed ? spec.reviewed.sources : spec?.watch;
}

/**
 * Read the registry: `<dir>/registry.yaml` (issue text defaults) and every
 * `<dir>/<id>/spec.yaml`, as the list of standards the commands work on.
 * Each standard keeps its parsed spec, plus `file` (its path, for apply-pins)
 * and `page` (its address on GitHub, for issues).
 */
export function loadRegistry(dir) {
  const defaultsPath = join(dir, "registry.yaml");
  const defaults = existsSync(defaultsPath) ? parseYaml(readFileSync(defaultsPath, "utf8")) ?? {} : {};
  const standards = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "spec.yaml")))
    .map((d) => d.name)
    .sort()
    .map((folder) => {
      const file = join(dir, folder, "spec.yaml");
      const spec = parseYaml(readFileSync(file, "utf8"));
      return {
        id: spec?.id,
        folder,
        name: spec?.name,
        file,
        page: SPEC_FILE_URL.replace("{id}", folder),
        reviewed: Boolean(spec?.reviewed),
        issue: spec?.issue,
        sources: specSources(spec) ?? [],
        spec,
      };
    });
  return { issue: defaults.issue, standards };
}

/** Check a registry's shape as the watcher needs it. Returns a list of problems (empty when valid). */
export function validateRegistry(registry) {
  const problems = [];
  if (!registry || !Array.isArray(registry.standards)) return ["the registry has no standards"];
  const ids = new Set();
  for (const s of registry.standards) {
    const where = `spec "${s?.id}"`;
    if (typeof s?.id !== "string" || !SPEC_ID.test(s.id)) problems.push(`${where}: id must be lowercase words and hyphens`);
    if (s?.folder !== undefined && s.folder !== s.id) problems.push(`${where}: lives in specs/${s.folder}, which must be named after its id`);
    if (ids.has(s?.id)) problems.push(`${where}: listed twice`);
    ids.add(s?.id);
    if (typeof s?.name !== "string" || !s.name) problems.push(`${where}: needs a name`);
    if (!Array.isArray(s?.sources) || s.sources.length === 0) {
      problems.push(`${where}: needs at least one source`);
      continue;
    }
    const keys = new Set();
    for (const src of s.sources) {
      const key = sourceKey(src ?? {});
      if (keys.has(key)) problems.push(`${where}: source "${key}" listed twice`);
      keys.add(key);
      problems.push(...validateSource(src ?? {}).map((p) => `${where}, source "${key}": ${p}`));
    }
  }
  return problems;
}

function loadValid(dir) {
  const registry = loadRegistry(dir);
  const problems = validateRegistry(registry);
  if (problems.length) {
    console.error(`${dir} is not valid:\n- ${problems.join("\n- ")}`);
    process.exit(2);
  }
  return registry;
}

/** The shape a pin of this kind must have; a pin that fails it is a broken spec file, not drift. */
export const pinShapeOk = valueShapeOk;

// ---------------------------------------------------------------- live state

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    timeout: 180_000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    ...opts,
  });
}

/** Compare version strings by their numeric runs, so v0.10 sorts after v0.9 and dated tags sort by date. */
export function compareVersions(a, b) {
  const pa = a.match(/\d+|\D+/g) ?? [];
  const pb = b.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "";
    const y = pb[i] ?? "";
    if (x === y) continue;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) - Number(y);
    return x < y ? -1 : 1;
  }
  return 0;
}

const MAX_REDIRECTS = 5;

/**
 * GET a URL as text. Redirects are followed only within the URL's own origin
 * (the PAP pages redirect to their current draft's folder), so a page cannot
 * send the watcher to another host, and the body is read in chunks and cut
 * off at `maxBytes`. `landed` is the URL that finally answered.
 */
async function fetchText(url, maxBytes = MAX_PAGE_BYTES) {
  const origin = new URL(url).origin;
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current, {
      headers: { "user-agent": USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      const next = new URL(location, current);
      if (next.origin !== origin) throw new Error(`${url} redirected to another origin`);
      current = next.href;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${current}`);
    return { body: await readCapped(res, maxBytes, url), landed: current };
  }
  throw new Error(`${url} redirected more than ${MAX_REDIRECTS} times`);
}

async function readCapped(res, maxBytes, url) {
  const chunks = [];
  let size = 0;
  if (res.body) {
    const reader = res.body.getReader();
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      size += r.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error(`${url} is larger than ${maxBytes} bytes`);
      }
      chunks.push(r.value);
    }
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/**
 * An RFC's state as one comparable string: its status, then the RFCs that
 * update or obsolete it, sorted. A new erratum does not move it; a new RFC
 * that updates or obsoletes this one does.
 */
export function rfcState(doc, number) {
  const status = String(doc?.status ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z ]{1,40}$/.test(status)) throw new Error(`rfc-editor gave no status for RFC ${number}`);
  const list = (field) => {
    const raw = Array.isArray(doc?.[field]) ? doc[field] : [];
    const ids = raw.map((x) => String(x).trim().toUpperCase().replace(/^RFC0*/, "RFC"));
    if (!ids.every((id) => /^RFC\d{1,5}$/.test(id))) throw new Error(`rfc-editor gave an unexpected ${field} for RFC ${number}`);
    return [...new Set(ids)].sort(compareVersions);
  };
  const parts = [status];
  const updated = list("updated_by");
  const obsoleted = list("obsoleted_by");
  if (updated.length) parts.push(`updated by ${updated.join(",")}`);
  if (obsoleted.length) parts.push(`obsoleted by ${obsoleted.join(",")}`);
  return parts.join("; ");
}

class Live {
  constructor() {
    this.dir = mkdtempSync(join(tmpdir(), "spec-drift-"));
    this.clones = new Map();
  }

  close() {
    rmSync(this.dir, { recursive: true, force: true });
  }

  /** A shallow clone of the default branch with trees but no file contents: enough for object SHAs and listings. */
  clone(repo) {
    let dir = this.clones.get(repo);
    if (!dir) {
      dir = join(this.dir, repo.replace("/", "__"));
      run("git", ["clone", "--quiet", "--depth", "1", "--filter=blob:none", "--no-checkout", "--", `https://github.com/${repo}`, dir]);
      this.clones.set(repo, dir);
    }
    return dir;
  }

  /** A clone with the whole history but no file contents until asked: enough to diff a pin against the live state. */
  fullClone(repo) {
    const key = `full:${repo}`;
    let dir = this.clones.get(key);
    if (!dir) {
      dir = join(this.dir, `${repo.replace("/", "__")}-full`);
      run("git", ["clone", "--quiet", "--filter=blob:none", "--no-checkout", "--", `https://github.com/${repo}`, dir]);
      this.clones.set(key, dir);
    }
    return dir;
  }

  /** The live state of one source: { value, note?, link? }. Throws when it cannot be read. */
  async resolve(src) {
    switch (src.kind) {
      case "git-path": {
        const dir = this.clone(src.repo);
        let value;
        try {
          value = run("git", ["-C", dir, "rev-parse", "--verify", "--quiet", `HEAD:${src.path}`]).trim();
        } catch {
          throw new Error(`${src.path} does not exist in ${src.repo}`);
        }
        return { value, link: `https://github.com/${src.repo}/commits/HEAD/${src.path}` };
      }
      case "git-head": {
        const line = run("git", ["ls-remote", "--", `https://github.com/${src.repo}`, "HEAD"]).trim();
        const value = line.split(/\s+/)[0] ?? "";
        return { value };
      }
      case "git-dated-dirs": {
        const dir = this.clone(src.repo);
        const names = run("git", ["-C", dir, "ls-tree", "-d", "--name-only", "HEAD", `${src.path}/`])
          .split("\n")
          .map((line) => line.trim().split("/").pop() ?? "")
          .filter((name) => DATE.test(name))
          .sort();
        const value = names.at(-1);
        if (!value) throw new Error(`no dated folders under ${src.path} in ${src.repo}`);
        return { value, link: `https://github.com/${src.repo}/tree/HEAD/${src.path}/${value}` };
      }
      case "git-latest-tag": {
        const match = new RegExp(src.match);
        const tags = run("git", ["ls-remote", "--tags", "--refs", "--", `https://github.com/${src.repo}`])
          .split("\n")
          .map((line) => line.split("refs/tags/")[1]?.trim() ?? "")
          .filter((tag) => TAG.test(tag) && match.test(tag))
          .sort(compareVersions);
        const value = tags.at(-1);
        if (!value) throw new Error(`no tag in ${src.repo} matches ${src.match}`);
        return { value, link: `https://github.com/${src.repo}/releases/tag/${value}` };
      }
      case "git-latest-file": {
        const dir = this.clone(src.repo);
        const match = new RegExp(src.match);
        const names = run("git", ["-C", dir, "ls-tree", "--name-only", "HEAD", `${src.path}/`])
          .split("\n")
          .map((line) => line.trim().split("/").pop() ?? "")
          .filter((name) => TAG.test(name) && match.test(name))
          .sort(compareVersions);
        const value = names.at(-1);
        if (!value) throw new Error(`no file under ${src.path} in ${src.repo} matches ${src.match}`);
        return { value, link: `https://github.com/${src.repo}/blob/HEAD/${src.path}/${value}` };
      }
      case "rfc": {
        const { body } = await fetchText(`https://www.rfc-editor.org/rfc/rfc${src.number}.json`, 2_000_000);
        return { value: rfcState(JSON.parse(body), src.number), link: `https://www.rfc-editor.org/rfc/rfc${src.number}` };
      }
      case "ietf-draft": {
        const { body } = await fetchText(`https://datatracker.ietf.org/doc/${src.name}/doc.json`, 2_000_000);
        const doc = JSON.parse(body);
        const rev = String(doc.rev ?? "");
        const state = String(doc.state ?? "");
        if (!/^\d{2}$/.test(rev)) throw new Error(`datatracker gave no revision for ${src.name}`);
        if (!/^[A-Za-z][A-Za-z ()-]{0,40}$/.test(state)) throw new Error(`datatracker gave no state for ${src.name}`);
        return {
          value: state === "Active" ? rev : `${rev} ${state}`,
          link: `https://datatracker.ietf.org/doc/${src.name}/${rev}/`,
        };
      }
      case "page": {
        const { body, landed } = await fetchText(src.url);
        const value = pageDigest(body);
        if (!value) throw new Error(`no <article> or <main> text at ${src.url}`);
        // The redirect target is the page operator's text: show only its path, and only when it is plain.
        const path = new URL(landed).pathname;
        const note = landed === src.url ? undefined : SAFE_PATH.test(path) ? `served from \`${path}\`` : "served from a redirect";
        return { value, link: src.url, note };
      }
      case "json-field": {
        const { body } = await fetchText(src.url, 2_000_000);
        let value = JSON.parse(body);
        for (const key of src.field.split(".")) value = value !== null && typeof value === "object" && Object.hasOwn(value, key) ? value[key] : undefined;
        if (typeof value !== "string") throw new Error(`${src.url} has no string at ${src.field}`);
        return { value, link: src.url };
      }
      default:
        throw new Error(`unknown kind ${src.kind}`);
    }
  }
}

/** Where to read what changed between the pin and the live state. */
function changeLink(src, pin, live) {
  if (src.kind === "git-head") return `https://github.com/${src.repo}/compare/${pin}...${live.value}`;
  if (src.kind === "git-latest-tag") return `https://github.com/${src.repo}/compare/${pin}...${live.value}`;
  const pinRev = pin.slice(0, 2);
  const liveRev = live.value.slice(0, 2);
  if (src.kind === "ietf-draft" && pinRev !== liveRev) {
    return `https://author-tools.ietf.org/iddiff?url1=${src.name}-${pinRev}&url2=${src.name}-${liveRev}`;
  }
  return live.link;
}

function short(value) {
  return SHA.test(value) || /^[0-9a-f]{64}$/.test(value) ? value.slice(0, 12) : value;
}

function describeSource(src) {
  switch (src.kind) {
    case "git-path":
      return `\`${src.path}\` in ${src.repo}`;
    case "git-head":
      return `${src.repo} (whole repository)`;
    case "git-dated-dirs":
      return `newest dated revision under \`${src.path}\` in ${src.repo}`;
    case "git-latest-tag":
      return `newest ${src.repo} release tag`;
    case "git-latest-file":
      return `newest \`${src.path}\` file in ${src.repo} matching \`${src.match}\``;
    case "ietf-draft":
      return `IETF ${src.name}`;
    case "rfc":
      return `RFC ${src.number}`;
    case "page":
      return src.url;
    case "json-field":
      return `\`${src.field}\` in ${src.url}`;
    default:
      return src.kind;
  }
}

// ---------------------------------------------------------------- check

async function check(dir, { only, out, dryRun }) {
  const registry = loadValid(dir);
  const live = new Live();
  const entries = [];
  try {
    for (const standard of registry.standards) {
      if (only && standard.id !== only) continue;
      const sources = [];
      for (const src of standard.sources) {
        const row = { key: sourceKey(src), label: describeSource(src), kind: src.kind, pin: src.pin };
        try {
          const state = await live.resolve(src);
          if (!pinShapeOk(src.kind, state.value)) throw new Error(`the live value is not a valid ${src.kind} state`);
          row.live = state.value;
          row.changed = state.value !== row.pin;
          if (state.note) row.note = state.note;
          row.link = changeLink(src, row.pin, state);
        } catch (error) {
          row.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
        }
        sources.push(row);
        const status = row.error ? `ERROR ${row.error}` : row.changed ? `CHANGED live ${row.live} (reviewed pin ${short(row.pin)})` : "ok";
        console.log(`${standard.id.padEnd(24)} ${row.key.padEnd(72)} ${status}`);
      }
      const state = sources.some((s) => s.error) ? "error" : sources.some((s) => s.changed) ? "drift" : "clean";
      entries.push({
        id: standard.id,
        name: standard.name,
        reviewed: standard.reviewed,
        state,
        title: issueTitle(registry, standard),
        body: issueBody(registry, standard, sources),
        sources,
      });
    }
  } finally {
    live.close();
  }
  if (out && !dryRun) writeFileSync(out, `${JSON.stringify({ entries }, null, 2)}\n`);
  const drifted = entries.filter((e) => e.state === "drift").map((e) => e.id);
  const failed = entries.filter((e) => e.state === "error").map((e) => e.id);
  console.log(`\n${entries.length} specs: ${drifted.length} drifted${drifted.length ? ` (${drifted.join(", ")})` : ""}, ${failed.length} unreadable${failed.length ? ` (${failed.join(", ")})` : ""}`);
  if (failed.length) process.exitCode = 1;
}

export function issueTitle(registry, standard) {
  return fill(standard.issue?.title ?? registry.issue?.title ?? "{name} spec changed since its last review", standard);
}

function issueBody(registry, standard, sources) {
  const impact = fill(standard.issue?.impact ?? registry.issue?.impact ?? "", standard);
  const fallbackTodo = standard.reviewed ? registry.issue?.todo : registry.issue?.watch_todo;
  const todo = fill(standard.issue?.todo ?? fallbackTodo ?? "Review the change, then move the pins.", standard);
  const moved = sources
    .filter((s) => s.changed)
    .map((s) => {
      const note = s.note ? `; ${s.note}` : "";
      const link = s.link ? ` ([${s.kind === "page" ? "read the page" : "what changed"}](${s.link}))` : "";
      return `- ${s.label}: live \`${s.live}\` vs reviewed pin \`${short(s.pin)}\`${note}${link}`;
    });
  return [
    "## Motivation",
    "",
    (standard.reviewed
      ? `${standard.name}: ${moved.length} of ${sources.length} watched source(s) changed since someone last reviewed them, so they no longer match their reviewed pins. ${impact}`
      : `${standard.name}: ${moved.length} of ${sources.length} watched source(s) changed since the registry started watching them. Nobody has reviewed this spec yet (\`reviewed: null\`). ${impact}`
    ).trim(),
    "",
    "## Objective",
    "",
    todo,
    "",
    "### What moved",
    "",
    ...moved,
    "",
    "---",
    `_Maintained by the daily spec drift watch (\`scripts/spec-drift.mjs\`) from [\`specs/${standard.id}/spec.yaml\`](${standard.page}): refreshed on each run, closed automatically once every pin matches._`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- issues

function gh(args, opts) {
  return run("gh", args, opts);
}

/** Create a label once per run; it usually exists already, and anything else is a real failure. */
function ensureLabel(repo, name, description, color, made) {
  if (made.has(name)) return;
  try {
    gh(["label", "create", name, "--repo", repo, "--color", color, "--description", description]);
  } catch (error) {
    if (!/already exists/i.test(String(error?.stderr ?? ""))) throw error;
  }
  made.add(name);
}

function issues(reportPath, { repo, label = "spec-drift", statusIn, statusOut, openedOut, escalateAfter, escalateLabel, escalateMention }) {
  if (!REPO.test(repo ?? "")) throw new Error("--repo owner/name is required");
  const escalateDays = escalateAfter === undefined ? undefined : Number(escalateAfter);
  if (escalateDays !== undefined && (!Number.isInteger(escalateDays) || escalateDays < 1 || !/^[a-z0-9-]{1,50}$/.test(escalateLabel ?? ""))) {
    throw new Error("--escalate-after needs a whole number of days and --escalate-label a lowercase label");
  }
  if (escalateMention !== undefined && !/^@[A-Za-z0-9-]{1,39}(?:\/[A-Za-z0-9_.-]{1,100})?$/.test(escalateMention)) {
    throw new Error("--escalate-mention must be a GitHub @handle or @org/team");
  }
  const { entries } = JSON.parse(readFileSync(reportPath, "utf8"));
  const open = JSON.parse(gh(["issue", "list", "--repo", repo, "--label", label, "--state", "open", "--limit", "200", "--json", "number,title,url,createdAt,labels"]));
  const previous = statusIn ? readStatus(statusIn) : {};
  const status = {};
  const opened = [];
  const bodyDir = mkdtempSync(join(tmpdir(), "spec-drift-issue-"));
  const labels = new Set();
  try {
    for (const entry of entries) {
      const existing = open.find((issue) => issue.title === entry.title);
      if (entry.state === "drift") {
        const bodyFile = join(bodyDir, `${entry.id}.md`);
        writeFileSync(bodyFile, entry.body);
        if (existing) {
          gh(["issue", "edit", String(existing.number), "--repo", repo, "--body-file", bodyFile]);
          status[entry.id] = { changed: true, issue: existing.url, since: existing.createdAt.slice(0, 10) };
          console.log(`refreshed ${existing.url}`);
          const age = (Date.now() - Date.parse(existing.createdAt)) / DAY_MS;
          const days = Math.round(age);
          const escalated = (existing.labels ?? []).some((l) => l.name === escalateLabel);
          if (escalateDays !== undefined && isOverdue(age, escalateDays) && !escalated) {
            const who = escalateMention ? `${escalateMention}: ` : "";
            const commentFile = join(bodyDir, `${entry.id}-escalate.md`);
            writeFileSync(
              commentFile,
              `${who}this has been open for ${days} days. Until someone reviews the change and moves the pins, this project describes or scores a version of the spec that is no longer current. If nothing needs to change, moving the pins is enough.\n`,
            );
            // Comment first: if it fails, the label is not set yet and the next run tries again.
            gh(["issue", "comment", String(existing.number), "--repo", repo, "--body-file", commentFile]);
            ensureLabel(repo, escalateLabel, "A spec drift issue nobody has handled in time", "B60205", labels);
            gh(["issue", "edit", String(existing.number), "--repo", repo, "--add-label", escalateLabel]);
            console.log(`escalated ${existing.url} after ${days} days`);
          }
        } else {
          ensureLabel(repo, label, "Opened by the spec drift watch", "D93F0B", labels);
          const url = gh(["issue", "create", "--repo", repo, "--title", entry.title, "--label", label, "--body-file", bodyFile]).trim();
          status[entry.id] = { changed: true, issue: url, since: new Date().toISOString().slice(0, 10) };
          const number = /\/issues\/(\d+)$/.exec(url)?.[1];
          if (number) opened.push({ id: entry.id, number: Number(number), url });
          console.log(`opened ${url}`);
        }
      } else if (entry.state === "clean") {
        if (existing) {
          const comment = entry.close_comment ?? "Every watched source matches its reviewed pin again - closing.";
          gh(["issue", "close", String(existing.number), "--repo", repo, "--comment", comment]);
          console.log(`closed ${existing.url}`);
        }
        status[entry.id] = { changed: false };
      } else {
        // A source could not be read: neither open nor close anything, and keep what was last known.
        if (previous[entry.id]) status[entry.id] = previous[entry.id];
        console.log(`left ${entry.id} alone: a source could not be read`);
      }
    }
  } finally {
    rmSync(bodyDir, { recursive: true, force: true });
  }
  if (statusOut) writeFileSync(statusOut, `${JSON.stringify(statusDocument(entries, status, previous), null, 2)}\n`);
  if (openedOut) writeFileSync(openedOut, `${JSON.stringify(opened, null, 2)}\n`);
}

/**
 * The public status the watch publishes to the `status` branch: per spec,
 * whether it changed since its pins, the issue that tracks it, and the live
 * value of every source this run could read (already shape-checked by
 * `check`). A spec whose sources could not all be read keeps what the last
 * run knew. Report rows for sources a consumer no longer watches are its
 * concern: it matches rows by source key.
 */
export function statusDocument(entries, status, previous = {}, checkedAt = new Date()) {
  const standards = {};
  for (const entry of entries) {
    const issueState = status[entry.id];
    if (entry.state === "error") {
      if (previous[entry.id]) standards[entry.id] = previous[entry.id];
      continue;
    }
    const sources = {};
    for (const row of entry.sources ?? []) {
      if (typeof row.live === "string" && pinShapeOk(row.kind, row.live)) sources[row.key] = { kind: row.kind, live: row.live };
    }
    standards[entry.id] = { ...(issueState ?? { changed: entry.state === "drift" }), sources };
  }
  const sorted = Object.fromEntries(Object.entries(standards).sort(([a], [b]) => a.localeCompare(b)));
  return { checked_at: checkedAt.toISOString(), standards: sorted };
}

/**
 * Whether an issue `ageDays` old is due for escalation. Weekly runs drift by
 * minutes against the issue's creation time, so half a day of slack keeps "14
 * days" from becoming 21 when a run starts a little early.
 */
export function isOverdue(ageDays, afterDays) {
  return ageDays >= afterDays - 0.5;
}

/** The watcher's own health as a one-entry report: a failed run opens an issue, the next good run closes it. */
export function healthReport({ failed, runUrl }) {
  if (!RUN_URL.test(runUrl ?? "")) throw new Error("--run-url must be a GitHub Actions run URL");
  return {
    entries: [
      {
        id: "watch-health",
        name: "spec drift watch",
        state: failed ? "drift" : "clean",
        title: "The spec drift watch failed - spec changes may be going unnoticed",
        close_comment: `The latest run succeeded (${runUrl}) - closing.`,
        body: [
          "## Motivation",
          "",
          `The latest spec drift watch run failed (${runUrl}). While it fails, a spec can change without anyone being told.`,
          "",
          "## Objective",
          "",
          "Open the run and see which job failed. Most often a watched source could not be read (a file or folder moved, a repository was renamed, a page changed its layout, or a site was down): fix the source in its `specs/<id>/spec.yaml` and run the watch again. If the status or report step failed, the run's log names the step. This issue closes on the next run that succeeds.",
          "",
          "---",
          "_Maintained by the spec drift watch (`scripts/spec-drift.mjs health`)._",
          "",
        ].join("\n"),
        sources: [],
      },
    ],
  };
}

function readStatus(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8")).standards ?? {};
  } catch (error) {
    // A first run has no earlier status; anything else is a real failure.
    if (error && error.code === "ENOENT") return {};
    throw error;
  }
}

// ---------------------------------------------------------------- fix workflow

const MAX_CONTEXT_CHARS = 300_000;

function capped(text) {
  return text.length > MAX_CONTEXT_CHARS ? `${text.slice(0, MAX_CONTEXT_CHARS)}\n\n[cut at ${MAX_CONTEXT_CHARS} characters]\n` : text;
}

/** `git` output, or null when git exits non-zero (an object missing from history, a path that is gone). */
function gitOr(dir, args) {
  try {
    return run("git", ["-C", dir, ...args], { maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // git diff --no-index exits 1 when the files differ; its output is still the answer.
    if (error && error.status === 1 && typeof error.stdout === "string" && error.stdout) return error.stdout;
    return null;
  }
}

/** What changed in one moved source, as Markdown with fenced upstream text. */
async function describeChange(live, src, pin, current) {
  const fence = (lang, body) => `\`\`\`\`${lang}\n${body}\n\`\`\`\`\n`;
  const head = `# ${describeSource(src)}\n\nReviewed pin: \`${pin}\`\nLive: \`${current}\`\n\n`;
  switch (src.kind) {
    case "git-path":
    case "git-head":
    case "git-latest-tag": {
      const dir = live.fullClone(src.repo);
      // A blob or tree pin is diffed object to object; a commit or tag pin, commit to commit.
      const log =
        src.kind === "git-path"
          ? gitOr(dir, ["log", "--date=short", "--format=%h %ad %s", "-n", "40", "HEAD", "--", src.path])
          : gitOr(dir, ["log", "--date=short", "--format=%h %ad %s", `${pin}..${current}`]);
      const stat = gitOr(dir, ["diff", "--stat", pin, current]);
      const diff = gitOr(dir, ["diff", pin, current]);
      if (diff === null) {
        const now = src.kind === "git-path" ? gitOr(dir, ["show", `HEAD:${src.path}`]) : null;
        return `${head}The reviewed state is no longer in the repository's history, so there is no diff.\n\n${now ? `Current content:\n\n${fence("", capped(now))}` : ""}`;
      }
      return `${head}Recent commits (untrusted text):\n\n${fence("", log ?? "")}\nChanged files:\n\n${fence("", stat ?? "")}\nDiff:\n\n${fence("diff", capped(diff))}`;
    }
    case "git-dated-dirs": {
      const dir = live.fullClone(src.repo);
      const diff = gitOr(dir, ["diff", `HEAD:${src.path}/${pin}`, `HEAD:${src.path}/${current}`]);
      return `${head}A newer dated revision exists. Diff from the reviewed revision folder to the newest one:\n\n${fence("diff", capped(diff ?? "(no diff available)"))}`;
    }
    case "ietf-draft": {
      const name = src.name;
      const text = async (rev) => (await fetchText(`https://www.ietf.org/archive/id/${name}-${rev}.txt`, 2_000_000)).body;
      const [oldRev, newRev] = [pin.slice(0, 2), current.slice(0, 2)];
      const before = await text(oldRev);
      const after = oldRev === newRev ? before : await text(newRev);
      const work = mkdtempSync(join(tmpdir(), "spec-drift-ietf-"));
      try {
        writeFileSync(join(work, "a.txt"), before);
        writeFileSync(join(work, "b.txt"), after);
        const diff = gitOr(work, ["diff", "--no-index", "a.txt", "b.txt"]) ?? "(the revisions are identical)";
        return `${head}Diff from ${name}-${oldRev} to ${name}-${newRev}:\n\n${fence("diff", capped(diff))}`;
      } finally {
        rmSync(work, { recursive: true, force: true });
      }
    }
    case "page": {
      const { body } = await fetchText(src.url);
      return `${head}The reviewed text is not kept (only its digest), so this is the page's current text:\n\n${fence("", capped(normalizePage(body) ?? ""))}`;
    }
    case "json-field": {
      const { body } = await fetchText(src.url, 2_000_000);
      return `${head}The current document:\n\n${fence("json", capped(JSON.stringify(JSON.parse(body), null, 2)))}`;
    }
    default:
      return head;
  }
}

/**
 * Write what changed for the drifted spec whose issue carries `title` into
 * `out`: one Markdown file per moved source plus `entry.json`. Refuses a title
 * that no drifted spec in the registry produces, which keeps the fix agent to
 * drift issues the watcher itself opened.
 */
async function context(dir, { titleFile, out }) {
  const registry = loadRegistry(dir);
  if (validateRegistry(registry).length) throw new Error(`${dir} is not valid`);
  const title = readFileSync(titleFile, "utf8").trim();
  const standard = registry.standards.find((s) => issueTitle(registry, s) === title);
  if (!standard) throw new Error("no watched spec has an issue with this title");
  mkdirSync(out, { recursive: true });
  const live = new Live();
  const moved = [];
  try {
    for (const [i, src] of standard.sources.entries()) {
      const pin = src.pin;
      const state = await live.resolve(src);
      if (!pinShapeOk(src.kind, state.value)) throw new Error(`the live value of ${sourceKey(src)} is not a valid ${src.kind} state`);
      if (state.value === pin) continue;
      const file = `source-${i + 1}.md`;
      writeFileSync(join(out, file), await describeChange(live, src, pin, state.value));
      moved.push({ file, key: sourceKey(src), kind: src.kind, pin, live: state.value });
    }
  } finally {
    live.close();
  }
  if (moved.length === 0) throw new Error(`${standard.id} no longer differs from its pins`);
  writeFileSync(join(out, "entry.json"), `${JSON.stringify({ id: standard.id, name: standard.name, reviewed: standard.reviewed, moved }, null, 2)}\n`);
  console.log(`${standard.id}: wrote ${moved.length} change file(s) to ${out}`);
}

// A pin line, by its name: a YAML `pin:` field of a spec file (`  pin: "..."`).
const PIN_LINE = /^\s+(pin): "[A-Za-z0-9._@:+/ ();,-]*"$/;

/** git, with nothing in the checkout able to make it run a command. */
function safeGit(cwd, args) {
  return run(
    "git",
    ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-C", cwd, ...args],
    { maxBuffer: 64 * 1024 * 1024 },
  );
}

/** Added and removed lines of one staged file, read from git's own diff by its hunk counts. */
function stagedLines(cwd, path) {
  const out = safeGit(cwd, ["diff", "--cached", "-U0", "--no-color", "--no-ext-diff", "--no-textconv", "--", `:(literal)${path}`]);
  const lines = out.split("\n");
  const added = [];
  const removed = [];
  let i = lines.findIndex((l) => l.startsWith("@@ "));
  while (i !== -1 && i < lines.length) {
    const m = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@/.exec(lines[i]);
    if (!m) break;
    let minus = m[1] === undefined ? 1 : Number(m[1]);
    let plus = m[2] === undefined ? 1 : Number(m[2]);
    i++;
    while ((minus > 0 || plus > 0) && i < lines.length) {
      const l = lines[i++];
      if (l.startsWith("\\")) continue;
      if (minus > 0 && l.startsWith("-")) {
        removed.push(l.slice(1));
        minus--;
      } else if (plus > 0 && l.startsWith("+")) {
        added.push(l.slice(1));
        plus--;
      } else throw new Error(`${path}: unexpected line in git's diff`);
    }
    while (i < lines.length && lines[i].startsWith("\\")) i++;
    if (i < lines.length && !lines[i].startsWith("@@ ")) break;
  }
  return { added, removed };
}

/** A JSON document with every string `pin` value blanked, so two versions compare equal when only pins moved. */
function withoutPins(value) {
  if (Array.isArray(value)) return value.map(withoutPins);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "pin" && typeof v === "string" ? "" : withoutPins(v)]));
  }
  return value;
}

/**
 * Problems with what is staged in `cwd` (the agent's patch after `git apply
 * --index`), read from git itself rather than from the patch text: only
 * regular files added or modified under `allow`; in `pinsOnly` files only
 * the values of existing pin lines change; in `jsonPins` files only string
 * `pin` values differ. Empty when the change is fine.
 */
export function vetStaged(cwd, { allow, pinsOnly, jsonPins }) {
  const problems = [];
  const fields = safeGit(cwd, ["diff", "--cached", "--name-status", "--no-renames", "-z"]).split("\0").filter(Boolean);
  if (fields.length === 0) return ["the agent changed nothing"];
  const numstat = safeGit(cwd, ["diff", "--cached", "--numstat", "--no-renames", "-z"]).split("\0").filter(Boolean);
  for (const row of numstat) if (row.startsWith("-\t-\t")) problems.push(`${row.slice(4)}: binary files are not allowed`);
  for (let k = 0; k < fields.length; k += 2) {
    const status = fields[k];
    const path = fields[k + 1] ?? "";
    if (status !== "M" && status !== "A") {
      problems.push(`${path}: only added or modified files are allowed (git says ${status})`);
      continue;
    }
    if (!allow.test(path) || path.split("/").includes("..")) {
      problems.push(`${path}: outside the paths the fix agent may change`);
      continue;
    }
    const mode = safeGit(cwd, ["ls-files", "-s", "-z", "--", `:(literal)${path}`]).split(" ")[0];
    const before = status === "M" ? safeGit(cwd, ["ls-tree", "HEAD", "--", `:(literal)${path}`]).split(" ")[0] : "100644";
    if (mode !== "100644" || before !== "100644") {
      problems.push(`${path}: only regular files are allowed`);
      continue;
    }
    if (pinsOnly && pinsOnly.test(path)) {
      const { added, removed } = stagedLines(cwd, path);
      const names = (lines) => lines.map((l) => PIN_LINE.exec(l)).map((m) => (m ? m[1] : null));
      const [gone, came] = [names(removed), names(added)];
      // Every changed line is a pin line, and each pin that lost a value gained one: values move, nothing else.
      if (![...gone, ...came].every((n) => n !== null) || gone.length !== came.length) {
        problems.push(`${path}: only pin values may change here`);
      }
    } else if (jsonPins && jsonPins.test(path)) {
      try {
        const oldDoc = status === "M" ? JSON.parse(safeGit(cwd, ["show", `HEAD:${path}`])) : undefined;
        const newDoc = JSON.parse(safeGit(cwd, ["show", `:${path}`]));
        if (JSON.stringify(withoutPins(oldDoc)) !== JSON.stringify(withoutPins(newDoc))) problems.push(`${path}: only pin values may change here`);
      } catch (error) {
        // A document that no longer parses is a refusal, not a crash.
        if (!(error instanceof SyntaxError)) throw error;
        problems.push(`${path}: is not valid JSON`);
      }
    }
  }
  return [...new Set(problems)];
}

const SECRET = /\b(sk-ant-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/;

/**
 * The fix agent's pull request text, made safe to post: no HTML comments
 * (which hide text from the rendered view), no closing keywords or @mentions
 * that act on their own (put in code spans), at most 20,000 characters.
 * Throws on anything shaped like a secret.
 */
export function cleanPrBody(text) {
  if (SECRET.test(text)) throw new Error("the description holds something shaped like a secret");
  let body = text
    // Characters a reader cannot see: Unicode tags, zero-width and direction controls, byte order marks.
    .replace(/[\u{E0000}-\u{E007F}\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu, "")
    .replace(/<!--[\s\S]*?(-->|$)/g, "")
    // Link reference definitions render as nothing, so text in them is hidden.
    .replace(/^\s{0,3}\[[^\]]+\]:.*$/gm, "")
    // No raw HTML at all: `<` shows as text.
    .replace(/</g, "&lt;");
  // "Fixes #12", "**closes** owner/repo#3", "resolves: https://github.com/o/r/issues/4": GitHub acts on these when the pull request merges.
  body = body.replace(/\b(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b(?=[\s:*_]*(?:[\w.-]+\/[\w.-]+)?#\d|[\s:*_]*https?:\/\/\S+\/(?:issues|pull)\/\d)/gi, "see");
  // A word joiner after @ keeps a handle readable and stops the mention.
  body = body.replace(/@(?=[A-Za-z0-9-])/g, "@\u2060");
  return body.length > 20_000 ? `${body.slice(0, 20_000)}\n\n[cut at 20,000 characters]\n` : body;
}

/**
 * Set each pin that `context` found moved to its live value, in the spec's
 * own file. The values were shape-checked when `context` read them; this
 * checks them again, replaces each pin line exactly once, then reads the
 * whole registry back to confirm only those pins moved.
 */
export function applyPins(dir, entryPath) {
  const registry = loadRegistry(dir);
  const entry = JSON.parse(readFileSync(entryPath, "utf8"));
  if (!SPEC_ID.test(entry.id ?? "")) throw new Error("unexpected spec id");
  const standard = registry.standards.find((s) => s.id === entry.id);
  if (!standard) throw new Error(`no spec ${entry.id} in ${dir}`);
  const pinsOf = (reg) => new Map(reg.standards.flatMap((st) => st.sources.map((src) => [`${st.id} ${sourceKey(src)}`, src.pin])));
  const expected = pinsOf(registry);
  for (const move of entry.moved) {
    const src = standard.sources.find((s) => sourceKey(s) === move.key);
    if (!src) throw new Error(`${entry.id} has no source ${move.key}`);
    if (src.pin !== move.pin) throw new Error(`${move.key}: the pin is no longer ${move.pin}`);
    if (!pinShapeOk(src.kind, move.live)) throw new Error(`${move.key}: the live value is not a valid ${src.kind} state`);
    if (src.kind === "git-dated-dirs") {
      // A newer revision is adopted by a person: the reviewed version, the watched folder and the skill move with it.
      console.log(`${move.key}: a newer revision ${move.live} exists; left for a person to adopt`);
      continue;
    }
    const text = readFileSync(standard.file, "utf8");
    const from = `pin: "${move.pin}"`;
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${standard.file}: expected the pin exactly once, found it ${count} times`);
    writeFileSync(standard.file, text.replace(from, () => `pin: "${move.live}"`));
    expected.set(`${standard.id} ${move.key}`, move.live);
    console.log(`${move.key}: ${short(move.pin)} -> ${short(move.live)}`);
  }
  const after = pinsOf(loadRegistry(dir));
  for (const [key, pin] of after) if (pin !== expected.get(key)) throw new Error(`${key}: the pin changed unexpectedly`);
  if (after.size !== expected.size) throw new Error("the set of sources changed");
}

// ---------------------------------------------------------------- cli

function option(args, name) {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

async function readPage(target) {
  if (/^https:\/\//.test(target)) return (await fetchText(target)).body;
  return readFileSync(target, "utf8");
}

async function main(argv) {
  const [command, ...args] = argv;
  switch (command) {
    case "check":
      return check(args[0], { only: option(args, "--only"), out: option(args, "--out"), dryRun: args.includes("--dry-run") });
    case "issues":
      return issues(args[0], {
        repo: option(args, "--repo"),
        label: option(args, "--label"),
        statusIn: option(args, "--status-in"),
        statusOut: option(args, "--status-out"),
        openedOut: option(args, "--opened-out"),
        escalateAfter: option(args, "--escalate-after"),
        escalateLabel: option(args, "--escalate-label"),
        escalateMention: option(args, "--escalate-mention"),
      });
    case "context":
      return context(args[0], { titleFile: option(args, "--title-file"), out: option(args, "--out") });
    case "vet-staged": {
      const re = (name) => (option(args, name) ? new RegExp(option(args, name)) : undefined);
      const allow = re("--allow");
      if (!allow) throw new Error("--allow <regex> is required");
      const problems = vetStaged(process.cwd(), { allow, pinsOnly: re("--pins-only"), jsonPins: re("--json-pins") });
      for (const p of problems) console.log(`- ${p}`);
      if (problems.length) process.exit(1);
      console.log("the staged change only touches allowed paths");
      return;
    }
    case "apply-pins":
      return applyPins(args[0], option(args, "--entry"));
    case "pr-body":
      writeFileSync(option(args, "--out") ?? "pr-body.md", cleanPrBody(readFileSync(args[0], "utf8")));
      return;
    case "health": {
      const failed = option(args, "--failed");
      if (failed !== "true" && failed !== "false") throw new Error("--failed must be true or false");
      const report = healthReport({ failed: failed === "true", runUrl: option(args, "--run-url") });
      writeFileSync(option(args, "--out") ?? "health.json", `${JSON.stringify(report, null, 2)}\n`);
      console.log(failed === "true" ? "recorded a failed run" : "recorded a good run");
      return;
    }
    case "page-text":
    case "page-digest": {
      const html = await readPage(args[0]);
      const text = normalizePage(html);
      // No <article> and no <main> means the page shape changed; fail loudly instead of pinning an empty digest.
      if (!text) {
        console.error(`no <article> or <main> content in ${args[0]}`);
        process.exit(1);
      }
      console.log(command === "page-text" ? text : pageDigest(html));
      return;
    }
    default:
      console.error("usage: spec-drift.mjs check|issues|health|context|apply-pins|vet-staged|pr-body|page-text|page-digest ... (see the comment at the top of this file)");
      process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

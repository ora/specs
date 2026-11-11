/*
 * Source kinds: where a spec's text lives upstream, the shape its state has,
 * and the links built from a state. One definition, used by the watcher
 * (scripts/spec-drift.mjs), the build (scripts/build.mjs) and the published
 * package (copied verbatim to dist/kinds.js), so a consumer that stores live
 * values checks them with the same shapes the watcher used.
 *
 *   git-path        { repo, path }         Git object SHA of <path> on the default branch (a file's blob or a folder's tree)
 *   git-head        { repo }               the default branch's head commit (any change anywhere in the repository)
 *   git-dated-dirs  { repo, path }         the newest YYYY-MM-DD folder under <path> (a newer dated revision)
 *   git-latest-tag  { repo, match }        the newest tag matching the anchored regular expression <match>, by version order
 *   git-latest-file { repo, path, match }  the newest file name directly under <path> matching <match>, by version order
 *   ietf-draft      { name }               the draft's latest revision ("01"), plus its state when it is no longer Active ("01 Expired")
 *   rfc             { number }             the RFC's status, plus the RFCs that update or obsolete it ("PROPOSED STANDARD; updated by RFC9999")
 *   page            { url }                SHA-256 of the page's normalized <article> (or <main>) text
 *   json-field      { url, field }         a string field of a JSON document, by dotted path
 */

export const KINDS = ["git-path", "git-head", "git-dated-dirs", "git-latest-tag", "git-latest-file", "ietf-draft", "rfc", "page", "json-field"];

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA = /^[0-9a-f]{40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// A tag or file name that may appear in an issue or a link: Git allows backticks and brackets in ref names, so the source's own `match` is not enough.
const NAME = /^[A-Za-z0-9][A-Za-z0-9._+/-]{0,99}$/;
const IETF_STATE = /^\d{2}(?: [A-Za-z][A-Za-z ()-]{0,40})?$/;
const RFC_STATE = /^[A-Z][A-Z ]{1,40}(?:; (?:updated|obsoleted) by RFC\d{1,5}(?:,RFC\d{1,5}){0,20}){0,2}$/;
const DIGEST = /^[0-9a-f]{64}$/;
// A json-field value that may appear in an issue: a label such as "pap-0.2@2026-10-19", nothing that is markup.
const LABEL = /^[A-Za-z0-9._@:+/-]{1,100}$/;
const FIELD_PATH = /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/;

/** Where a source lives, as one comparable string: the same key in two places means the same thing is watched. */
export function sourceKey(source) {
  switch (source.kind) {
    case "git-path":
    case "git-dated-dirs":
      return `${source.kind} ${source.repo} ${source.path}`;
    case "git-head":
      return `${source.kind} ${source.repo}`;
    case "git-latest-tag":
      return `${source.kind} ${source.repo} ${source.match}`;
    case "git-latest-file":
      return `${source.kind} ${source.repo} ${source.path} ${source.match}`;
    case "ietf-draft":
      return `${source.kind} ${source.name}`;
    case "rfc":
      return `${source.kind} ${source.number}`;
    case "page":
      return `${source.kind} ${source.url}`;
    case "json-field":
      return `${source.kind} ${source.url} ${source.field}`;
    default:
      return `${source.kind}`;
  }
}

/** The shape a state of this kind must have. A pin that fails it is a broken spec file; a live value that fails it is never stored. */
export function valueShapeOk(kind, value) {
  if (typeof value !== "string") return false;
  switch (kind) {
    case "git-path":
    case "git-head":
      return SHA.test(value);
    case "git-dated-dirs":
      return DATE.test(value);
    case "ietf-draft":
      return IETF_STATE.test(value);
    case "rfc":
      return RFC_STATE.test(value);
    case "page":
      return DIGEST.test(value);
    case "git-latest-tag":
    case "git-latest-file":
      return NAME.test(value);
    case "json-field":
      return LABEL.test(value);
    default:
      return false;
  }
}

/**
 * A live value fit to store for this source: its kind's shape, and for a tag
 * or file name also the source's own pattern and no `..`, since the name lands
 * in GitHub release, compare and tree paths.
 */
export function liveValueOk(source, value) {
  if (!valueShapeOk(source.kind, value)) return false;
  if (source.kind !== "git-latest-tag" && source.kind !== "git-latest-file") return true;
  if (value.includes("..") || typeof source.match !== "string") return false;
  return new RegExp(source.match).test(value);
}

/** Problems with one source definition (empty when valid). Pins are checked separately with `valueShapeOk`. */
export function validateSource(src) {
  const problems = [];
  if (!KINDS.includes(src.kind)) return [`unknown kind (use one of ${KINDS.join(", ")})`];
  if (src.kind.startsWith("git-") && !REPO.test(src.repo ?? "")) problems.push("repo must be owner/name");
  if (["git-path", "git-dated-dirs", "git-latest-file"].includes(src.kind) && !/^[^-\s][^\s]*$/.test(src.path ?? "")) problems.push("needs a path");
  if (src.kind === "git-latest-tag" || src.kind === "git-latest-file") {
    try {
      new RegExp(src.match);
    } catch {
      problems.push("match must be a regular expression");
    }
    if (typeof src.match !== "string" || !src.match.startsWith("^") || !src.match.endsWith("$")) problems.push("match must be anchored with ^ and $");
  }
  if (src.kind === "ietf-draft" && !/^draft-[a-z0-9-]+$/.test(src.name ?? "")) problems.push("name must be a draft name such as draft-ietf-x-y");
  if (src.kind === "rfc" && !(Number.isInteger(src.number) && src.number > 0 && src.number < 100000)) problems.push("number must be an RFC number");
  if ((src.kind === "page" || src.kind === "json-field") && !/^https:\/\//.test(src.url ?? "")) problems.push("url must be https");
  if (src.kind === "json-field" && !FIELD_PATH.test(src.field ?? "")) problems.push("field must be a dotted path such as profile or meta.version");
  if (src.commit !== undefined && (src.kind !== "git-path" || !SHA.test(src.commit))) problems.push("commit is a full commit SHA, on git-path sources only");
  if (typeof src.pin !== "string" || !src.pin) problems.push("pin must be a non-empty string");
  else if (!valueShapeOk(src.kind, src.pin)) problems.push(`pin "${src.pin}" is not a valid ${src.kind} state`);
  return problems;
}

/**
 * The name and address of one state of a source, for the kinds whose state IS
 * a named revision. Null for a Git blob or tree, a page digest or a JSON
 * field, which name no version. `value` must already have its kind's shape.
 * `revisionUrl` is the spec's own template for a revision's address
 * ("https://example.org/spec/{revision}"), for specs that publish revisions
 * somewhere other than their repository folder.
 */
export function revisionOf(source, value, revisionUrl) {
  switch (source.kind) {
    case "git-dated-dirs":
      return { label: value, url: revisionUrl ? revisionUrl.replaceAll("{revision}", value) : `https://github.com/${source.repo}/tree/HEAD/${source.path}/${value}` };
    case "git-latest-tag":
      return { label: value, url: `https://github.com/${source.repo}/releases/tag/${value}` };
    case "git-latest-file":
      return { label: value, url: `https://github.com/${source.repo}/blob/HEAD/${source.path}/${value}` };
    case "ietf-draft": {
      const rev = value.slice(0, 2);
      const state = value.slice(3);
      return { label: `${source.name}-${rev}${state ? ` (${state})` : ""}`, url: `https://datatracker.ietf.org/doc/${source.name}/${rev}/` };
    }
    case "rfc":
      return { label: `RFC ${source.number} (${value.toLowerCase()})`, url: `https://www.rfc-editor.org/rfc/rfc${source.number}` };
    case "git-head":
      return { label: `commit ${value.slice(0, 7)}`, url: `https://github.com/${source.repo}/tree/${value}` };
    default:
      return null;
  }
}

/** Where to read what changed between a pin and a live value. `fallbackUrl` is the living spec. */
export function changeUrl(source, pin, live, { revisionUrl, fallbackUrl } = {}) {
  switch (source.kind) {
    case "git-head":
    case "git-latest-tag":
      return `https://github.com/${source.repo}/compare/${pin}...${live}`;
    case "ietf-draft": {
      const pinRev = pin.slice(0, 2);
      const liveRev = live.slice(0, 2);
      if (pinRev !== liveRev) return `https://author-tools.ietf.org/iddiff?url1=${source.name}-${pinRev}&url2=${source.name}-${liveRev}`;
      return `https://datatracker.ietf.org/doc/${source.name}/${liveRev}/`;
    }
    case "git-path":
      return `https://github.com/${source.repo}/commits/HEAD/${source.path}`;
    case "git-latest-file":
      return `https://github.com/${source.repo}/commits/HEAD/${source.path}`;
    case "git-dated-dirs":
    case "rfc":
      return revisionOf(source, live, revisionUrl)?.url ?? fallbackUrl;
    case "page":
    case "json-field":
      return source.url ?? fallbackUrl;
    default:
      return fallbackUrl;
  }
}

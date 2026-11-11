#!/usr/bin/env node
/*
 * Validate every specs/<id>/spec.yaml and build the published package:
 *
 *   dist/specs.json   the registry as data (issue text left out: it is the watcher's)
 *   dist/index.js     the same data as an ES module, plus helpers
 *   dist/index.d.ts   types with every value as a literal, so `spec("pap").versions`
 *                     narrows to the real version ids
 *   dist/kinds.js     source kinds, state shapes and link builders (src/kinds.mjs, verbatim)
 *   dist/schema.json  the JSON Schema a spec file must satisfy
 *
 *   node scripts/build.mjs           validate and write dist/
 *   node scripts/build.mjs --check   validate only (exit 1 on any problem)
 *
 * Validation is the schema plus what a schema cannot say: the folder is named
 * after the id, at most one version is current, the reviewed version is one
 * of the versions, a reviewed revision folder agrees with the dated-folder
 * pin, every pin has its kind's shape and sits on its own `pin: "..."` line
 * (so the fix workflow can move it without touching anything else), the
 * named skill exists, and no file holds an em dash.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { loadRegistry, validateRegistry } from "./spec-drift.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPECS_DIR = join(ROOT, "specs");
const SCHEMA_PATH = join(ROOT, "schema", "spec.schema.json");
const DIST = join(ROOT, "dist");
const PLACEHOLDER = /\{([a-z0-9]+)\}/g;
const LABEL_PLACEHOLDERS = new Set(["version", "read", "pin", "pin7", "commit"]);
const EM_DASH = "—";

/** Fill {version} {read} {pin} {pin7} {commit} from the reviewed state and its first source. */
function resolveTemplate(template, reviewed, where, problems) {
  if (template === null || template === undefined) return template ?? null;
  const first = reviewed?.sources?.[0];
  const values = {
    version: reviewed?.version ?? undefined,
    read: reviewed?.read,
    pin: first?.pin,
    pin7: first?.pin?.slice(0, 7),
    commit: first?.commit,
  };
  return template.replace(PLACEHOLDER, (match, name) => {
    if (!LABEL_PLACEHOLDERS.has(name)) {
      problems.push(`${where}: unknown placeholder ${match}`);
      return match;
    }
    if (values[name] === undefined) {
      problems.push(`${where}: ${match} has no value here`);
      return match;
    }
    return values[name];
  });
}

/** The published shape of one spec: data only, templates filled, version lists by status. */
export function publishedEntry(spec, problems = []) {
  const ids = (status) => spec.versions.filter((v) => v.status === status).map((v) => v.id);
  const reviewed = spec.reviewed
    ? {
        version: spec.reviewed.version,
        read: spec.reviewed.read,
        skill: spec.reviewed.skill,
        label: resolveTemplate(spec.reviewed.label ?? null, spec.reviewed, `${spec.id} reviewed.label`, problems),
        url: resolveTemplate(spec.reviewed.url ?? null, spec.reviewed, `${spec.id} reviewed.url`, problems),
        sources: spec.reviewed.sources,
      }
    : null;
  return {
    id: spec.id,
    name: spec.name,
    homepage: spec.homepage,
    spec_url: resolveTemplate(spec.spec_url, spec.reviewed, `${spec.id} spec_url`, problems),
    revision_url: spec.revision_url ?? null,
    versions: spec.versions,
    current: ids("current")[0] ?? null,
    preview: ids("preview"),
    supported: ids("supported"),
    deprecated: ids("deprecated"),
    reviewed,
    sources: spec.reviewed ? spec.reviewed.sources : spec.watch,
    notes: spec.notes ?? {},
  };
}

/** Every problem with the registry, as one list (empty when it is valid). */
export function validate(registry, { root = ROOT, schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) } = {}) {
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, allowUnionTypes: true });
  const check = ajv.compile(schema);
  const problems = [...validateRegistry(registry)];
  for (const standard of registry.standards) {
    const spec = standard.spec;
    const where = `specs/${standard.folder}/spec.yaml`;
    if (!check(spec)) {
      for (const e of check.errors ?? []) problems.push(`${where}: ${e.instancePath || "(root)"} ${e.message}`);
      continue;
    }
    const text = readFileSync(standard.file, "utf8");
    if (text.includes(EM_DASH)) problems.push(`${where}: holds an em dash; use " - "`);
    const versionIds = spec.versions.map((v) => v.id);
    if (new Set(versionIds).size !== versionIds.length) problems.push(`${where}: a version id is listed twice`);
    if (spec.versions.filter((v) => v.status === "current").length > 1) problems.push(`${where}: more than one current version`);
    const reviewed = spec.reviewed;
    if (reviewed) {
      if (reviewed.version !== null && !versionIds.includes(reviewed.version)) problems.push(`${where}: reviewed.version "${reviewed.version}" is not in versions`);
      if (reviewed.version === null && versionIds.length > 0) problems.push(`${where}: reviewed.version is null but the spec lists versions`);
      if (reviewed.skill && !existsSync(join(root, "skills", reviewed.skill, "SKILL.md"))) problems.push(`${where}: skill ${reviewed.skill} has no skills/${reviewed.skill}/SKILL.md`);
      if (!reviewed.label && reviewed.url !== undefined) problems.push(`${where}: reviewed.url needs a reviewed.label`);
    }
    const sources = standard.sources;
    for (const dated of sources.filter((s) => s.kind === "git-dated-dirs")) {
      if (reviewed?.version && dated.pin !== reviewed.version) problems.push(`${where}: the dated folder pin "${dated.pin}" is not reviewed.version "${reviewed.version}"`);
      for (const tree of sources.filter((s) => s.kind === "git-path" && s.repo === dated.repo && s.path.startsWith(`${dated.path}/`))) {
        if (tree.path !== `${dated.path}/${dated.pin}`) problems.push(`${where}: watches ${tree.path}, but the reviewed revision folder is ${dated.path}/${dated.pin}`);
      }
    }
    for (const src of sources) {
      const lines = text.split("\n").filter((line) => /^\s+pin: /.test(line) && line.trim() === `pin: ${JSON.stringify(src.pin)}`);
      if (lines.length !== 1) problems.push(`${where}: pin "${src.pin}" must sit on exactly one indented \`pin: "..."\` line (found ${lines.length})`);
    }
    publishedEntry(spec, problems);
  }
  return problems;
}

function typeOf(value) {
  // A JSON value is also a TypeScript type literal: strings, numbers, booleans and null narrow, arrays become tuples.
  return JSON.stringify(value);
}

const INDEX_DTS_HEAD = `/* Generated by scripts/build.mjs from specs/<id>/spec.yaml. Do not edit. */
export * from "./kinds.js";

type DeepReadonly<T> = T extends readonly unknown[] ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;

export type VersionStatus = "current" | "preview" | "supported" | "deprecated";
`;

const INDEX_DTS_TAIL = `
export type Specs = DeepReadonly<typeof SPECS_TYPE>;
export type SpecId = keyof Specs;
export type Spec<I extends SpecId = SpecId> = Specs[I];
export type VersionId<I extends SpecId, S extends VersionStatus = VersionStatus> = Extract<Specs[I]["versions"][number], { readonly status: S }>["id"];
export type SpecSource = Spec["sources"][number];

/** The registry release this package was built from. */
export declare const REGISTRY_VERSION: string;
/** Every spec, by id. */
export declare const SPECS: Specs;
/** Every spec id, in registry order. */
export declare const SPEC_IDS: readonly SpecId[];
/** One spec by id; throws on an id the registry does not have. */
export declare function spec<I extends SpecId>(id: I): Specs[I];
/** The ids of a spec's versions with any of these statuses, newest first (registry order). */
export declare function versionIds<I extends SpecId, S extends VersionStatus>(id: I, statuses: readonly S[]): VersionId<I, S>[];
/**
 * The pin of the one reviewed source of this kind (and, when given, this
 * path). Throws when the spec is not reviewed or no single source matches,
 * so a renamed source fails at import time, not silently.
 */
export declare function reviewedPin(id: SpecId, kind: SpecSource["kind"], path?: string): string;
/** Whether two releases reviewed a spec identically: same version, read date and pins. */
export declare function sameReview(a: { readonly reviewed: unknown } | undefined | null, b: { readonly reviewed: unknown } | undefined | null): boolean;
`;

const INDEX_JS_TAIL = `
export const SPECS = Object.freeze(Object.fromEntries(DATA.specs.map((s) => [s.id, s])));
export const SPEC_IDS = Object.freeze(DATA.specs.map((s) => s.id));
export const REGISTRY_VERSION = DATA.version;

export function spec(id) {
  const found = Object.hasOwn(SPECS, id) ? SPECS[id] : undefined;
  if (!found) throw new Error(\`@ora-ai/specs has no spec "\${id}"\`);
  return found;
}

export function versionIds(id, statuses) {
  return spec(id).versions.filter((v) => statuses.includes(v.status)).map((v) => v.id);
}

export function reviewedPin(id, kind, path) {
  const s = spec(id);
  if (!s.reviewed) throw new Error(\`\${id} has not been reviewed\`);
  const matches = s.reviewed.sources.filter((src) => src.kind === kind && (path === undefined || src.path === path));
  if (matches.length !== 1) throw new Error(\`\${id} has \${matches.length} reviewed \${kind} sources\${path ? \` at \${path}\` : ""}, expected one\`);
  return matches[0].pin;
}

function reviewKey(entry) {
  const r = entry?.reviewed;
  if (!r) return "unreviewed";
  return JSON.stringify([r.version ?? null, r.read, (r.sources ?? []).map((s) => [s.kind, s.repo ?? s.url ?? s.name ?? s.number ?? null, s.path ?? s.match ?? s.field ?? null, s.pin])]);
}

export function sameReview(a, b) {
  if (!a || !b) return false;
  return reviewKey(a) === reviewKey(b);
}
`;

const KINDS_DTS = `/* Generated by scripts/build.mjs from src/kinds.mjs. Do not edit. */
export type SourceKind = "git-path" | "git-head" | "git-dated-dirs" | "git-latest-tag" | "git-latest-file" | "ietf-draft" | "rfc" | "page" | "json-field";
export interface SourceLike {
  readonly kind: string;
  readonly repo?: string;
  readonly path?: string;
  readonly match?: string;
  readonly name?: string;
  readonly number?: number;
  readonly url?: string;
  readonly field?: string;
  readonly commit?: string;
  readonly pin?: string;
}
export interface Revision {
  readonly label: string;
  readonly url: string;
}
export declare const KINDS: readonly SourceKind[];
/** Where a source lives, as one comparable string. The watcher's report rows carry it as \`key\`. */
export declare function sourceKey(source: SourceLike): string;
/** Whether a value has the shape a state of this kind must have. */
export declare function valueShapeOk(kind: string, value: unknown): value is string;
/** A live value fit to store for this source: its kind's shape, and for a tag or file name the source's own pattern and no "..". */
export declare function liveValueOk(source: SourceLike, value: unknown): value is string;
/** Problems with one source definition (empty when valid). */
export declare function validateSource(source: SourceLike): string[];
/** The name and address of a state, for kinds whose state is a named revision; null otherwise. */
export declare function revisionOf(source: SourceLike, value: string, revisionUrl?: string | null): Revision | null;
/** Where to read what changed between a pin and a live value. */
export declare function changeUrl(source: SourceLike, pin: string, live: string, options?: { readonly revisionUrl?: string | null; readonly fallbackUrl?: string }): string;
`;

function build() {
  const registry = loadRegistry(SPECS_DIR);
  const problems = validate(registry);
  if (problems.length) {
    console.error(`The registry is not valid:\n- ${problems.join("\n- ")}`);
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const specs = registry.standards.map((s) => publishedEntry(s.spec));
  const data = { version: pkg.version, schema: 1, specs };
  if (process.argv.includes("--check")) {
    console.log(`${specs.length} specs are valid`);
    return;
  }
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(DIST, "specs.json"), `${JSON.stringify(data, null, 2)}\n`);
  copyFileSync(SCHEMA_PATH, join(DIST, "schema.json"));
  copyFileSync(join(ROOT, "src", "kinds.mjs"), join(DIST, "kinds.js"));
  writeFileSync(join(DIST, "kinds.d.ts"), KINDS_DTS);
  writeFileSync(
    join(DIST, "index.js"),
    `/* Generated by scripts/build.mjs from specs/<id>/spec.yaml. Do not edit. */\nexport * from "./kinds.js";\n\nconst DATA = ${JSON.stringify(data, null, 2)};\n${INDEX_JS_TAIL}`,
  );
  const typeTable = `{ ${specs.map((s) => `${JSON.stringify(s.id)}: ${typeOf(s)}`).join(", ")} }`;
  writeFileSync(join(DIST, "index.d.ts"), `${INDEX_DTS_HEAD}\ndeclare const SPECS_TYPE: ${typeTable};\n${INDEX_DTS_TAIL}`);
  console.log(`built ${specs.length} specs into dist/ (registry ${pkg.version})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) build();

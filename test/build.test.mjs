import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { publishedEntry, validate } from "../scripts/build.mjs";
import { loadRegistry } from "../scripts/spec-drift.mjs";
import { liveValueOk, revisionOf, sourceKey, valueShapeOk } from "../src/kinds.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "../..");

const BASE = {
  id: "demo",
  name: "Demo",
  homepage: "https://example.org",
  spec_url: "https://example.org/spec",
  versions: [{ id: "2026-01-01", status: "current" }],
  reviewed: {
    version: "2026-01-01",
    read: "2026-01-02",
    skill: null,
    sources: [
      { kind: "git-dated-dirs", repo: "o/r", path: "spec", pin: "2026-01-01" },
      { kind: "git-path", repo: "o/r", path: "spec/2026-01-01", pin: "a".repeat(40) },
    ],
  },
};

/** Problems with a one-spec registry holding `spec`, written as the real files are (one indented pin line per source). */
function problemsFor(spec, { folder = spec.id, raw } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "specs-build-"));
  try {
    mkdirSync(join(dir, "specs", folder), { recursive: true });
    const lines = raw ?? toYaml(spec);
    writeFileSync(join(dir, "specs", folder, "spec.yaml"), lines);
    return validate(loadRegistry(join(dir, "specs")), { root: dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function toYaml(spec) {
  // JSON is YAML; pins go on their own lines so the pin-line rule can see them.
  const { reviewed, watch, ...rest } = spec;
  const out = Object.entries(rest).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  const sources = (list) => list.flatMap((s) => Object.entries(s).map(([k, v], i) => `${i === 0 ? "    - " : "      "}${k}: ${JSON.stringify(v)}`));
  if (reviewed === null) {
    out.push("reviewed: null");
    if (watch) out.push("watch:", ...sources(watch).map((l) => l.slice(2)));
  } else if (reviewed) {
    const { sources: list, ...r } = reviewed;
    out.push("reviewed:", ...Object.entries(r).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`), "  sources:", ...sources(list));
  }
  return `${out.join("\n")}\n`;
}

describe("validate", () => {
  it("accepts the registry as committed", () => {
    assert.deepEqual(validate(loadRegistry(join(ROOT, "specs"))), []);
  });

  it("accepts a well-formed entry", () => {
    assert.deepEqual(problemsFor(BASE), []);
  });

  it("refuses unknown fields anywhere (the schema is strict)", () => {
    assert.ok(problemsFor({ ...BASE, colour: "red" }).some((p) => p.includes("must NOT have additional properties")));
    const extraSource = structuredClone(BASE);
    extraSource.reviewed.sources[1].note = "x";
    assert.ok(problemsFor(extraSource).length > 0);
  });

  it("refuses a reviewed version missing from versions, two current versions, and a folder named for another id", () => {
    assert.ok(problemsFor({ ...BASE, reviewed: { ...BASE.reviewed, version: "2025-01-01" } }).some((p) => p.includes("is not in versions")));
    assert.ok(problemsFor({ ...BASE, versions: [{ id: "a", status: "current" }, { id: "2026-01-01", status: "current" }] }).some((p) => p.includes("more than one current")));
    assert.ok(problemsFor(BASE, { folder: "other" }).some((p) => p.includes("must be named after its id")));
  });

  it("refuses a watched revision folder that disagrees with the dated folder pin", () => {
    const moved = structuredClone(BASE);
    moved.reviewed.sources[1].path = "spec/2025-06-18";
    assert.ok(problemsFor(moved).some((p) => p.includes("the reviewed revision folder is spec/2026-01-01")));
  });

  it("refuses a pin of the wrong shape, a pin the fix workflow could not move by its line, and an em dash", () => {
    const badPin = structuredClone(BASE);
    badPin.reviewed.sources[1].pin = "main";
    assert.ok(problemsFor(badPin).some((p) => p.includes("is not a valid git-path state")));
    // Valid YAML for the same data, but the pin shares a line with the rest of its source.
    const lines = toYaml(BASE).split("\n");
    const start = lines.findIndex((l) => l === '    - kind: "git-path"');
    lines.splice(start, 4, `    - { kind: "git-path", repo: "o/r", path: "spec/2026-01-01", pin: "${"a".repeat(40)}" }`);
    assert.ok(problemsFor(BASE, { raw: lines.join("\n") }).some((p) => p.includes("must sit on exactly one indented")));
    assert.ok(problemsFor({ ...BASE, name: "Demo \u2014 draft" }).some((p) => p.includes("em dash")));
  });

  it("requires watched sources for an unreviewed spec, and refuses them on a reviewed one", () => {
    const watched = { ...BASE, versions: [], reviewed: null, watch: [{ kind: "rfc", number: 9309, pin: "PROPOSED STANDARD" }] };
    assert.deepEqual(problemsFor(watched), []);
    assert.ok(problemsFor({ ...watched, watch: undefined }).length > 0);
  });
});

describe("publishedEntry", () => {
  it("fills label and URL templates from the reviewed state and its first source", () => {
    const spec = {
      ...BASE,
      versions: [{ id: "0.6.0", status: "current" }],
      reviewed: { version: "0.6.0", read: "2026-08-31", skill: null, label: "v{version} + commits to {pin7} (read {read})", url: "https://github.com/o/r/blob/{pin}/A.md", sources: [{ kind: "git-head", repo: "o/r", pin: "b53c9edfbfeea679b617727ebca9ba436bade794" }] },
    };
    const problems = [];
    const entry = publishedEntry(spec, problems);
    assert.deepEqual(problems, []);
    assert.equal(entry.reviewed.label, "v0.6.0 + commits to b53c9ed (read 2026-08-31)");
    assert.equal(entry.reviewed.url, "https://github.com/o/r/blob/b53c9edfbfeea679b617727ebca9ba436bade794/A.md");
    assert.equal(entry.current, "0.6.0");
  });
});

describe("kinds", () => {
  it("keys sources the way consumers match report rows", () => {
    assert.equal(sourceKey({ kind: "git-path", repo: "o/r", path: "x" }), "git-path o/r x");
    assert.equal(sourceKey({ kind: "rfc", number: 9309 }), "rfc 9309");
    assert.equal(sourceKey({ kind: "git-latest-file", repo: "o/r", path: "versions", match: "^x$" }), "git-latest-file o/r versions ^x$");
  });

  it("stores a live tag only when it matches the source's own pattern and holds no ..", () => {
    const src = { kind: "git-latest-tag", match: "^v\\d+$" };
    assert.equal(liveValueOk(src, "v12"), true);
    assert.equal(liveValueOk(src, "release-1"), false);
    assert.equal(liveValueOk({ kind: "git-latest-tag", match: "^.+$" }, "v1/../x"), false);
    assert.equal(valueShapeOk("rfc", "PROPOSED STANDARD; updated by RFC1,RFC2"), true);
    assert.equal(valueShapeOk("rfc", "proposed <b>"), false);
  });

  it("names a dated revision by the spec's own revision address when it has one", () => {
    const src = { kind: "git-dated-dirs", repo: "o/r", path: "docs/specification" };
    assert.deepEqual(revisionOf(src, "2026-07-28", "https://example.org/specification/{revision}"), { label: "2026-07-28", url: "https://example.org/specification/2026-07-28" });
  });
});

describe("the built package", () => {
  before(() => execFileSync("node", [join(ROOT, "scripts/build.mjs")], { stdio: "pipe" }));

  it("exposes current, supported and reviewed state for every spec, and refuses an unknown id", async () => {
    const pkg = await import(join(ROOT, "dist/index.js"));
    assert.equal(pkg.spec("mcp").current, "2026-07-28");
    assert.deepEqual(pkg.versionIds("pap", ["current", "supported", "preview"]).reverse(), ["0.1", "0.2", "0.3", "0.4"]);
    assert.equal(pkg.reviewedPin("mcp", "git-path"), pkg.spec("mcp").reviewed.sources[1].pin);
    assert.throws(() => pkg.reviewedPin("pap", "page"), /expected one/);
    assert.throws(() => pkg.spec("nope"), /no spec/);
    assert.equal(pkg.spec("robots-txt").reviewed, null);
    assert.equal(pkg.sameReview(pkg.spec("mcp"), structuredClone(pkg.spec("mcp"))), true);
    assert.equal(pkg.sameReview(pkg.spec("mcp"), pkg.spec("mcp-apps")), false);
  });

  it("ships the same data as JSON, without the watcher's issue text", () => {
    const data = JSON.parse(readFileSync(join(ROOT, "dist/specs.json"), "utf8"));
    assert.equal(data.specs.length, loadRegistry(join(ROOT, "specs")).standards.length);
    assert.ok(data.specs.every((s) => !("issue" in s)));
  });
});

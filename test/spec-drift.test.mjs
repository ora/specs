import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyPins,
  cleanPrBody,
  healthReport,
  isOverdue,
  loadRegistry,
  normalizePage,
  rfcState,
  statusDocument,
  validateRegistry,
  vetStaged,
} from "../scripts/spec-drift.mjs";

const ROOT = join(fileURLToPath(import.meta.url), "../..");

describe("the registry as the watcher reads it", () => {
  it("is valid", () => {
    assert.deepEqual(validateRegistry(loadRegistry(join(ROOT, "specs"))), []);
  });

  it("watches every spec, reviewed or not", () => {
    const { standards } = loadRegistry(join(ROOT, "specs"));
    assert.ok(standards.length >= 21);
    for (const s of standards) assert.ok(s.sources.length > 0, `${s.id} has no sources`);
  });
});

describe("normalizePage", () => {
  it("hashes only the article text, so page chrome and markup changes are not drift", () => {
    const page = (nav, body) => `<html><nav>${nav}</nav><article><h1>Spec</h1>${body}<script>x()</script></article></html>`;
    assert.equal(normalizePage(page("v1", "<p>One &amp; two</p>")), "Spec One & two");
    assert.equal(normalizePage(page("v2", "<div>One &amp;  two</div>")), normalizePage(page("v1", "<p>One &amp; two</p>")));
    assert.equal(normalizePage("<html><body>no article</body></html>"), null);
  });

  it("stays linear on a page built to make the old regular expressions quadratic", () => {
    const crafted = `<article>${"<".repeat(200_000)}</article>${"<!--".repeat(100_000)}${"<article".repeat(50_000)}`;
    const started = Date.now();
    normalizePage(crafted);
    assert.ok(Date.now() - started < 2_000);
  });
});

describe("rfcState", () => {
  it("is the status alone for an RFC nothing has updated", () => {
    assert.equal(rfcState({ status: "PROPOSED STANDARD", updated_by: [], obsoleted_by: [] }, 9309), "PROPOSED STANDARD");
  });

  it("names the RFCs that update or obsolete it, sorted, so a new one is drift", () => {
    assert.equal(
      rfcState({ status: "Proposed Standard", updated_by: ["RFC9999", "RFC1234"], obsoleted_by: ["RFC0100"] }, 1),
      "PROPOSED STANDARD; updated by RFC1234,RFC9999; obsoleted by RFC100",
    );
  });

  it("refuses an answer that is not shaped like rfc-editor's", () => {
    assert.throws(() => rfcState({ status: "<b>x</b>" }, 1), /no status/);
    assert.throws(() => rfcState({ status: "HISTORIC", updated_by: ["[x](https://e.example)"] }, 1), /unexpected updated_by/);
  });
});

describe("statusDocument", () => {
  const entries = [
    { id: "a", state: "drift", sources: [{ key: "git-path o/r x", kind: "git-path", live: "a".repeat(40) }, { key: "page https://e", kind: "page", live: "not-a-digest" }] },
    { id: "b", state: "error", sources: [] },
    { id: "c", state: "clean", sources: [] },
  ];

  it("publishes shape-checked live values and keeps what the last run knew for an unreadable spec", () => {
    const doc = statusDocument(entries, { a: { changed: true, issue: "https://github.com/ora/specs/issues/1", since: "2026-11-11" }, c: { changed: false } }, { b: { changed: false, sources: {} } }, new Date("2026-11-11T00:00:00Z"));
    assert.equal(doc.checked_at, "2026-11-11T00:00:00.000Z");
    assert.deepEqual(doc.standards.a.sources, { "git-path o/r x": { kind: "git-path", live: "a".repeat(40) } });
    assert.equal(doc.standards.a.changed, true);
    assert.deepEqual(doc.standards.b, { changed: false, sources: {} });
    assert.deepEqual(doc.standards.c, { changed: false, sources: {} });
  });
});

describe("healthReport", () => {
  const runUrl = "https://github.com/ora/specs/actions/runs/123";

  it("opens the watch-failed issue on a failed run and closes it on a good one", () => {
    assert.equal(healthReport({ failed: true, runUrl }).entries[0].state, "drift");
    assert.match(healthReport({ failed: false, runUrl }).entries[0].close_comment, /123/);
  });

  it("refuses anything but a GitHub Actions run URL, since it lands in the issue", () => {
    assert.throws(() => healthReport({ failed: true, runUrl: "https://e.example/[x](y)" }), /run URL/);
  });
});

describe("isOverdue", () => {
  it("escalates on the run nearest the deadline, even one that starts minutes early", () => {
    assert.equal(isOverdue(13.99, 14), true);
    assert.equal(isOverdue(13.4, 14), false);
  });
});

/** A throwaway Git repository holding a one-spec registry, with git's location variables cleared (a hook from a worktree exports GIT_DIR). */
function withRepo(fn) {
  const saved = {};
  for (const name of execFileSync("git", ["rev-parse", "--local-env-vars"], { encoding: "utf8" }).split("\n").filter(Boolean)) {
    saved[name] = process.env[name];
    delete process.env[name];
  }
  const dir = mkdtempSync(join(tmpdir(), "specs-repo-"));
  const git = (...args) => execFileSync("git", ["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", ...args], { stdio: "pipe", encoding: "utf8" });
  try {
    mkdirSync(join(dir, "specs/demo"), { recursive: true });
    writeFileSync(
      join(dir, "specs/demo/spec.yaml"),
      [
        "id: demo",
        'name: "Demo"',
        "homepage: https://example.org",
        'spec_url: "https://example.org/spec"',
        "versions: []",
        "reviewed:",
        "  version: null",
        '  read: "2026-11-01"',
        "  skill: null",
        "  sources:",
        '    - kind: "git-path"',
        '      repo: "o/r"',
        '      path: "spec.md"',
        `      pin: "${"a".repeat(40)}"`,
        '    - kind: "rfc"',
        "      number: 9309",
        '      pin: "PROPOSED STANDARD"',
        "",
      ].join("\n"),
    );
    git("init", "-q");
    git("add", "-A");
    git("commit", "-qm", "base");
    return fn(dir, git);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const [name, value] of Object.entries(saved)) if (value !== undefined) process.env[name] = value;
  }
}

const VET = { allow: /^specs\/[a-z0-9-]+\/spec\.yaml$/, pinsOnly: /^specs\/[a-z0-9-]+\/spec\.yaml$/ };

describe("applyPins and vetStaged", () => {
  it("move exactly the pins that moved, and git confirms only pin lines changed", () => {
    withRepo((dir, git) => {
      const entry = join(dir, "entry.json");
      writeFileSync(
        entry,
        JSON.stringify({
          id: "demo",
          moved: [
            { key: "git-path o/r spec.md", kind: "git-path", pin: "a".repeat(40), live: "b".repeat(40) },
            { key: "rfc 9309", kind: "rfc", pin: "PROPOSED STANDARD", live: "PROPOSED STANDARD; updated by RFC9999" },
          ],
        }),
      );
      applyPins(join(dir, "specs"), entry);
      rmSync(entry);
      const text = readFileSync(join(dir, "specs/demo/spec.yaml"), "utf8");
      assert.match(text, new RegExp(`pin: "${"b".repeat(40)}"`));
      assert.match(text, /pin: "PROPOSED STANDARD; updated by RFC9999"/);
      git("add", "-A");
      assert.deepEqual(vetStaged(dir, VET), []);
    });
  });

  it("refuse a pin that is no longer the one the entry saw", () => {
    withRepo((dir) => {
      const entry = join(dir, "entry.json");
      writeFileSync(entry, JSON.stringify({ id: "demo", moved: [{ key: "git-path o/r spec.md", kind: "git-path", pin: "c".repeat(40), live: "b".repeat(40) }] }));
      assert.throws(() => applyPins(join(dir, "specs"), entry), /no longer/);
    });
  });

  it("refuse any change beyond pin values, a file outside the allowed paths, and an empty change", () => {
    withRepo((dir, git) => {
      const file = join(dir, "specs/demo/spec.yaml");
      writeFileSync(file, readFileSync(file, "utf8").replace("https://example.org/spec", "https://e.example/spec"));
      git("add", "-A");
      assert.deepEqual(vetStaged(dir, VET), ["specs/demo/spec.yaml: only pin values may change here"]);
    });
    withRepo((dir, git) => {
      appendFileSync(join(dir, "specs/demo/spec.yaml"), '    pin: "x"\n');
      mkdirSync(join(dir, "src x"));
      writeFileSync(join(dir, "src x/a.mjs"), 'fetch("https://e.example");\n');
      git("add", "-A");
      assert.deepEqual(vetStaged(dir, VET), ["specs/demo/spec.yaml: only pin values may change here", "src x/a.mjs: outside the paths the fix agent may change"]);
    });
    withRepo((dir) => assert.deepEqual(vetStaged(dir, VET), ["the agent changed nothing"]));
  });
});

describe("cleanPrBody", () => {
  it("defuses closing keywords, mentions and hidden comments", () => {
    assert.equal(
      cleanPrBody("Fixes #12 for @someone <!-- hidden -->ok\n[//]: # (hidden)\n**Closes** https://github.com/o/r/issues/4"),
      "see #12 for @⁠someone ok\n\n**see** https://github.com/o/r/issues/4",
    );
  });

  it("shows raw HTML as text and drops text a reader cannot see", () => {
    assert.equal(cleanPrBody('<div hidden>x</div>\n[ref]: https://e.example "t"\na​b\u{E0041}'), "&lt;div hidden>x&lt;/div>\n\nab");
  });

  it("refuses text shaped like a secret", () => {
    assert.throws(() => cleanPrBody("key sk-ant-abcdefghijklmnop"), /secret/);
  });
});

describe("the registry copy of the watcher", () => {
  it("is self-contained: it loads specs from any folder handed to it", () => {
    const dir = mkdtempSync(join(tmpdir(), "specs-copy-"));
    try {
      cpSync(join(ROOT, "specs"), join(dir, "specs"), { recursive: true });
      assert.equal(loadRegistry(join(dir, "specs")).standards.length, loadRegistry(join(ROOT, "specs")).standards.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

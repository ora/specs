# ora/specs

The registry of agent protocol specs Ora tracks, and the one place their versions are written down. For every spec it records three things, kept apart:

1. **Upstream facts**: the versions that exist, which one is current, and where the text lives. Observed by the daily watch, never reviewed.
2. **The reviewed state**: the version Ora has read and turned into rules, the day it was read, and the exact source pin (a Git blob or tree SHA, a commit, a release tag, an IETF draft revision, an RFC status, or a digest of a page's text). It moves only through a reviewed pull request.
3. Nothing about who uses which version. Each consumer pins a release of the package, and that stays the consumer's business.

| Spec | Reviewed | | Spec | Reviewed |
|---|---|---|---|---|
| WebMCP | yes | | UCP | yes |
| MCP | yes | | ACP | yes |
| MCP Apps | yes | | AP2 | yes |
| auth.md | yes | | MPP | yes |
| Personal Agent Protocol | yes | | MPP payment discovery | yes |
| NLWeb | yes | | x402 | yes |
| ARD | yes | | A2A | watched only |
| AI Catalog | yes | | llms.txt | watched only |
| Web Bot Auth | yes | | OpenAPI | watched only |
| Robots Exclusion Protocol (RFC 9309) | watched only | | API catalog (RFC 9727) | watched only |
| OAuth 2.0 Protected Resource Metadata (RFC 9728) | watched only | | | |

## Use it

```sh
npm install --save-exact @ora-ai/specs
```

```ts
import { spec, versionIds, reviewedPin, SPECS } from "@ora-ai/specs";

spec("mcp").current;                                   // "2026-07-28"
spec("mcp").supported;                                 // ["2025-11-25", "2025-06-18", "2025-03-26"]
versionIds("pap", ["current", "supported", "preview"]); // ["0.4", "0.3", "0.2", "0.1"], typed as those literals
spec("webmcp").reviewed?.read;                         // "2026-11-10"
reviewedPin("webmcp", "git-path");                     // the reviewed index.bs blob SHA
```

The same data is plain JSON at `@ora-ai/specs/specs.json`, and the schema a spec file must satisfy at `@ora-ai/specs/schema.json`. `@ora-ai/specs/kinds` exports the source kinds, the shape each kind's state must have (`valueShapeOk`, `liveValueOk`), `sourceKey` and the link builders, so a consumer that stores live values checks them exactly as the watcher does.

Pin the package exactly. A build then never reads the network, and moving to a newer release is a pull request in your own repo where your own adherence checks run.

**Latest upstream state.** The daily watch publishes what it saw to the `status` branch as `status.json`: each spec's live source values (by source key), whether it changed since its pins, and the issue that tracks it. Read it from `https://raw.githubusercontent.com/ora/specs/status/status.json`. It is not part of the npm package, so a watch run never needs a release.

## Layout

```
specs/<id>/spec.yaml          one spec: identity, versions, reviewed pin (schema/spec.schema.json)
specs/registry.yaml           defaults for the drift issue text
skills/protocol-<id>/         the spec rules that hold in every repo, plus the research reports behind them
scripts/spec-drift.mjs        the watcher (the only copy)
scripts/build.mjs             validates every spec file and builds dist/
src/kinds.mjs                 source kinds and state shapes, shared by the watcher, the build and the package
```

### A spec file

```yaml
id: mcp
name: "Model Context Protocol"
homepage: https://modelcontextprotocol.io
spec_url: "https://modelcontextprotocol.io/specification"
versions:                      # newest first; status is current, preview, supported or deprecated
  - { id: "2026-07-28", status: current }
  - { id: "2025-11-25", status: supported }
reviewed:                      # null while a spec is only watched; its sources then go in `watch`
  version: "2026-07-28"
  read: "2026-08-30"
  skill: "protocol-mcp"
  sources:
    - kind: "git-dated-dirs"
      repo: "modelcontextprotocol/modelcontextprotocol"
      path: "docs/specification"
      pin: "2026-07-28"
```

Each pin sits on its own `pin: "..."` line, so the fix workflow can move it without touching anything else. `npm run check` validates every file; `npm test` runs the tests.

## The self-updating loop

1. `watch.yml` runs daily: `spec-drift.mjs check specs`, then one issue per drifted spec, the `status` branch, and the report sent to ora.ai.
2. `fix.yml` (schedule or dispatch only, never from a pull request) moves the pins by code, has git confirm only pin lines changed, and opens a pull request carrying Claude's review of the upstream change. A person makes any skill or versions change on that branch.
3. Merging to main updates the release-please pull request; merging that publishes `@ora-ai/specs` (`release.yml`).
4. Each consumer's own daily `specs-bump.yml` sees the release and opens a bump pull request in its repo, where its adherence checks run.

## Protocol skills

`skills/protocol-<id>/SKILL.md` holds the rules for writing, probing, teaching and scoring each protocol that hold in any repo: the spec's identity, its hard rules, its unstable areas, and the research report behind them. Vendor them with:

```sh
npx skills add ora/specs
```

Each repo keeps a small overlay of its own (which of its files are observers, first-party authors or emitters, and its own enforcement), and the overlay wins on points specific to that repo.

## Run the watcher by hand

```sh
npm ci
node scripts/spec-drift.mjs check specs --dry-run           # every source, pin vs live
node scripts/spec-drift.mjs page-text <url>                 # a page's normalized text, to diff two versions
```

## License

MIT

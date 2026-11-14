---
name: protocol-mcp-apps
description: Use when writing, reviewing, or scoring anything that renders, emits, teaches, or detects in-conversation UI over MCP (MCP Apps) - app tools and their views, the view-side bridge script, ui:// resource registrations, scanner checks that grade a server's views, or recommendations that tell site owners how to ship them. Also use when code or a diff mentions MCP Apps, SEP-1865, io.modelcontextprotocol/ui, ui://, _meta.ui, resourceUri, ui/initialize, appCapabilities, text/html;profile=mcp-app, registerAppTool, callServerTool, the OpenAI Apps SDK, openai/outputTemplate, skybridge, window.openai, MCP-UI, or widget CSP, so generated code follows the ratified SEP-1865 2026-01-26 revision instead of the draft, OpenAI's flat keys, or pre-SEP MCP-UI.
---

# MCP Apps protocol adherence

Code that renders, emits, teaches, or scores MCP Apps surfaces must encode the spec correctly in three distinct postures:

| Posture | What it is | Rule |
|---|---|---|
| **Observer** | Code that detects what servers in the wild ship, including OpenAI-flavored and pre-SEP forms (view and resource readers, scanner checks; OpenAI Apps SDK keywords are legitimate detection signals there, as is the deprecated flat `_meta["ui/resourceUri"]` read from the wire) | MAY reference foreign / deprecated / draft forms as detection signatures and finding text. Never as recommended usage. |
| **First-party author** | Your own views and app tools (view HTML, the bridge script, tool `_meta.ui`, `ui://` resource registrations) | MUST be spec-current to the ratified revision (rules below). |
| **Emitter** | Code you hand to the public as guidance (recommendations, methodology copy, check provenance strings shown to site owners) | MUST be spec-current: a stale key or mimetype in a recommendation propagates to every site owner who follows it. |

Which files sit in which posture is repo-specific: see "Repo overlay" below.

**Spec identity.** MCP Apps is **SEP-1865**, the first official MCP extension (extension id `io.modelcontextprotocol/ui`), ratified **Stable at 2026-01-26** - `specification/2026-01-26/apps.mdx` in https://github.com/modelcontextprotocol/ext-apps. The reviewed pin (revision, read date, and sources with the ratified revision's tree SHA) lives in `specs/mcp-apps/spec.yaml` of ora/specs and is read through `@ora-ai/specs` (`spec("mcp-apps").reviewed`), never restated in code constants. The sibling `specification/draft/apps.mdx` is ~886 lines ahead; **draft-only APIs must not leak into code pinned to 2026-01-26**, and the shipped SDK's `spec.types.ts` tracks the draft, so presence in the SDK types is NOT proof of ratified status. Precedence: the ratified spec text wins over the SDK and over any host's docs. Asserting anything beyond the pin requires re-reading the spec and moving the pin and this skill together.

## Hard rules (the ratified 2026-01-26 contract - enforce, don't debate)

1. **Nested `_meta.ui.*` keys only.** Flat `_meta["ui/resourceUri"]` is deprecated with removal announced "before GA" - observers may accept it from the wire; first-party and emitted code writes `_meta: { ui: { resourceUri } }`. `csp` and `permissions` belong on the **resource** content item, never the tool.
2. **UI resources use the `ui://` scheme and mimetype exactly `text/html;profile=mcp-app`** (semicolon, no space). Content is a complete HTML5 document, predeclared as a resource and referenced from tool metadata - inline UI resources in tool results are a pre-SEP pattern the SEP explicitly rejected.
3. **The `ui/*` JSON-RPC bridge method names are verbatim spec vocabulary.** Ratified surface: requests `ui/initialize`, `ui/open-link`, `ui/message`, `ui/request-display-mode`, `ui/update-model-context`, `ui/resource-teardown` (host to view); notifications `ui/notifications/initialized`, `size-changed`, `tool-input`, `tool-input-partial`, `tool-result`, `tool-cancelled`, `host-context-changed`, plus the sandbox pair `sandbox-proxy-ready` / `sandbox-resource-ready`. Anything else under `ui/` is draft-only (see unstable areas).
4. **The handshake is `ui/initialize` with `{ appInfo, appCapabilities, protocolVersion }`** - its own param names, not core MCP's clientInfo / capabilities. (Provenance: the ratified spec text mandates `appCapabilities`; the full param naming including `appInfo` comes from the SDK's spec types, which both spec revisions share for this request.) The host answers, then the view sends `ui/notifications/initialized`; the host MUST NOT message the view before that arrives. `protocolVersion` is `"2026-01-26"`.
5. **Capability negotiation is two-layer and the layers never mix:** client to server via `capabilities.extensions["io.modelcontextprotocol/ui"].mimeTypes` (MUST include the mimetype) at the MCP level; view to host via the `ui/initialize` exchange inside the iframe channel. Tools MUST still return a meaningful text `content` array for hosts without UI.
6. **CSP is built from `_meta.ui.csp` camelCase domain lists** (`connectDomains`, `resourceDomains`, `frameDomains`, `baseUriDomains`); hosts may restrict further, never loosen. Snake_case (`resource_domains` etc.) is OpenAI vocabulary.
7. **Never OpenAI Apps SDK forms, never pre-SEP MCP-UI forms** outside observer signatures: no flat `openai/*` `_meta` keys (`openai/outputTemplate`, `openai/widgetCSP`, ...), no `text/html+skybridge`, no `window.openai`, no `iframe-ready` handshake. The full mapping table lives in the reference report section 5.1.
8. **Current SDK names, not renamed ancestors:** `containerDimensions` (not `viewport`), `openLink` (not `sendOpenLink`), `ui/notifications/sandbox-proxy-ready` (not `sandbox-ready`), `addEventListener("toolinput", ...)` over the deprecated `on*` setters.

## Unstable areas (draft-only - flag if used while pinned to 2026-01-26)

App-provided tools (`app.registerTool`, `oncalltool` / `onlisttools`, host-to-app `tools/call` and bidirectional `tools/list`, tool lifecycle handles), `ui/download-file` (+ the `downloadFile` host capability), `ui/notifications/request-teardown`, view-side `sampling/createMessage` (+ the `sampling` capability), `SupportedContentBlockModalities` and the `updateModelContext` / `message` capability typings, listing-level `_meta.ui` on `resources/list` entries. Note `callServerTool` is NOT draft-only - it is the ratified app-to-host-to-server call path. Full delta: `references/mcp-apps-research-2026-08-30.md` section 7.

**Listing-level `_meta.ui.csp`.** The ratified 2026-01-26 spec reads csp only from the `resources/read` content item; draft-tracking hosts and the ext-apps SDK also apply it from the `resources/list` entry. An observer that reads the listing as a fallback labels it a draft-spec location. Emitters still teach the content item only.

## Reference

`references/mcp-apps-research-2026-08-30.md` - the full research report behind this skill: the complete `_meta.ui.*` inventory, the full `ui/*` method tables, host-context / theming variables, the OpenAI migration mapping, the draft-vs-ratified delta, and SDK divergence notes. Load it when a question goes past the hard rules above.

## Repo overlay

Each consuming repo keeps its own posture table (which of its files are observer, first-party author, or emitter) and its own enforcement (mechanical adherence suites, reviewers) in its own rules file, alongside any observer reading decisions it makes about what to score. On repo-specific points, the overlay wins over this skill.

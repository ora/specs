# MCP Apps (SEP-1865) research report for spec-compatible code generation

**Research date:** Sunday 30 August 2026 (Asia/Jerusalem, UTC+3)
**Canonical spec snapshot used:** SEP-1865, ratified version **2026-01-26**, status **Stable (2026-01-26)**
**Primary source:** local checkout of https://github.com/modelcontextprotocol/ext-apps at HEAD `10195ad9` (2026-08-12), SDK `@modelcontextprotocol/ext-apps` 1.7.5
**Ratified spec file:** `specification/2026-01-26/apps.mdx`
**Draft spec file (ahead of ratified, do NOT pin to it):** `specification/draft/apps.mdx`

This report is for a coding-agent skill pinned to the **ratified 2026-01-26** version. Everything the draft adds beyond that snapshot is catalogued in section 7 as a precise delta: code pinned to 2026-01-26 must not emit those APIs. Where the shipped SDK (1.7.5) tracks the draft or diverges from both spec texts, that is called out as **SDK lag/lead**, not as the spec.

Do not invent APIs. Every claim below was read from the files named above; anything not verifiable from them is marked explicitly.

---

## 1. What MCP Apps is (one paragraph)

MCP Apps is **SEP-1865**, the **first official MCP extension** (per the extensions mechanism of SEP-1724), ratified **Stable at 2026-01-26**. It lets an MCP server deliver an interactive HTML user interface (a "View" or "App") that the host renders in a sandboxed iframe next to a tool result. The pattern: the server predeclares UI resources under the **`ui://`** URI scheme with mimetype **`text/html;profile=mcp-app`**, links tools to them via nested **`_meta.ui.*`** metadata, and the iframe talks to the host over **MCP JSON-RPC 2.0 via `postMessage`** - the iframe acts conceptually as an MCP client, the host as a proxying MCP server. Support is negotiated twice: client-to-server through `capabilities.extensions["io.modelcontextprotocol/ui"]` at MCP `initialize`, and view-to-host through a dedicated `ui/initialize` handshake. It unifies two predecessor systems it explicitly supersedes: community **MCP-UI** (pre-SEP patterns like `iframe-ready`) and **OpenAI's Apps SDK** (flat `_meta["openai/..."]` keys, `window.openai`, `text/html+skybridge`). Authors include Ido Salomon, Liad Yosef, Olivier Chafik, and others; created 2025-11-21.

---

## 2. Canonical URL, version, status

| Field | Value |
|---|---|
| **SEP** | SEP-1865, "MCP Apps: Interactive User Interfaces for MCP", Track: Extensions |
| **Status** | **Stable (2026-01-26)** in the ratified file; the sibling `draft/apps.mdx` is Status: Draft and ~886 lines ahead |
| **Extension identifier** | `io.modelcontextprotocol/ui` (reserved label; `ui://` prefix reserved in MCP) |
| **Spec repo** | https://github.com/modelcontextprotocol/ext-apps |
| **Ratified spec path** | `specification/2026-01-26/apps.mdx` |
| **Draft spec path** | `specification/draft/apps.mdx` (carries full edit history) |
| **SDK package** | `@modelcontextprotocol/ext-apps`, version 1.7.5 at HEAD, MIT, Node >= 20 |
| **Protocol version string** | `"2026-01-26"` - `LATEST_PROTOCOL_VERSION` in `src/spec.types.ts`; `SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION]` in `src/app-bridge.ts` |
| **Docs site** | https://apps.extensions.modelcontextprotocol.io/ (Quickstart etc., linked from README) |
| **Created** | 2025-11-21 |

**Stability for a skill:** the 2026-01-26 snapshot is ratified and safe to pin hard. The draft is actively adding a large surface (app-provided tools, downloads, sampling - section 7); a skill must treat every draft-only name as a forward reference, not as available API.

---

## 3. Related repos and docs

- Spec + SDK monorepo: https://github.com/modelcontextprotocol/ext-apps (spec, TypeScript SDK, React hooks, examples, Playwright tests)
- Normative-constant sources inside the repo: `src/spec.types.ts` (protocol types, method string constants, source of truth for generated Zod schemas), `src/app.ts` (App class, `RESOURCE_MIME_TYPE`), `src/server/index.ts` (`EXTENSION_ID`, `getUiCapability`, `registerAppTool`, `registerAppResource`)
- Migration guide from OpenAI Apps SDK: `docs/migrate_from_openai_apps.md` (the ban-vocabulary source, section 5.1)
- Release notes: `RELEASES.md` (SDK renames worth banning, section 6.2)
- Agent skills shipped by the repo itself: `docs/agent-skills.md` - `create-mcp-app`, `migrate-oai-app`, `add-app-to-server`, `convert-web-app`
- Other docs in the repo: `docs/csp-cors.md`, `docs/authorization.md`, `docs/patterns.md`, `docs/testing-mcp-apps.md`, `docs/quickstart.md`, `docs/overview.md`
- Predecessor / prior art: MCP-UI https://mcpui.dev/ (community reference implementation, pre-SEP patterns); OpenAI Apps SDK (launched November 2025)
- Core MCP spec (the extension mechanism, SEP-1724): https://modelcontextprotocol.io/specification
- Host support docs linked from README: ChatGPT, Claude, VS Code, Goose, Postman, MCPJam, mcp-use inspector, Alpic Playground (section 6.1)

---

## 4. Compatibility-critical rules (core of this report)

All citations are the ratified `specification/2026-01-26/apps.mdx` unless marked SDK.

### 4.1 Two-layer capability negotiation

Layer 1 - **client to server**, standard MCP `initialize`:

```json
"capabilities": {
  "extensions": {
    "io.modelcontextprotocol/ui": {
      "mimeTypes": ["text/html;profile=mcp-app"]
    }
  }
}
```

- `mimeTypes` is REQUIRED in the extension settings and must include `"text/html;profile=mcp-app"` for MCP Apps support.
- Servers SHOULD check this before registering UI-enabled tools; the SDK helper is `getUiCapability(clientCapabilities)` plus the `EXTENSION_ID` constant (`"io.modelcontextprotocol/ui"`, `src/server/index.ts:413`) and `RESOURCE_MIME_TYPE` (`"text/html;profile=mcp-app"`, `src/app.ts:158`).
- Servers SHOULD provide a text-only fallback; tools MUST return a meaningful `content` array even when UI is available.

Layer 2 - **view to host**, the `ui/initialize` request over postMessage:

- View sends `ui/initialize` with params `{ appInfo: Implementation, appCapabilities: McpUiAppCapabilities, protocolVersion: string }` (SDK types; the ratified spec text mandates `appCapabilities`).
- `McpUiAppCapabilities` (ratified): `experimental?: {}`, `tools?: { listChanged?: boolean }`, `availableDisplayModes?: Array<"inline" | "fullscreen" | "pip">`.
- Host answers with `McpUiInitializeResult`: `{ protocolVersion, hostInfo, hostCapabilities, hostContext }`. Ratified examples carry `"protocolVersion": "2026-01-26"` in both directions.
- View then sends the `ui/notifications/initialized` notification. The Host MUST NOT send any request or notification to the View before receiving it.
- `HostCapabilities` (ratified, complete): `experimental?: {}`, `openLinks?: {}`, `serverTools?: { listChanged?: boolean }`, `serverResources?: { listChanged?: boolean }`, `logging?: {}`, `sandbox?: { permissions?, csp? }`. Anything else (`downloadFile`, `updateModelContext`, `message`, `sampling`) is draft-only - section 7.

Do not conflate the layers: the extension capability rides in MCP `capabilities.extensions`; the app handshake is a separate `ui/*` exchange inside the iframe channel.

### 4.2 UI resources: `ui://` scheme and the exact mimetype

- URI MUST start with the `ui://` scheme (e.g. `ui://weather-server/dashboard-template`).
- `mimeType` MUST be exactly **`text/html;profile=mcp-app`** (semicolon, no space, `profile=mcp-app`). Other content types are reserved for future extensions. `text/uri-list` / externalUrl embedding is explicitly deferred from the MVP.
- Content MUST be a valid HTML5 document, delivered via `text` (string) or `blob` (base64) in the `resources/read` result.
- Hosts fetch the referenced resource with `resources/read` and MAY prefetch/cache it. Because discovery flows through tool metadata, servers MAY omit UI-only resources from `resources/list` and `notifications/resources/list_changed`.
- In the ratified version, the `_meta.ui` resource metadata lives on the **`resources/read` content item**. A listing-level `_meta.ui` on `resources/list` entries with precedence rules is **draft-only** (section 7).

### 4.3 Nested `_meta.ui.*` keys - the complete ratified inventory

**On the resource content item** (`UIResourceMeta` / SDK `McpUiResourceMeta`):

| Key | Type | Meaning |
|---|---|---|
| `_meta.ui.csp.connectDomains` | `string[]` | Origins for fetch/XHR/WebSocket; CSP `connect-src` |
| `_meta.ui.csp.resourceDomains` | `string[]` | Origins for static assets; CSP `img-src`, `script-src`, `style-src`, `font-src`, `media-src`; wildcard subdomains allowed (`https://*.example.com`) |
| `_meta.ui.csp.frameDomains` | `string[]` | Origins for nested iframes; CSP `frame-src`; omitted means `frame-src 'none'` |
| `_meta.ui.csp.baseUriDomains` | `string[]` | Allowed base URIs; CSP `base-uri`; omitted means `base-uri 'self'` |
| `_meta.ui.permissions.camera` | `{}` | Permission Policy `camera` |
| `_meta.ui.permissions.microphone` | `{}` | Permission Policy `microphone` |
| `_meta.ui.permissions.geolocation` | `{}` | Permission Policy `geolocation` |
| `_meta.ui.permissions.clipboardWrite` | `{}` | Permission Policy `clipboard-write` |
| `_meta.ui.domain` | `string` | Dedicated sandbox origin (host-dependent format, e.g. `{hash}.claudemcpcontent.com`) |
| `_meta.ui.prefersBorder` | `boolean` | Visual boundary preference; explicit value recommended |

**On the tool** (`McpUiToolMeta`):

| Key | Type | Meaning |
|---|---|---|
| `_meta.ui.resourceUri` | `string` | URI of the UI resource rendering this tool's results |
| `_meta.ui.visibility` | `Array<"model" \| "app">` | Who can call the tool; default `["model", "app"]` |

- `csp` and `permissions` belong on the **resource**, never the tool; the SDK types mark them `never` on `McpUiToolMeta`.
- **Flat `_meta["ui/resourceUri"]` is deprecated, not removed**: the ratified spec keeps it with the note "will be removed before GA". The SDK's `registerAppTool` still writes the legacy flat key alongside the nested one for backward compatibility (`src/server/index.ts`). Skill posture: emitters write nested `_meta.ui.resourceUri` only; observers/scanners may accept the flat key as a legacy detection signature.
- Visibility semantics (ratified MUSTs): host MUST NOT list a tool to the agent when `visibility` excludes `"model"`; host MUST reject `tools/call` from apps for tools whose `visibility` excludes `"app"`; app-only tools are always blocked cross-server.

### 4.4 CSP model

- Host MUST construct CSP from the declared domain lists and MUST block undeclared domains (restricting further is allowed, loosening is not).
- Restrictive default when `ui.csp` is omitted (ratified text): `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'`. (The draft adds `object-src 'none'` to this block; the ratified sandbox-proxy section separately requires blocking `object-src 'none'`.)
- All four CSP keys are **camelCase**. `resource_domains` / `connect_domains` / `frame_domains` (snake_case) are **OpenAI Apps SDK vocabulary**, wrong here (section 5.1). `redirect_domains` has no MCP equivalent at all; `baseUriDomains` has no OpenAI equivalent.
- Web-page hosts MUST use the double-iframe **sandbox proxy**: host and sandbox on different origins; sandbox has `allow-scripts allow-same-origin`; sandbox sends `ui/notifications/sandbox-proxy-ready`, host answers with `ui/notifications/sandbox-resource-ready` carrying `{ html, sandbox?, csp?, permissions? }`; sandbox forwards everything except `ui/notifications/sandbox-*` messages and creates no requests of its own. (Ratified says MUST for the two sandbox notifications; the draft softens to SHOULD.)

### 4.5 The complete `ui/*` JSON-RPC surface (ratified 2026-01-26)

Method string constants are exported from `src/spec.types.ts` and match these exactly.

**Requests, View to Host:**

| Method | Params | Result |
|---|---|---|
| `ui/initialize` | `appInfo`, `appCapabilities`, `protocolVersion` | `McpUiInitializeResult` |
| `ui/open-link` | `{ url: string }` | `{}` on success |
| `ui/message` | `{ role: "user", content: { type: "text", text } }` (spec text; SDK generalizes to `ContentBlock[]`, see 6.3) | `{}` on success |
| `ui/request-display-mode` | `{ mode: "inline" \| "fullscreen" \| "pip" }` | `{ mode }` actually set |
| `ui/update-model-context` | `{ content?: ContentBlock[], structuredContent?: object }` | `{}` on success; each call overwrites the previous context from this View |

**Request, Host to View:**

| Method | Params | Notes |
|---|---|---|
| `ui/resource-teardown` | `{ reason: string }` | Sent before teardown; host SHOULD wait for the response to prevent data loss. It carries an id (it is a request), despite the ratified section heading placing it under notifications |

**Notifications, View to Host:**

| Method | Params |
|---|---|
| `ui/notifications/initialized` | `{}` |
| `ui/notifications/size-changed` | `{ width, height }` (SDK marks both optional) |

**Notifications, Host to View:**

| Method | Params | Contract |
|---|---|---|
| `ui/notifications/tool-input` | `{ arguments }` | MUST be sent once after initialize completes, before tool-result |
| `ui/notifications/tool-input-partial` | `{ arguments }` | MAY be sent 0..n times while arguments stream; MUST stop after tool-input; views MUST NOT rely on partials for critical operations |
| `ui/notifications/tool-result` | `CallToolResult` | MUST be sent when the tool completes (if the View is displayed) |
| `ui/notifications/tool-cancelled` | `{ reason }` | MUST be sent on any cancellation |
| `ui/notifications/host-context-changed` | `Partial<HostContext>` | Partial update; View merges |

**Sandbox-reserved:** `ui/notifications/sandbox-proxy-ready` (Sandbox to Host), `ui/notifications/sandbox-resource-ready` (Host to Sandbox).

**Standard MCP messages a View may use:** `tools/call` (App to Host to Server direction only in the ratified version), `resources/read`, `notifications/message` (logging), `ping`. The host MAY forward any non-`ui/` method from the View to the MCP server and MAY block or gate messages on user approval.

Anything else under `ui/` - notably `ui/download-file` and `ui/notifications/request-teardown` - is **draft-only** (section 7).

### 4.6 Host context, sizing, display modes, theming

- `HostContext` fields (ratified): `toolInfo? { id?, tool }`, `theme? "light" | "dark"`, `styles? { variables?, css?.fonts? }`, `displayMode?`, `availableDisplayModes?`, `containerDimensions?`, `locale?` (BCP 47), `timeZone?` (IANA), `userAgent?`, `platform? "web" | "desktop" | "mobile"`, `deviceCapabilities? { touch?, hover? }`, `safeAreaInsets? { top, right, bottom, left }`.
- **`containerDimensions`**, not `viewport`: each axis is fixed (`height` / `width`), flexible (`maxHeight` / `maxWidth`), or unbounded (omitted). With flexible dimensions the host MUST listen for `ui/notifications/size-changed` and resize the iframe. The SDK auto-sends size-changed via ResizeObserver when `autoResize` is on (the default). `viewport` was the pre-1.0 name, removed in SDK 0.3.0 - ban it.
- Display modes `"inline" | "fullscreen" | "pip"`: view MUST declare its supported modes in `appCapabilities.availableDisplayModes`, MUST check the host's `availableDisplayModes` before requesting, MUST handle getting a different mode back; host MUST NOT switch a view to an undeclared mode and MUST return the resulting mode from `ui/request-display-mode`.
- Theming: hosts MAY pass any subset of the standardized CSS custom properties in `styles.variables` (families `--color-background-*`, `--color-text-*`, `--color-border-*`, `--color-ring-*`, `--font-sans/--font-mono`, `--font-weight-*`, `--font-text-*-size/-line-height`, `--font-heading-*-size/-line-height`, `--border-radius-*`, `--border-width-regular`, `--shadow-*`; full enumeration in `McpUiStyleVariableKey`, `src/spec.types.ts:44`). Hosts should use `light-dark()`; views should define their own fallbacks for every variable they use. Custom fonts arrive as raw CSS in `styles.css.fonts` (`@font-face` or `@import`), applied with `applyHostFonts`. Spacing variables are intentionally excluded.

### 4.7 Data-passing best practices (ratified)

- `content`: text representation for model context and text-only hosts.
- `structuredContent`: structured data for UI rendering, not added to model context.
- `_meta` on the result: metadata not intended for model context.
- `ui/update-model-context` is overwrite-by-design and does not trigger follow-ups; `ui/message` adds a user-role message and does trigger follow-ups; `notifications/message` is logging only. Do not swap them.

### 4.8 Common ways generated code breaks the spec

1. OpenAI flat keys: `_meta["openai/outputTemplate"]`, `openai/widgetCSP`, `openai/widgetAccessible`, snake_case CSP fields - wrong protocol (section 5.1).
2. `text/html+skybridge` as the mimetype - OpenAI's, not `text/html;profile=mcp-app`.
3. `window.openai.*` anything in view code - the MCP Apps view API is an explicit `new App(...)` + `await app.connect()`.
4. Pre-SEP MCP-UI handshake: `iframe-ready` events instead of `ui/initialize` / `ui/notifications/initialized`.
5. Returning inline UI resources in tool results instead of predeclaring `ui://` resources referenced by `_meta.ui.resourceUri` (the SEP explicitly rejected inline embedding).
6. Emitting the flat `_meta["ui/resourceUri"]` in new code - deprecated, removal announced for GA.
7. Putting `csp` / `permissions` on the tool `_meta.ui` instead of the resource content item.
8. Draft-only APIs against a 2026-01-26 host: `app.registerTool`, `oncalltool` / `onlisttools`, host-to-app `tools/call` / `tools/list`, `ui/download-file`, `ui/notifications/request-teardown`, view-side `sampling/createMessage`, `outputSchema` on app tools (section 7).
9. `viewport` / `maxHeight` at top level of host context (OpenAI's `window.openai.maxHeight`, and the SDK's own pre-0.3.0 shape) instead of `containerDimensions`.
10. `sendOpenLink()` / other `send`-prefixed request methods - renamed in SDK 0.2.2; `openLink()` and `teardownResource()` are current (deprecated aliases linger, do not teach them).
11. Skipping capability checks: registering UI tools without consulting `capabilities.extensions["io.modelcontextprotocol/ui"].mimeTypes`, or calling `ui/open-link` etc. without checking `hostCapabilities`.
12. Treating `ui/notifications/tool-input-partial` arguments as reliable, or expecting tool-result before tool-input.
13. Inventing a loosened CSP: hosts may only restrict beyond the declared domains, never allow undeclared ones.
14. Sending host-to-view messages before `ui/notifications/initialized` arrived.
15. Assuming `visibility: ["app"]` tools appear in the agent's `tools/list` (they must not) or that cross-server app tools work (always blocked).

---

## 5. Things that look similar but are NOT MCP Apps 2026-01-26

### 5.1 OpenAI Apps SDK (the biggest confusion source; full mapping in `docs/migrate_from_openai_apps.md`)

Ban vocabulary - each left-hand form is OpenAI's, wrong in MCP Apps code:

| OpenAI form | MCP Apps 2026-01-26 form |
|---|---|
| `_meta["openai/outputTemplate"]` | `_meta.ui.resourceUri` |
| `_meta["openai/widgetAccessible"]` (boolean) | `_meta.ui.visibility` includes/excludes `"app"` |
| `_meta["openai/visibility"]` (`"public"`/`"private"`) | `_meta.ui.visibility` includes/excludes `"model"` |
| `_meta["openai/widgetCSP"]` | `_meta.ui.csp` |
| `resource_domains` / `connect_domains` / `frame_domains` | `resourceDomains` / `connectDomains` / `frameDomains` |
| `redirect_domains` | no equivalent (OpenAI-only) |
| `_meta["openai/widgetDomain"]` | `_meta.ui.domain` |
| `_meta["openai/widgetPrefersBorder"]` | `_meta.ui.prefersBorder` |
| `_meta["openai/widgetDescription"]` | no equivalent yet (use `ui/update-model-context` dynamically) |
| `_meta["openai/toolInvocation/invoking"]` / `invoked` | no equivalent yet |
| `text/html+skybridge` | `text/html;profile=mcp-app` |
| `window.openai` (implicit global) | `new App({name, version})` + `await app.connect()` |
| `window.openai.callTool(name, args)` | `app.callServerTool({ name, arguments })` |
| `window.openai.sendFollowUpMessage({ prompt })` | `app.sendMessage({ role: "user", content: [...] })` |
| `window.openai.openExternal({ href })` | `app.openLink({ url })` (note `href` vs `url`) |
| `window.openai.notifyIntrinsicHeight(h)` | `app.sendSizeChanged({ width, height })` / autoResize |
| `window.openai.maxHeight` | `hostContext.containerDimensions` |
| `window.openai.widgetState` / `setWidgetState(state)` | no equivalent (localStorage or server state) |
| `window.openai.uploadFile` / `getFileDownloadUrl` | no equivalent in 2026-01-26 (`ui/download-file` is draft-only) |
| `window.openai.requestModal` / `requestClose` / `setOpenInAppUrl` | no equivalent |
| `addEventListener("openai:set_globals", ...)` | host-context-changed handling on the App instance |

### 5.2 Pre-SEP MCP-UI

- `iframe-ready` custom handshake - replaced by `ui/initialize` / `ui/notifications/initialized` (called out by name in the ratified "Key Differences from Pre-SEP MCP-UI").
- Inline `UIResource` embedded in tool results - the SEP requires predeclared resources referenced from tool metadata; inline embedding was considered and rejected.
- Custom message types (tool, prompt, etc.) over postMessage - replaced by MCP JSON-RPC proper.
- MCP-UI's extra content types (external URL, remote DOM) - not in the MVP; only `text/html;profile=mcp-app`.
- Flat `_meta["ui/resourceUri"]` - the transitional key; deprecated (see 4.3).
- MCP-UI remains a reference implementation and migration shim (per the SEP's Reference Implementation note), not a spec source.

### 5.3 WebMCP

Entirely different thing despite the name: a W3C Web Machine Learning CG browser API (`document.modelContext.registerTool`) letting live web pages expose JS tools to browser agents. No iframes-from-MCP-servers, no `ui://`, no JSON-RPC wire contract. Ora already pins it separately in `protocol-webmcp`. Connection: the DRAFT MCP Apps app-provided-tools feature says it is "inspired by WebMCP" (ext-apps#35) but stays MCP-native - do not import WebMCP API shapes into MCP Apps code or vice versa.

### 5.4 Other

- Core MCP itself: `tools/call`, `resources/read`, capability negotiation are core; MCP Apps only adds the `ui/*` layer and metadata conventions on top. An MCP server with no `_meta.ui` is not "missing" MCP Apps; the extension is optional and negotiated.
- MCP Apps SDK helper names (`registerAppTool`, `registerAppResource`, `App`, `AppBridge`) are SDK conveniences, not wire protocol; scoring a server for not using them is wrong.

---

## 6. Ecosystem and SDK lag

### 6.1 Host support (as documented in README at HEAD, 2026-08-12)

Supported clients with linked docs: **ChatGPT** (developers.openai.com apps-sdk "MCP Apps in ChatGPT"), **Claude** (claude.com connectors docs, "building MCP Apps"), **VS Code** (blog post dated 2026-01-26, same day as ratification), **Goose** (Block tutorial), **Postman** (MCP requests interact docs), **MCPJam**, **mcp-use inspector** (manufact.com), **Alpic Playground** (added in the last commit at HEAD, #729). README notes host support varies; the full list is the MCP clients page.

### 6.2 SDK renames to ban (from `RELEASES.md` and `src/app.ts`)

- **`viewport` -> `containerDimensions`** (breaking, SDK 0.3.0, PR #153). Never generate `viewport` in host context.
- **`sendOpenLink()` -> `openLink()`**, **teardown request method -> `teardownResource()`** (SDK 0.2.2, PR #161, "removed `send` prefix"; deprecated aliases still exist in 1.7.5 - `src/app.ts:1637` - but must not be taught).
- **Flat `_meta["ui/resourceUri"]` -> nested `_meta.ui.resourceUri`** (SDK 0.2.2, PR #131, same change that introduced `visibility`).
- **`sandbox-ready` -> `sandbox-proxy-ready`** notification name fix (SDK 0.2.2, PR #160). Ban `ui/notifications/sandbox-ready`.
- `on*` handler setters (`ontoolinput`, `ontoolresult`, `ontoolinputpartial`, `ontoolcancelled`, `onhostcontextchanged`) are marked `@deprecated` in 1.7.5 in favor of `addEventListener("toolinput", ...)` etc. - note that `docs/migrate_from_openai_apps.md` still teaches the `on*` form, so the repo's own docs lag its SDK. Emitters should prefer `addEventListener`.

### 6.3 SDK 1.7.5 vs the two spec texts (divergences to know when reading `src/spec.types.ts`)

- **The types file tracks the DRAFT, not the ratified snapshot**, despite its `@see` link pointing at `specification/2026-01-26/apps.mdx`. It contains `McpUiDownloadFileRequest`, `McpUiRequestTeardownNotification`, `McpUiSupportedContentBlockModalities`, and host capabilities `downloadFile` / `updateModelContext` / `message` / `sampling` - all draft-only. Do not treat presence in `spec.types.ts` as proof of ratified status.
- `McpUiMessageRequest.params.content` is `ContentBlock[]` in the SDK; **both** spec texts (ratified and draft) still show a single `{ type: "text", text }` object. The SDK is ahead of the written spec here; an observer should accept both shapes, an emitter targeting spec-pinned hosts is safest with a single text block wrapped in an array via the SDK.
- `McpUiResourceTeardownRequest.params` is `{}` in the SDK types; the ratified spec shows `{ reason: string }`. Another SDK-vs-text mismatch; do not fail a host for either.
- The JSDoc example on `McpUiInitializeResult.protocolVersion` says `"2025-11-21"` - stale example text; the constant is `"2026-01-26"`.
- Draft spec examples themselves show `protocolVersion: "2025-06-18"` in the transport and initialize-result examples (a core-MCP version string), while the ratified file shows `"2026-01-26"`. Pin `"2026-01-26"`.

---

## 7. Draft-vs-ratified delta: APIs that MUST NOT appear in code pinned to 2026-01-26

Verified by diffing `specification/2026-01-26/apps.mdx` against `specification/draft/apps.mdx` at HEAD `10195ad9` (draft is 2654 lines vs 1768). Every item below exists only in the draft.

**New methods / notifications:**

1. **`ui/download-file`** (View to Host request): `params.contents` is an array of standard MCP `EmbeddedResource` or `ResourceLink`; host confirmation dialog, filename derived from `resource.uri`, sanitization guidance. Plus the `downloadFile?: {}` host capability and the SDK's `app.downloadFile()`.
2. **`ui/notifications/request-teardown`** (View to Host notification): view asks to be torn down; host MAY defer or ignore, and on accept MUST still run the `ui/resource-teardown` graceful flow. Draft also renames the lifecycle section "Cleanup" to "Teardown". SDK: `app.requestTeardown` (`spec.types.ts` reference).
3. **View-side `sampling/createMessage`**: apps may request LLM completions from the host, standard MCP `CreateMessageRequest` / `CreateMessageResult` including SEP-1577 `tools` / `toolChoice`; gated on `hostCapabilities.sampling` (and `.sampling.tools`). Plus the `sampling` host capability key.

**App-provided tools (the largest draft block, ~400 lines):**

4. **Bidirectional `tools/call` and `tools/list`**: Host to App tool calls against app-registered tools, `notifications/tools/list_changed` in both directions. Ratified `tools/call` is App to Host to Server only, and app `tools?: { listChanged }` capability exists in the ratified `McpUiAppCapabilities` shape but has no ratified host-to-app request flow behind it.
5. **`app.registerTool(name, config, callback)`** SDK helper with Standard Schema validation (Zod, ArkType, Valibot), `outputSchema`, and a handle exposing `enable()` / `disable()` / `update()` / `remove()`.
6. **`app.oncalltool`** and **`app.onlisttools`** manual handlers (apps MUST implement them when declaring the `tools` capability, per draft).
7. **Long-running app tools via core MCP Tasks** (`tasks/*` proxied to the app).
8. **App-provided tools security section**: namespacing (`app:` / `tictactoe:` prefixes), resource limits (50 tools, 30 s timeouts, 10 MB results), audit trail, approval granularity, "Hosts MUST NOT persist app tool registrations across sessions".

**Metadata and capability shape changes:**

9. **`SupportedContentBlockModalities`** interface (`text` / `image` / `audio` / `resource` / `resourceLink` / `structuredContent`) and the host capability keys **`updateModelContext`** and **`message`** typed with it.
10. **Metadata Location section**: `_meta.ui` allowed on `resources/list` entries as static defaults with content-item precedence; hosts MUST check both. Ratified reads it from the `resources/read` content item only.
11. `experimental` capability retyped from `{}` to `Record<string, object>` on both app and host capabilities.
12. `object-src 'none'` added to the restrictive default CSP block.
13. Sandbox proxy handshake softened from MUST to SHOULD for `sandbox-proxy-ready` / `sandbox-resource-ready`.
14. Draft example `protocolVersion` strings changed to `"2025-06-18"` (see 6.3; not something to emit either way).

Items the tasking summary listed that check out: `app.registerTool`, `oncalltool`, `ui/download-file`, `ui/notifications/request-teardown`, view-side `sampling/createMessage`, bidirectional `tools/list`, `SupportedContentBlockModalities` - all confirmed draft-only. One correction: **`callServerTool` is NOT draft-only** - it is the SDK method for the ratified App-to-Host-to-Server `tools/call` flow and is fine in 2026-01-26 code. Additions the summary missed: the metadata-location dual placement, the `updateModelContext` / `message` / `downloadFile` / `sampling` host capability keys, app tool lifecycle handles (`enable` / `disable` / `update` / `remove`), `onlisttools`, tasks-augmented app tools, and the `object-src` / MUST-to-SHOULD / `experimental` typing edits.

---

## 8. Encode-if conditions (is this stable enough for a skill?)

Yes - this is the easiest pin of the protocol family: a **ratified, dated, immutable snapshot** exists at `specification/2026-01-26/apps.mdx`. Encode as a skill if and only if:

1. The skill pins **SEP-1865 version 2026-01-26 (Stable)** and names the draft as explicitly out of scope for generated code; asserting anything beyond the snapshot requires re-reading the spec and moving the snapshot + skill together (same rule as `protocol-webmcp`).
2. Hard rules are limited to the ratified surface: extension id, both negotiation layers, `ui://` + `text/html;profile=mcp-app`, the nested `_meta.ui.*` inventory of 4.3, the CSP model, the `ui/*` method table of 4.5, protocol version `"2026-01-26"`, display modes, `containerDimensions`.
3. The entire section 7 delta is a **ban list for emitters** pinned to 2026-01-26, while observers may recognize those names as "draft feature detected", never as spec violations by the host.
4. The section 5.1 OpenAI table and 5.2 MCP-UI list are detection signatures for observer code and hard bans for emitter code.
5. The skill treats `src/spec.types.ts` / SDK 1.7.5 as draft-tracking (6.3) and never cites SDK presence as ratified-spec evidence.
6. Deprecated forms (`_meta["ui/resourceUri"]`, `sendOpenLink`, `viewport`, `on*` setters) are accepted on read, never written.

---

## 9. Sources

All primary sources are the local checkout `/Users/liadyosef/code/personal/ext-apps/` at HEAD `10195ad9` (2026-08-12):

- `specification/2026-01-26/apps.mdx` - the ratified spec (1768 lines)
- `specification/draft/apps.mdx` - the draft (2654 lines; delta in section 7 derived by diff)
- `src/spec.types.ts` - protocol types, method constants, `LATEST_PROTOCOL_VERSION = "2026-01-26"`
- `src/app.ts` - `RESOURCE_MIME_TYPE`, `RESOURCE_URI_META_KEY`, App class API, deprecated aliases
- `src/app-bridge.ts` - `SUPPORTED_PROTOCOL_VERSIONS`
- `src/server/index.ts` - `EXTENSION_ID = "io.modelcontextprotocol/ui"`, `getUiCapability`, legacy flat-key emission
- `docs/migrate_from_openai_apps.md` - OpenAI mapping tables (section 5.1)
- `RELEASES.md` - 0.2.2 and 0.3.0 breaking renames (section 6.2)
- `README.md` - supported clients (section 6.1), how-it-works overview
- `package.json` - `@modelcontextprotocol/ext-apps` 1.7.5

External URLs referenced by those files (not independently fetched for this report):

- https://github.com/modelcontextprotocol/ext-apps
- https://modelcontextprotocol.io/specification (core MCP, SEP-1724 extensions mechanism)
- https://mcpui.dev/ (MCP-UI, predecessor)
- https://apps.extensions.modelcontextprotocol.io/ (docs site)
- https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt/
- https://claude.com/docs/connectors/building/mcp-apps/getting-started
- https://code.visualstudio.com/blogs/2026/01/26/mcp-apps-support
- https://block.github.io/goose/docs/tutorials/building-mcp-apps/
- https://learning.postman.com/docs/postman-ai/mcp-requests/interact
- https://github.com/modelcontextprotocol/ext-apps/issues/35 (app tools / WebMCP relation, draft)
- https://standardschema.dev/ (draft app-tool validation)

End of report. Spec snapshot: SEP-1865 Stable 2026-01-26. Research completed 30 August 2026 from ext-apps HEAD 10195ad9.

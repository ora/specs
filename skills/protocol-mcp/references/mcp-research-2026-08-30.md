# MCP core spec research report for spec-compatible code generation

**Research date:** Sunday 30 August 2026 (Asia/Jerusalem, UTC+3)
**Canonical spec snapshot used:** Model Context Protocol, revision **2026-07-28** (latest stable)
**Primary source:** https://modelcontextprotocol.io/specification/2026-07-28
**Schema source of truth:** https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts

This report is for a coding-agent skill. It prefers the published spec pages and the TypeScript schema over blogs, SDK docs, and vendor previews. Where SDKs, adapters, or the deployed ecosystem lag the spec, that is called out as **implementation lag**, not as the spec. Every claim about the 2026-07-28 revision below was verified against a fetched spec page or the fetched schema on 30 August 2026; training-data memory of MCP predates this revision and was not trusted.

Do not invent APIs. Anything not on a 2026-07-28 spec page or in the 2026-07-28 schema is marked legacy, deprecated, extension, or unverified.

---

## 1. What MCP is (one paragraph)

The Model Context Protocol (MCP) is an open **wire protocol** (JSON-RPC 2.0 over stdio or Streamable HTTP) that connects LLM applications to external tools, data, and prompts. Hosts run clients; servers expose **tools** (model-invoked functions), **resources** (context/data), and **prompts** (templated workflows); clients can expose **elicitation** (server asks the user for input, now via the MRTR pattern). It takes inspiration from the Language Server Protocol. As of revision 2026-07-28 the core is **stateless**: no protocol-level session, no initialize handshake, every request self-describes its version and capabilities in `_meta`, and servers can run on plain request/response infrastructure (serverless, edge). The spec is authored in the `modelcontextprotocol/modelcontextprotocol` GitHub org and governed by a SEP process with core maintainers; the authoritative protocol requirements derive from the TypeScript schema. MCP is a different layer from WebMCP (a browser page API that borrows MCP vocabulary but has no wire protocol; see the sibling `protocol-webmcp` skill).

---

## 2. Canonical spec URL(s), version, date, status, org

| Field | Value |
|---|---|
| **Canonical spec (pinned revision)** | https://modelcontextprotocol.io/specification/2026-07-28 |
| **Changelog for this revision** | https://modelcontextprotocol.io/specification/2026-07-28/changelog |
| **Schema (source of truth)** | https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/schema/2026-07-28/schema.ts (`LATEST_PROTOCOL_VERSION = "2026-07-28"` in the repo's main schema) |
| **Status** | Latest stable protocol revision. Final shipped **28 July 2026** (release candidate announced earlier; blog post confirms "the final specification ships on July 28, 2026"). |
| **Supersedes** | `2025-11-25`, before that `2025-06-18`, `2025-03-26`, `2024-11-05` (all date strings, format YYYY-MM-DD) |
| **Revision era model** | Spec terminology: **Modern** = `2026-07-28` and later (per-request metadata). **Legacy** = `2025-11-25` and earlier (`initialize` handshake, sessions). **Dual-era** = supports both. |
| **Governance** | SEP (spec enhancement proposal) process, markdown files in `seps/`, core maintainers have final authority. Feature lifecycle policy: Active -> Deprecated -> Removed, minimum twelve month deprecation window. Deprecated registry: https://modelcontextprotocol.io/specification/2026-07-28/deprecated |
| **Announcement** | https://blog.modelcontextprotocol.io/posts/2026-07-28/ (final), https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ (RC) |
| **Normative language** | BCP 14 / RFC 2119 / RFC 8174 |

**Stability for a skill:** stable enough to pin. This is a shipped, dated revision, not a living draft. The moving parts are the extensions (versioned independently), the deprecation clock, and the ecosystem's slow migration off the legacy era. See section 8.

---

## 3. Related repos and docs (with URLs)

### 3.1 Official

- Spec + schema + SEPs: https://github.com/modelcontextprotocol/modelcontextprotocol
- Docs site: https://modelcontextprotocol.io (per-revision spec under `/specification/<date>`)
- Blog: https://blog.modelcontextprotocol.io
- TypeScript SDK v1.x (legacy era): https://github.com/modelcontextprotocol/typescript-sdk - npm `@modelcontextprotocol/sdk`
- TypeScript SDK v2 (modern era, split packages): npm `@modelcontextprotocol/server` + `@modelcontextprotocol/client` (+ `@modelcontextprotocol/core`), both at 2.0.0 on npm as of 30 Aug 2026; migration codemod `npx @modelcontextprotocol/codemod v1-to-v2 .`
- Python SDK: https://github.com/modelcontextprotocol/python-sdk (`mcp` on PyPI; v2 line implements 2026-07-28)
- Go SDK: https://github.com/modelcontextprotocol/go-sdk
- C# SDK: https://github.com/modelcontextprotocol/csharp-sdk (`ModelContextProtocol` on NuGet)
- Registry (server distribution/discovery, not the protocol): https://github.com/modelcontextprotocol/registry
- Official extension repos use the `ext-` prefix inside the org: https://github.com/modelcontextprotocol/ext-apps (MCP Apps / UI extension), https://github.com/modelcontextprotocol/ext-auth (authorization extensions). Experimental extensions use `experimental-ext-`.
- Extensions docs: https://modelcontextprotocol.io/extensions/overview

### 3.2 Third-party adapters relevant to this repo

- Vercel `mcp-handler`: https://github.com/vercel/mcp-handler - npm `mcp-handler`. Latest 2.1.1 (published 2026-08-13) peer-depends on `@modelcontextprotocol/server` ^2.0.0, i.e. the modern-era SDK. The 1.x line (this repo installs 1.1.0) wraps the legacy-era `@modelcontextprotocol/sdk` 1.x.
- MCP Apps SDK: npm `@modelcontextprotocol/ext-apps` (this repo installs 1.5.0). Extension surface, covered by its own sibling skill, not this one.

---

## 4. Compatibility-critical rules (core of this report)

Follow the 2026-07-28 spec pages and schema. SDK docs, blogs, and almost all training-data examples describe the legacy era. Section citations are from https://modelcontextprotocol.io/specification/2026-07-28.

### 4.1 Stateless core: no handshake, self-describing `_meta`

- The `initialize` / `notifications/initialized` handshake is **removed** from the modern era (SEP-2575). A server that supports only 2026-07-28 rejects `initialize` (unknown method).
- Every request **MUST** carry required `_meta` fields:
  - `io.modelcontextprotocol/protocolVersion` (required, string, e.g. `"2026-07-28"`)
  - `io.modelcontextprotocol/clientCapabilities` (required, ClientCapabilities)
  - `io.modelcontextprotocol/clientInfo` (SHOULD, Implementation)
- Results SHOULD carry `io.modelcontextprotocol/serverInfo` in `_meta`. Notifications may carry `io.modelcontextprotocol/subscriptionId`. `io.modelcontextprotocol/logLevel` sets log level per request (the Logging feature itself is deprecated).
- Servers **MUST** implement `server/discover`: advertises `supportedVersions`, capabilities, and identity. Clients MAY call it up front or use it as a backward-compatibility probe on stdio.
- **All results carry a required `resultType` field**: `"complete"` for ordinary results, `"input_required"` for MRTR interim results. Clients MUST treat results from earlier-protocol servers that omit it as `"complete"`.
- **MRTR (Multi Round-Trip Requests)** replaces server-initiated requests (`roots/list`, `sampling/createMessage`, `elicitation/create`). The server returns an `InputRequiredResult` (`resultType: "input_required"`) whose `inputRequests` map carries the requests; the client retries the **original request** with `inputResponses` (and `requestState` if the server provided one) and a **new JSON-RPC id**. Servers never send their own JSON-RPC requests on response streams in this revision.
- Cross-call state uses explicit server-minted handles passed as ordinary tool arguments (non-normative "Stateful Tools" guidance: validate authorization per call, opaque ids, stated lifetime, clear expiry errors). List endpoints MUST NOT vary per connection; they MAY vary by the authorization on the request.
- OpenTelemetry trace context propagates via `_meta` keys `traceparent`, `tracestate`, `baggage`.

### 4.2 Transport: Streamable HTTP (POST-only endpoint), stdio

- The server exposes a **single MCP endpoint that supports POST**. Each JSON-RPC request or notification is its own HTTP POST. Responses are either `application/json` (single object) or `text/event-stream` (SSE scoped to that request); clients MUST support both. Notifications get `202 Accepted` with no body.
- **The GET stream endpoint is removed. Protocol-level sessions are removed.** A modern-only server answers GET or DELETE on the MCP endpoint with `405 Method Not Allowed`, **ignores** any `Mcp-Session-Id` header, and does not mint or echo session ids. `Last-Event-ID` / SSE resumability is removed; a broken stream loses the request and the client MUST re-issue it with a new request id.
- Required headers on every POST (REQUIRED for compliance):
  - `MCP-Protocol-Version: 2026-07-28` - MUST match `_meta`'s `io.modelcontextprotocol/protocolVersion`, else `400` + JSON-RPC error `-32020` (`HeaderMismatch`).
  - `Mcp-Method: <method>` on all requests.
  - `Mcp-Name: <params.name or params.uri>` on `tools/call`, `resources/read`, `prompts/get`.
  - `Accept: application/json, text/event-stream`.
- Values that are not header-safe ASCII use the Base64 sentinel format `=?base64?<b64>?=` (lowercase markers, exact).
- `x-mcp-header` in a tool's `inputSchema` property mirrors that argument into an `Mcp-Param-{Name}` header. Optional for servers; clients on Streamable HTTP MUST support it and MUST reject (exclude from `tools/list`) tool definitions with invalid `x-mcp-header` values. Only primitive types (string, integer, boolean; not `number`), only properties statically reachable via `properties` chains (no `items`, `oneOf`/`anyOf`/`allOf`/`not`, `if`/`then`/`else`, `$ref`). Never mark sensitive parameters.
- Servers processing the body MUST validate header values against body values; mismatch or missing required header -> `400` + `-32020`.
- Unknown RPC method -> `404 Not Found` + JSON-RPC `-32601` (the error body distinguishes a modern server from a legacy HTTP+SSE server's 404).
- `subscriptions/listen` (replaces the GET stream and `resources/subscribe`/`unsubscribe`): one long-lived POST whose SSE response stream carries only opted-in change notifications (`toolsListChanged`, `promptsListChanged`, `resourcesListChanged`, `resourceSubscriptions`); the server acknowledges with `notifications/subscriptions/acknowledged` and tags notifications with `io.modelcontextprotocol/subscriptionId`. Request-scoped notifications (`notifications/progress`, `notifications/message`) flow only on the response stream of the request they relate to, never on the listen stream.
- **Cancellation on Streamable HTTP = closing the SSE response stream.** No `notifications/cancelled` on HTTP (stdio keeps it). Servers SHOULD stop work promptly and MUST NOT send further messages for a cancelled request.
- Security: servers MUST validate the `Origin` header (403 on invalid) against DNS rebinding; local servers SHOULD bind 127.0.0.1; SSE responses SHOULD set `X-Accel-Buffering: no`; long streams keep alive with SSE comment lines.
- Error code allocation: `-32000`..`-32019` implementation-defined (grandfathered), `-32020`..`-32099` reserved for the MCP spec. Defined: `-32020` HeaderMismatch, `-32021` MissingRequiredClientCapability, `-32022` UnsupportedProtocolVersion. Resource not found is now `-32602` (was `-32002`).
- stdio remains a transport; auth on stdio comes from the environment, not OAuth.

### 4.3 Versioning and negotiation

- Protocol revision strings are dates, `YYYY-MM-DD`. There is **no negotiation handshake**: every request declares its version; the server accepts or rejects each request independently. Unsupported version -> `-32022` `UnsupportedProtocolVersionError` with `data.supported` listing the server's versions; the client retries with a mutually supported one.
- A server MAY treat a request with no `MCP-Protocol-Version` header as `2025-03-26` (pre-2025-06-18 clients did not send the header) if it chooses to support such clients; otherwise it MUST reject per server validation.
- Era detection for dual-era clients: attempt a modern request; on `400`, inspect the body - a recognized modern JSON-RPC error means modern server (retry, do not fall back); anything else means legacy (fall back to `initialize`, possibly further to deprecated HTTP+SSE). Era is a property of the server; cache it.
- Compatibility matrix (spec): Modern client x Legacy server fails; Legacy client x Modern-only server fails; dual-era on either side works. A dual-era server selects per opening: modern `_meta` -> stateless semantics; `initialize` -> legacy semantics for that session/process.

### 4.4 Tools: definition shape and annotations

- `Tool` fields: `name`, `title` (optional display name), `description`, `icons` (optional), `inputSchema` (required; MUST be a valid JSON Schema **object**, not `null`; JSON Schema 2020-12 by default when `$schema` absent; any 2020-12 keywords allowed since this revision), `outputSchema` (optional), `annotations` (optional), `_meta`.
- No-parameter tools: `{ "type": "object", "additionalProperties": false }` (recommended) or `{ "type": "object" }`.
- Tool names (all SHOULD, not MUST): 1 to 128 chars, case sensitive, only ASCII letters, digits, `_`, `-`, `.`; unique within a server. Aggregating clients disambiguate collisions themselves (e.g. server-id prefix); `serverInfo.name` is NOT guaranteed unique and SHOULD NOT be used for disambiguation.
- **`ToolAnnotations` (verbatim from the 2026-07-28 schema), all optional:**
  - `title?: string`
  - `readOnlyHint?: boolean` - default **false** ("the tool does not modify its environment")
  - `destructiveHint?: boolean` - default **true** (meaningful only when `readOnlyHint == false`)
  - `idempotentHint?: boolean` - default **false** (meaningful only when `readOnlyHint == false`)
  - `openWorldHint?: boolean` - default **true** (open world of external entities, e.g. web search vs memory tool)
  - Contrast with WebMCP, whose `ToolAnnotations` has exactly two fields: `readOnlyHint` and `untrustedContentHint`. `untrustedContentHint` is **not** MCP vocabulary; `destructiveHint` / `idempotentHint` / `openWorldHint` are **not** WebMCP vocabulary. Do not mix the sets.
  - Clients MUST treat annotations as untrusted unless from a trusted server; they are hints, never security guarantees.
- `tools/call` result: `resultType`, `content[]` (text | image | audio | resource_link | resource), optional `structuredContent` (any JSON value conforming to `outputSchema` if defined; SHOULD be mirrored as serialized JSON in a TextContent block for backward compatibility), `isError` for tool execution errors (protocol errors use JSON-RPC errors instead). If `outputSchema` is provided, servers MUST conform and clients SHOULD validate. Clients SHOULD follow the spec's `$ref` resolution requirements when validating.
- **`ttlMs` and `cacheScope` are required** on results of `tools/list`, `prompts/list`, `resources/list`, `resources/read`, and `resources/templates/list` (`CacheableResult`): `ttlMs` is a freshness hint in milliseconds; `cacheScope` is `"public"` or `"private"`. Servers SHOULD return tools in deterministic order (client caching, LLM prompt cache hits).
- List changed notifications ride the `subscriptions/listen` stream for clients that opted in with `toolsListChanged: true`.

### 4.5 Authorization (HTTP transports)

- Authorization is OPTIONAL; when supported on HTTP it SHOULD follow the spec. Base standards: OAuth 2.1 (draft-ietf-oauth-v2-1-13), RFC 6750 bearer tokens, RFC 8414 AS metadata, RFC 9728 protected resource metadata, RFC 8707 resource indicators, RFC 9207 issuer identification, CIMD draft, OIDC Discovery.
- Discovery: MCP servers **MUST** implement RFC 9728 Protected Resource Metadata; clients **MUST** use it to find the authorization server (401 response carries `WWW-Authenticate: Bearer resource_metadata="https://.../.well-known/oauth-protected-resource", scope="..."`). Authorization servers MUST provide RFC 8414 metadata or OIDC Discovery; clients MUST support **both** mechanisms.
- **Client registration priority: Client ID Metadata Documents (CIMD) first.** Authorization servers and clients **SHOULD** support CIMD (draft-ietf-oauth-client-id-metadata-document-00): the client uses an **HTTPS URL as its `client_id`**; the AS detects the URL-formatted client_id, fetches the JSON metadata document from that URL, and validates the metadata and `redirect_uris`. No registration round trip.
- **Dynamic Client Registration (RFC 7591) is deprecated** in favor of CIMD; MAY still be supported for backward compatibility with authorization servers that lack CIMD. Clients that do use registration must key persisted credentials by issuer, never reuse them across authorization servers, and set an appropriate `application_type`.
- Clients MUST implement RFC 8707: the `resource` parameter (canonical MCP server URI, lowercase scheme/host, no fragment) goes in both authorization and token requests regardless of AS support. Servers MUST validate token audience and MUST NOT accept or pass through foreign tokens. Bearer tokens go in the `Authorization` header on every request, never in the query string. Invalid/expired token -> 401; insufficient scope -> 403 with `error="insufficient_scope"` and a `scope` challenge; clients step up by requesting the union of prior and challenged scopes.
- RFC 9207: AS SHOULD include `iss` in authorization responses; clients MUST validate a present `iss` against the recorded issuer (exact string compare, no normalization) before redeeming the code. A future revision is expected to upgrade AS `iss` inclusion to MUST.

### 4.6 Extensions framework

- Extension identifier format: `{vendor-prefix}/{extension-name}`, following `_meta` key naming with a mandatory prefix. Official extensions use the `io.modelcontextprotocol` prefix; third parties use their own reverse domain (`com.example/my-extension`).
- Exact official ids verified on spec pages: **`io.modelcontextprotocol/tasks`** (Tasks), **`io.modelcontextprotocol/ui`** (MCP Apps), **`io.modelcontextprotocol/oauth-client-credentials`** (OAuth client credentials). Enterprise Managed Authorization lives in ext-auth (id not quoted on the fetched pages).
- Negotiation: `extensions` field inside capabilities - clients in `_meta["io.modelcontextprotocol/clientCapabilities"].extensions` on each request, servers in the `server/discover` response capabilities. Extensions are always opt-in and disabled by default; each defines its settings object schema; graceful degradation to core behavior (or a clean rejection when the extension is mandatory).
- **Tasks moved out of the experimental core into the `io.modelcontextprotocol/tasks` extension** (SEP-2663): polling via `tasks/get` (replacing blocking `tasks/result`), client input via `tasks/update`, `tasks/list` removed, servers may return task handles unsolicited. Do not generate the pre-extension core task methods.
- Extensions evolve independently of the core revision; a breaking change gets a new identifier (`.../my-extension-v2`), not a mutation.

### 4.7 Deprecated and removed (this revision)

Deprecated (still functional, minimum twelve month window, new implementations should not adopt; tracked in the deprecated registry):

- **Roots, Sampling, Logging** (SEP-2577). Migrations: pass directories/files via tool parameters, resource URIs, or server configuration instead of Roots; integrate directly with LLM provider APIs instead of Sampling; log to stderr (stdio) or OpenTelemetry instead of Logging.
- **HTTP+SSE transport** (from 2024-11-05; informally deprecated since 2025-03-26, now formally Deprecated under the lifecycle policy, SEP-2596). The blog calls it "officially deprecated, with a year-long offramp". Migrate to Streamable HTTP.
- `includeContext` values `"thisServer"` / `"allServers"`.
- **Dynamic Client Registration** (RFC 7591) in favor of CIMD.

Removed outright in 2026-07-28 (do not generate against the latest version):

- `initialize` / `notifications/initialized`; the `Mcp-Session-Id` header and protocol sessions; the HTTP GET stream; SSE resumability (`Last-Event-ID`); `ping`; `logging/setLevel`; `notifications/roots/list_changed`; `resources/subscribe` / `resources/unsubscribe` (replaced by `subscriptions/listen`); server-initiated requests on streams (replaced by MRTR); `notifications/elicitation/complete` and URL-mode `elicitationId` (both introduced only in 2025-11-25); core task methods (moved to the extension).

### 4.8 Common ways generated code breaks the spec

Stale training data overwhelmingly teaches the 2024-2025 legacy era. The highest-frequency breaks:

1. **Stale version strings**: emitting `2024-11-05`, `2025-03-26`, or `2025-06-18` as "the current protocol version". Latest is `2026-07-28`; version strings are dates and each is a distinct contract.
2. **HTTP+SSE transport as current**: a GET `/sse` endpoint returning an `endpoint` event plus a separate POST endpoint. Deprecated since 2025-03-26, formally Deprecated now. Streamable HTTP (single POST endpoint) is the transport.
3. **`initialize` handshake presented as required by the latest spec**: generated clients that open with `initialize`/`notifications/initialized` speak the legacy era. Fine against legacy or dual-era servers; a 2026-07-28-only server rejects it. Teaching material MUST NOT present the handshake as current.
4. **Minting or echoing `Mcp-Session-Id`**: sessions are gone. Modern servers ignore the header; state rides in explicit tool-argument handles.
5. **Missing modern request plumbing**: no `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name` headers, no `_meta` protocolVersion/clientCapabilities, no `resultType` on results, no `ttlMs`/`cacheScope` on list results.
6. **DCR as the current auth registration story**: RFC 7591 dynamic registration is deprecated; CIMD (HTTPS URL as `client_id` serving a metadata document) is the SHOULD. Also: skipping RFC 9728 discovery, skipping the RFC 8707 `resource` parameter, or putting tokens in query strings.
7. **Roots / Sampling / Logging as current features**: all three are Deprecated; `logging/setLevel`, `ping`, and `notifications/roots/list_changed` are removed. Server-initiated `sampling/createMessage`, `roots/list`, `elicitation/create` requests on SSE streams are replaced by MRTR interim results.
8. **`resources/subscribe` / GET notification streams / `Last-Event-ID` resumability**: replaced by `subscriptions/listen`; streams are not resumable, re-issue the request.
9. **Old error codes**: `-32002` for resource not found (now `-32602`); inventing codes inside `-32020`..`-32099` (reserved for the spec).
10. **Annotation vocabulary bleed with WebMCP**: `untrustedContentHint` on an MCP tool (WebMCP-only), or `destructiveHint`/`idempotentHint`/`openWorldHint` on a WebMCP tool (MCP-only). Also trusting annotations as enforcement.
11. **Tasks as core methods**: `tasks/result` (blocking) or `tasks/list`; the extension shape is `tasks/get` polling + `tasks/update`, negotiated as `io.modelcontextprotocol/tasks`.
12. **Retrying MRTR with the same JSON-RPC id** or answering `inputRequests` as separate JSON-RPC responses; the retry is a fresh request carrying `inputResponses` (+ `requestState`).

**Observer vs emitter posture matters**: most deployed servers still speak the legacy era, so scanner/detection code legitimately references `initialize`, `Mcp-Session-Id`, and HTTP+SSE as signatures of what exists in the wild. Emitted snippets, teaching copy, and "current spec" claims must be 2026-07-28-correct, or must explicitly name the older revision they target.

---

## 5. Things that look similar but are NOT MCP core

- **WebMCP**: W3C WebML CG browser API (`document.modelContext`). Borrows MCP vocabulary (tools, inputSchema, annotations) but is a JavaScript page API with **no wire protocol, no JSON-RPC, no transports, no versioned revisions**. Different annotation set (`readOnlyHint` + `untrustedContentHint`). Covered by the sibling `protocol-webmcp` skill; never apply MCP transport/auth/session rules to it.
- **MCP Apps**: an **extension of MCP** (`io.modelcontextprotocol/ui`, repo `modelcontextprotocol/ext-apps`), not core protocol. Interactive UI (charts, forms) rendered inline in conversations. Gets its own sibling skill; this report covers only how it is negotiated (extensions field).
- **OpenAI Apps SDK**: OpenAI's framework for apps inside ChatGPT. Related to MCP (it consumes MCP servers) but the app/UI surface (`window.openai`, component rendering) is OpenAI's own, not an MCP spec. Do not cite it as MCP core requirements.
- **MCP Tasks / ext-auth extensions**: official but opt-in extensions, versioned independently; core conformance does not require them.
- **The MCP registry** (`modelcontextprotocol/registry`): server distribution and discovery metadata, not protocol behavior.
- **FastMCP, mcp-handler, mcp-use, LangChain/AI SDK MCP clients**: frameworks and adapters. Their API shapes (e.g. `createMcpHandler`) are not spec vocabulary, and their supported protocol revision lags or leads independently of their own package versions.
- **A2A (Agent2Agent), ACP, OpenAI function calling, ChatGPT Actions/OpenAPI**: adjacent agent/tool protocols; none are MCP.
- **`modelcontextprotocol.io/specification/latest` vs a pinned date**: "latest" is a moving alias. This skill pins `2026-07-28`; cite the dated URL.

---

## 6. Ecosystem: SDKs, adapters, deployed reality (implementation lag)

Verified 30 August 2026:

- **TypeScript SDK 1.x (`@modelcontextprotocol/sdk`)**: latest published is **1.30.0**; its `types.js` still declares `LATEST_PROTOCOL_VERSION = '2025-11-25'`, `DEFAULT_NEGOTIATED_PROTOCOL_VERSION = '2025-03-26'`, `SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05', '2024-10-07']`. **The 1.x line does not speak 2026-07-28 at all.** It negotiates via `initialize`, i.e. the legacy era.
- **This repo installs `@modelcontextprotocol/sdk` ^1.29.0 (1.29.0 on disk)** with identical constants (verified in `node_modules/.../dist/esm/types.js`). Anything Ora serves through it is a legacy-era MCP server, max revision 2025-11-25. That is spec-legal (dual-era interop, twelve month windows) but emitted teaching content must not label its mechanics "the latest spec".
- **TypeScript SDK v2** (modern era): split packages `@modelcontextprotocol/server` and `@modelcontextprotocol/client` over `@modelcontextprotocol/core`, **2.0.0 stable on npm** (dist-tag latest), ESM-only, Node 20+/Bun/Deno. Implements 2026-07-28. Migration codemod: `npx @modelcontextprotocol/codemod v1-to-v2 .`. (The June 2026 SDK-betas blog post described these as betas; they have since gone stable.)
- **Other SDKs** (per the announcement + betas posts): Python v2 (`mcp` 2.0.0b1 at the betas post), Go `v1.7.0-pre.1`, C# `2.0.0-preview.1` implement 2026-07-28; Rust in beta. All Tier 1 SDKs support 2026-07-28 per the final announcement. Current stable status of each was not re-verified beyond TypeScript.
- **Vercel `mcp-handler`**: npm latest **2.1.1** (published 2026-08-13) peer-depends on `@modelcontextprotocol/server` ^2.0.0, so the current mcp-handler line is on the modern-era SDK. **This repo pins `mcp-handler` ^1.1.0 (1.1.0 on disk)**, the older line that wraps sdk 1.x (the repo overrides its sdk to the shared ^1.29.0). So the repo's whole MCP-serving stack tops out at 2025-11-25.
- **`@modelcontextprotocol/ext-apps`**: repo installs 1.5.0 (MCP Apps extension SDK; sibling skill territory).
- **What the wild speaks**: the legacy era dominates deployed servers and clients - the 1.x SDK's supported list (`2025-03-26`, `2025-06-18`, `2025-11-25` plus older) is what most shipped code negotiates, and the spec's dual-era machinery plus the blog's migration-cost note exist precisely because of that install base. (Inference from SDK constants and spec compatibility text, not a measured survey.) Scanner heuristics should expect `initialize`-era servers as the common case for months and treat a 2026-07-28 modern-only server as the growing minority.
- **Claude/Anthropic adoption**: claude.com blog post "MCP 2026-07-28 spec: stateless core, coming to Claude" exists (found via search, not fetched; no claims taken from it beyond its existence).

---

## 7. Unstable areas and landed breaking changes

### 7.1 Landed in 2026-07-28 (the changelog, condensed - do not generate the old forms against this revision)

Major: sessions + `Mcp-Session-Id` removed (SEP-2567); stateless `_meta`-based version/capability carriage replacing `initialize` (SEP-2575); `server/discover` added (SEP-2575); `subscriptions/listen` replacing the GET stream and resource subscribe/unsubscribe (SEP-2575); `ping`, `logging/setLevel`, `notifications/roots/list_changed` removed; Tasks moved to the `io.modelcontextprotocol/tasks` extension with polling redesign (SEP-2663); MRTR replacing server-initiated requests (SEP-2322); required `resultType` on all results (SEP-2322); SSE resumability removed (SEP-2575).

Minor: `extensions` capability field; OTel `_meta` conventions (SEP-414); deterministic `tools/list` ordering; required `Mcp-Method`/`Mcp-Name` headers + `x-mcp-header` (SEP-2243); required `ttlMs`/`cacheScope` via `CacheableResult` (SEP-2549); resource not found `-32002` -> `-32602`; RFC 9207 `iss` validation (SEP-2468); DCR `application_type` requirement (SEP-837); credentials keyed by issuer (SEP-2352); `inputSchema`/`outputSchema` loosened to full JSON Schema 2020-12 with `$ref` resolution requirements and composition bounds (SEP-2106); `notifications/elicitation/complete` + `elicitationId` removed; error code range partition with renumbering (`HeaderMismatch` `-32001` -> `-32020`, `MissingRequiredClientCapability` `-32003` -> `-32021`, `UnsupportedProtocolVersion` `-32004` -> `-32022`).

Governance: feature lifecycle policy (Active/Deprecated/Removed, twelve month minimum window, deprecated registry); PR-based SEP workflow.

### 7.2 Unstable / watch list (do not encode as hard rules)

- **Deprecation clocks**: Roots, Sampling, Logging, HTTP+SSE, `includeContext` values, and DCR are all Deprecated with a twelve month minimum window - removals become possible in a revision after roughly July 2027. Track the deprecated registry.
- **`iss` upgrade**: AS inclusion of `iss` is expected to move from SHOULD to MUST in a future revision.
- **Extensions evolve independently** of the core revision (Tasks, MCP Apps, ext-auth); their ids are stable but their contents version separately. MCP Apps rules belong to its own skill snapshot.
- **Notification POST header requirements** on Streamable HTTP are explicitly not defined by this revision.
- **Tool name grammar is SHOULD-level**, unlike WebMCP's MUST grammar; do not hard-fail scans on it, and expect the Base64 sentinel for unsafe names in `Mcp-Name`.
- **A next draft revision exists** at `/specification/draft` on the docs site; nothing there is normative until dated and released.
- **SDK churn**: the TS v2 packages went stable very recently ("pin the exact version" was the beta-era guidance); the 1.x line continues to receive releases without modern-era support. Whether 1.x will ever gain 2026-07-28 support is unknown.

---

## 8. Is the spec stable enough to encode as a skill?

Yes - a dated, shipped revision is exactly the right thing to pin, and it is much firmer ground than the WebMCP CG draft. Encode with these conditions:

1. The skill pins **revision 2026-07-28** and states that asserting behavior past it requires re-reading https://modelcontextprotocol.io/specification/2026-07-28 (and `/specification/latest` for a newer dated revision), then moving the snapshot and skill together.
2. Move the snapshot when any of these happen: a new dated revision is published as latest; a Deprecated feature (HTTP+SSE, Roots/Sampling/Logging, DCR, `includeContext` values) transitions to Removed; the `iss` SHOULD becomes MUST; or the extension ids this report quotes change shape.
3. Hard rules are limited to the shipped 2026-07-28 core: stateless `_meta` carriage, `resultType`, Streamable HTTP header set, no sessions, `subscriptions/listen`, MRTR, the ToolAnnotations vocabulary, `ttlMs`/`cacheScope`, RFC 9728 + 8414 discovery, RFC 8707 `resource`, CIMD-over-DCR priority, the error code map, and the extension negotiation shape.
4. The skill distinguishes **observer** files (may reference `initialize`, `Mcp-Session-Id`, HTTP+SSE, DCR, roots/sampling as detection signatures for the legacy install base, with a reason) from **first-party author** and **emitter** files (spec-current, or explicitly labeled with the older revision they target). This mirrors the `protocol-webmcp` skill's posture split.
5. The skill records the local reality: this repo's serving stack (`@modelcontextprotocol/sdk` 1.29.0, `mcp-handler` 1.1.0) speaks the legacy era, max 2025-11-25; upgrading to modern-era serving means the v2 packages (`@modelcontextprotocol/server` 2.x) and `mcp-handler` 2.x, which is a migration, not a version bump.
6. Ecosystem-lag rules (what SDKs negotiate, what the wild speaks) are re-verified per snapshot, never trusted from this report's date forward.

---

## 9. Source list (URLs)

Specification (all fetched 30 Aug 2026):

- https://modelcontextprotocol.io/specification/2026-07-28
- https://modelcontextprotocol.io/specification/2026-07-28/changelog
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
- https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- https://modelcontextprotocol.io/specification/2026-07-28/server/tools
- https://modelcontextprotocol.io/extensions/overview
- https://raw.githubusercontent.com/modelcontextprotocol/modelcontextprotocol/main/schema/2026-07-28/schema.ts
- https://modelcontextprotocol.io/specification/2026-07-28/deprecated (linked from changelog; not fetched directly)

Blog / announcements:

- https://blog.modelcontextprotocol.io/posts/2026-07-28/ (fetched)
- https://blog.modelcontextprotocol.io/posts/sdk-betas-2026-07-28/ (fetched)
- https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/ (search result, not fetched)
- https://claude.com/blog/bringing-mcp-2026-07-28-to-claude (search result, not fetched)
- https://developers.googleblog.com/scaling-ai-agent-infrastructure-with-the-mcp-stateless-updates/ (search result, not fetched)

Repos:

- https://github.com/modelcontextprotocol/modelcontextprotocol
- https://github.com/modelcontextprotocol/typescript-sdk
- https://github.com/modelcontextprotocol/registry
- https://github.com/modelcontextprotocol/ext-apps
- https://github.com/modelcontextprotocol/ext-auth
- https://github.com/vercel/mcp-handler

Installed / npm reality (verified via local `node_modules` and `npm view`, 30 Aug 2026):

- `@modelcontextprotocol/sdk` installed 1.29.0 / npm latest 1.30.0 - both `LATEST_PROTOCOL_VERSION = '2025-11-25'`
- `@modelcontextprotocol/server` / `@modelcontextprotocol/client` npm latest 2.0.0
- `mcp-handler` installed 1.1.0 / npm latest 2.1.1 (peer: `@modelcontextprotocol/server` ^2.0.0)
- `@modelcontextprotocol/ext-apps` installed 1.5.0

---

## Appendix A - Minimal modern-era tools/call over Streamable HTTP (spec-shaped)

POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: get_weather

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_weather",
    "arguments": { "location": "Seattle, WA" },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { "name": "ExampleClient", "version": "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}

Success result (single JSON object variant):

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "content": [{ "type": "text", "text": "72F, partly cloudy" }],
    "isError": false,
    "_meta": { "io.modelcontextprotocol/serverInfo": { "name": "ExampleServer", "version": "1.0.0" } }
  }
}

No `initialize` was sent; no session id exists; a version the server does not support would have returned 400 + `-32022` with a `supported` list to retry from.

End of report. Spec snapshot: MCP revision 2026-07-28 (latest stable). Research completed 30 August 2026 (Asia/Jerusalem).

---

## Addendum 2026-11-09 - in-place edits to the 2026-07-28 tree, nothing normative moved

The spec-drift watch flagged the pinned folder `docs/specification/2026-07-28` moving from tree `494ea7d0` to `96b3ac6e`; PR #1598 moved `MCP_SPEC_SOURCE_TREE_SHA` to `96b3ac6ef4f0782af3b46ce555ad9b162dafcd24` after review, and `MCP_SPEC_SNAPSHOT` stays `2026-07-28` (no newer dated revision exists). The two upstream commits, re-read on 2026-11-09:

- **`9850cae8` (2026-10-28, #3462), `server/tools.mdx`.** The embedded resource example nested `annotations` inside `resource`; it now sits beside `resource`, matching `EmbeddedResource` in `schema.ts`. The schema always had this shape. Ora emits no `EmbeddedResource` content.
- **`38353251` (2026-11-06, #3185), `schema.mdx` regenerated from `schema/2026-07-28/schema.ts`.** A non-normative paragraph on `Tool.inputSchema`: with composition keywords, declare `properties` at the root and keep branches to presence assertions such as `required`, because a type error inside a `oneOf` branch that does not match is never enforced. No RFC 2119 keyword was added, and `inputSchema` / `outputSchema` keep their wire shapes. Ora's first-party tool schemas are zod object shapes with root `properties`, already the shape the guidance asks for.

Server cards, re-read the same day: `seps/2127-mcp-server-cards.md` (commit `5c8483d5`) is Status Final with extension identifier `io.modelcontextprotocol/server-card`; `ext-server-card` `docs/discovery.md` (commit `526201bb`) still reads Protocol Revision draft, reserves `<streamable-http-url>/server-card`, and does not recommend a card under `.well-known` because `.well-known` is for site-wide metadata. The card schema's `title` is the display name and `icons[].src` is required on each icon.

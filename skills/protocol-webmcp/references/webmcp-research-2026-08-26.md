# WebMCP research report for spec-compatible code generation

**Research date:** Saturday 29 August 2026 (Asia/Jerusalem, UTC+3)
**Canonical spec snapshot used:** W3C Web Machine Learning Community Group Draft, **26 August 2026**
**Primary source:** https://webmachinelearning.github.io/webmcp/
**Bikeshed source of truth:** https://github.com/webmachinelearning/webmcp/blob/main/index.bs

This report is for a coding-agent skill. It prefers the published Community Group draft and its GitHub source over blogs, polyfills, and vendor docs. Where Chrome, TypeScript types, or third-party packages lag or diverge, that is called out as **implementation lag**, not as the spec.

Do not invent APIs. Anything not in the 26 August 2026 draft or an explicitly cited explainer is marked unpublished / unstable.

---

## 1. What WebMCP is (one paragraph)

WebMCP is a proposed **browser JavaScript API** (not a network protocol) that lets a live web page expose client-side tools - named JavaScript functions, plus optionally annotated HTML forms - so in-browser AI agents, browser-built-in agents, extensions, and in-page iframe agents can discover and invoke those tools instead of scraping the DOM or simulating clicks. Tools carry a natural-language description and a JSON Schema for inputs; they execute in the page own event loop, with the user existing cookies, session, and UI still in view. The specification is incubated by the **W3C Web Machine Learning Community Group**. It is **not** a W3C Standard, **not** on the W3C Standards Track, and **not** an implementation of Anthropic Model Context Protocol (MCP): it borrows MCP vocabulary (tools, schemas) while using web-platform mechanisms (origins, Permissions Policy, AbortSignal, Document lifecycle). A page that uses WebMCP can be *thought of* as an in-page MCP server, but the wire format to a browser agent is implementation-defined and is not JSON-RPC/MCP.

---

## 2. Canonical spec URL(s), version, date, status, editors/org

| Field | Value |
|---|---|
| **Canonical rendered spec** | https://webmachinelearning.github.io/webmcp/ |
| **Canonical shortname / URL field in bikeshed** | `webmcp` -> https://webmachinelearning.github.io/webmcp |
| **Source** | https://github.com/webmachinelearning/webmcp/blob/main/index.bs |
| **Status** | **CG-DRAFT** - Draft Community Group Report. Explicitly: It is not a W3C Standard nor is it on the W3C Standards Track. |
| **Date on rendered draft** | **26 August 2026** |
| **Group** | W3C Web Machine Learning Community Group (`webml`) |
| **Editors (from index.bs)** | **Brandon Walderman**, Microsoft (brwalder@microsoft.com, w3cid 115877); **Khushal Sagar**, Google (khushalsagar@google.com, w3cid 122787); **Dominic Farolino**, Google (domfarolino@google.com, w3cid 102763) |
| **Test suite** | https://wpt.fyi/results/webmcp (declared in bikeshed Test Suite field) |
| **JSON Schema cited** | JSON Schema 2020-12: https://json-schema.org/draft/2020-12/json-schema-core.html |
| **MCP cited (related, not the wire protocol)** | https://modelcontextprotocol.io/specification/latest |
| **Explainer (same repo README)** | https://github.com/webmachinelearning/webmcp/blob/main/README.md |
| **Declarative explainer (not folded into spec)** | https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md |
| **Implementation status** | https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md |
| **Security/privacy questionnaire** | https://github.com/webmachinelearning/webmcp/blob/main/security-privacy-questionnaire.md |
| **W3C TAG review (open, in progress)** | https://github.com/w3ctag/design-reviews/issues/1238 |
| **web-platform-tests** | https://github.com/web-platform-tests/wpt (directory webmcp/) |

**There is no WHATWG or IETF draft.** WebMCP is not HTML Standard text. It is not an RFC. Venue is the WebML Community Group; WebKit has objected to that venue.

**webmcp.dev:** not an official spec host. Do not treat it as canonical. The official rendered spec is on webmachinelearning.github.io.

**Stability for a skill:** **not frozen.** Encode the 26 August 2026 imperative API as the current contract, with feature detection and explicit Chrome lag / open-issues notes. Do **not** treat the draft as a Recommendation. See section 8.

---


## 3. Related repos and docs (with URLs)

### 3.1 Official / vendor

- Spec repo: https://github.com/webmachinelearning/webmcp
- Official TypeScript types: https://www.npmjs.com/package/webmcp-types
- Types repo: https://github.com/webmachinelearning/webmcp-types
- Chrome docs hub (updated 7 Aug 2026): https://developer.chrome.com/docs/ai/webmcp
- Chrome imperative API (updated 20 Aug 2026): https://developer.chrome.com/docs/ai/webmcp/imperative-api
- Chrome declarative API: https://developer.chrome.com/docs/ai/webmcp/declarative-api
- Chrome vs MCP: https://developer.chrome.com/docs/ai/webmcp/compare-mcp
- Chrome best practices: https://developer.chrome.com/docs/ai/webmcp/best-practices
- Chrome tool security: https://developer.chrome.com/docs/ai/webmcp/secure-tools
- Chrome origin-trial blog (9 Jun 2026): https://developer.chrome.com/blog/ai-webmcp-origin-trial
- Chrome Status: https://chromestatus.com/feature/5117755740913664
- Blink Intent to Experiment: https://groups.google.com/a/chromium.org/g/blink-dev/c/gmYffo5WOE8/m/OJxuQRP3AAAJ
- Chrome demos: https://github.com/GoogleChromeLabs/webmcp-tools
- Chrome modern-web guidance: https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/webmcp/agentic-javascript-tools/guide.md
- Mozilla NEUTRAL: https://github.com/mozilla/standards-positions/issues/1412
- WebKit OPPOSE: https://github.com/WebKit/standards-positions/issues/670
- Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=2018306
- Brave Leo: https://github.com/brave/brave-browser/issues/55232
- Chrome DevTools MCP (consumer, not spec): https://github.com/ChromeDevTools/chrome-devtools-mcp

---

## 4. Compatibility-critical rules (core of this report)

Follow the 26 August 2026 CG draft and index.bs. Chrome docs, polyfills, and blogs are secondary and sometimes wrong. Section citations are from https://webmachinelearning.github.io/webmcp/

### 4.1 Where the API lives

MUST use document.modelContext, a [SecureContext, SameObject] readonly attribute on Document (spec section 4.1).

WebIDL (spec IDL Index):
partial interface Document { [SecureContext, SameObject] readonly attribute ModelContext modelContext; }
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject = {}, optional ModelContextExecuteToolOptions options = {});
  attribute EventHandler ontoolchange;
}

MUST NOT treat navigator.modelContext as current spec. Getter moved from Navigator to Document. Chrome 150 keeps a deprecated alias; newer Chrome may drop it. Feature-detect document.modelContext first.

MUST NOT call removed APIs: unregisterTool(), provideContext(), clearContext(), window.agent, document.agent. Unregistration is ONLY via AbortSignal passed to registerTool (section 4.2.3).

MUST NOT use testing shim navigator.modelContextTesting (listTools / executeTool(name, jsonString)) in production code. That is a Chromium testing surface. Cloudflare April 2026 docs still show it; they are stale.

ModelContext is Window-only, SecureContext. No Worker. No Service Worker in the current spec (a Service Workers explainer exists but is not spec text).

### 4.2 Secure context, origin isolation, fully active document

From index.bs registerTool / getTools / executeTool method steps (bikeshed is slightly more complete than the rendered HTML on origin-keying):

- MUST run in a secure context. The attribute is [SecureContext]. HTTPS or localhost; not plain HTTP.
- MUST be on a fully active Document. Otherwise registerTool / getTools / executeTool reject with InvalidStateError.
- MUST be allowed to use the Permissions Policy feature "tools". Otherwise reject with NotAllowedError.
- Origin isolation (Chrome docs plus bikeshed): if the surrounding agent cluster is not origin-keyed and the origin scheme is not "file", reject with SecurityError. Chrome: WebMCP is only available in origin-isolated documents. If document.domain is relaxed (e.g. Origin-Agent-Cluster: ?0), the APIs are disabled.
- Chrome docs: do not set document.domain. Keep origin isolation.

### 4.3 Permissions Policy feature name is tools (not model-context)

Section 4.5: access is gated behind policy-controlled feature "tools", default allowlist self.

- Top-level and same-origin iframes: allowed by default.
- Cross-origin iframes: disabled by default. Parent MUST delegate with allow="tools" on the iframe, or an equivalent Permissions-Policy allowlist.
- To disable site-wide: Permissions-Policy: tools=() HTTP header. README: registerTool() then rejects with NotAllowedError.
- MUST NOT invent a model-context Permissions-Policy token. Some third-party blogs claim that header; the spec and Chrome docs say tools.
- Declarative registration error handling when the policy is disabled is TBD (Issue 182).

### 4.4 registerTool(tool, options) required shape

registerTool returns Promise<undefined> (resolves with undefined, not the tool).

ModelContextTool dictionary (section 4.2.1):
- name: required DOMString. See name grammar.
- title: optional USVString. Human UI label; SHOULD be localized to navigator.language. If omitted, UA may pick a display value. getTools currently defaults missing title to empty string (Issue 224 may change this to omitted/undefined).
- description: required DOMString. Empty string -> InvalidStateError.
- inputSchema: optional object. JSON Schema object, NOT a JSON string. Serialized internally via JSON.stringify.
- execute: required ToolExecuteCallback = Promise<any>(object inputObject, ToolExecuteCallbackOptions options).
- annotations: optional ToolAnnotations { readOnlyHint = false, untrustedContentHint = false }.

ModelContextRegisterToolOptions: { sequence<USVString> exposedTo; AbortSignal signal; }
ToolExecuteCallbackOptions: { required AbortSignal signal; }

Name grammar (MUST) from section 3 and registerTool steps:
- Length 1 to 128 inclusive.
- Only ASCII alphanumeric, underscore, hyphen-minus, and full stop (dot).
- Empty name or empty description -> InvalidStateError.
- Duplicate name already in this document tool map -> InvalidStateError.
- MUST NOT use spaces, slashes, colons, or Unicode letters. MCP-style namespaced names with slash are illegal.

inputSchema (MUST):
- Pass a JavaScript object such as { type: "object", properties: { ... } }.
- MUST NOT pass a pre-stringified JSON string as inputSchema.
- If JSON.stringify throws (circular refs) or yields undefined, registerTool rejects with that exception / TypeError.
- Spec does NOT currently validate the schema against JSON Schema meta-schema, and does NOT validate invocation arguments against the schema before calling execute (Issue 92, open). MUST validate inside execute.
- Cited dialect: JSON Schema 2020-12. No spec requirement to set $schema.
- Omitted inputSchema is stored as the empty string; getTools then returns inputSchema undefined.

execute callback (MUST):
- First argument is a parsed JSON object (the agent arguments), not a string.
- Second argument is { signal: AbortSignal }. MUST honor it (pass to fetch, abort long work). If the caller cancels, the UA aborts this signal; if execute later settles, the result is ignored.
- Return value is Promise<any>. The UA JSON.stringifies it. If stringify throws, execution is treated as failure (UnknownError to the executeTool caller).
- MUST return JSON-serializable data. MUST NOT return DOM nodes, functions, BigInt, circular objects.
- Rejection of the execute promise is a failed execution. The spec does NOT surface the rejection reason to executeTool(); the caller gets UnknownError. Optionally the UA logs a console warning. Put recovery hints in a successful JSON return value if the agent must see them.
- There is NO required MCP content-block envelope. The README example uses { content: [{ type: "text", text }] } as shared MCP vocabulary; the spec only requires a JSON-serializable value. Returning a plain string or a plain object is spec-legal.

Unregistration (MUST):
- const ac = new AbortController(); await document.modelContext.registerTool(tool, { signal: ac.signal }); ac.abort();
- If options.signal is already aborted at register time -> reject with the abort reason (after schema serialization checks).
- Aborting later unregisters the tool and rejects the original register promise with the abort reason.
- MUST NOT emit unregisterTool(name).
- Chrome 153+: unregistering does not cancel in-flight executions (Chrome-specific; useful for framework lifecycles). Spec: aborting the registration signal unregisters; aborting the execution signal cancels that invocation.

exposedTo (cross-origin sharing):
- Default: tool is visible to same-origin documents in the frame tree, plus the UA built-in browser agent (README; built-in-agent default is still an open question).
- To share with a cross-origin in-page agent: pass exposedTo: ["https://trusted-partner.example"].
- Each entry is parsed as a URL. Failure or origin not potentially trustworthy -> SecurityError. Only secure origins.
- Exposure algorithm (section 3.1): same-origin with the tool owner OR same-origin with an entry in exposedTo.

### 4.5 getTools(options) discovery for in-page agents

Returns Promise<sequence<RegisteredTool>>, sorted ascending by name (code-unit order).

ModelContextGetToolOptions: { sequence<USVString> fromOrigins; }
RegisteredTool: required name, title, required description, inputSchema object, required Window window, required USVString origin, annotations.

- Default: same-origin tools from this document and descendant navigables only.
- Cross-origin tools: caller MUST list those origins in fromOrigins. Empty or omitted fromOrigins -> same-origin only.
- A cross-origin tool is included only if BOTH: (1) tool-owner origin is same-origin with the caller OR listed in fromOrigins, and (2) the tool is exposed to the caller (exposedTo / same-origin).
- fromOrigins entries: same URL-parse plus potentially-trustworthy check as exposedTo; else SecurityError.
- Each RegisteredTool includes window (the registering document Window) and origin (serialized origin of the registering document).
- inputSchema on the result is a parsed object (deep copy), or undefined if none was registered.
- CHROME 151 LAG (reported 29 Aug 2026 in issue 165): getTools() still returned inputSchema as a stringified DOMString. Generated code that consumes getTools() MUST accept both object and string until Chrome catches up.
- Browser built-in agents do not use getTools(). They use an internal observation of the tool map (section 5.2). getTools/executeTool exist for in-page JS agents (including iframes).

### 4.6 executeTool(tool, inputObject, options) in-page invocation

Spec IDL after issues 241 / 243 / 246 closed mid-August 2026:
Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject = {}, optional ModelContextExecuteToolOptions options = {});

MUST pass:
1. The RegisteredTool dictionary from getTools() (not a name string). The UA uses tool.window, tool.origin, and tool.name.
2. An object of arguments (default {}). The UA JSON.stringifies it. MUST NOT (per current spec) pass a pre-stringified JSON string.
3. Optional { signal } to cancel.

Returns Promise<DOMString>: the stringified execute result on success.

CHROME 151 LAG (issue 165, 29 Aug 2026): executeTool() still took a JSON string for arguments, and Chrome 20 Aug 2026 docs still show executeTool(tool, "{\"text\": \"Buy milk\"}").
SKILL RULE: generate object arguments (spec). If supporting current Chrome 149-151 origin-trial, feature-detect or try/catch and fall back to JSON.stringify(input) as the second argument. Do not document the string form as the spec.

executeTool rejects:
- Document not fully active -> InvalidStateError
- Not origin-isolated (bikeshed) -> SecurityError
- Not allowed to use tools -> NotAllowedError
- tool.origin unparsable or opaque -> NotSupportedError
- inputObject not JSON-serializable -> the stringify exception
- Different traversable (not same tab/frame tree) -> UnknownError (Issue 227: maybe later allow same browsing-context group)
- Target origin != tool.origin -> UnknownError
- Tool no longer registered -> UnknownError
- Not exposed to caller -> UnknownError
- Execute failed / cancelled race / non-JSON result -> UnknownError
- Caller abort signal -> abort reason

Granular errors (NotFoundError, DataError) are spec TODOs, not shipped.
Caller and target MUST share the same traversable navigable (same tab frame tree). Cannot executeTool across top-level windows.
If the target document is in bfcache / not fully active, the execute task is queued until it is active again.
Chrome docs: may return null when a navigation is triggered. That is NOT in the current IDL (Promise<DOMString>). Treat navigation-during-execute as unstable (Issue 135).

### 4.7 Events

Spec-normative on ModelContext (section 4.4): ontoolchange / event type toolchange, target document.modelContext.
toolchange fires when tools are registered or unregistered and the document is allowed to see that tool. It does NOT carry a tool list; listeners MUST call getTools() again.
Timing: fired on the webmcp task source, in parallel. MUST NOT assume ordering vs setTimeout. Parent toolchange is queued before descendant toolchange; the register promise resolves after both.

Not yet specified, but Chrome fires (declarative plus possibly imperative):
- toolactivated -- Issue 146, still a spec issue. Chrome docs: fired on window, with a toolName attribute, after form fields are filled.
- toolcancel vs toolcanceled -- naming inconsistent. Spec issue text says toolcanceled on the target Document global; Chrome declarative docs say toolcancel on window. MUST NOT rely on either name without feature-detecting. Prefer AbortSignal in execute.
- MUST NOT listen for a toolcall event on document.agent -- alternatives-considered, not shipped.

### 4.8 Declarative API (Chrome implements; spec section is a TODO)

Section 4.3: This section is entirely a TODO. For now, refer to the Declarative API explainer.
Chrome origin trial implements approximately the explainer. Treat as vendor-preview, not CG-draft-normative.

Explainer plus Chrome docs attributes on form:
- toolname: analogous to ModelContextTool.name
- tooldescription: analogous to description
- toolautosubmit: boolean; agent may submit without user click. Absent means user must submit.
- toolparamdescription: on form controls; JSON Schema property description. Fallback: label text, then aria-description.
- Unregistration: remove toolname or tooldescription.

Chrome SubmitEvent extensions (explainer, not in spec IDL index):
- submitEvent.agentInvoked (boolean)
- submitEvent.respondWith(Promise<any>) -- MUST call preventDefault() first; then no navigation; promise value is serialized as the tool result.

CSS (explainer / Chrome): :tool-form-active on the form while the declarative tool is running; :tool-submit-active on the submit control.
Schema synthesis from select, min/max/step, custom elements: TBD in spec. Chrome has a loose version.
Issue 135: cross-document form response (JSON-LD on the navigated page vs respondWith) is unresolved.

### 4.9 Transport, protocol, headers

WebMCP has no HTTP API, no JSON-RPC, no SSE, no stdio, no MCP initialize handshake.
The only HTTP-level control in the spec is Permissions-Policy for tools. There is no WebMCP header, no well-known URL, no manifest (static manifests were considered and rejected for v1).
Browser agents observe tools via an implementation-defined observation that includes at least the document tool map (section 5.2). The spec explicitly does not prescribe MCP as the agent-facing format: browsers may expose tools via MCP, proprietary function calling, or anything else.

### 4.10 Security, consent, origin model

Normative isolation:
- Same-origin by default.
- Cross-origin in-page use requires BOTH allow="tools" AND exposedTo / fromOrigins with potentially-trustworthy origins.
- Secure context plus origin-keyed agent cluster.
- Tools live and die with the Document (unload cancels pending executions; destroying caller or target cleans the pending map).

NOT in the spec IDL (do not generate as if they exist):
- requestUserInteraction() / ModelContextClient -- removed from the draft (PR 205). Open redesign as requestUserInput (Issue 165, PR 204). Chrome security page still mentions requestUserInteraction() as if in the spec; it is NOT in the 26 Aug IDL.
- User-permission prompts, consent chrome -- UA-defined, not a page API.
- readOnlyHint / untrustedContentHint are hints, not enforcement. WebKit oppose letter flags this.

Non-normative section 6 (authors SHOULD):
- Do not put prompt-injection text in name / description / parameter descriptions.
- Set untrustedContentHint true when returning UGC or third-party data.
- Set readOnlyHint true only when the tool truly has no side effects.
- Do not over-parameterize tools to vacuum personalization data (age, location, pregnancy, purchase history). Spec calls this personalization-to-fingerprinting.
- High-privilege tools (reset-password, purchase, transfer) SHOULD keep the same validation as the human UI; WebMCP is another code path.
- Same-origin-boundary section is still TODO in the spec (section 6.3.4).
- Private browsing: UA responsibility; unspecified for authors.

Chrome character budgets (agent-guardrail recommendations, not spec MUST): description <= 500, param description <= 150, name <= 30, output <= 1.5K.

### 4.11 Versioning

There is no navigator.modelContext.version, no protocol version field, no initialize handshake. Compatibility is whatever the UA implements of the living CG draft. Feature-detect methods.

### 4.12 Common ways generated code breaks the spec

1. navigator.modelContext only -- silent no-op on Chrome 150+ if you gate on navigator.modelContext then register. Prefer document.modelContext.
2. unregisterTool() / provideContext({ tools }) / clearContext() -- removed. Use AbortSignal.
3. executeTool("name", ...) -- spec requires a RegisteredTool object from getTools(), not a name string. modelContextTesting.executeTool(name, json) is the old testing shim.
4. Passing a JSON string as executeTool second argument -- current spec wants an object; Chrome 151 still wants a string. Dual-support if targeting the origin trial.
5. Passing inputSchema as a string.
6. MCP server patterns: prompts, resources, listChanged notifications, JSON-RPC, stdio, Streamable HTTP, outputSchema (Issue 9, not in IDL).
7. Slash-namespaced tool names (github/search) -- illegal name grammar.
8. Returning DOM nodes / Maps / circular objects from execute.
9. Registering in a cross-origin iframe without allow="tools".
10. Sharing tools with an iframe agent without exposedTo.
11. Assuming schema validation happens before execute (it does not; Issue 92).
12. Assuming toolchange includes the new list (it does not).
13. Using document.domain, disabling origin isolation.
14. Headless / Service Worker / no-tab invocation as if specified (non-goals; SW explainer only).
15. Stale blogs (Feb-May 2026) teaching provideContext, window.agent, requestUserInteraction as current.

---

## 5. Things that look similar but are NOT WebMCP

- MCP (Model Context Protocol): Anthropic/Linux Foundation JSON-RPC protocol for tools/prompts/resources over stdio or Streamable HTTP. Spec: https://modelcontextprotocol.io/specification/latest Different layer, different runtime. Chrome: WebMCP is not a replacement.
- MCP-B / mcp-b.ai / @mcp-b packages / historical WebMCP by Alex Nahas: open-source polyfill plus extension that bridges in-page tools to MCP clients. Prior art in the README. Packages add MCP prompts/resources/listTools that are NOT in the CG draft. Use the polyfill only for document.modelContext. Do not copy MCP-B extension APIs into spec code.
- Jason McGhee WebMCP repo: early independent implementation; prior art in the README. Historical, not the CG draft.
- chrome-devtools-mcp: MCP server that drives Chrome DevTools (click, screenshot, network). Optional experimental tools list_webmcp_tools / execute_webmcp_tool consume page WebMCP. Flag category-experimental-webmcp. Automation host, not the page API.
- Chrome Prompt API / on-device Gemini: separate Chrome AI APIs that can call WebMCP tools; not WebMCP.
- Google Script Tools: Chrome earlier internal name; merged into WebMCP.
- Microsoft Web Model Context explainer (2025): precursor; evolved into this CG draft.
- UCP / Universal Commerce Protocol: commerce protocol some vendors discuss alongside WebMCP as a transport. Not the spec.
- OpenAPI / ChatGPT Actions: HTTP API descriptions. README prior art.
- Agent2Agent (A2A): agent-to-agent protocol. README prior art.
- navigator.modelContextTesting: Chromium testing shim (listTools, executeTool(name, jsonString)). Not the spec.
- webmcp.com / third-party WebMCP Standard blogs: commentary. Several still say navigator.modelContext or claim it is a W3C Standard. Prefer the CG draft.
- WHATWG HTML / ARIA: WebKit proposed alternative (richer shared semantics instead of a parallel tool API). Related debate, not WebMCP.

Mozilla position note: There is no MCP here. The name is misleading.

---

## 6. Ecosystem: SDKs, browsers, frameworks, examples

Browsers as of 29 Aug 2026:
- Chromium / Chrome: Origin trial M149-M156 (Intent to Experiment; I2E table also lists shipping estimate M157 -- not a ship decision). Local flag chrome://flags/#enable-webmcp-testing. DevTrial since about M146. Headless not a design goal.
- Edge: implementation-status.md says origin trial live in Edge 150. Treat as Chromium-aligned; confirm against Edge OT page.
- Firefox: NEUTRAL standards-position. No shipping implementation found. Interest in imperative API; API-shape issues 236 / 237.
- Safari / WebKit: OPPOSE (security, privacy, venue, agent-as-AT, consent, duplication of postMessage). No implementation.
- Brave: experimental in Leo AI chat (issue 55232).
- ChatGPT Desktop: listed as supported in implementation-status.md; details unpublished in the spec.

Chrome OT feedback cited in TAG review (6 Aug 2026): about 172 million imperative registerTool calls vs about 20k declarative -- imperative is what sites actually use.

Types / SDKs:
- webmcp-types 0.1.5 (20 Aug 2026): official ambient types. document.modelContext.registerTool / getTools / ontoolchange. OMITS executeTool as of 0.1.5, while the 26 Aug spec includes it. Types lag the spec.
- @mcp-b/webmcp-types: splits ModelContext vs ChromeModelContext (adds executeTool). Treat executeTool as spec-standard now, not merely a Chrome extension.
- @mcp-b/webmcp-polyfill: polyfill for document.modelContext; deprecated navigator.modelContext alias. Rejects non-empty fromOrigins/exposedTo with NotSupportedError (cannot polyfill cross-document securely).
- usewebmcp: React hooks; abort on unmount. Chrome docs name this package. Expects document.modelContext already present.
- @mcp-b/react-webmcp / @mcp-b/global: full MCP-B runtime (prompts, resources, transports). NOT the CG draft.
- Angular: experimental declareWebMcpTool / provideWebMcpTools tied to injector lifecycle. Angular examples return MCP content envelopes -- allowed but not required.

Demos / tooling:
- https://github.com/GoogleChromeLabs/webmcp-tools -- pizza-maker (zaMaker), React flight search, hotel-chain / Le Petit Bistro declarative demo
- Model Context Tool Inspector Chrome extension (Chrome docs)
- Chrome DevTools WebMCP panel / CDP domain (I2E: list, invoke, log)
- WPT: https://wpt.fyi/results/webmcp

---

## 7. Open questions / unstable areas

Do not encode these as skill MUST-rules. Point at issues.

- Declarative API algorithms: entire spec section 4.3 TODO. Explainer; Chrome OT only.
- executeTool argument type: spec = object (17 Aug). Chrome 151 = JSON string. Issues 243, 246; issue 165 comment 29 Aug.
- getTools().inputSchema type: spec = object. Chrome 151 = string. Issues 241, 165.
- Native JSON Schema validation of args/results: not done. Issue 92.
- outputSchema: not in IDL. Issue 9.
- requestUserInteraction / requestUserInput / ModelContextClient: removed from IDL; redesign open. Issue 165, 50, PR 204/205.
- toolactivated / toolcanceled vs Chrome toolcancel: spec issues; Chrome fires on window. Issues 146, 126.
- Missing title default empty string vs omitted: Issue 224.
- Cross-top-level executeTool: not allowed; maybe later. Issue 227.
- Cross-document tool result after navigation: unresolved. Issue 135.
- Built-in agent vs iframe default exposedTo (native-agent keyword): open in README.
- Multimodal / streaming I/O: Issues 41, 81, 82, 86.
- Skills (multi-tool journeys): Issue 161.
- Progress reporting: open (MCP Progress analog) in README.
- Service Worker background tools: explainer only, not spec (docs/service-workers.md).
- Name/description length limits beyond 128-char names: Issue 73.
- Same-origin privacy section: TODO in spec 6.3.4.
- Granular DOMExceptions vs UnknownError: TODOs in execute/register algorithms.
- Venue / TAG / WebKit oppose: TAG review in progress; WebKit wants a different CG. TAG 1238, WebKit 670.
- Mozilla API-shape (issue 236 call functions between environments): may still change imperative shape. Issues 236, 237.
- Official polyfill hosting: Issue 252.
- Chrome OT end: I2E last milestone 156; third-party dates around 16-17 Nov 2026 -- verify, do not hardcode.

Breaking changes already landed in 2026 (do not generate the old forms):
- about Mar 2026: provideContext() / clearContext() removed
- about Apr 2026 (issue 130): unregisterTool() removed; AbortSignal on registerTool
- about 27 May / 21 Jul 2026 (draft plus Chrome 150): getter moved navigator.modelContext -> document.modelContext
- Aug 2026 (issues 241/243/246): executeTool takes RegisteredTool plus object args; inputSchema on RegisteredTool is object
- Mid-2026: ModelContextClient / requestUserInteraction stripped from IDL pending redesign

---

## 8. Is the spec stable enough to encode as a skill?

Yes, with a version pin and a large unstable section -- not as an unversioned frozen standard.

Encode as a skill if and only if:
1. The skill pins CG-DRAFT 26 August 2026 and tells the agent to re-read https://webmachinelearning.github.io/webmcp/ before generating code after that date.
2. The skill hard rules are limited to the imperative IDL that has survived the 2026 churn: document.modelContext, registerTool plus AbortSignal, name grammar, JSON Schema object, execute(inputObject, {signal}), JSON-serializable return, tools Permissions Policy, exposedTo / fromOrigins, toolchange, secure context, feature detection.
3. The skill treats declarative HTML attributes, executeTool argument encoding, getTools schema type, requestUserInput, toolactivated, Service Workers, and outputSchema as Chrome-preview or open issues.
4. The skill MUST feature-detect and keep a human UI path. WebKit opposes; Firefox is neutral; Chrome is an origin trial that can still change.
5. The skill MUST NOT copy MCP server APIs or MCP-B extensions into WebMCP output.

The imperative registration contract is now coherent enough that a skill will prevent the most common (and already-shipped) breaks: navigator.*, unregisterTool, provideContext, slash-names, string schemas, MCP envelopes-as-required. It is not stable enough to promise bit-identical behavior across Chrome 149-156 without the lag notes in sections 4.5-4.6.

---

## 9. Source list (URLs)

Specification and editors drafts:
- https://webmachinelearning.github.io/webmcp/
- https://github.com/webmachinelearning/webmcp
- https://github.com/webmachinelearning/webmcp/blob/main/index.bs
- https://github.com/webmachinelearning/webmcp/blob/main/README.md
- https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md
- https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md
- https://github.com/webmachinelearning/webmcp/blob/main/security-privacy-questionnaire.md
- https://json-schema.org/draft/2020-12/json-schema-core.html
- https://modelcontextprotocol.io/specification/latest
- https://w3c.github.io/webappsec-permissions-policy/

Issues / process:
- https://github.com/webmachinelearning/webmcp/issues
- https://github.com/webmachinelearning/webmcp/issues/130
- https://github.com/webmachinelearning/webmcp/issues/146
- https://github.com/webmachinelearning/webmcp/issues/165
- https://github.com/webmachinelearning/webmcp/issues/243
- https://github.com/webmachinelearning/webmcp/issues/92
- https://github.com/webmachinelearning/webmcp/issues/9
- https://github.com/webmachinelearning/webmcp/issues/135
- https://github.com/webmachinelearning/webmcp/issues/182
- https://github.com/webmachinelearning/webmcp/issues/224
- https://github.com/webmachinelearning/webmcp/issues/227
- https://github.com/w3ctag/design-reviews/issues/1238
- https://github.com/mozilla/standards-positions/issues/1412
- https://github.com/WebKit/standards-positions/issues/670
- https://wpt.fyi/results/webmcp

Chrome / Chromium:
- https://developer.chrome.com/docs/ai/webmcp
- https://developer.chrome.com/docs/ai/webmcp/imperative-api
- https://developer.chrome.com/docs/ai/webmcp/declarative-api
- https://developer.chrome.com/docs/ai/webmcp/compare-mcp
- https://developer.chrome.com/docs/ai/webmcp/best-practices
- https://developer.chrome.com/docs/ai/webmcp/secure-tools
- https://developer.chrome.com/blog/ai-webmcp-origin-trial
- https://chromestatus.com/feature/5117755740913664
- https://github.com/GoogleChromeLabs/webmcp-tools
- https://github.com/ChromeDevTools/chrome-devtools-mcp

Types, polyfills, frameworks:
- https://www.npmjs.com/package/webmcp-types
- https://github.com/webmachinelearning/webmcp-types
- https://www.npmjs.com/package/usewebmcp
- https://github.com/angular/angular/pull/68139

Commentary (stale risk):
- https://chudi.dev/blog/what-is-webmcp
- https://nohacks.co/blog/what-is-webmcp
- https://www.spronta.com/blog/state-of-webmcp-july-2026/

---

## Appendix A -- Minimal spec-compatible registration (imperative)

const modelContext = document.modelContext;
if (!modelContext || typeof modelContext.registerTool !== "function") {
  // Feature-detect; keep the human UI as the only path.
} else {
  const controller = new AbortController();
  await modelContext.registerTool(
    {
      name: "add-todo",
      title: "Add to-do",
      description: "Add a new item to the user active to-do list.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "The text content of the to-do item." },
        },
        required: ["text"],
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async ({ text }, { signal }) => {
        await addTodoItemToCollection(text, { signal });
        return { ok: true, message: "Added to-do: " + text };
      },
    },
    { signal: controller.signal }
  );
  // Later: controller.abort();
}

## Appendix B -- In-page agent discovery/execute (spec-shaped, with Chrome lag)

const mc = document.modelContext;
mc.addEventListener("toolchange", async () => {
  const tools = await mc.getTools();
  const add = tools.find((t) => t.name === "add-todo");
  if (!add) return;
  const args = { text: "Buy milk" };
  let result;
  try {
    result = await mc.executeTool(add, args); // spec: object
  } catch (e) {
    result = await mc.executeTool(add, JSON.stringify(args)); // Chrome 151 lag
  }
  // result is a DOMString (JSON text) on success
});

End of report. Spec snapshot: CG-DRAFT 26 August 2026. Research completed 29 August 2026 (Asia/Jerusalem).


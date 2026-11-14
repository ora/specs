# WebMCP research report for spec-compatible code generation (16 October 2026 draft)

**Research date:** Monday 19 October 2026
**Canonical spec snapshot used:** W3C Web Machine Learning Community Group Draft, **16 October 2026**
**Primary source:** https://webmachinelearning.github.io/webmcp/
**Bikeshed source of truth:** https://github.com/webmachinelearning/webmcp/blob/main/index.bs (blob `bd81b6d06c4d22bd15c14849030bbeb2fb14d9cd`, last spec commit `3279798`, 14 Oct 2026)
**Supersedes:** `webmcp-research-2026-08-26.md` (kept beside this file as history; its ecosystem map in sections 5-6 is still accurate unless this report says otherwise)

This report is for a coding-agent skill. It prefers the published Community Group draft and its GitHub source over blogs, polyfills, and vendor docs. Where Chrome, TypeScript types, or third-party packages lag or diverge, that is called out as **implementation lag**, not as the spec. Anything not in the 16 October 2026 draft is marked unpublished / unstable.

---

## 1. What changed since the 26 August 2026 snapshot

The normative `index.bs` commits between the two pins (blob `241bb2c0`, current from `bd99438` until `7b3f50f`, -> blob `bd81b6d0`; the commit range is `7b3f50f^..3279798`), grouped by what it means for code we write, emit, or score. Four editorial commits in the range change no behaviour and are not tabled: `19fc565` (#264, observation context-management note), `0957b0b` (#320), `4999377` (JSON parse realm argument), `d0e4e0e` (#335, typos and cross-references).

| Date | Commit | Change | Effect on Ora |
|---|---|---|---|
| 3 Sep | `7b3f50f` (#217) | **`consequentialHint`** added to `ToolAnnotations` (default `false`). Section 6.4.5 names it the mitigation for misrepresentation of intent: agents may enforce a user confirmation before a consequential tool runs. | The WebMCP annotation vocabulary is now four keys, not two. Capture must keep it; emitted guidance should teach it for significant, real-world, or irreversible actions (booking, payment, transfer). It is WebMCP's own analogue of MCP's `destructiveHint`, which stays MCP-only. |
| 17 Sep | `8a82bb7` (#253) | **`debugging`** added to `ToolAnnotations` (default `false`): the tool is for debugging and developer tooling, not end-user interactions. | Fourth annotation key. Capture keeps it; nothing we emit needs it. |
| 17 Sep | `f5645e9` (#245) | **`ToolActivatedEvent` / `ToolCancelEvent`** interfaces, `ontoolactivated` / `ontoolcancel` handlers on `ModelContext`. `toolactivated` fires at the target document's `ModelContext` when execution begins (after input parsing, before `execute` is invoked); `toolcancel` fires there when a pending execution is cancelled, after the execute signal aborts. Both carry `toolName`. | No longer an unstable area. Spelling is `toolcancel` (not `toolcanceled`); target is `document.modelContext` (not `window`). |
| 9 Sep | `94c0a3a` (#281) | Observation tool map values are now an **observed tool collection** `{ origin, tools }` per document. | Non-normative implementer guidance; browser agents are expected to show tool origin. |
| 10 Sep -> 29 Sep | `97da8f5` (#251), `294bad9` (#324), `69b73b4` (#279) | `executeTool` input: briefly `any`, now `optional object inputObject` with **no default**; an omitted input becomes an empty object. Clarified the input is a JS object matching `inputSchema`, with an example. | Spec form is still object arguments. Chrome 151 string lag (issue 165) remains an implementation note. |
| 14 Sep | `cc45efc` (#302) | `registerTool` validates the name before the description. | Error ordering only. |
| 15 Sep | `df2d824` (#275) | Section 6.4.1: **`Permissions-Policy: tools=()`** documented as a security mitigation (disables WebMCP in the document and every descendant frame, enforced before script runs). | Safe to teach as the opt-out for pages that must not expose tools. |
| 25 Sep | `321d83c` (#311) | Normative note: **unregistering a tool does not cancel an execution already in flight**, including when the callback unregisters itself. Registration signal controls availability; execute signal controls one invocation. | Was Chrome-153 behaviour; now spec. |
| 26 Sep, 13-14 Oct | `729ae01` (#301), `eada13b` (#337), `1636b33` (#345), `3279798` (#347) | Algorithm hardening: navigable lookups, completion-step parallelism, detached-document checks, a second fully-active check and duplicate-name check after `inputSchema` serialization (a `toJSON()` can run script). | Behaviour pages rarely observe. Shims we ship should still reject duplicates. |
| 30 Sep | `d61d0e6` (#330) | **Origin-keyed agent cluster requirement removed** from `registerTool`, `getTools`, `executeTool`. No more `SecurityError` for a non-origin-keyed agent cluster. | Drop "origin-keyed agent cluster required" from rules. Still never suggest `document.domain` (it is deprecated platform-wide and weakens isolation), but it is no longer a WebMCP precondition. |
| 8 Oct | `14ae813` (#338) | **Declarative API removed from the spec.** The TODO section, the synthesize-schema algorithm, and the declarative execute steps are gone; tool definitions are imperative only. README now lists declarative as "Future Exploration", explainer-only. | Declarative `<form toolname>` is a Chrome preview that the specification does not define at all. Report it as observed and never teach it as spec; Ora's posture (2026-10-19): never a score input and never a WebMCP tool; observed and named only. Copy that says "spec section is still a TODO" is stale. |
| 8 Oct | `b206dae` (#339) | **`UnknownError` replaced** with a table of tool execution errors mapped to specific `DOMException` names (section 3). | See 4.6. Copy that says "a rejection reaches the caller as UnknownError" is stale: it is now `OperationError`. |
| 28 Sep | `433a194` (#315) | MCP referenced non-normatively. | Confirms WebMCP is not an MCP wire implementation. |

Explainer-side changes in the same window (README, not normative): headless use is now explicitly in scope ("tools exposed for human-in-the-loop can also be used ... in headless scenarios"); a **Best Practices** section (tool budget, single responsibility, dynamic registration via `AbortSignal`, re-register to change name/description/schema, validate in `execute`, accept raw input, natural-language enums, describe every parameter, validate strictly in code and loosely in schema, return actionable errors, keep the visible UI in sync); no `updateTool()`, lazy schemas, or disabled/grouped tool states exist (issues 167, 255).

---

## 2. Spec identity

| Field | Value |
|---|---|
| **Canonical rendered spec** | https://webmachinelearning.github.io/webmcp/ |
| **Source** | https://github.com/webmachinelearning/webmcp/blob/main/index.bs |
| **Status** | **CG-DRAFT** - Draft Community Group Report. Not a W3C Standard, not on the Standards Track. |
| **Date on rendered draft** | **16 October 2026** |
| **Group** | W3C Web Machine Learning Community Group |
| **Editors** | Brandon Walderman (Microsoft), Khushal Sagar (Google), Dominic Farolino (Google) |
| **Test suite** | https://wpt.fyi/results/webmcp |
| **JSON Schema cited** | 2020-12 |
| **Open inline issues** | #224 (missing `title` defaults to `""` vs omitted), #227 (cross-top-level `executeTool`) |

Still not an implementation of Anthropic's Model Context Protocol: no JSON-RPC, no HTTP transport, no initialize handshake, no prompts/resources. Section 5.2: "this specification does not prescribe the format in which tools are exposed to the browser agent."

---

## 3. Complete IDL (16 October 2026)

```webidl
partial interface Document {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};

[Exposed=Window, SecureContext]
interface ModelContext : EventTarget {
  Promise<undefined> registerTool(ModelContextTool tool, optional ModelContextRegisterToolOptions options = {});
  Promise<sequence<RegisteredTool>> getTools(optional ModelContextGetToolOptions options = {});
  Promise<DOMString> executeTool(RegisteredTool tool, optional object inputObject, optional ModelContextExecuteToolOptions options = {});
  attribute EventHandler ontoolchange;
  attribute EventHandler ontoolactivated;
  attribute EventHandler ontoolcancel;
};

dictionary ModelContextTool {
  required DOMString name;
  USVString title;
  required DOMString description;
  object inputSchema;
  required ToolExecuteCallback execute;
  ToolAnnotations annotations;
};

dictionary ToolAnnotations {
  boolean readOnlyHint = false;
  boolean untrustedContentHint = false;
  boolean consequentialHint = false;
  boolean debugging = false;
};

dictionary ToolExecuteCallbackOptions { required AbortSignal signal; };
callback ToolExecuteCallback = Promise<any> (object inputObject, ToolExecuteCallbackOptions options);

dictionary ModelContextRegisterToolOptions { sequence<USVString> exposedTo; AbortSignal signal; };
dictionary ModelContextGetToolOptions { sequence<USVString> fromOrigins; };
dictionary ModelContextExecuteToolOptions { AbortSignal signal; };

dictionary RegisteredTool {
  required DOMString name;
  DOMString title;
  required DOMString description;
  object inputSchema;
  required Window window;
  required USVString origin;
  ToolAnnotations annotations;
};

[Exposed=Window, SecureContext]
interface ToolActivatedEvent : Event {
  constructor(DOMString type, optional ToolActivatedEventInit eventInitDict = {});
  readonly attribute DOMString toolName;
};
dictionary ToolActivatedEventInit : EventInit { DOMString toolName = ""; };

[Exposed=Window, SecureContext]
interface ToolCancelEvent : Event {
  constructor(DOMString type, optional ToolCancelEventInit eventInitDict = {});
  readonly attribute DOMString toolName;
};
dictionary ToolCancelEventInit : EventInit { DOMString toolName = ""; };
```

Permissions Policy (section 4.4): policy-controlled feature **`tools`**, default allowlist `'self'`.

---

## 4. Compatibility-critical rules

### 4.1 Entry point

`document.modelContext` only. `navigator.modelContext` is not in the spec; Chromium kept a deprecated alias, so the canonical feature detect is `document.modelContext || navigator.modelContext` (document first). Window-only, `[SecureContext]`. No Worker, no Service Worker in the spec.

Removed and never coming back in this shape: `provideContext()`, `clearContext()`, `unregisterTool()`, `window.agent`, `document.agent`, `navigator.modelContextTesting` (Chromium testing shim), `requestUserInteraction()` / `ModelContextClient`.

### 4.2 Preconditions every method checks

- Fully active document, else `InvalidStateError`.
- Allowed to use the `tools` feature, else `NotAllowedError`.
- Secure context (IDL).
- **No longer:** origin-keyed agent cluster (removed 30 Sep 2026, #330).

Cross-origin iframes need `allow="tools"` (or an equivalent policy allowlist). `Permissions-Policy: tools=()` disables WebMCP for the document and all descendants (section 6.4.1).

### 4.3 registerTool(tool, options)

Returns `Promise<undefined>`. Rejections, in order:

1. Not fully active -> `InvalidStateError`.
2. Not allowed to use `tools` -> `NotAllowedError`.
3. Name already registered -> `InvalidStateError`.
4. Name empty, longer than 128, or containing anything but ASCII alphanumeric, `_`, `-`, `.` -> `InvalidStateError`.
5. Description empty -> `InvalidStateError`.
6. `inputSchema` present and `JSON.stringify` throws or yields `undefined` -> that exception / `TypeError`.
7. Re-check fully active and duplicate name (the `toJSON` race).
8. `options.signal` already aborted -> its abort reason.
9. Any `exposedTo` entry that fails URL parsing or is not potentially trustworthy -> `SecurityError`.

Aborting `options.signal` later unregisters the tool and rejects the register promise with the abort reason. That is the only unregistration mechanism.

`inputSchema` is a JavaScript object (JSON Schema 2020-12), stored stringified; never pass a pre-stringified string. The UA does not validate the schema or the arguments against it (issue 92); validate inside `execute`. `title` is a top-level `USVString` (localize it); it is NOT an annotation (MCP puts `title` under annotations, WebMCP does not).

### 4.4 Annotations (four keys)

| Key | Meaning (spec 4.2.1) | When to set |
|---|---|---|
| `readOnlyHint` | Tool does not modify any state, only reads. | `true` only on true reads; it is the claim that lets an agent skip confirmation. `false` is the default and carries no information. |
| `untrustedContentHint` | Output contains data untrusted from the registering author's perspective. | `true` when returning UGC, reviews, third-party text (section 6.4.4). |
| `consequentialHint` | Execution results in consequential actions: significant, real-world, or non-reversible (booking a flight, transferring money). | `true` on such actions, so agents can require user confirmation (section 6.4.5). A tool with `readOnlyHint: true` and `consequentialHint: true` contradicts itself. |
| `debugging` | Tool is for debugging and developer tooling, not end-user interactions. | `true` on dev-only tools. |

Not WebMCP: `destructiveHint`, `idempotentHint`, `openWorldHint`, `annotations.title`, `outputSchema`. Observed in the wild they are worth naming as a mistake; recommended by us they are a bug. (Superseded 2026-11-04 for `outputSchema`, see SKILL.md rule 7: it is a WebMCP tool member since spec #254.) When a site reaches for `destructiveHint`, point it at `consequentialHint` (similar intent, WebMCP's own key) and, for reads, `readOnlyHint: true`.

### 4.5 execute(inputObject, { signal })

- Input is a parsed JSON object. The UA parses the caller's serialized input; if it does not parse or is not an Object, the call fails with `DataError` before `execute` runs.
- `toolactivated` fires at `document.modelContext` immediately before `execute` is invoked.
- Honour `signal`: pass it to `fetch`, stop long work. On caller cancellation the UA aborts it, fires `toolcancel`, and ignores a later settlement.
- Return value is JSON-serialized by the UA. Not serializable (DOM nodes, functions, BigInt, cycles) -> `OperationError` for the caller.
- A rejected promise -> `OperationError` for the caller; the reason itself is never exposed (only optionally logged to the console). Recovery hints the agent should read belong in a successful JSON return value.
- No MCP content-block envelope is required; any JSON-serializable value is legal.
- Unregistering does not cancel an execution already running.

### 4.6 Tool execution errors (section 3) and executeTool rejections

| Error concept | DOMException name the caller sees |
|---|---|
| tool not found | `NotFoundError` |
| invalid input | `DataError` |
| tool rejected | `OperationError` |
| unserializable result | `OperationError` |
| target document unloaded | `AbortError` |

`executeTool(tool, inputObject, options)` additionally rejects with: `TypeError` from WebIDL conversion when `tool` is not a dictionary (a bare name string), `InvalidStateError` (caller not fully active; target has no navigable; target in a different traversable, issue 227), `NotAllowedError` (no `tools` permission), `NotSupportedError` (`tool.origin` unparsable or opaque), the stringify exception (unserializable `inputObject`), the abort reason (caller `signal`), and **`NotFoundError` uniformly** for origin mismatch, tool not registered, or tool not exposed to the caller (so a cross-origin caller cannot probe). `UnknownError` no longer appears anywhere in the spec.

Omitted `inputObject` -> empty object. Pass the `RegisteredTool` from `getTools()`, never a name string.

### 4.7 getTools(options)

Sorted by name in code-unit order. Same-origin tools from this document and its descendants by default; cross-origin tools need the owner origin in `fromOrigins` AND the tool's `exposedTo` to include the caller. `RegisteredTool.inputSchema` is a parsed deep copy (or `undefined`); `title` is `""` when absent (issue 224); `annotations` carries all four keys when the tool declared any annotations. Browser agents do not use `getTools()`; they read an implementation-defined observation (section 5.2).

### 4.8 Events

All three fire at `document.modelContext` (an `EventTarget`), on the webmcp task source.

- `toolchange` - a tool exposed to this document was registered or unregistered. Carries no list; call `getTools()` again. UA-fired; pages never dispatch it by hand. Parent fires before descendants; ordering against `setTimeout` is not guaranteed.
- `toolactivated` (`ToolActivatedEvent`, `toolName`) - an execution began on this document.
- `toolcancel` (`ToolCancelEvent`, `toolName`) - a pending execution on this document was cancelled.

Chrome's earlier declarative-preview events fired on `window`; the spec target is the `ModelContext`.

### 4.9 Cross-origin

`exposedTo` (register) / `fromOrigins` (getTools), potentially trustworthy origins only, `SecurityError` otherwise. Cross-origin in-page use needs both those and `allow="tools"`.

### 4.10 Transport

None. No WebMCP HTTP header, well-known URL, or manifest. Only a live page can show WebMCP tools; the only HTTP-level control is `Permissions-Policy: tools`.

### 4.11 Security considerations authors should follow (section 6, non-normative)

No instructions to the agent inside names, descriptions, or parameter descriptions (tool poisoning). Mark untrusted output with `untrustedContentHint`. Mark consequential actions with `consequentialHint`. Do not over-parameterize to harvest personalization data. Keep the same validation on the WebMCP path as the human UI path. `Permissions-Policy: tools=()` where WebMCP is not intended. Names are capped at 128 chars; other length limits are open (issue 73).

---

## 5. Unstable / not in the spec

- **Declarative API** (`toolname`, `tooldescription`, `toolautosubmit`, `toolparamdescription`, `SubmitEvent.agentInvoked`, `respondWith`, `:tool-form-active`): removed from the spec 8 Oct 2026; explainer "future exploration"; Chrome origin trial still implements a version. Observe, never teach as spec, never score.
- `executeTool` argument encoding and `getTools().inputSchema` type in Chrome 151 (strings, issue 165): accept both when consuming; generate the spec object form.
- `requestUserInput` / user-interaction redesign (issue 165, PR 204).
- `outputSchema` (issue 9; superseded 2026-11-04, see SKILL.md rule 7: added by spec #254), native schema validation (issue 92), streaming/multimodal I/O, Service Worker tools, `updateTool()` / lazy schemas / grouped tools (issues 167, 255), cross-top-level execution (issue 227), missing-title representation (issue 224), length limits beyond names (issue 73), same-origin-boundary considerations (section 6.3.4 TODO).
- Chrome docs may still show `toolcancel` on `window`, string `executeTool` arguments, or the declarative API as WebMCP. Spec wins.

---

## 6. Common ways generated code breaks the 16 October draft

1. `navigator.modelContext` first or only.
2. `provideContext` / `clearContext` / `unregisterTool` / `window.agent`.
3. `executeTool("name", ...)` or a JSON-string second argument as the spec form.
4. String `inputSchema`; slash-namespaced or Unicode names.
5. MCP annotations (`destructiveHint`, `idempotentHint`, `openWorldHint`, `annotations.title`) or `outputSchema` on WebMCP tools (`outputSchema` superseded 2026-11-04, see SKILL.md rule 7: it is spec-current now). Use `consequentialHint` / `readOnlyHint` / top-level `title`.
6. Telling authors a rejection surfaces as `UnknownError` (now `OperationError`), or shimming `executeTool` with `UnknownError`.
7. Listening for `toolcanceled`, or for `toolactivated` / `toolcancel` on `window`.
8. Claiming WebMCP requires an origin-keyed agent cluster.
9. Presenting declarative `<form toolname>` as specified WebMCP.
10. Returning DOM nodes, functions, BigInt, or cycles; assuming the UA validates arguments; assuming `toolchange` carries the list; dispatching `toolchange` by hand.

---

## 7. Minimal spec-shaped registration

```js
const mc = document.modelContext || navigator.modelContext;
if (mc && typeof mc.registerTool === "function") {
  const controller = new AbortController();
  mc.registerTool(
    {
      name: "book_table",
      title: "Book a table",
      description: "Book a table at this restaurant for a date, time and party size. Returns the confirmation number.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date as YYYY-MM-DD" },
          time: { type: "string", description: "Time as HH:MM, 24-hour" },
          partySize: { type: "integer", description: "Number of guests" },
        },
        required: ["date", "time", "partySize"],
      },
      annotations: { consequentialHint: true },
      execute: async (input, { signal }) => {
        const res = await fetch("/api/bookings", { method: "POST", body: JSON.stringify(input), signal });
        if (!res.ok) return { ok: false, hint: "That slot is taken; try another time." };
        return { ok: true, confirmation: (await res.json()).id };
      },
    },
    { signal: controller.signal },
  ).catch((err) => console.warn("WebMCP registration failed", err && err.name));
  // controller.abort() unregisters.
}
```

---

## 8. Sources

- https://webmachinelearning.github.io/webmcp/ (rendered 16 October 2026)
- https://github.com/webmachinelearning/webmcp/blob/main/index.bs and `git log 241bb2c0..bd81b6d0` over it (commits listed in section 1)
- https://github.com/webmachinelearning/webmcp/blob/main/README.md (Best Practices, Future Exploration: Declarative API, headless scope)
- https://github.com/webmachinelearning/webmcp/blob/main/declarative-api-explainer.md
- Issues: 9, 73, 92, 106, 165, 167, 224, 227, 255 and PRs 217, 245, 253, 275, 281, 301, 311, 324, 330, 337, 338, 339, 345, 347

End of report. Spec snapshot: CG-DRAFT 16 October 2026. Research completed 19 October 2026.

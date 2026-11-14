# WebMCP re-verification, 4 November 2026

Read against the live `index.bs` in webmachinelearning/webmcp (blob `847677e03d3e61aaddf65ad328147129083168c0`), commit by commit since the 16 October pin (blob `bd81b6d06c4d22bd15c14849030bbeb2fb14d9cd`). The October report (`webmcp-research-2026-10-16.md`) stays the full IDL and error reference; this note records only what moved.

## What changed

| Date | Commit | Change | Normative? |
| --- | --- | --- | --- |
| 2026-11-02 | `6cd745ac8` (#254) | `outputSchema` added to `ModelContextTool` and `RegisteredTool` | Yes |
| 2026-10-27 | `6838130ef` (#326) | Section 6.3.4: cross-origin tool exposure and the two-sided opt-in | No, security notes |
| 2026-10-20 | `51ed75653` (#334) | Agent ecosystem risks, linking agent security guidance | No, security notes |
| 2026-10-20 | `cb3d16964` (#352) | New editor | No |
| 2026-10-16 | `f14762e63` (#350) | Explainers synced with the spec (outside `index.bs`) | No |

## `outputSchema` (#254)

- `ModelContextTool` gains `object outputSchema`: a JSON Schema object describing the expected result. "Tool output is expected to conform to the provided schema, and agents may reject outputs that do not validate."
- `RegisteredTool` (what `getTools()` returns) gains `object outputSchema`, a deep copy of the registered schema, parsed back from its stored JSON string.
- The tool definition stores both schemas as strings through one new algorithm, "serialize a tool schema": the empty string when the member is absent or undefined, otherwise `JSON.stringify` of the object. Serialization that yields undefined throws a `TypeError`, and errors such as a circular reference are re-thrown, so `registerTool()` rejects.
- Because both members are typed `object`, a non-object value (`inputSchema: ""`) throws a `TypeError` during dictionary conversion.
- The user agent does not validate results against `outputSchema`; the agent may.

## What it means for Ora

- The rule calling `outputSchema` "MCP vocabulary that does not exist in WebMCP" is retired; it is now rule 7 of the skill.
- No check flagged `outputSchema` as a mistake, so nothing scored a site wrongly.
- Capture now records `outputSchema` (the shim's registry record, its `getTools()` polyfill and the static code reader). The public audit projection does not carry it, so the contract is unchanged.
- No WebMCP check scores `outputSchema`. Whether it should, the way `mcp-output-schema` does for MCP servers, is a product decision.
- The two-sided cross-origin opt-in was already a hard rule; section 6.3.4 now explains it.

## Sources

- https://webmachinelearning.github.io/webmcp/ (rendered draft)
- https://github.com/webmachinelearning/webmcp/pull/254
- https://github.com/webmachinelearning/webmcp/pull/326
- https://github.com/webmachinelearning/webmcp/pull/334

## Addendum, 10 November 2026: blob `68a80fe3d10fac37dd42e2dee57b16989804392c`

One normative change since this report: webmcp #371 (commit `f2f2ae229`, 9 November) moves the `toolactivated` step in "invoke the execute callback" to after `execute` is invoked, and the event's definition now reads "after a tool's execute callback is invoked" instead of "when the execution of a tool begins". Because the invocation turns a synchronous throw into a rejected promise, the event fires even when `execute` throws. No scanner check reads the event. Ora's two first-party shims now fire it after invoking `execute`. `WEBMCP_SPEC_SOURCE_SHA` moves to this blob and `WEBMCP_SPEC_SNAPSHOT` to 2026-11-10, the date of this read. 2026-11-04 joins `WEBMCP_RUNTIME_COMPATIBLE_SPEC_SNAPSHOTS`, because the capture contract (which tools register, how the verdict is reached) is unchanged, so stored audits stay valid runtime evidence. One of them also fires `toolcancel` only once `execute` has been invoked, since the spec cannot cancel an execution it has not started.

# NLWeb - research snapshot 2026-10-15

Source of truth: `NLWEBSPEC.md` in https://github.com/nlweb-ai/website, read at commit `930136bc663994730d4762b55f1a88e332274810` (2026-03-23, "Replace static site with NLWeb documentation app"), the last commit touching the file as of 2026-10-15; the website repo's HEAD (`9cd2fd6`, 2026-08-11) carries the identical blob `b62cf132e689a0e7083b87fde8ff083a1d853b8e`. The document's title is "NLWeb Specification v0.55". There are no tagged releases and no changelog outside the spec's own Appendix D. Section numbers below (section N) are the spec's own.

## 1. What NLWeb is

A protocol for natural-language interaction with a site's agent. The primary operation is `ask`; `await` checks on or cancels a long-running answer. Transport neutral (section 2.1): the same JSON travels over HTTP (section 7) or as MCP tools (Appendix A). Authentication and rate limiting are transport concerns (sections 2.4, 2.5).

## 2. Request (section 3)

| Section | Fields |
|---|---|
| `query` (required) | `text` (required string), `site` (optional string, a sub-corpus), plus any filter attributes (`itemType`, `location`, `price`, ...), schema.org vocabulary where possible |
| `context` (optional) | `@type` (default `ConversationalContext`); for it: `prev` (string array), `text` (string), `memory` (string). Custom types via `@context` |
| `prefer` (optional) | `streaming` (boolean, no default stated), `response_format` (`conversational_search` default, `chatgpt_app`; a client may list several), `mode` (`list`, `summarize`; comma lists), `accept-language`, `user-agent`. Modelled on HTTP content negotiation |
| `meta` (optional) | `version`, `session_context` (object), `user` (string or object), `remember` (boolean) |

## 3. Response (section 4)

- `_meta` is required: `response_type` (required: `answer`, `elicitation`, `promise`, `failure`), `version` (required), `response_format`, `session_context`, format-specific keys (`openai/outputTemplate`, `openai/widgetAccessible`).
- **Answer, `conversational_search`** (section 4.1.1): `results`, an array of typed objects: `@type` recommended, type-specific fields (`url`, `name`, `description`, ...), optional `grounding` (provenance) and `actions` (section 5). A summary item uses `@type: "SearchSummary"` and `text`.
- **Answer, `chatgpt_app`**: `content` (`[{type: "text", text}]`) and `structuredData` (typed objects).
- **Promise** (section 4.1.2): `token`, `estimated_time`, `message`, `progress`. **Elicitation** (section 4.1.3): question types `single_select`, `multi_select`, `free_text`, `number`, `boolean`.
- **Failure** (section 4.1.4): `error.code` (required) and `error.message`. Standard codes: `NO_RESULTS`, `INVALID_QUERY`, `UNSUPPORTED_FORMAT`, `UNSUPPORTED_MODE`, `RATE_LIMITED`, `INTERNAL_ERROR`, `TIMEOUT`, `TOKEN_LIMIT`; `/await` adds `CANCELLED`. Additional codes via extensibility.

## 4. Streaming (section 6)

Requested by `prefer.streaming: true`; SSE via `Accept: text/event-stream` (section 7.3). Events: `start` (`_meta` with `"streaming": true`), `result` (`{index, item}`, indexes may arrive out of order), `error` (failure envelope; the stream may continue or end), `complete` (final `_meta`, which clients MUST process for `session_context`).

## 5. HTTP binding (section 7)

`POST /ask`, `POST /await`. `prefer` carries preferences rather than HTTP headers; standard headers stay transport level. Status guidance: 200 for answers, elicitations and application failures; 202 for a promise; 400 malformed; 401 auth; 429 rate limited; 500 server failure.

## 6. Era map (what Ora meets in the wild)

| Era | Source | Shape |
|---|---|---|
| Pre-0.55 REST | nlweb-ai/NLWeb `docs/nlweb-rest-api.md` (formerly microsoft/NLWeb) | GET or POST with flat args: `query` string, `site`, `prev` (comma list), `decontextualized_query`, `streaming` (default true), `query_id`, `mode` (`list`, `summarize`, `generate`). Answer `{query_id, results: [{url, name, site, score, description, schema_object}]}`. Streams carry `message_type` objects (`begin-nlweb-response`, `result`, `end-nlweb-response`) |
| v0.5 TypeSpec | nlweb-ai/nlweb-typespec `main.tsp` ("Current version: 0.5") | `return_response` (not `prefer`) with `streaming` default true, `meta.api_version`, `query.site` as a string array, `context.memory` as a string array, `_meta.response_type` capitalised (`Answer`, `Elicitation`, `Promise`), answers as `content[]` of `text` / `resource` items, a `Who` agent-discovery endpoint |
| v0.54 | Appendix D of v0.55 | `api_version` in places; streaming without formal event types |
| **v0.55 (pinned)** | `NLWEBSPEC.md` | The shape in sections 2 to 5 above |

The spec-adherence suite bans the pre-0.55 and v0.5 vocabulary in everything Ora authors or emits; observers may still send pre-0.55 probes as fallbacks.

## 7. Implementations Ora meets

- **Reference server** (nlweb-ai/NLWeb `AskAgent/python`): accepts both the v0.55 envelope and the flat form (`webserver/routes/api.py` flattens the envelope), defaults `streaming` to true, and in v0.55 mode emits `start`, `result` per item and `complete` (`core/utils/message_senders.py`).
- **Agent Front** (Ora's implementation; serves ora.ai's `/ask`): the stateless v0.55 `list` profile with `conversational_search` results typed `WebPage` and `grounding.evidence`; JSON unless `prefer.streaming` selects SSE, or an `Accept` header preferring `text/event-stream` when `prefer.streaming` is absent (verified live on ora.ai, 2026-10-16: a POST with only `query.text` and `Accept: text/event-stream` streamed `start`, five `result` events and `complete`); HTTP 200 `UNSUPPORTED_*` failures for modes, formats, filters and context types it cannot serve; a GET convenience adapter.
- **nljev** (a second Ora implementation): a v0.55 `list` profile with `WebPageSection` results.

Observed live on ora.ai, 2026-10-15: GET `?query=stripe&mode=list` and the v0.55 POST both returned `200` answers with `_meta.version: "0.55"`; `prefer.streaming: true` with `Accept: text/event-stream` returned `start`, five `result` events and `complete`; a flat `{"query":"stripe"}` POST returned `400` with `error.code: "INVALID_QUERY"`.

## 8. Watch list

- Any commit touching `NLWEBSPEC.md` (the drift watch's signal).
- A tagged release or a versioned spec directory in nlweb-ai/website, which would let the pin move from a blob to a version.
- nlweb.ai availability (unreachable from Ora's network on 2026-10-15; a certificate lapse on 2026-08-04 is reported by third parties).
- Real deployments of `chatgpt_app`, `promise` / `/await`, `elicitation` or `actions`, before any check scores them.
- The unmerged branch `spec-mcp-apps-output` of nlweb-ai/website (91da273, 2026-06-22, R.V. Guha; seen live and unmerged on 2026-11-09). It keeps the version at 0.55 and switches interactive output from the ChatGPT Apps SDK to MCP Apps (`io.modelcontextprotocol/ui`): `response_format: "chatgpt_app"` becomes `"mcp_app"`, the answer's `structuredData` array becomes `structuredContent: {results: [...]}`, and the `_meta` keys `openai/outputTemplate` / `openai/widgetAccessible` become `_meta.ui.resourceUri` naming a `ui://` resource (served as `text/html;profile=mcp-app` over HTTP). Watch only: no Ora check, probe or emitter uses `chatgpt_app`, and the drift watch alerts if it merges to `main`, at which point section 3 and SKILL.md rule 3 move with the pin.

## Sources

- https://github.com/nlweb-ai/website/blob/930136bc663994730d4762b55f1a88e332274810/NLWEBSPEC.md
- https://github.com/nlweb-ai/NLWeb (`docs/nlweb-rest-api.md`, `AskAgent/python/webserver/routes/api.py`, `AskAgent/python/core/utils/message_senders.py`)
- https://github.com/nlweb-ai/nlweb-typespec (`main.tsp`)
- https://agentic-readiness.lumar.io/docs/capabilities/nl-web (reports the nlweb.ai certificate lapse and the absence of tagged releases)

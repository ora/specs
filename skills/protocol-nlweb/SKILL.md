---
name: protocol-nlweb
description: Use when writing, reviewing, or scoring anything that serves, probes, teaches, or grades an NLWeb /ask endpoint - a site's own /ask and its OpenAPI or catalog entries, checks that probe /ask and its streaming mode, or recommendations and docs that tell site owners how to ship one. Also use when code or a diff mentions NLWeb, /ask, /await, NLWEBSPEC.md, query.text, prefer.streaming, response_format, conversational_search, chatgpt_app, _meta.response_type, NO_RESULTS, UNSUPPORTED_MODE, SearchSummary, or the start/result/complete SSE events, so generated code follows the pinned v0.55 spec instead of the pre-0.55 REST API or the v0.5 TypeSpec still common in training data.
---

# NLWeb adherence

Code that serves, probes, teaches, or scores NLWeb `/ask` endpoints must encode the spec correctly in each posture:

| Posture | What it is | Rule |
|---|---|---|
| **Observer** | Code that probes and grades what sites serve | MAY send pre-0.55 forms (GET `?query=`, a flat `query` string, a top-level `streaming`) as FALLBACK probes, and MAY recognise pre-0.55 answers (`query_id` + `results`, a `meta` envelope) as evidence. MUST send the v0.55 POST envelope before any pre-0.55 POST body (a GET probe may precede both), MUST state `streaming` explicitly on every pre-0.55 probe (that era streams by default), and MUST NOT fail a site for anything v0.55 leaves open (rules 5 and 8). |
| **First-party author** | Your own `/ask` and the documents that describe it (OpenAPI operations, catalog entries, agent-facing index files) | MUST be v0.55-current. |
| **Emitter** | Guidance you hand to the public (recommendations, methodology copy, check maps, playbooks) | MUST teach the v0.55 envelope and point at the spec (`NLWEBSPEC.md`), never at the reference implementation's repo. |

Which files sit in which posture is repo-specific: see "Repo overlay" below.

**Spec identity.** NLWeb **v0.55**, `NLWEBSPEC.md` in https://github.com/nlweb-ai/website (no tagged releases; nlweb.ai has carried the same text but was unreachable at the 2026-10-15 read and a certificate lapse on 2026-08-04 is reported, so cite the repo). The reviewed pin (version, read date, and sources with commit 930136b, the last commit touching the file, and the file's blob SHA) lives in `specs/nlweb/spec.yaml` of ora/specs and is read through `@ora-ai/specs` (`spec("nlweb").reviewed`), never restated in code constants. When asserting anything beyond the pin, re-read the spec and move the pin and this skill together.

## Hard rules (the v0.55 contract - enforce, don't debate)

1. **HTTP binding is `POST /ask`** (and `POST /await`), JSON body (section 7.1). GET is not part of v0.55: a server may offer it, a check may fall back to it, but nothing emitted teaches it as the way to call NLWeb.
2. **The request has four sections** (section 3): `query` (required; `query.text` required, `query.site` optional string, further filter attributes allowed), `context` (optional; default `ConversationalContext` with `prev` string array, `text` string, `memory` string), `prefer` (`streaming`, `response_format`, `mode`, `accept-language`, `user-agent`), `meta` (`version`, `session_context`, `user` string or object, `remember`). Requests use `meta`; responses use `_meta`. The version field is `version`, never `api_version`.
3. **Every response is JSON with `_meta.response_type` and `_meta.version` required** (section 4). `response_type` is lowercase `answer`, `elicitation`, `promise` or `failure`. `response_format` is optional and open-ended (section 3.3.1): the spec defines `conversational_search` (default) and `chatgpt_app`, and agents may support more.
4. **A `conversational_search` answer is a `results` array of typed objects** (section 4.1.1): `@type` recommended (schema.org where it applies), type-specific fields, optional `grounding` and `actions`. There is no `schema_object` wrapper. A summary item SHOULD use `@type: "SearchSummary"` (or a type that fits the domain) with `text`.
5. **Failures carry `error.code`** (section 4.1.4): standard codes `NO_RESULTS`, `INVALID_QUERY`, `UNSUPPORTED_FORMAT`, `UNSUPPORTED_MODE`, `RATE_LIMITED`, `INTERNAL_ERROR`, `TIMEOUT`, `TOKEN_LIMIT`; extensions allowed. An application failure is typically HTTP 200, a malformed request 400, rate limiting 429 (section 7.4), with `Retry-After` per section 2.5. A check reading a 200 must look at `_meta.response_type` before calling it an answer.
6. **Streaming is requested with `prefer.streaming: true`** and delivered as SSE under `Accept: text/event-stream` (sections 6 and 7.3), with named events `start` (`_meta` with `streaming: true`), `result` (`{index, item}`), `error` (a failure envelope) and `complete` (final `_meta`). There is no `message_type` field and no `begin-nlweb-response` framing.
7. **Modes are `list` and `summarize`**, comma lists allowed (section 3.3.2). `generate` is pre-0.55. When `summarize` is requested the agent adds a summary item or answers `UNSUPPORTED_MODE`.
8. **v0.55 sets no default for `streaming`.** JSON-by-default and SSE-by-default are both conformant; never score a server for either. Likewise `prefer.accept-language` is negotiated like the HTTP header, so serving the source language is conformant.

## Unstable areas (feature-detect, never hard-rule)

`chatgpt_app` output, `promise` and `/await`, `elicitation`, `actions`, `session_context`, and `@context` extension types are defined but had no observed deployment at the 2026-10-15 read; no check may require them. The reference implementation (nlweb-ai/NLWeb, `AskAgent`) accepts both eras, defaults `streaming` to true and answers `generate`: that is implementation behaviour, not the spec. The website repo has no releases, so the spec can change in place: comparing the file's blob against the pin is the only signal. Watch, not rule: the unmerged nlweb-ai/website branch `spec-mcp-apps-output` (91da273, 2026-06-22, by the spec author, still labelled v0.55) replaces `chatgpt_app` with `mcp_app` (MCP Apps), `structuredData` (array) with `structuredContent: {results: [...]}`, and the `openai/outputTemplate` / `openai/widgetAccessible` meta keys with `_meta.ui.resourceUri` (a `ui://` resource); rule 3 stays as written until it merges to `main`. Full detail: `references/nlweb-research-2026-10-15.md`.

## Reference

`references/nlweb-research-2026-10-15.md` - the spec summary by section, the era map (pre-0.55 REST, v0.5 TypeSpec, v0.54, v0.55), the implementations met in the wild (reference server and others), and sources. Load it when a question goes past the hard rules above.

## Repo overlay

Each consuming repo keeps its own posture table (which of its files are observer, first-party author, or emitter), where its own `/ask` runtime lives, and its own enforcement (mechanical adherence suites, reviewers) in its own rules file. On repo-specific points, the overlay wins over this skill.

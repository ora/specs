# Personal Agent Protocol (PAP, "Poppy") - research snapshot 2026-10-10

Source of truth: the three pages at https://personalagentprotocol.org - `/docs/spec` (the protocol), `/docs/extensions/operations` (the operations extension, version 1) and `/docs/guides` (recommended practice, not normative). Snapshot read 2026-10-10 against **Draft 0.1**, published 2026-10-09 (Apache-2.0), developed by Meta and Sierra with industry partners Genesys, Instinct, Rocket, Shopify, Stripe and Walmart (https://sierra.ai/blog/introducing-personal-agent-protocol). There is no source repository, no changelog and no dated revision directory, so drift is measured as a change in each page's normalized article text: `scripts/pap-spec-digest.mjs` produces the SHA-256 pinned in `src/lib/pap/constants.ts`, and the `pap` job in `.github/workflows/spec-drift-watch.yml` re-runs it weekly. Section numbers below (§N) are the spec page's own.

The draft says of itself: "Any part of it can change before a stable version, including in ways that aren't backward compatible." Treat every rule here as pinned to Draft 0.1, never as settled.

## 1. What PAP is

A protocol for a **Personal Agent** acting for one **User** to work with a **Company**: discovery, sessions and sign-in, web browsing, APIs, and conversations with the Company's own agent. A Company publishes one JSON document; everything else is an OAuth 2.0 profile (RFC 6749 + 7523 + 7636 + 8414 + 8628 + 8707 + 9207 + 9449) plus a conversation wire format. Key terms: **Session** (one User at one Company through one Personal Agent, starts signed out), **Session Token** (short-lived OAuth access token, DPoP-bound), **Account Token** (the OAuth refresh token from sign-in, used only at the token and revocation endpoints), **User ID** (stable, opaque, different per Company, never derived from personal information even with a keyed hash), **Company Agent**.

## 2. Discovery (§3, §3.1)

- The document lives at `https://{domain}/.well-known/poppy.json` over HTTPS, `{domain}` being the Company's domain or a subdomain it controls.
- The well-known URL MAY redirect (hosting with a provider). Personal Agents MUST follow redirects, and every redirect MUST be to an HTTPS URL. The document still speaks for the domain the agent **requested**.
- Personal Agents SHOULD cache it per its HTTP caching headers.

`poppy.json` fields:

| Field | Required | Rule |
|---|---|---|
| `protocol_version` | Yes | `major.minor`; Draft is `"0.1"`. A newer minor must not break older agents (ignore unknown fields). An agent MUST NOT use a document whose major it does not support. |
| `organization` | Yes | `name` + `domain`. `domain` MUST match the host of the well-known URL the agent requested, ignoring a leading `www.`. **After a redirect, the host the document is served from does not count.** |
| `auth` | If `agent`, `apis`, or `web.browser_session_endpoint` is present | `issuer` (HTTPS OAuth issuer identifier) plus `direct`, `device`, `mediated` for supported sign-in types, and `custom_scopes`. With no sign-in type, only signed-out Sessions. Without `auth` at all, the site can only be browsed as an ordinary website. |
| `auth.direct` / `auth.device` | If supported | `scopes` the type can grant. |
| `auth.mediated` | If supported | `endpoint` (where credentials go), `fields` (`name`, `label`, `secret`), `scopes`. |
| `auth.custom_scopes` | No | Description per Company scope beyond `poppy:read` / `poppy:write`. |
| `agent` | One of `agent`, `apis`, `web` | `protocols[]`, each `type` + HTTPS `endpoint`; MAY carry `resource`. |
| `apis` | One of `agent`, `apis`, `web` | Each `type` (§6), `url`, `description`; MAY carry `resource`. |
| `web` | One of `agent`, `apis`, `web` | Optional `browser_session_endpoint` (§5). Without it, agents browse signed out. |
| `extensions` | No | Keyed by name (§3.3). |

## 3. OAuth server (§3.2)

- A Company is identified by its `auth.issuer`. Several domains MAY name one issuer and are then one Company (same User IDs, Sessions, Account Tokens).
- The issuer MUST publish **OAuth Authorization Server Metadata (RFC 8414)**, and `poppy_domains` in it MUST list every domain whose `poppy.json` names the issuer.
- Before using a `poppy.json`, the agent fetches the metadata and MUST check that its `issuer` **exactly** matches `auth.issuer` and that `poppy_domains` includes `organization.domain`. The spec's reason: "Otherwise any domain could claim another Company's issuer and receive its tokens."
- Metadata URL: the spec example is `GET https://auth.example.com/.well-known/oauth-authorization-server`. Per RFC 8414 section 3, an issuer with a path component inserts the well-known segment between host and path (`https://auth.example.com/tenant` -> `https://auth.example.com/.well-known/oauth-authorization-server/tenant`). The spec never mentions OIDC discovery; `/.well-known/openid-configuration` is not a PAP discovery location.
- Endpoints taken from metadata: `token_endpoint` (required), `revocation_endpoint` (required), `authorization_endpoint` (required if `auth.direct`), `device_authorization_endpoint` (required if `auth.device`). Other fields are ignored. Cache per HTTP headers.

## 4. Extensions (§3.3)

- Listed in `poppy.json` `extensions`, keyed by name. Plain names (`operations`) belong to this protocol; anyone else MUST prefix a domain they control (`example.com/gift-wrap`).
- Each entry has `version` (the extension's major); other fields are extension-defined.
- Agents list theirs in `extensions` in their client metadata document (§4.1).
- Both sides MUST ignore unsupported extensions and unknown fields. A Company MAY refuse a request it handles only with an extension the agent does not list: `extension_required` (HTTP 403) with the name in `extension`.

## 5. Sessions and tokens (§4)

**Agent identity (§4.1).** `client_id` MUST be an HTTPS URL returning the agent's metadata document (the OAuth Client ID Metadata Document draft that MCP also uses). `client_id` MUST equal the fetched URL. `jwks_uri` and every `redirect_uris` entry MUST be HTTPS on the same domain as `client_id`. Token endpoint auth is `private_key_jwt` (RFC 7523). DPoP keys are separate and unpublished. A Company requiring registration rejects an unregistered agent with `invalid_client` (401). Ora reserves two such URLs: `https://ora.ai/poppy/probe-client.json` (`PAP_PROBE_CLIENT_ID`, permanently 404, used by the Tier 1 junk token request) and `https://ora.ai/poppy/agent.json` (`PAP_AGENT_CLIENT_ID`, Tier 2).

**Starting a Session (§4.2).** JWT bearer grant (`urn:ietf:params:oauth:grant-type:jwt-bearer`) at `token_endpoint`, with the Session assertion (`iss` = `client_id`, `sub` = User ID, `aud` = token endpoint as a single string, short `exp`, `jti` with at least 128 random bits), the client assertion, and a DPoP proof. Response: `access_token`, `token_type` (`DPoP`, or `Bearer` for a proofless request), `expires_in` > 0 (hours, not days), `scope`, `session_id` (not a credential), `signed_in`. Renewal sends the same request with `session_id`. Session Tokens are opaque to the agent; if a Company embeds its own credentials, it MUST encrypt the token.

Token endpoint errors (OAuth error response):

| Error | Status | Meaning |
|---|---|---|
| `invalid_client` | 401 | `client_id` unregistered, blocked, revoked, or its metadata or signature does not check out |
| `invalid_grant` | 400 | Assertion or Account Token missing, expired, reused, revoked, malformed |
| `invalid_session` | 400 | Session ended or belongs to another agent or User |
| `account_mismatch` | 400 | Session signed in to a different account |
| `invalid_dpop_proof`, `use_dpop_nonce` | 400 | DPoP proof missing, invalid, or needs a nonce |
| `rate_limited` | 429 | Too many requests for this `client_id`; honour `Retry-After` |

A junk JWT bearer request (unknown `client_id`, garbage assertion) is therefore answered with `invalid_client` 401 or `invalid_grant` 400; the live demo receiver answers `401 {"error":"invalid_client"}`. Ora's T1-01 also passes `invalid_request` 400 (a generic RFC 6749 rejection outside the §4.2 table) with a note, and passes a §4.2 code sent with a different status with a note; public copy teaches only the §4.2 codes.

**Using Session Tokens (§4.3).** API calls and conversations MUST carry `Authorization: DPoP <token>` plus a `DPoP` proof (RFC 9449: `typ` `dpop+jwt`, public `jwk` in header, `jti`, `htm`, `htu` without query or fragment, `iat`, `ath` = SHA-256 of the token; `nonce` when required). The Company MUST verify signature, key binding, `htm`/`htu`, `iat` window, `jti` replay, `ath`. Personal Agents MUST support nonces. Failures return `invalid_dpop_proof` / `use_dpop_nonce` with `WWW-Authenticate: DPoP`.

**Bearer is for MCP only.** MCP authorization uses Bearer, so for MCP the agent requests a token without a proof and MUST send `resource` = the MCP server's `url` from `poppy.json`; each Bearer token works at one MCP server. Companies MUST accept Bearer Session Tokens only on their MCP APIs and MUST require DPoP everywhere else. Web browsing does not use Session Tokens.

Other §4.3 rules: `scope` and `resource` (RFC 8707) narrow any token request; tokens MUST be accepted in the `Authorization` header without cookies; agents MUST send a Session Token on every API and conversation request; tokens MUST NOT travel in a URL and Companies MUST NOT accept them from one; 429 + `Retry-After` on any endpoint, which the agent MUST honour.

**Sign-in types (§4.4-§4.7).**

| Type | Who signs in | Mechanism |
|---|---|---|
| `direct` | The User | OAuth authorization code + PKCE (RFC 7636); `iss` returned in the redirect (RFC 9207) and MUST exactly match `auth.issuer`; `session_id` sent at code exchange |
| `device` | The User | RFC 8628 device grant; opening the link MUST NOT approve by itself; `authorization_pending` / `slow_down` / `access_denied` / `expired_token` |
| `mediated` | The agent, for the User | Not OAuth: JSON POST of `scope` + `credentials` to `auth.mediated.endpoint` with a DPoP Session Token; statuses `complete`, `code_required` (with `sign_in_id`, then POST `{endpoint}/{sign_in_id}` with only the code), `failed`, `expired`. The Company MUST rate-limit attempts and MUST NOT return credentials. |

Scopes: `poppy:read` and `poppy:write` are independent (write does not include read); names starting `poppy:` are reserved; custom scopes are described in `auth.custom_scopes`. Every sign-in request MUST carry `scope`; unknown or unavailable scopes get `invalid_scope`. All three types end with `refresh_token` (the Account Token, optional `refresh_token_expires_in`) and a signed-in Session Token. A Session is signed in to at most one account (`account_mismatch` otherwise).

**Account Tokens (§4.8)** are accepted only at `token_endpoint` and `revocation_endpoint`, only from the issuing `client_id`. Using one does not extend its lifetime; a rotated one MUST replace the old. Expired or revoked: `invalid_grant`. Agents MUST store them as secrets, never in model context, messages, logs, or URLs.

**Signing out (§4.9)** is RFC 7009 revocation of the Account Token; Sessions usually continue signed out (or end, returning `invalid_session` on renewal).

## 6. Browser join (§5)

Optional; advertised as `web.browser_session_endpoint`. When present, the agent MUST join its browser to a Session before browsing.

1. The agent signs a browser assertion with a `jwks_uri` key, header `typ` = `poppy-browser+jwt`, claims `iss`, `sub`, `aud` (= the endpoint), `session_id`, `return_to` (HTTPS on `organization.domain` or a subdomain), `iat`, `exp` (at most 60 s after `iat`), `jti`.
2. Its browser (never the User's own browser) form-POSTs `assertion=...` to the endpoint as a top-level navigation; the assertion goes in the body, never the URL.
3. The Company MUST check signature + `typ` (a Session assertion is not accepted here, nor a browser assertion at the token endpoint), `aud`, expiry and the 60 s cap, `jti` replay, an active Session for the same `client_id` and User, and `return_to` on its own domain.
4. **Success: `303 See Other` to `return_to` with `Set-Cookie`. Failure: no cookie, an error page with HTTP 400.** The cookie MUST follow the Session's state, MUST NOT outlive the Session, and MUST be `Secure`, `HttpOnly`, `SameSite=Lax` or `None` (not `Strict`).

## 7. APIs (§6)

- `type` MUST be `openapi` (an OpenAPI 3.0 or 3.1 description at `url`) or `mcp` (a remote MCP server, Streamable HTTP, MCP 2025-06-18 or later). Agents SHOULD skip unknown types.
- Every listed API MUST accept Session Tokens: DPoP for OpenAPI, Bearer for MCP.
- A listed MCP server MUST accept Session Tokens as access tokens, enforce their scopes, and accept only tokens issued for its `url`. Its RFC 9728 protected resource metadata `authorization_servers` **MUST include `auth.issuer`**; a non-PAP MCP client then signs in through MCP's own flow and the Company treats it as a new signed-in Session.
- Resource errors in `WWW-Authenticate` (RFC 9449, or RFC 6750 for Bearer): `invalid_token` 401 (missing or expired), `sign_in_required` 403, `insufficient_scope` 403 with `scope`. The demo receiver's conversation endpoint answers an unauthenticated request with `401` and `WWW-Authenticate: DPoP error="invalid_token"`.

## 8. Conversations (§7)

- `agent.protocols[]` entry `type: "poppy"` is the one defined protocol; agents skip unfamiliar types. JSON over HTTPS; every request carries a DPoP Session Token.
- Routes off `{endpoint}`: `POST {endpoint}` (start, or a Direct Conversation with `parent_conversation_id`), `POST {endpoint}/{id}/messages`, `GET {endpoint}/{id}/events` (cursor + `wait` long poll, or SSE via `Accept: text/event-stream`), `POST {endpoint}/{id}/handoff` (`{}`), `POST {endpoint}/{id}/close` (`{}`).
- Ownership: the `client_id` + User ID that started it, then the account once used; other callers are rejected (`conversation_not_found` for all mismatch cases).
- IDs: 1-256 chars of URL-safe base64 alphabet, prefixed `cnv_`, `msg_`, `evt_` by convention, opaque to the other side.
- Message: `id` (agent-chosen, unique per User, idempotent retry; different content = `message_id_conflict`), `sender` (`agent` | `human`; `human` only for the User's own words), at least one of `text`, `data`, `context` (`locale` RFC 5646, `time_zone` IANA, `user_available`). Start returns `201` with `conversation_id`, `status`, `responder`; later messages `202`; optional `wait` + `cursor` return events inline.
- Events: `id` (also the cursor), `type`, `created_at` (RFC 3339). Types `message` (with `role` `user` | `company`), `state`, `authorization` (`error` + `scope`), `user_requested` (`reason`), `direct_opened` / `direct_closed`. Unknown types MUST be skipped. Every successful read MUST include `cursor`, `has_more`, `status`, `responder`. SSE `text-delta` pieces are never acted on.
- Status `working` | `idle` | `queued` | `closed`; responder `agent` | `human`, independent of status.
- Errors: `conversation_not_found` 404, `conversation_closed` 409, `direct_conversation_open` 409, `message_id_conflict` 409, `invalid_cursor` 400, `cursor_expired` 410.

## 9. Operations extension (version 1)

- Advertised as `extensions.operations` `{ "version": "1", "endpoint": "https://..." }`; the endpoint accepts DPoP Session Tokens and MAY carry `resource`. The agent lists `operations` `{ "version": "1" }` in its client metadata. A Company MUST NOT return operations to an agent that does not list the extension (perform the action without it, or `extension_required`).
- Operation object: `operation_id`, `revision` (starts at 1), `state`, `summary` (stands alone: what, to what, any cost, date, condition), optional `terms`, `expires_at` (while proposed), `user_approval_required` (default false), optional `url`, `confirmation` (null until confirmed), `result` (null until final).
- States: `proposed`, `in_progress`, then final `succeeded`, `failed`, `cancelled`, `expired`. Revisions are immutable; only the latest can be confirmed. Proposing never performs; the Company MUST NOT start before confirmation.
- Proposed through existing channels: OpenAPI `202` with `operation`; MCP tool result `structuredContent.operation`; conversation message `operation`; website `url`.
- Confirm: `POST {endpoint}/{operation_id}/confirm` `{ "revision": n, "approved_by": "user" | "standing_permission" }`; read `GET {endpoint}/{operation_id}`; cancel `POST {endpoint}/{operation_id}/cancel`. At most once; no `Idempotency-Key` needed; `failed` never reported while the outcome is unknown.
- Errors: `operation_not_found` 404, `terms_changed` 409 (with the current operation), `user_approval_required` 403, `extension_required` 403.

## 10. Guides (recommendations, never non-compliance)

Items Ora's catalog grades as `Adv` or `P2` come from here: S256 PKCE only, reject `plain`; fetch limits (a few redirects, about 100 KB, a few seconds, no credentials, reject private addresses); cache bounds of a minute to a day; `Cache-Control: no-store` on any response carrying a token or code; ES256/RS256, reject `alg: none` and HS256; Companies fetch `client_id` without following redirects; one shared DPoP replay cache; build `htu` from the configured public origin; `RateLimit` / `RateLimit-Policy` headers (IETF draft); keep conversation events and final operations at least 30 days; identical errors for "does not exist" and "belongs to someone else".

## 11. Era map

| Form | Era | Fate |
|---|---|---|
| Everything above | Draft 0.1 (2026-10-09) | Current. No earlier public draft exists, so there are no legacy signatures for observer code yet. |

When the first breaking draft lands, add rows here (form, era, fate) before any observer code accepts the old form.

## 12. Watch list

- **Open topics** listed on the site (https://personalagentprotocol.org/docs/open-topics, not pinned by the drift job): payments, push notifications (reaching an agent with no open request), and attachments (receipts, labels, images, forms). Operations covers approval of costed actions, not payment execution.
- **Sierra's reference implementation**, promised within about a month of publication (around 2026-11-09). Expect it to settle ambiguities and possibly move the draft; re-read all three pages when it ships.
- The only live implementation found is the demo receiver at https://poppy-receiver.roundtrip.workers.dev (no production deployments as of 2026-10-09). Its `poppy.json` carries an empty `"web": {}` and no `device_authorization_endpoint`; do not generalise its choices into rules.
- Dependent drafts that can move under PAP: the OAuth Client ID Metadata Document draft (§4.1), the RateLimit headers draft (guides), and the MCP authorization spec (§4.3, §6).
- Any page edit that keeps the same Last-Modified is still caught by the digest; a page restructure that drops `<article>` fails the digest script loudly instead of reading as drift.

## 13. Sources

| Page | URL | Last-Modified | Normalized SHA-256 (`scripts/pap-spec-digest.mjs`) |
|---|---|---|---|
| Specification | https://personalagentprotocol.org/docs/spec | Fri, 09 Oct 2026 23:06:22 GMT | `833b32455bc20f6f2f248e18442a6f26e15b0d2fa0e9db0cd4246ce68b328cbd` (`PAP_SPEC_SOURCE_SHA256`) |
| Operations extension | https://personalagentprotocol.org/docs/extensions/operations | Fri, 09 Oct 2026 23:10:29 GMT | `819e01ded9ef876ec6b83c19d513b6e2f5a3965b4c733bee99290ab523862a79` (`PAP_OPS_SOURCE_SHA256`) |
| Guides | https://personalagentprotocol.org/docs/guides | Fri, 09 Oct 2026 23:10:25 GMT | `e16b5c8f9422b45caa94560dd3e130e55fd63f494047ae1ea249a7997db02ce7` (`PAP_GUIDES_SOURCE_SHA256`) |

Each digest was reproduced from three independent fetches on 2026-10-10 (user agent `OraBot/1.0 (+https://ora.ai/bot)`). Demo receiver responses (`poppy.json`, issuer metadata, junk token request, unauthenticated conversation request) were recorded the same day. Authors: the Sierra announcement, https://sierra.ai/blog/introducing-personal-agent-protocol (read 2026-10-11). RFCs the spec cites normatively: 2119, 8174, 6749, 6750, 7009, 7519, 7523, 7636, 8414, 8628, 8707, 9207, 9449, 9728; plus OpenAPI 3.1 and MCP 2025-06-18.

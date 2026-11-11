# Personal Agent Protocol (PAP, "Poppy") - Draft 0.2 delta, 2026-10-19

What Draft 0.2 changed against the Draft 0.1 baseline in `pap-research-2026-10-10.md`, how Ora grades each change, and the 0.2 requirements Ora does not check yet. Read the baseline for everything not listed here; where they disagree, this file wins for 0.2 files.

## 1. Status and sources

- **Draft 0.2 is in progress, not published.** The default docs URLs (`/docs/spec`, `/docs/extensions/operations`, `/docs/guides`) serve 0.2. The spec's changelog (https://personalagentprotocol.org/docs/changelog) says "In progress, at /docs/spec. This list grows until 0.2 is published." Draft 0.1 (published 2026-10-09) is frozen at `/docs/0.1/spec` and its siblings.
- **The spec now has a repository**: https://github.com/personal-agent-protocol/personal-agent-protocol (Apache-2.0). Sources are Markdown under `content/versions/<version>/`, published versions carry page hashes in `content/versions/versions.json`, and `kit/company/` holds an implementation kit with JSON schemas (`poppy.schema.json`, `authorization-server-metadata.schema.json`, `protected-resource-metadata.schema.json`, and more). On 2026-10-19 the live site already carried changelog entries ("HTTPS everywhere", "Versions before 1.0", "Redirects and addresses") that `main` did not, so the live pages, not the repository, are the pin.
- Pinned digests (`scripts/pap-spec-digest.mjs`, live pages re-read 2026-10-20, see section 7): spec `3b7a81416cfc5f98d4ce1d6f2cb0e359cbf68a46d5a5317b5a4a856855eb50e3`, operations `6f94925f7306c2d19cb5548e9655c8d414709301ba8ef37c6e1a436969614b7f`, guides `f2b0a17c0f420732a721f2843717015cb3f8277fc365a6b829af5e36bd67ea49`. The 2026-10-19 read pinned spec `1c12afb072eb...`, operations `ce2bd8aca3f7...`, guides `8b7ec9262ae7...`. The frozen 0.1 pages no longer hash to the 2026-10-10 pins either: the version banner and menu changed the article text, not the rules.
- The demo receiver (https://poppy-receiver.roundtrip.workers.dev) still declares `"protocol_version": "0.1"` on 2026-10-19, and its metadata now lists `dpop_signing_alg_values_supported: ["ES256"]`.

## 2. Changes that move a graded row

| 0.2 change (spec section) | 0.1 rule | Ora row and how it grades now |
|---|---|---|
| Before 1.0 each 0.x version can break the previous one; an agent MUST NOT use a document whose major.minor it does not support (3.1) | Same major only; newer minors were promised compatible | T0-04: passes `"0.1"` and `"0.2"` exactly (`PAP_SUPPORTED_VERSIONS`), notes that a 0.1 file will not be used by an agent that supports only 0.2, reads a well-formed unknown version as `not_tested` (`out_of_scope`), fails a malformed one. Every other row is graded by the declared draft (`papDocVersion`). |
| `organization.domain` MUST be the host that serves the document after any redirects; domains compare ignoring case only, so a leading `www.` counts (3, 3.1; issue #5) | The host the agent requested, ignoring a leading `www.`; the serving host did not count | T0-05: 0.2 files compare against the last hop's host, case folded; 0.1 files keep the 0.1 rule. The note names both hosts when a redirect moved the file. Row retitled "Organization names its own host". |
| A file redirected to a provider's domain speaks for the provider; providers serve each Company's file on the Company's own domain (3, guides "Hosting several companies") | A provider-hosted file spoke for the requested domain | For 0.2 files, `issuerBindingHolds` also requires the serving host to sit on the requested registrable domain, so a domain that redirects to another Company's real 0.2 file cannot unlock probes or alias fetches against it. `publishesSelfNamingPoppyJson` (the `pap_sites` rule) requires the URL in T0-01's note to be on the scanned registrable domain. Neither applies to a 0.1 file, which still speaks for the requested host wherever a provider serves it. |
| `auth` is required when `feedback` is present; `feedback.endpoint` is an HTTPS URL (3.1, 8; issue #9) | No feedback field | T0-07 counts `feedback` for 0.2 files; T0-08 lists `feedback.endpoint` among the known URL fields (any version). |
| Every URL the protocol defines or exchanges is HTTPS, including API and MCP URLs, metadata, client metadata, extension endpoints, assertions, proofs and responses (3) | URLs in poppy.json | No row change: T0-08 already holds every scheme-bearing string in the file to HTTPS, and T0-12 the metadata endpoints. |
| Outside discovery, an agent MUST NOT send a token, DPoP proof, assertion or credentials to the URL a protocol endpoint redirects to (3) | Guides: each redirect hop needs its own proof | T1-14 (P1, added after the move by owner decision) grades it for 0.2 files; ADV-REDIRECT stays the `Adv` guides row for 0.1 files. |
| Client and Session assertion `aud` is `auth.issuer`, a single string compared character for character; an endpoint URL is rejected; `exp` at most five minutes after `iat`; `jti` reuse per `client_id` rejected (4.1, 4.2, 9.4; issue #2) | Session assertion `aud` was the token endpoint; client assertion `aud` unspecified | T1-01's junk assertions set `aud` to the issuer. Verdicts unchanged (the probe is unsigned and its `client_id` is a 404, so the answer is still `invalid_client` / `invalid_grant` / a DPoP error). Planned T2-04 reworded. |
| An MCP server supports DPoP when its RFC 9728 metadata lists `dpop_signing_alg_values_supported` (with ES256); its 401 carries a challenge per accepted scheme (Bearer, and DPoP when supported), each with `resource_metadata` (4.3, 6; issue #6) | Bearer only at MCP; the pointer came from MCP's own spec, which from 2025-11-25 lets the well-known URI stand in | T1-05 for 0.2 files: 401 with a Bearer challenge carrying `resource_metadata`, plus a DPoP challenge carrying it when T0-18's metadata lists DPoP algorithms or the 401 offers DPoP; every Bearer or DPoP challenge present needs the pointer, and the well-known URI no longer stands in. 0.1 files keep the old rule. |
| Only the token endpoint MUST reject a reused proof `jti`; APIs and conversations MAY (4.3) | Every endpoint MUST | No implemented row. Planned T2-09 now targets the token endpoint. |
| A token request with no proof for a DPoP-capable MCP server gets `invalid_dpop_proof`; Bearer only for MCP servers without DPoP, valid only at the server whose `url` equals its `resource` (4.3) | Bearer for every MCP server | Planned T2-16 reworded. |
| Every successful conversation read includes `conversation_id` and `events` (7.5; issue #13) | `cursor`, `has_more`, `status`, `responder` | Planned T2-29 reworded. |

## 3. Changes that move no graded row (checked, nothing to do)

- Token endpoint error table gains `extension_required` (403) and keeps `rate_limited` (429): a junk Session request never earns either, and a 429 already grades `blocked`.
- `invalid_dpop_proof` / `use_dpop_nonce` at APIs and conversations are 401 with `WWW-Authenticate: DPoP`; T1-03 already requires exactly that.
- `extension_required` format (JSON body vs `WWW-Authenticate`), `rate_limited` body, conversation `invalid_request` / `rate_limited`, repeated close and handoff, `Last-Event-ID` over `cursor`, `user_requested` leaving status alone, role as a message field: conversation behaviour behind authentication (Tier 2 and 3).
- Sessions stay tied to their account after sign-out; device sign-in link host rule; Mediated Sign-In statuses (always HTTP 200), errors and credential storage; anonymous User IDs; a DPoP key per User ID; work outlasting a Session Token; the new security considerations (section 9): agent-side or authenticated behaviour no unauthenticated scan can observe.
- Operations: ownership after sign-out (`sign_in_required`), `rate_limited` in the error table, `extension_required` dropped from it, MCP tools returning an ordinary tool error. T1-09 (401 without a token) is unchanged.
- Spec section anchors: every id `SPEC_ANCHORS` and `OPS_ANCHORS` in `src/lib/pap/catalog.ts` name still exists; 0.2 adds `feedback`, `security`, `untrusted-content`, `secrets`, `trust`, `assertion-audience`, `references`.

## 4. 0.2 requirements: added checks and what is still open

Added 2026-10-19, after the 0.2 move (each reads N/A on a 0.1 file):

- **T0-22** (pap-issuer-binding, P1): a `dpop_signing_alg_values_supported` list in the issuer metadata includes ES256 (3.2). N/A when the field is absent, since it is optional.
- **T0-18** (pap-interfaces) also fails when an MCP server's protected resource metadata lists DPoP algorithms without ES256 (4.3).
- **T0-23** (pap-issuer-binding, P1): every other `poppy_domains` domain whose poppy.json names the same issuer carries the same `auth` (3.2), compared key-sorted with lists of plain values sorted. It reads the alias documents X-04 fetches (`resolvePapAliasDocs`, one fetch per scan under X-04's caps), so it adds no request.
- **T1-13** (pap-endpoint-enforcement, P1): POST `feedback.endpoint` with a well-formed report (`kind: "missing"`) that says it is an Ora probe, and no token; a correct site answers 401 with a DPoP challenge, and any Bearer challenge fails (8, 6). The body is valid so the missing token is the only defect to refuse. `PAP_MAX_PROBES` moved from 6 to 7 for it.
- **T1-14** (pap-endpoint-enforcement, P1; owner decision 2026-10-19): a probed token, conversation, MCP, operations or feedback endpoint that answers with a redirect fails, since a conformant 0.2 agent sends it no credentials (3). The browser join is never counted (its success is a 303). ADV-REDIRECT keeps grading 0.1 files as the guides' advisory and reads N/A on 0.2 files; T1-14 reads N/A on 0.1 files.

Also closed the same day (each for 0.2 files only):

- A URL the file or its issuer gives that resolves to a loopback, private, link-local or other non-public address fails the row that needed it (T0-09, T0-17, T0-18, or the endpoint's Tier 1 probe) instead of reading not tested (spec 3); an IP literal in such a range fails at planning, with no request.
- A `feedback` block without an endpoint fails T0-08.
- X-04 and T0-23 treat a `www.` host listed in `poppy_domains` as its own domain (0.1 files keep the www folding).

Nothing from the 0.2 delta is known to be left unchecked by a scan without credentials; everything else in 0.2 is behaviour behind authentication (Tier 2 and 3).

## 5. Era map

| Form | Era | Fate |
|---|---|---|
| `organization.domain` = requested host, leading `www.` ignored | Draft 0.1 | Replaced in 0.2 by the serving host, case only. Ora still grades 0.1 files by it; emitted copy names the draft when it mentions it. |
| Session assertion `aud` = token endpoint | Draft 0.1 | Replaced in 0.2 by `auth.issuer`. Banned in emitted text (`spec-adherence.spec.ts`). |
| Bearer Session Tokens for every MCP server | Draft 0.1 | 0.2: only for MCP servers whose metadata lists no DPoP algorithms. |
| Any 0.x minor usable by an older agent | Draft 0.1 | 0.2: exact major.minor before 1.0; the promise starts at 1.0. |
| Every endpoint rejects a reused proof `jti` | Draft 0.1 | 0.2: token endpoint MUST, others MAY. |
| Everything in `pap-research-2026-10-10.md` not listed above | Draft 0.1 | Unchanged in 0.2. |

## 6. Watch list

- 0.2 is still growing: the weekly drift job will flag each edit. On publication, set `PAP_SPEC_PUBLISHED`, and consider pinning the frozen `/docs/0.2/*` URLs instead of the moving defaults.
- The repository's `kit/company/schemas/` could back a schema-level T0 check; it is not normative and lagged the live site on 2026-10-19.
- Sierra's reference implementation (expected around 2026-11-09) is still unannounced.
- Since #71, spec 4.3 says a proof goes with "every request that carries a Session Token" and names only "a request for a Bearer token for an MCP server" as the exception. Read literally, that also asks for a proof alongside a Bearer token at a non-DPoP MCP server, which the rest of 4.3 contradicts. Likely an upstream slip: grade planned T2-16 and T2-17 by the Bearer-for-MCP rule, not by this sentence, until the text settles.

## 7. Re-read 2026-10-20: wording only, no row moves

The drift watch flagged all three pages (eralabs-ai/ora#1429). Four repository commits that merged after the 2026-10-19 read (`2fb9832` #67, `82ae80a` #68, `554f87d` #69, `30c4764` #70) were already live on the site when it was read, and sections 2 to 4 cover them. The one new change is `39b35bd` ("Make examples and guides match the spec", #71), which its author calls wording-only. What #71 changed, and what it means for Ora:

- **Which requests carry a DPoP proof (4.3).** Every token endpoint request and every request with a Session Token carries one, except a request for a Bearer token for an MCP server; revocation (4.9) and device authorization (4.6) need none. Ora's probes and copy never claimed otherwise. No row change.
- **Browser assertion audience (9.4).** Client and Session assertions name `auth.issuer`; a browser assertion names `web.browser_session_endpoint` and has its own `typ`. This is what Ora already sends (`src/lib/pap/probes.ts`) and what hard rule 9 says. No row change.
- **Examples (7.3, Operations 4.3).** The wait request shown in full, `Idempotency-Key` on API writes, a 128-bit example proof `jti`, a distinct Operations event ID. Examples are not graded.
- **Guides.** Personal agents sign with ES256 and companies accept ES256 and RS256 in assertions; the redirect advice now cites the section 3 MUST (T1-14 already grades it for 0.2 files); credentials are discarded when a sign-in ends; `iss` in Direct Sign-In redirects and the token endpoint replay rule cite the spec; without a browser session endpoint, agents browse as signed-out visitors. All agent-side or already graded.

`PAP_SPEC_SNAPSHOT` stays `2026-10-19` because the graded rules did not move; only the three digests advanced.

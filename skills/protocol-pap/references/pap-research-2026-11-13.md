# Personal Agent Protocol (PAP, "Poppy") - Draft 1.0 fixes, 2026-11-13

Re-read of Draft 1.0 (in progress) after eight commits landed on the spec repository's `main` on 2026-11-13, from `ad20217` (Ora's 2026-11-12 read) to `bb98332`. Sources: `git diff ad20217 bb98332 -- content/versions/1.0 content/shared/changelog.mdx` in personal-agent-protocol/personal-agent-protocol, and the live `/docs/1.0/spec`, `/docs/1.0/guides` and `/docs/1.0/extensions/ucp` pages. 1.0 is still unpublished (`versions.json` has no `published` for it, blob unchanged at `ff7c9a3`); 0.4 is still the latest published version.

## 1. Pins moved

- `PAP_SPEC_SOURCE_TREE_SHA`: `720a0fe` to `0800017f4ba402b8f5616b20eacf32ae8b103f0a`.
- `PAP_WORKING_DRAFT_SPEC_SHA256` and `PAP_WORKING_DRAFT_GUIDES_SHA256` moved (the spec and the guides changed). The operations, extensions list, Browser Control and Mediated Sign-In digests did not.
- `PAP_SPEC_SNAPSHOT`: `2026-11-12` to `2026-11-13`, because two graded rules moved, so `PAP_PROFILE` is `pap-1.0@2026-11-13`.
- Heading anchors on the 1.0 spec, guides and UCP pages are unchanged, so `__fixtures__/spec-anchors.json` needs nothing.

## 2. The eight fixes, and what Ora does with each

The changelog marks six as breaking. Each is a 1.0 rule; a 0.4 file keeps the 0.4 text.

| Fix | Spec | Ora |
|---|---|---|
| Conversation protocol descriptions (breaking): every `agent.protocols` entry MUST have a `description` of what the agent there can help with; it MAY say anything | 3.1 table, 8.1, UCP 5 | **Graded.** T0-15 fails a 1.0 entry with no non-empty string `description` (`fromDraft10`). Recommendations and methodology say so. |
| PS384 required (breaking): Companies MUST accept client assertions and delegations signed with `ES256` and with `PS384` (was: SHOULD accept PS384) | 4.1, 5.2, 10.7 | **Graded.** T0-22 fails a given `token_endpoint_auth_signing_alg_values_supported` that omits PS384 for a 1.0 file. T0-34 keeps its RFC 8414 warning (P2) but, for 1.0, drops the "a blind PS384 signer cannot tell" reason, which no longer holds. Delegations are verified only with a session, so not graded. |
| Pushed Authorization Requests (breaking): a Company MAY require PAR with `require_pushed_authorization_requests`; the agent MUST then push, and SHOULD whenever `pushed_authorization_request_endpoint` is listed | 3.2, 4.2, 4.8 | Not graded. Requiring PAR is optional for a Company, and the agent obligations are agent-side. A future passive row could check that `require_pushed_authorization_requests: true` comes with an HTTPS `pushed_authorization_request_endpoint` (RFC 9126 section 5); not added, since no live issuer sets it yet. |
| Consent for scopes granted before (breaking): the consent page MUST list every scope it will grant (except a `poppy:browser-sign-in` it MAY grant without asking); a Direct Sign-In request MUST carry `prompt=consent` unless the redirect returns only to the opening device; Companies SHOULD honour it and SHOULD show the page for every Device Sign-In | 4.2, 4.3, 10.8, 11 | Not graded: observing a consent page needs a sign-in. The planned T3 rows (written for 0.2) would be the place. |
| Same DPoP key at refresh (breaking): an agent that got a refresh token with a DPoP proof MUST refresh with the same key; a Company MAY bind refresh tokens to it and then answers `invalid_grant` to another key | 4.4, 4.5, 4.8, 10.7 | Not graded: needs a real refresh token. |
| UCP scope requests name every scope (breaking): for `insufficient_scope` the agent signs in for every scope it still needs; the Company grants only what the request names | UCP 4, UCP 11 | Not graded (account flow). |
| Ports in `organization.domain` (minor): the domain carries its port when not 443, as does the `protected_resources` entry; agents use another port only when configured to | 3.1, 3.2 | **Graded for 1.0 files.** A redirect can end on another port, so T0-05 and the issuer gate (`resolvePapCompanyIssuer`) compare `organization.domain` with `URL.host` (`servedDomain`), which drops a default :443; `boundDomains` still skips another domain's `protected_resources` entry that carries a port (X-04 and T0-23 fetch other domains on 443 only), a coverage gap rather than a false finding; the second protocol review found that keeping it made X-04 call it "not a domain name". 0.1 to 0.4 compare hostnames as before. The `supported_versions` same-host rule (T0-08, T0-27) keeps comparing hostnames: spec 3.4 says "host" without a port clause, and a hostname match is lenient, never a false fail. T0-11's 1.0 near-miss wording says the entry carries a port only when organization.domain does. Found by the protocol review of 6a32b1a, matching the kit's port 4443 test. |
| Agents choose their Companies; clearing `context` with `null`; room to extend conversations (unknown `role`, `author.type`, SSE events and error codes); scope description advice | 4.1, 4.7, 8.4, 8.6, 8.13, guides | Not graded. Scope descriptions stay plain language with no new field, so T0-26 (a description exists) is unchanged. |

## 3. Emitted copy

- `pap-interfaces` recommendation and methodology: a conversation entry needs a `description` (from 1.0).
- `pap-issuer-binding` recommendation and methodology: accept ES256 and PS384, and list both.
- `papCatalog()` pass conditions for T0-11, T0-15, T0-22 and T0-34 name the 1.0 rule.
- The agent files generator drafts no `agent` block, so nothing there changed.

## 4. Tests

`src/lib/pap/__fixtures__/spec-v10-example-poppy.json` is the 1.0 spec's own example `poppy.json` (spec 3), verbatim at `bb98332`: it differs from the 0.4 example only by `protocol_version`, the conversation entry's `description` and longer scope descriptions. `draft-03-04.spec.ts` ("Draft 1.0 fixes of 2026-11-13") holds T0-15, T0-22, T0-34 and T0-11 for 1.0 against it, and the 0.4 grading next to it.

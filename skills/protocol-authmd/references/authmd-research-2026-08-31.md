# auth.md (WorkOS agentic registration) - research snapshot 2026-08-31

Source of truth: https://github.com/workos/auth.md - the `AUTH.md` file on `main` plus `CHANGELOG.md`. Snapshot taken 2026-08-31 at spec version **v0.6.0** (changelog-dated 2026-06-10); the newest repo commit is `b53c9ed` (2026-07-23, "Revoke registration and delegation on provider SET"), which touched only the reference implementation under `agent-services/`, not the normative `AUTH.md`. The repo is a rolling single-file spec with a semver changelog; there is no ratified 1.0 and no dated revision directories, so drift is measured in repo commits, not version tags or `AUTH.md` edits alone (b53c9ed changed reference revocation behaviour with no version bump and no AUTH.md edit - narrower pinning would have missed it).

The WorkOS-hosted docs pages (workos.com/auth-md/...) render the same material but can lag the repo; when they disagree, the repo wins.

## 1. What auth.md is

A markdown file a service publishes (conventionally at `/auth.md`, back-pointed by discovery metadata) that walks an agent through **agentic registration**: discover, register, claim if needed, exchange for an access_token, call the API, handle revocation. It is written TO the agent ("You are an agent. ... Follow the steps in order; do not skip ahead"). The protocol underneath is an OAuth profile: RFC 9728 protected-resource metadata, RFC 8414 AS metadata extended with an `agent_auth` block, RFC 7523 JWT-bearer exchange, RFC 7009 revocation, RFC 8628-shaped claim ceremony, RFC 8417/8935 Security Event Tokens.

## 2. Discovery (Step 1)

Two hops:

1. **PRM** at `/.well-known/oauth-protected-resource` on the resource server (also advertised in the 401 `WWW-Authenticate: Bearer resource_metadata="..."` header). Fields: `resource` (canonical API URL, used as ID-JAG `aud`), `resource_name` / `resource_logo_uri` (surfaced to the user at the consent gate), `authorization_servers`, `scopes_supported`, `bearer_methods_supported`.
2. **AS metadata** at `<authorization_servers[0]>/.well-known/oauth-authorization-server`. Standard RFC 8414 top level (`issuer`, `token_endpoint`, `revocation_endpoint`, `grant_types_supported`) plus the profile block:

```json
"agent_auth": {
  "skill": "https://service.example.com/auth.md",
  "identity_endpoint": "https://auth.service.example.com/agent/identity",
  "claim_endpoint": "https://auth.service.example.com/agent/identity/claim",
  "events_endpoint": "https://auth.service.example.com/agent/event/notify",
  "identity_types_supported": ["anonymous", "identity_assertion", "service_auth"],
  "identity_assertion": {
    "assertion_types_supported": ["urn:ietf:params:oauth:token-type:id-jag"]
  },
  "events_supported": [
    "https://schemas.workos.com/events/agent/auth/identity/assertion/revoked"
  ]
}
```

- `skill` is a back-pointer to the published auth.md (round-trip checkable).
- `grant_types_supported` lists `urn:ietf:params:oauth:grant-type:jwt-bearer` (assertion exchange) and `urn:workos:agent-auth:grant-type:claim` (ceremony polling). The claim grant is a profile URN so it cannot collide with standard RFC 8628 device authorization at the same token endpoint.
- `identity_types_supported` is authoritative only for `identity_assertion` (agents must cross-check `assertion_types_supported` and stop if theirs is missing); for `service_auth` and `anonymous` it is informational - agents send the body and act on the `*_not_enabled` error if the service opted out (v0.6.0 decision).

## 3. Registration types (Steps 2-3)

Decision tree: session exchangeable for an ID-JAG audience-bound to this service -> `identity_assertion`; only the user's email -> `service_auth` (claim ceremony required); neither -> `anonymous` (claim ceremony optional, deferred until the user wants ownership).

Consent gate: before sending an `identity_assertion` or `service_auth` body, the agent surfaces `resource_name` / `resource_logo_uri` and the scope set to the user and confirms. Skipped for `anonymous` (no user identity asserted).

All three POST to `agent_auth.identity_endpoint` (`/agent/identity` in the reference implementation):

- **identity_assertion**: `{ "type": "identity_assertion", "assertion_type": "urn:ietf:params:oauth:token-type:id-jag", "assertion": "<ID-JAG JWT>" }`. ID-JAG mint requirements: `aud` = PRM `resource`; `iss` = provider issuer on the service's trust list (publishing format is service-specific); `email_verified: true` or `phone_number_verified: true`; fresh `jti`; near-term `exp` (~5 min); **required fresh `auth_time`** (services enforce a max-age window). Success: `{ registration_id, registration_type, identity_assertion: "<service-signed JWT>", assertion_expires, scopes }`. Two 401 step-ups:
  - `interaction_required`: the ID-JAG matched an existing account by verified email/phone but no `(iss, sub)` delegation exists. Body carries `claim_url`, `claim_token`, `post_claim_scopes`, and an RFC 8628-shaped `claim` block; the user confirms the link at the service. After confirmation, subsequent ID-JAGs for the same `(iss, sub, aud)` are accepted directly.
  - `login_required`: `auth_time` missing or older than the service's `max_age` (echoed in `WWW-Authenticate`). Only re-authentication at the agent's own provider helps (e.g. `prompt=login`); nothing at the service does.
- **service_auth** (v0.6.0, replaces the `verified_email` assertion type): `{ "type": "service_auth", "login_hint": "user@example.com" }`. `login_hint` follows OIDC CIBA: an untyped string the service sniffs (today an email; room for phone numbers later). Response bundles the claim ceremony: `{ registration_id, registration_type: "service_auth", claim_url, claim_token, claim_token_expires, post_claim_scopes, claim: { user_code, expires_in, verification_uri, interval } }`. No `identity_assertion` until the ceremony completes.
- **anonymous**: `{ "type": "anonymous" }`. Response carries an immediate `identity_assertion` limited to `pre_claim_scopes`, plus `claim_url` / `claim_token` / `post_claim_scopes` for an optional later ceremony.

`claim_token` is returned exactly once; the agent holds it in memory for the ceremony and does not persist it.

## 4. Claim ceremony (Step 4)

Shape borrowed from RFC 8628 device authorization (`user_code`, `verification_uri`, `expires_in`, `interval`) without overloading the IANA `device_code` grant. The code travels agent -> user; the user signs in at the service (reusing the service's own session/SSO/MFA) and types the code on a service-owned `/claim` page. `verification_uri` embeds a `claim_attempt_token` so the URL identifies the registration without leaking the `user_code`.

- `service_auth` registrations already carry the `claim` block; `anonymous` registrations start a ceremony with `POST <claim_endpoint>` `{ "claim_token": "clm_...", "email": "user@example.com" }` and get a `claim_attempt` block of the same shape. The `email` binds the registration to one signed-in account so an intercepted `user_code` cannot be claimed by a third party.
- Polling happens at the standard `token_endpoint` with `grant_type=urn:workos:agent-auth:grant-type:claim&claim_token=...`. RFC 8628 vocabulary while waiting: `authorization_pending`, `slow_down` (add >= 5s to `interval`), `expired_token` (the `user_code` window closed; re-call the claim endpoint with the same `claim_token` + `email` for a fresh code, and restart at registration if that returns `claim_expired` - the outer window, typically 24h, is separate from the ~10 min code window).
- Success: a standard OAuth token response extended with `identity_assertion` + `assertion_expires` as the refresh path. For `anonymous`, completion **revokes** pre-claim access_tokens and supersedes the v1 assertion with a v2 carrying the user's email claims.
- `/claim` page advisories (v0.6.0): `first_time_provider`, `first_time_account` - rendered to the user above the code form, never sent to the agent.

## 5. Exchange and use (Steps 5-6)

- Exchange: `POST token_endpoint` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<identity_assertion>` and optionally (recommended) `resource=<PRM resource>`. Standard token response; the same assertion re-mints access_tokens until it expires.
- Use: `Authorization: Bearer <access_token>`. **There is no refresh_token in this profile** - re-exchange the assertion on expiry; on `invalid_grant` re-register; on a 401 for a previously working token, retry the exchange once, then restart at discovery.

## 6. Errors

Profile codes at the identity/claim endpoints (no OAuth analog): `anonymous_not_enabled`, `service_auth_not_enabled`, `issuer_not_enabled`, `invalid_request`, `invalid_login_hint` (v0.6.0), `interaction_required` (401), `login_required` (401), `invalid_claim_token`, `claimed_or_in_flight`, `claim_expired` (410 on re-initiate when the registration is gone). OAuth vocabulary at the token endpoint per RFC 6749 / 7523: `invalid_grant`, `invalid_client`, `unsupported_grant_type`, `authorization_pending`, `expired_token`, `slow_down`. Plus `rate_limited` (429) anywhere. `user_code` typos surface on the claim page, never to the agent. Retry policy: 5xx backoff-and-retry; 4xx act on the table; 401 on a working token means one re-exchange then restart discovery.

## 7. Revocation

Two independent layers:

- **Credential layer** (agent-callable): RFC 7009 at the top-level `revocation_endpoint` - `token=<access_token>&token_type_hint=access_token`, idempotent 200. The assertion survives; re-exchange for a fresh token.
- **Registration layer** (provider-driven): the provider that minted the ID-JAG POSTs an RFC 8417 SET (`Content-Type: application/secevent+jwt`, delivered per RFC 8935 push) to `agent_auth.events_endpoint`. The normative text: the service invalidates the identity assertion and every access_token derived from it; the agent discovers this as `invalid_grant` on the next exchange and restarts at registration. The reference implementation goes further since `b53c9ed` (2026-07-23) and drops the **registration and the `(iss, sub)` delegation** too, so re-registering re-triggers the confirmation ceremony - reference behaviour, unobservable from outside, never a scoreable property. Receiver behavior per RFC 8935: 202 on success, 400 with `{ "err": ... }` codes (`invalid_request`, `invalid_key`, `invalid_issuer`, `invalid_audience`, `authentication_failed`); unknown event schemas in an envelope are ignored per RFC 8417.

## 8. Era map (observer signatures by draft vintage)

Sites in the wild published auth.md files against every draft; detection code may recognize all eras, teaching code uses only the current one.

| Form | Era | Fate |
|---|---|---|
| `register_uri`, `claim_uri` in `agent_auth` | v0.1 (2026-05-21) | Renamed `identity_endpoint` / `claim_endpoint` at v0.2.0 (2026-06-03) |
| `/agent/auth` endpoint family, `requested_credential_type`, credentials issued directly at registration, `api_key` / `credential_types_supported` | v0.1 | Removed at v0.2.0; credential surface became `/oauth2/token` JWT-bearer exchange, `access_token` only |
| `revocation_uri` in `agent_auth`, `logout+jwt` (OIDC Back-Channel Logout shape), `/agent/auth/revoke` | v0.1-v0.2 | Replaced at v0.3.0 (2026-06-03) by `events_endpoint` + RFC 8417 SET (`secevent+jwt`), `events_supported` added |
| Email-OTP claim flow (service emails the user), `otp_invalid` / `otp_expired` / `previously_claimed` error codes, `/agent/identity/claim/view` polling, `/claim/attempt/challenge` | v0.1-v0.3 | Inverted at v0.4.0 (2026-06-04): RFC 8628-shaped ceremony, polling at `token_endpoint` with the claim grant, `claimed_or_in_flight` replaces `previously_claimed` |
| No `auth_time` requirement, silent ID-JAG account linking | v0.1-v0.4 | v0.5.0 (2026-06-05) added required fresh `auth_time` (`login_required`) and the `(iss, sub)` confirmation ceremony (`interaction_required`) |
| `"assertion_type": "verified_email"`, `registration_type: "email-verification"`, `verified_email_not_enabled` | v0.1-v0.5 | Split out at v0.6.0 (2026-06-10) as the top-level `service_auth` type with CIBA `login_hint`; `service_auth_not_enabled`, `invalid_login_hint` added |
| Provider SET revokes the assertion + derived tokens (normative, unchanged) | v0.3+ | Reference implementation additionally drops the registration and delegation since `b53c9ed` (2026-07-23); normative text unchanged |

## 9. Watch list (unstable areas)

- The spec is a v0.x rolling draft; every surface can still move. Semver bumps are not the only signal (b53c9ed).
- Trust-list publishing for ID-JAG providers is explicitly service-specific ("check the AS metadata or service docs") - no standard discovery yet; do not hard-rule a location.
- `identity_types_supported` semantics differ by type (authoritative for `identity_assertion`, informational for the other two) - scoring should not fail a service for omitting informational entries.
- `login_hint` is deliberately untyped (email today, phone later) - do not encode email-only validation as spec law.
- `events_supported` currently lists a single WorkOS-namespaced schema URI; the SET vocabulary will likely grow.
- Wild adoption is small and era-mixed (workos.com, here.now, resend.com are the motivating corpus examples in our checks); expect old-era files for a long time.
- The conventional path is root `/auth.md`; the spec does not define a `/.well-known/auth.md`. The normative pointer is `agent_auth.skill`.
- Unmerged v0.7.0 branches (seen live on 2026-11-09, none on `main`), in two incompatible forms. Watch only; no rule changes until one merges, and the drift watch alerts when it does:
  - `madison/reconcile` (02a1591, 2026-08-31, merges `main`) and `devin/1788219364-agent-client` (34e100a, 2026-09-01) carry "v0.7.0 (2026-06-26)", which **reverses the claim ceremony** "to match the shipped service": the `user_code` travels service -> user -> agent (revealed on the service's claim page, read back to the agent), a direct `POST /agent/identity/claim/complete` replaces the `urn:workos:agent-auth:grant-type:claim` polling grant and its `authorization_pending` / `slow_down` / `expired_token` vocabulary, a `refresh` registration type is added, responses move to a nested envelope (`identity.{assertion,expires_at}`, `claim.{token,expires_at,url}`, `scopes.{pre_claim,post_claim}`), and error codes are renamed (`service_auth_not_enabled` -> `service_auth_registration_disabled`, `rate_limited` -> `rate_limit_exceeded`, among others). If this merges, SKILL.md hard rule 5 and section 4 above invert, along with the rubrics built on them.
  - `madison/claim-via-id-jag` (81b6112, 2026-06-12) carries a different "v0.7.0": `POST /agent/identity/claim` becomes a discriminated union on `type`, adding an `identity_assertion` (ID-JAG) claim body next to the `login_hint` one, and keeps the RFC 8628 polling ceremony.

## 10. Sources

- https://github.com/workos/auth.md/blob/main/AUTH.md (read in full at b53c9ed)
- https://github.com/workos/auth.md/blob/main/CHANGELOG.md (v0.1.0 through v0.6.0)
- Commit history of workos/auth.md through 2026-07-23
- RFCs referenced normatively by the spec: 6749, 7009, 7523, 8414, 8417, 8628 (shape only), 8935, 9728

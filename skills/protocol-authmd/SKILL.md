---
name: protocol-authmd
description: Use when writing, reviewing, or scoring anything that publishes, probes, teaches, or grades an auth.md file (the WorkOS agentic registration standard) - a service's own auth.md, checks that read auth.md files or the agent_auth block in OAuth metadata, prompts or rubrics that judge an auth.md walkthrough, or recommendations and docs that tell site owners how to ship one. Also use when code or a diff mentions auth.md, agent_auth, identity_endpoint, claim_endpoint, events_endpoint, identity_assertion, ID-JAG, service_auth, anonymous registration, login_hint, claim ceremony, user_code, jwt-bearer, register_uri, verified_email, or oauth-protected-resource, so generated code follows the pinned v0.6.0 spec instead of the pre-June-2026 drafts.
---

# auth.md protocol adherence

Code that publishes, probes, teaches, or scores auth.md files (the WorkOS agentic registration standard) must encode the spec correctly in distinct postures:

| Posture | What it is | Rule |
|---|---|---|
| **Observer** | Code that detects what sites in the wild ship, including legacy draft eras (checks, OAuth metadata mining, placeholder detection, deep-check prompts and rubrics) | MAY reference legacy-era forms (`register_uri`, `verified_email`, OTP error codes) as detection signatures and finding text, per the era map in `references/`. Never as recommended usage, and rubrics define "current" by v0.6.0. |
| **First-party author** | A service's own published auth.md | Spec-current always. A file that honestly declares non-support must name as absent the fields the current spec actually defines. |
| **Emitter** | Code you hand to the public as guidance (recommendations, generated auth artifacts, playbooks, docs) | MUST be spec-current: never teach `verified_email`, the `*_uri` endpoint names, OTP flows, `api_key` credential types, or `logout+jwt` revocation. |
| **Era-labelled documentation** | Emitted copy that DESCRIBES observers' era-aware behaviour (methodology entries, check maps, generated playbooks) | May name a removed form ONLY immediately next to an era label (legacy / pre-v0.x / pre-rename) and only as what detection accepts - never as a target state. |

Which files sit in which posture is repo-specific: see "Repo overlay" below.

**Spec identity.** auth.md, version **v0.6.0** (changelog-dated 2026-06-10) plus post-release commits through `b53c9ed` (2026-07-23), at https://github.com/workos/auth.md - `AUTH.md` on `main` is the source of truth and `CHANGELOG.md` is normative history; the workos.com/auth-md docs pages can lag the repo. The reviewed pin (version, read date, and sources with the full commit SHA of the "through `b53c9ed`" read) lives in `specs/authmd/spec.yaml` of ora/specs and is read through `@ora-ai/specs` (`spec("authmd").reviewed`), never restated in code constants. The spec is a rolling v0.x draft with breaking renames between minors, so the era map in `references/authmd-research-2026-08-31.md` section 8 is the vocabulary-to-era decoder for observer code. When asserting anything beyond the pin, re-read the spec first and move the pin and this skill together.

## Hard rules (the v0.6.0 contract - enforce, don't debate)

1. **Discovery is RFC 9728 PRM + RFC 8414 AS metadata carrying the `agent_auth` block.** The conventional file path is root `/auth.md`; the normative pointer is `agent_auth.skill`, which must round-trip to the published file. There is no `/.well-known/auth.md` in the spec.
2. **The `agent_auth` endpoint names are `identity_endpoint`, `claim_endpoint`, `events_endpoint`.** `register_uri` / `claim_uri` (renamed v0.2.0) and `revocation_uri` (renamed v0.3.0) are legacy-era detection signatures only.
3. **Registration types are `anonymous`, `identity_assertion`, `service_auth`.** `verified_email` was removed at v0.6.0 - the email path is the top-level `service_auth` type with a CIBA-style untyped `login_hint`. The only current assertion type is `urn:ietf:params:oauth:token-type:id-jag`. `identity_types_supported` is authoritative for `identity_assertion` (cross-check `assertion_types_supported`, stop if absent) and informational for the other two (opt-out is signaled by `*_not_enabled` errors).
4. **ID-JAGs require fresh `auth_time`** (plus `aud` = PRM `resource`, trusted `iss`, verified email or phone, fresh `jti`, ~5 min `exp`). The two 401 step-ups are distinct: `interaction_required` (user confirms the `(iss, sub)` link at the service, via a claim ceremony) and `login_required` (only re-authentication at the agent's own provider helps).
5. **The claim ceremony is RFC 8628-shaped and polled at the standard `token_endpoint`** with `grant_type=urn:workos:agent-auth:grant-type:claim`. Ceremony fields: `user_code`, `verification_uri`, `expires_in`, `interval`; the code travels agent to user; waiting vocabulary is `authorization_pending` / `slow_down` / `expired_token`. There is no service-sent OTP email, no `/claim/view` polling endpoint, and no `otp_*` error codes - all pre-v0.4 forms.
6. **Credentials are a two-step exchange, `access_token` only.** Registration mints a service-signed `identity_assertion`; the agent exchanges it at `token_endpoint` via RFC 7523 JWT-bearer (`resource` parameter recommended). No refresh_token exists in the profile, no `api_key` credential type, no `requested_credential_type` / `credential_types_supported` (both gone at v0.2.0).
7. **Errors split by surface.** Profile codes at the identity/claim endpoints (`*_not_enabled` family, `invalid_login_hint`, `interaction_required`, `login_required`, `invalid_claim_token`, `claimed_or_in_flight`, `claim_expired`); OAuth vocabulary at the token endpoint (`invalid_grant`, `invalid_client`, `unsupported_grant_type`, plus the RFC 8628 trio). `invalid_signature` / `replay_detected` / `audience_mismatch` / `credential_expired` / `otp_invalid` / `otp_expired` / `previously_claimed` as a "canonical set" is pre-v0.4 vocabulary.
8. **Revocation has two layers.** Agent-callable RFC 7009 at the top-level `revocation_endpoint` (kills one access_token; the assertion survives), and provider-driven RFC 8417 SETs (`application/secevent+jwt`, RFC 8935 push) to `agent_auth.events_endpoint`. The normative text says a SET invalidates the identity assertion and every derived access_token; the reference implementation additionally drops the registration and `(iss, sub)` delegation since b53c9ed - reference behaviour, not a scoreable spec property (it is unobservable from outside anyway). `logout+jwt` is the pre-v0.3 signature.

## Unstable areas (feature-detect, mark as era or lag, never hard-rule)

The whole spec is a rolling v0.x draft; breaking renames have landed in minor versions and one semantic change landed with no version bump at all (b53c9ed). Specifically unstable: trust-list publishing for ID-JAG providers (explicitly service-specific), `login_hint` formats beyond email, the `events_supported` schema vocabulary, and every corpus assumption - wild adoption is tiny and era-mixed, so an observer accepts legacy-era files as adherence evidence (noting the era) while emitters teach only the current forms. Full changelog and watch list: `references/authmd-research-2026-08-31.md` sections 8-9.

## Reference

`references/authmd-research-2026-08-31.md` - the full research report behind this skill: discovery shapes, the three registration flows, the claim ceremony, exchange and revocation mechanics, the error table, the era map for observer signatures, and the watch list. Load it when a question goes past the hard rules above.

## Repo overlay

Each consuming repo keeps its own posture table (which of its files are observer, first-party author, emitter, or era-labelled documentation) and its own enforcement (mechanical adherence suites, reviewers) in its own rules file, alongside any decisions it makes about what to score. On repo-specific points, the overlay wins over this skill.

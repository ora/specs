# Personal Agent Protocol (PAP, "Poppy") - Draft 0.4 published, Draft 1.0 started, 2026-11-12

What changed since the 2026-11-09 read (`pap-research-2026-11-09.md`, which graded 0.4 as a preview at spec repository commit `a2f16ec`), how Ora grades each change, and what moved in Ora. For a file that declares 0.4 or 1.0 this file wins on the points below; everything else in the 2026-11-09 report still holds.

## 1. Status and sources

- **Draft 0.4 was published 2026-11-10** (`4803900`, "Publish 0.4 as the 1.0 release candidate", #175) and is frozen at `/docs/0.4/spec`. Its intro: "It's the 1.0 release candidate: if implementers find problems, the fixes, which can include changes that aren't backward compatible, go into a draft 1.0. Otherwise this text is published as 1.0." The next day `ed47408` (#176) changed only "draft version" to "version" in its wording, so the frozen tree is `399ba1b` (`PAP_SPEC_SOURCE_TREE_SHA`), and `versions.json` is blob `ff7c9a3` (`PAP_VERSIONS_SOURCE_SHA`).
- **Draft 1.0 started 2026-11-11** (`272cab0`, #178) at `/docs/1.0/spec` and the unversioned `/docs/spec`. It is not published: `versions.json` lists it with no `published` date, and the changelog says the list "grows until 1.0 is published". Read at `ad20217` (`content/versions/1.0` tree `720a0fe`).
- **Pin moved to 0.4** on 2026-11-12, following the product owner's rule from 2026-11-09 (pin the latest published draft) and the request to update Ora for the new release. `PAP_SPEC_VERSION` `"0.4"`, `PAP_SPEC_PUBLISHED` `2026-11-10`, `PAP_SPEC_SNAPSHOT` `2026-11-12` (the graded rules moved: see section 2), `profile` `pap-0.4@2026-11-12`. Draft 1.0 is the preview (`PAP_PREVIEW_VERSIONS = ["1.0"]`).
- Live files, rechecked 2026-11-12 on the domains the 2026-11-09 survey found: cv.cm, elimfilters.com and printwithpoppy.com still declare 0.3; ifuentes.net, aeobility.com.au, www.mattpyle.com, ticketfairy.com and alpic.ai declare 0.2; salespeak.ai and lorikeetcx.ai 0.1. The first public 0.4 file is **www.cliffside-retail.com**, a community demo store (not reviewed or endorsed by the protocol's authors) that the spec site's demos page lists as following 0.4 (2026-11-11, `ad20217`). No launch partner (Walmart, Shopify, Stripe, Rocket, Genesys, NiCE, Instinct) serves a poppy.json. No file declares 1.0.

## 2. 0.4 changes after Ora's preview read (`a2f16ec..4803900`) that move a graded row

| Change (spec section) | Before | Ora row |
|---|---|---|
| `scopes_supported` may be in the issuer's metadata, the domain's protected resource metadata (RFC 9728 §2), or both, and agents read them as one list (3.2, 4.7; #174). The spec's own protected resource metadata example now carries it. | Issuer metadata only | T0-26 and T0-28 read the union from 0.4 (`offeredScopes` in `rules.ts`; the domain metadata Ora already fetches once per scan now keeps its `scopes`). A 0.3 file is still graded on the issuer's list alone, since the frozen 0.3 text names only that one. T0-28 reads not tested only when neither document has a list. The company kit's validator made the same change. |

## 3. 0.4 changes after `a2f16ec` that move no graded row

- **Where the browser-session endpoint can be** (6, #173): on any host the Company chooses, as long as the session cookie reaches the browsed pages. Ora never constrained its host; the join cookie keeps `__Host-` either way (guides), so T1-15 is unchanged.
- **Sign-ins someone else started** (4.2, 4.3, 10.8, #170): Direct Sign-In opened on another device MUST follow RFC 10027 §2. Agent and consent-page behaviour, not observable without signing in.
- **Operations: declining an approval** (Operations 6, #169): `approval_declined` (403) and `extensions.operations.declined`. Behind a Session.
- **Guides** (#168): scopes a Company doesn't grant, passkeys and the "wants to connect" heading on consent pages. Advice, behind sign-in.

## 4. Draft 1.0 so far

- Starts from the 0.4 text. Differences on 2026-11-12: the version string (`"1.0"` in examples, `Poppy-Version: 1.0`) and a paragraph in spec 10.3 plus the guides (issue #73) saying nothing in poppy.json confirms the domain belongs to the company `organization.name` names, so choosing and showing the domain is up to the agent. Nothing gradeable.
- Ora grades a `"1.0"` file by the 0.4 rules (`fromDraft04` in `rules.ts` covers 0.4 and 1.0), as a preview: every check's details start "Graded as a preview of Draft 1.0 (in progress).", and T0-04 advises listing a 0.4 document in `supported_versions` (before 1.0 a 0.4 agent does not use a 1.0 file).
- **The middle path (product owner decision, 2026-11-12).** The spec site tells builders to use the 1.0 draft, and before 1.0 a 1.0 agent uses no 0.4 file either. Ora keeps the published 0.4 pin, and T0-04 advises a 0.4 file to also list a 1.0 document in `supported_versions`, so one site reaches both kinds of agent; T0-27 already grades that document.
- Spec 3.4: from 1.0, versions with the same major are compatible, so a 1.0 agent uses a `1.1` file. Ora grades a later 1.x minor by the 1.0 rules and passes T0-04 with a note; a later major reads not tested (`out_of_scope`) with the rest graded as a 1.0 preview.
- T1-03 (spec 3.2, 7): a conversation entry with `access: signed_in` needs account access first, and the spec sets no order between that 401 and the Session check, so a 401 there reads not tested; Ora probes an entry without `signed_in` first. Found in a second external review on 2026-11-12.
- When a 1.0 change moves a graded rule, that rule gets its own 1.0 branch. The working draft digests (`PAP_WORKING_DRAFT_*_SHA256`) now hash the 1.0 pages and are how such a change is noticed.

## 4b. The pin moves to 1.0 (product owner decision, later on 2026-11-12)

- After the 0.4 pin merged in the original consuming repo, an external review argued that Ora should teach 1.0, and the product owner agreed. The authors' Path to 1.0 page says "Build against the 1.0 draft, the latest version"; 1.0 takes only fixes; the official company kit validates only `"1.0"`; and a site Ora steered to `"0.4"` would need rewriting when 1.0 is published, since before 1.0 the two are incompatible (spec 3.4).
- Constants: `PAP_SPEC_VERSION` `"1.0"`, `PAP_SPEC_PUBLISHED` null, `PAP_LATEST_PUBLISHED` `"0.4"` (2026-11-10), `PAP_SPEC_SOURCE_TREE_SHA` the `content/versions/1.0` tree `720a0fe`, `profile` `pap-1.0@2026-11-12`, catalog `spec_version` `"1.0"` with `draft: true`. `PAP_PREVIEW_VERSIONS` is empty.
- Grading did not change: `fromDraft04` grades 0.4 and 1.0 files alike. T0-04's advisory now makes 1.0 primary with 0.4 linked: a 1.0 file lists a 0.4 document, a 0.4 file moves to 1.0 or lists a 1.0 document, and an older file moves to 1.0.
- Emitted copy names 1.0 as in progress and 0.4 as the latest published version. The drafted poppy.json declares `"1.0"`, and its notes say how to add a 0.4 copy in `supported_versions`.
- Protocol review on `main` (2026-11-12) corrected T0-34's reasoning (see section 7), limited later 1.x minors to canonical `major.minor`, and made T1-03's `signed_in` exemption match the probed entry exactly.

## 5. What moved in Ora

- Pins and preview: `src/lib/pap/constants.ts`; `fromDraft04` and the version helpers, T0-26 and T0-28 in `rules.ts`; the domain metadata's `scopes` in `discovery.ts` / `types.ts`; anchor maps and catalog text in `catalog.ts` (T0-27 and T0-28 now cite the pinned pages with no draft label; rows say "from 0.4" where they said "in 0.4"); heading ids for 0.4 and 1.0 in `__fixtures__/spec-anchors.json`; the published 0.4 protected resource metadata example in `__fixtures__/spec-v04-example-prm.json`.
- Emitters teach 0.4: the `pap-*` recommendations (protocol_version `"0.4"`, the extension list form, operations version 3, `tasks.endpoint`, `poppy:browser-sign-in` in either metadata), methodology and evidence lines, the drafted poppy.json (unchanged shape, now `"0.4"`, still valid as-is) and its notes, the playbook (`npm run skills:gen`), `openapi.json`, `agents.md`, `llms-full.txt`, `docs/api.md`, `docs/pap.md`, `docs/checks-map.html`.
- `spec-adherence.spec.ts` also bans, in emitted text, the poppy.json fields 0.4 replaced with `tasks.endpoint` (`excluded_tasks`, `skill_index`) unless an older draft is named nearby; `feedback.endpoint` is allowed, since 0.4 keeps it inside the tasks response (spec 9.3).
- The spec drift manifest pins `content/versions/0.4`; ax.guide (`content/standards/poppy.md` in ora/standards) moved its matching pins.

## 6. Requirements Ora does not check yet (additions to the 2026-11-09 list)

- RFC 10027 §2 for cross-device Direct Sign-In, the consent page heading and "only continue if you asked" text: behind sign-in.
- `approval_declined` responses and their schema: behind a Session.
- Whether the browser-session endpoint's session cookie reaches the browsed hosts when the endpoint is on another host: needs a successful join (Tier 2a).

## 7. Observed on the first 0.4 deployment

www.cliffside-retail.com (community demo listed on the spec site), 2026-11-12, branch build: `pap-discovery`, `pap-auth-config` and `pap-interfaces` pass; `pap-issuer-binding` fails T0-22 because the issuer metadata lists `private_key_jwt` in `token_endpoint_auth_methods_supported` without `token_endpoint_auth_signing_alg_values_supported`, which RFC 8414 §2 says MUST then be present. The product owner moved that case to its own P2 row the same day (T0-34, a warning): the 0.4 text cites RFC 8414 §2 for the field but never restates the rule, the company kit does not check it, and an agent can still sign with ES256, which every Company must accept (4.1). Protocol review corrected the first reasoning, which said the gap breaks no agent: an agent that signs blindly signs client assertions with PS384 (4.1, 10.7), which Companies only SHOULD accept, and without the list it cannot tell whether PS384 is accepted. A list without ES256 or with `none` still fails T0-22. Tier 1 probes were not sent.

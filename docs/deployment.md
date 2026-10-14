# Production deployment

Public website: **https://fun-liga.vercel.app**

- Hosting: Vercel project `fun-liga`, Node.js 24, production deployment.
- Database/Auth: existing Supabase project `jszmhqxejzrlvwacoyol`, restored to ACTIVE_HEALTHY.
- Competition schema and RLS applied transactionally from `001_competitions.sql`. The checksum is recorded in `public.fun_liga_schema_migrations`.
- Existing tables belonging to another application were preserved. Its default Auth Site URL and existing redirect allowlist entries were preserved; Fun Liga redirects were added.
- Production mode has `DEMO_MODE=false`. Supabase values are stored as encrypted Vercel environment settings, not in the repository.
- Deployment used the Vercel REST API because the cloud proxy's secret placeholders are incompatible with CLI token format validation.

## Validation completed

Production HTTPS/API checks verified:

- Public homepage and discovery, with demo mode disabled.
- Actual Supabase password login using temporary verified test accounts.
- Fourfeo creation with 12 fixtures, explicit publication, live score and final result.
- Idempotent finalization and correction with audit history.
- Official standings calculated from production snapshots: 2–1 gives winner 3 points; correction to 1–1 gives each team 1 point.
- Private isolation, scoped operator permissions, one-use invitations, immediate revocation, and stale-update HTTP 409.
- Sanitized public responses and permitted realtime event signals; anonymous direct aggregate reads denied.
- Archive behavior.
- Owner-only permanent deletion of draft, published, and archived competitions, exact-name confirmation, stale-version rejection, and cascading removal of memberships, invitations, and realtime events. Deleted URLs return 404 and deleted invitations cannot be accepted. An independent competition remains intact. Verified using temporary production accounts and competitions; only those test resources were removed afterward.
- Goal records with automatic scores, scorer/assist identities reused across casing and whitespace, own-goal attribution to opponents, goal edits/deletion, score-operator permissions, stale retry rejection, and confirmed/audited final corrections. Production reloads preserve goal records. Legacy goals can receive player attribution without increasing the existing score. All production checks used temporary private competitions/accounts, which were removed afterward.

Goal records and the per-competition player registry are additive fields in the existing JSONB aggregate; existing scores are preserved. The Top skor & assist view derives statistics from final matches only, excluding own goals and penalty shootouts. Current local validation passed 73 unit/database tests and seven browser flows (including mobile goal entry, account administration, input sizing, drawing preview/cancel/apply, autocomplete, and spectator views), type checking, lint, and the production build. Regression flows and the final drawing flow were validated across focused runs.

## Compact schedule and drawing

Optimalkan jeda is removed from the UI. Match rows use a compact two-line mobile layout (96px minimum; long names can wrap). A single instruction appears above the list; keyboard Enter/Space and tapping the row open the goal panel/details. Reorder buttons and drag/drop appear only in Atur urutan mode.

Acak jadwal uses Web Crypto with Fisher–Yates drawing of complete matchweek blocks and their fixtures within each league/group season half. Default mirrored drawing aligns return-half pairings with first-half order, reversing home/away. Independent drawing is available and persisted in `rules.mirrorMeetings`. Knockout rounds and advancement roles retain their original slots. Preview/Acak ulang do not persist changes. Applying checks IDs, permissions, version, group/half slots, intact matchweeks, season-half chronology, mirror policy, and played anchors. Time slots and fixture identities are preserved and the change is audited. A half containing live/final/cancelled fixtures is conservatively kept fixed; an incompatible mirrored preview is blocked.

Authenticated production checks verified drawing persistence, unchanged fixture identities and team pairings, preserved clock slots, a locked LIVE score, rejection of cross-group proposals, stale writes and operator attempts, and the order audit. Only temporary test competitions/accounts were created and removed. Deployed CSS was fetched over verified HTTPS and confirmed to contain the compact card and drawing-preview styles.

## Accounts, mobile forms, and group schedules

Fun Liga public signup is removed. Only the verified main administrator `sanjifile@gmail.com` can use `/api/admin/accounts` or Akun saya → Kelola akun. Other accounts must have the server-managed `app_metadata.fun_liga_access=true` flag and a verified email; editable user metadata cannot grant access. Existing competition members/owners were granted this flag before rollout. The shared Supabase project's global signup, verification policies, other application settings, existing passwords, and unrelated data were preserved. New administrator-provisioned accounts receive a chosen initial password without sending mail; activating an existing account preserves its password and verification status.

Production checks verified real account creation/listing using the server provisioning implementation, preservation of an existing password on repeated provisioning, approved-account login, denial of account management to ordinary users, and rejection of forged access flags in user metadata. Temporary test accounts and the test competition were removed.

Group fixtures alternate A/B/C/D per match, skipping exhausted groups. Seimbangkan giliran grup reorders unplayed group fixtures while keeping played matches and knockout fixtures anchored, preserving fixture IDs/results and time slots, and recording an audit entry. Actual production creation and balancing of a temporary old-style grouped schedule were verified. No existing active group competition needed migration during this rollout.

Mobile and touch-device form controls use at least 16px text to prevent iOS input-focus zoom; browser pinch zoom stays available. Mobile forms, match cards, headers, buttons, and dialogs were checked through local browser automation. The deployed CSS was fetched over verified HTTPS and checked for the updated control sizes and card grid. Actual iOS Safari focus behavior has not been automated in this environment.

All temporary users, competition data, invitations and event rows used for testing were removed. No sample competition was published in discovery.

The cloud browser could not complete production UI automation because its trust store lacked the environment proxy certificate. HTTPS verification remained enabled; authenticated functional checks used the system trust store. Prior local browser tests cover the UI; production UI automation itself is not claimed as passed.

## Email verification limitation

Email/password authentication is enabled and the shared Supabase project's email verification policy is preserved. Custom SMTP is **not configured**. Supabase's default email service restricts recipients and rate-limits mail; forgot-password delivery to arbitrary addresses needs a configured SMTP provider. Fun Liga does not offer public registration. Administrator-provisioned accounts and test accounts are explicitly confirmed through Auth Admin without sending mail. Email delivery itself has not been verified. Do not weaken the shared project's existing global email-verification policy to bypass this limitation.

## Future deployments

Source is in `shanjialjabir/Fun-Liga` on `main`. The initial deployment uploaded source through the Vercel API; automatic GitHub-to-Vercel deployments are not configured or claimed. Keep the existing project's encrypted settings when deploying updates, and confirm the production alias remains `fun-liga.vercel.app`. Apply future database migrations through authenticated management access, preserving existing unrelated tables and Auth settings. Never commit tokens, service-role keys or local database files.

## Season halves and drawing policy

Putaran labels use `match.meeting`: Putaran 1 includes all first meetings, and Putaran 2 includes all return meetings with reversed home/away. `match.round` is the internal original matchweek identifier, not a season half; drawing can reorder entire weeks without changing their identities or breaking round-robin coverage. Knockout fixtures use Babak/semifinal/final labels. Uneven groups finish the first half across all groups before any group enters the return half. Legacy mixed-half schedules can be normalized only when played anchors permit it.

Verified on 2026-10-14: 76 domain/database tests, eight Playwright browser flows, typecheck, lint, and production build passed. Production deployment `dpl_DakpSvjtb3MBnMwBwfNHvdsSMahA` is READY, and the `fun-liga.vercel.app` alias resolves to it. Authenticated production API checks with temporary private competitions verified an eight-team two-half league (28 fixtures per half), mirrored drawing, independent drawing with saved policy, reverse home/away, intact matchweeks, clock slots and fixture identities, LIVE-position protection, and rejection of incompatible mirrored/locked proposals. An eleven-team four-group competition verified that all first-half fixtures finish before any return-half fixture while preserving alternating group slots. Temporary accounts and competitions were removed; existing user data was preserved. No database migration or bulk modification of existing competitions was needed. Production browser TLS was not bypassed; browser flows were tested locally against the production build.

## Group and knockout drawing

New group competitions draw balanced team allocation using Web Crypto. Existing assignments are preserved until an owner/admin confirms a drawing change. Group drawing supports random allocation or manual group selection with participant/minimum-size checks and is restricted to draft, unplayed competitions. Applying regenerates the draft fixtures and resets tie ordering while retaining team identities.

Knockout drawing supports random or manually swapped bracket slots, bye placement, and an optional first-pair restriction against same-group opponents. It uses only qualified teams after all group fixtures finish and ranking ties are resolved. Winner and semifinal-loser paths are rebuilt together, including the configured third-place match. Redrawing an unplayed bracket preserves completed group fixtures and scheduled clock slots; any previously started knockout fixture locks drawing even if postponed. Slots and the same-group policy persist in `knockoutDrawing`. Both commands require owner/admin, explicit confirmation, valid IDs and the reviewed aggregate version, and record an audit event. No database migration is required.

Verified on 2026-10-14: 100 domain/database tests, nine browser flows (including mobile random/manual drawing, cancellation, persisted positions, same-group validation and played locks), lint/typecheck and production build passed. The drawing browser flow was repeated against the final build after strengthening postponed-match history checks. Deployment `dpl_AKHU77eHH7FNWYuo4hiijYxs6fTq` is READY and the `fun-liga.vercel.app` alias points to it. Authenticated production API checks verified balanced initial groups, manual reassignment, alternating fixtures, published-group protection, qualifier-only bracket slots, same-group/free policy, persisted drawing, unchanged final group fixtures, preserved clock slots, third-place links, rejection of duplicates/stale/operator requests, and continued drawing protection after LIVE becomes postponed. All temporary accounts and private test competitions were removed; existing user data was preserved. Production browser TLS verification was not bypassed; browser UI testing used the local production build.

## Account-free committee invitation links

The Panitia screen creates reusable role-scoped capability links (72-hour lifetime) rather than requiring account registration or login. Opening `/invite/:token` exchanges the token through same-origin JSON POST into an HttpOnly, SameSite=Lax cookie that is Secure on HTTPS; the URL is replaced with the invited competition route. Each request resolves the SHA-256 token hash against the current private aggregate and checks expiration and role. Virtual `link:` identities never become Supabase Auth users or FK-backed competition members. Guests cannot create other competitions or manage global accounts, and ordinary competition role restrictions still apply. Owners/admins can revoke operator links; only owners can issue or revoke admin links. Revocation removes the capability with aggregate version checks and immediately invalidates existing device cookies. Tokens/hashes are stripped from all competition snapshots; APIs use no-store and invite pages use no-referrer.

Unused legacy invitations can activate this same account-free access while retaining their original expiration/role. Legacy consumption and aggregate update use the existing transactional invite RPC, so concurrent opens cannot duplicate grants or bypass version checks. Already-consumed account invitations retain their old registered membership behavior. No Auth policy change or database migration is needed. Existing user competitions and memberships are preserved until an explicitly authorized link operation changes them. Reused devices can exit the guest session using Akses panitia → Keluar dari akses tautan; reopening a valid link restores access.

Verified on 2026-10-14: 110 domain/store/database tests, eleven browser flows across completed runs, lint/typecheck, and production build passed. The account-free invitation browser flows were repeated against the final build. Deployment `dpl_6zvRGVb1m3W6PdWpodeWG9uXg187` is READY and the production alias `fun-liga.vercel.app` points to it. Authenticated owner and anonymous HTTPS production checks verified reusable operator access in two independent cookie sessions, Secure/HttpOnly cookies, guest goal entry and labeled audit, private competition scope, refusal of global account/new competition/admin invite operations, immediate revocation of both sessions, legacy unused invitation activation as guest admin, saved settings, unchanged registered membership, no Auth users for the virtual identities, logout/reopen, and snapshot token-hash stripping. Production invite-page no-referrer and session no-store headers were also verified. All temporary accounts and private test competitions were removed; existing user data and Auth settings were preserved. Browser UI testing used the local production build; production HTTPS checks retained TLS verification.

## Live standings

League, Fourfeo and group tables now combine LIVE and final fixtures by default. Current score changes recompute points, played/won/drawn/lost, goals, goal difference, head-to-head and rank. LIVE tables and participating teams have a provisional marker; finalization changes status without counting the fixture a second time. Scheduled/postponed/cancelled and knockout fixtures are excluded. Qualification explicitly requests final-only standings and still requires completion of the entire group phase. Existing five-second snapshot polling updates spectator and guest tables automatically; registered-user realtime signals continue to trigger refreshes. No database migration or saved-score changes are required.

Verified on 2026-10-14: 113 domain/store/database tests, twelve browser flows across completed runs, lint and production build/typecheck passed. The spectator LIVE-table flow was repeated against the final build and demonstrated automatic polling through 1:0, 1:1 and 1:2, leader changes, LIVE markers, and finalization with one played match. Deployment `dpl_CQgRVaP2crXKz4Nr2goFBju65dZL` is READY and the production alias points to it. Production HTTPS goal snapshots were checked with the shared standings module: LIVE win/draw/loss points, goals and leadership updated; final-only totals stayed unchanged during LIVE; finalization preserved the same totals without duplication. Temporary accounts/competitions were removed and existing user data was preserved. Browser UI checks used the local production build; production API checks retained TLS verification.

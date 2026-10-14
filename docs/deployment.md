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

Goal records and the per-competition player registry are additive fields in the existing JSONB aggregate; existing scores are preserved. The Top skor & assist view derives statistics from final matches only, excluding own goals and penalty shootouts. Current local validation passed 64 unit/database tests, six browser flows (including mobile goal entry, account administration, input sizing, autocomplete, and spectator views), type checking, lint, and the production build.

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

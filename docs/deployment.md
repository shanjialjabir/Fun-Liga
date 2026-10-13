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

All temporary users, competition data, invitations and event rows used for testing were removed. No sample competition was published in discovery.

The cloud browser could not complete production UI automation because its trust store lacked the environment proxy certificate. HTTPS verification remained enabled; authenticated functional checks used the system trust store. Prior local browser tests cover the UI; production UI automation itself is not claimed as passed.

## Email verification limitation

Email/password authentication is enabled and email verification remains required by the existing Supabase project configuration. Custom SMTP is **not configured**. Supabase's default email service restricts recipients and rate-limits mail; public registration/forgot-password email delivery to arbitrary addresses needs a configured SMTP provider. Test accounts were created through Auth Admin with explicit verification and did not send emails. Email delivery itself has not been verified. Do not weaken the shared project's existing email-verification policy to bypass this limitation.

## Future deployments

Source is in `shanjialjabir/Fun-Liga` on `main`. The initial deployment uploaded source through the Vercel API; automatic GitHub-to-Vercel deployments are not configured or claimed. Keep the existing project's encrypted settings when deploying updates, and confirm the production alias remains `fun-liga.vercel.app`. Apply future database migrations through authenticated management access, preserving existing unrelated tables and Auth settings. Never commit tokens, service-role keys or local database files.

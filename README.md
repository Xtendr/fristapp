# Frist

Working name for a mobile-first household food inventory and expiry tracker.

The product source of truth is [`FOOD_INVENTORY_PRODUCT_HANDOFF.md`](./FOOD_INVENTORY_PRODUCT_HANDOFF.md). This README covers the initialized codebase.

## Current implementation state

Phases 0–2 are complete. The scheduled iPhone path has been physically proven with the installed PWA fully closed:

`pg_cron → pg_net → push-dispatch → Web Push → iPhone`

The production hourly cron remains; the temporary proof cron was removed.

Phases 3–6 are implemented in the repository and require migration/function deployment plus real-device validation before they can be called complete:

- camera and still-image EAN/UPC scanning with local check-digit validation
- service-only product cache with Open Food Facts fallback and user-confirmed mappings
- private photo capture with client compression and Mistral-assisted proposals
- explicit product/expiry image pairs for batch capture
- mandatory review before AI/batch inventory changes
- atomic, idempotent batch commit through `commit_capture_session`
- scheduled cleanup function for expired capture images and sessions
- manual fallback whenever AI is unconfigured or unavailable

- Email and password auth. Confirm email is off for the private prototype.
- Households are many-to-many via `household_members`. Current household is a cookie (`frist_household_id`), UX state only. RLS is the security boundary.
- Inventory belongs to a household. Members can add, edit, and remove items.
- Home lists items that expire within 3 Copenhagen calendar days, plus already expired items.
- Inventory lists every item, earliest expiry first. Expired items stay until removed.
- Push subscriptions belong to a user/device, not a household. Expiry reminders go to current household members.
- Production dispatch is hourly UTC. The function sends only when the local hour in `Europe/Copenhagen` is 08.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm start
npm run db:push
npm run test:expiry
npm run test:push
npm run test:capture
npm run test:rls
```

`.env.local` is required to **run** the app (`next dev` / `next start`) and `npm run test:rls`. `npm run lint`, `npm run typecheck`, and `npm run build` succeed without it because auth routes are dynamic and are not executed at build time.

## Environment variables

Copy `.env.example` to `.env.local`. Do not invent values. Do not commit `.env.local`.

Required for the Next.js app:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable / anon public key)
- `NEXT_PUBLIC_APP_URL` (invite links and the deployed origin)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (browser `applicationServerKey`)

Edge Function / Vault only. Never `NEXT_PUBLIC_`. Never add these to Vercel:

- `VAPID_PRIVATE_KEY` (JWK JSON from `npx @pushforge/builder vapid`)
- `VAPID_SUBJECT` (`mailto:` contact)
- `CRON_SECRET` (shared by `pg_cron` and `push-dispatch`)
- `SUPABASE_SERVICE_ROLE_KEY` (injected on hosted Edge Functions)
- `MISTRAL_API_KEY` (omit it to guarantee zero AI spend and use manual fallback)
- `MISTRAL_MODEL` (defaults to `mistral-small-2506`)
- `OPEN_FOOD_FACTS_USER_AGENT` (identify Frist and include a real contact address)

## Supabase setup

1. Create a free EU Supabase project, or run `npx supabase start` locally (Docker).
2. Auth: Email provider on, **Confirm email off**, Site URL `http://localhost:3000`. After the Vercel deploy, add `https://<deployment>.vercel.app` to the Site URL / additional redirect URLs.
3. API exposed schemas must stay `public` (and default extras). Never expose `private`.
4. Link and push repo migrations:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npm run db:push
```

5. Generate VAPID keys once:

```bash
npx @pushforge/builder vapid
```

Put the public key in `.env.local` and Vercel as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Put the private JWK JSON in Edge Function secrets as `VAPID_PRIVATE_KEY`.

6. Set Edge Function secrets, then deploy the function:

```bash
npx supabase secrets set CRON_SECRET=<long-random-string>
npx supabase secrets set VAPID_SUBJECT=mailto:you@example.com
npx supabase secrets set VAPID_PRIVATE_KEY=<jwk-json>
npx supabase functions deploy push-dispatch
npx supabase functions deploy product-resolver
npx supabase functions deploy analyze-capture
npx supabase functions deploy capture-cleanup
```

7. Store `project_url` and `cron_secret` in Vault, then apply the hourly notification schedule from [`supabase/cron/schedule_push_dispatch.sql.example`](supabase/cron/schedule_push_dispatch.sql.example). Apply the capture cleanup schedule from [`supabase/cron/schedule_capture_cleanup.sql.example`](supabase/cron/schedule_capture_cleanup.sql.example) only after its Edge Function is deployed.

8. Run proofs:

```bash
npm run test:expiry
npm run test:push
npm run test:capture
npm run test:rls
```

## HTTPS deploy

Real iPhone/Android push testing needs HTTPS. Deploy the Next.js app to Vercel Hobby with the public env vars above. `NEXT_PUBLIC_APP_URL` must be the `*.vercel.app` origin. Testers install Frist from that URL, not localhost.

The Next.js app does not send Web Push and does not use the service role.

## Scheduler proof (acceptance gate)

A Household **Send test notification** only proves permission → subscription → Edge Function → OS banner. It does **not** prove the scheduler.

For the closed-PWA gate:

1. Install Frist from the HTTPS URL (Home Screen on iPhone).
2. Sign in and enable notifications.
3. Add an inventory item whose expiry is today, tomorrow, or in 3 Copenhagen calendar days.
4. Fully close the installed PWA.
5. Apply the temporary once-a-minute job in the cron example (`ignoreScheduleWindow: true`), using the same `CRON_SECRET` as production.
6. Receive the reminder with the app closed.
7. Immediately `cron.unschedule` that temporary job. Do not leave a high-frequency schedule running. Do not commit it.

## Free-project pause

If the hosted Supabase project pauses after inactivity, `pg_cron` does not run and expiry notifications stop until the project resumes. That is acceptable for an active 2–3 person prototype. Do not add a paid keep-alive.

## Still deferred

- Notification preference settings
- `profiles.active_household_id`
- `expiry_type` in the UI (column exists, default `unknown`)
- native application distribution
- paid AI capacity or automatic paid retries

Add remains a mounted top-level tab with Scan, Photo, Batch, and Manual modes.

## Required acceptance proof for capture

After deploying the migration and functions, verify on real iPhone and Android hardware:

1. camera permission, scan start/stop, EAN-8, EAN-13, UPC-A, still-image fallback
2. internal product-cache hit, Open Food Facts hit, unknown product confirmation, offline/unavailable fallback
3. private Storage access across two users/households
4. Mistral success, missing-key fallback, invalid output, and rate-limit fallback
5. paired batch review and all-or-nothing commit
6. cleanup removes expired capture images without touching inventory

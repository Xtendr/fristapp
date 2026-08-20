# Frist

Working name for a mobile-first household food inventory and expiry tracker.

The product source of truth is [`FOOD_INVENTORY_PRODUCT_HANDOFF.md`](./FOOD_INVENTORY_PRODUCT_HANDOFF.md). This README covers the initialized codebase.

## Current slice: Phase 2 (implementation in repo)

Web Push subscriptions, a scheduled `push-dispatch` Edge Function, and notification enablement UX.

**Phase 2 is not complete until the real-device scheduler gate passes.** Automated lint/typecheck/build/RLS tests are necessary but not sufficient. The gate is:

`pg_cron → pg_net → push-dispatch → Web Push → closed installed PWA` on a Danish iPhone and on Android.

Barcode, Open Food Facts, Mistral, AI, and batch capture remain unimplemented.

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

Unused:

- `MISTRAL_API_KEY`, `MISTRAL_MODEL`

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
```

7. Store `project_url` and `cron_secret` in Vault, then apply the hourly schedule from [`supabase/cron/schedule_push_dispatch.sql.example`](supabase/cron/schedule_push_dispatch.sql.example).

8. Run proofs:

```bash
npm run test:expiry
npm run test:push
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

## Intentionally not implemented

- Barcode scanning and product lookup
- Mistral / image capture
- Notification preference settings
- `profiles.active_household_id`
- `expiry_type` in the UI (column exists, default `unknown`)

Add remains a tab for now. Scan / photo / batch are not shown as fake modes.

## Next recommended slice

Phase 3 (barcode) only after the iPhone + Android scheduled-push gate succeeds.

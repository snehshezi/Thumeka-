# Thumeka

Durban-only mobile-first marketplace for products, services, errands, and
deliveries. Buyer pays by EFT; approved provider fulfils; approved driver
delivers; admin oversees. Built in ZAR for South Africa.

## Stack

- **Next.js 15** (App Router, Server Actions, server-rendered by default)
- **TypeScript 5**
- **Supabase** — Postgres + Auth + Storage, with RLS on every public table
- **Tailwind CSS** with a brand palette tuned to the logo gradient
- **Resend** for transactional email
- **Google Maps** (Geocoding + Distance Matrix server-side, Places autocomplete in-browser)
- **Sentry** (opt-in via env — see below)
- **Playwright** + **Vitest** for tests

## Quick start

```bash
# 1. Install deps
npm install

# 2. Start the local Supabase stack (in a separate terminal)
npx supabase start

# 3. Copy the env template + fill in keys printed by `supabase start`
cp .env.example .env.local
#    → NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#    → NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
#    → SUPABASE_SERVICE_ROLE_KEY=<from supabase start>

# 4. Seed the dev DB (creates 6 test users + frozen orders for the runbook)
npm run seed:dev

# 5. Run the app
npm run dev
# → http://127.0.0.1:3000
#   (the dev server binds to 127.0.0.1 — open this exact URL, not 0.0.0.0,
#    or Safari will block it with "Not allowed to use restricted network port".)
```

Sign in as any seeded user (passwords are in [docs/manual-test-cases.md](docs/manual-test-cases.md)).

## Environment variables

See [`.env.example`](.env.example) for the full list with inline docs. The required ones to boot the app are:

| Var | What it does |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-side anon key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only admin key (bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | Used for email links + OG tags |

Optional but recommended for production:

| Var | What it does |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Server-side geocoding + driving distance |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser Places autocomplete |
| `RESEND_API_KEY` | Transactional email (silently skipped if unset) |
| `EMAIL_FROM` | Defaults to `Thumeka <noreply@thumeka.co.za>` (must be a verified Resend domain) |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error tracking (silently skipped if unset) |

## Commands

```bash
npm run dev                  # Dev server, port 3000
npm run build                # Production build (incl. Sentry wrapping)
npm run lint                 # ESLint
npm run test:unit            # Vitest unit tests (no DB)
npm run test:db              # Vitest integration tests (real Supabase)
npm run test:e2e             # Full Playwright e2e
npm run test:e2e:runbook     # Just the runbook specs (fastest sanity check)
npm run seed:dev             # Wipe + reseed local DB with the test-data fixtures
npm run reset:dev            # Wipe only
```

## Documentation

| File | What's in it |
|---|---|
| [docs/THUMEKA_MVP_SPEC.md](docs/THUMEKA_MVP_SPEC.md) | Product spec — what the MVP must do |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layered architecture, where to put new code |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Full schema reference |
| [docs/ORDER_FLOW.md](docs/ORDER_FLOW.md) | Order state machine + financial flow |
| [docs/manual-test-cases.md](docs/manual-test-cases.md) | Runbook — 100+ cases, ~60% e2e-automated |
| [docs/DEPLOYMENT_MERCURY_HKDNS.md](docs/DEPLOYMENT_MERCURY_HKDNS.md) | Deploying to mercury.hkdns.host (target host) |

## Migrations

All in [`supabase/migrations/`](supabase/migrations/), numbered + monotonic.
Re-run by `npx supabase db reset` (destroys local data) or applied to remote
via `npx supabase db push`. All migrations are idempotent (`if not exists`
guards everywhere).

## Health check

`GET /api/health` returns 200 / 503 depending on Supabase reachability. Wire
your load balancer or uptime monitor here.

## Testing strategy

- **Unit** ([tests/unit/](tests/unit/)) — pure functions, financials, validators. Fast, no IO.
- **Integration** ([tests/db/](tests/db/)) — real Supabase round-trips behind a single fixture.
- **E2E runbook** ([tests/e2e/runbook/](tests/e2e/runbook/)) — Playwright against `npm run dev:test` (port 3100). Single-worker so it shares a clean seed.

The runbook mirrors [docs/manual-test-cases.md](docs/manual-test-cases.md) — when you add a manual case, automate it.

## Code conventions

- **Server actions over API routes** for all writes. Server actions get CSRF protection + cookie auth automatically.
- **RLS in the database is the source of truth** for authorisation. App-level role checks (`requireRole`) are belt + braces.
- **Path validation before storage writes** — see `lib/storage.ts` and `lib/listing-images.ts` for the pattern.
- **Money columns** have `CHECK (>= 0)` constraints since [migration 010](supabase/migrations/010_money_check_constraints.sql) — the app never writes negatives, but the DB refuses them.
- **Idempotency on key writes** — `confirmEftPaymentAction` and `acceptProviderOrderAction` use atomic-update guards (`.in("status", [...])`) to prevent double-commit on double-click.

## Known deprecations

- **Google Maps Places `Autocomplete` (legacy class)** — used in
  [`components/address-autocomplete.tsx`](components/address-autocomplete.tsx).
  Google deprecated `google.maps.places.Autocomplete` in March 2025 in
  favour of the `<gmp-place-autocomplete>` Web Component. The legacy call
  still works (≥12 months notice promised before any removal), but new
  Google Cloud projects see a console warning. Migration involves
  enabling the **"Places API (New)"** SKU in Google Cloud, swapping the
  imperative class for the declarative element, and rewriting the
  `place_changed` listener / suburb auto-fill against the new `gmp-placeselect`
  event. Soft target: migrate within 6 months.

## Contributing

1. Branch from `main`.
2. Run `npm run lint && npm run test:unit` before pushing — CI will too.
3. If you touch any server action, run `npm run test:e2e:runbook` locally.
4. Migrations get a new numbered file — never edit existing ones.

## License

Proprietary. Source available; do not redistribute.

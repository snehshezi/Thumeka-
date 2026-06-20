# Thumeka Testing

Testing uses Vitest for unit/integration coverage and Playwright for E2E/accessibility coverage.

## Commands

- `npm run test` runs all Vitest tests once.
- `npm run test:unit` runs unit tests.
- `npm run test:integration` runs integration tests.
- `npm run test:db` runs local Supabase auth/RLS/persistence integration tests.
- `npm run test:e2e` runs Playwright smoke and accessibility checks.
- `npm run test:coverage` writes coverage to `coverage/`.

## Supabase Safety

Seed helpers only accept local Supabase URLs such as `http://127.0.0.1:54321` or `http://localhost:54321`.
They intentionally reject hosted Supabase URLs so automated tests cannot mutate production data.

Use `.env.test.local` for local credentials and never production values.

Database tests are not part of the default Vitest command. They require the
local Supabase stack to be running with migrations applied, and they seed their
own local auth users/listings/orders before each file. The product delivery
Playwright flow uses the same local seed helpers and real browser sessions.
Use real local anon and service-role keys in `.env.test.local`; placeholders
are rejected.

## data-testid Convention

Use stable kebab-case IDs:

- Page roots: `page-<route-name>`
- Forms: `<area>-form`
- Inputs: `<area>-<field>-input`
- Buttons/links: `<area>-<action>-button` or `nav-<destination>-link`
- Repeated cards: `<entity>-card`

Prefer accessible queries first in tests. Use `data-testid` for stable workflows, repeated UI, or text that may change.

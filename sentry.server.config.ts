// Sentry server SDK — Node runtime. Same conditional init pattern as the
// client config so unconfigured environments stay silent.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.SENTRY_ENV ?? process.env.NEXT_PUBLIC_SENTRY_ENV ?? "production"
  });
}

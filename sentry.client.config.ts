// Sentry browser SDK. Only initialises when NEXT_PUBLIC_SENTRY_DSN is set so
// development + CI keep zero-overhead behaviour. Drop a DSN into the env to
// turn it on in production without touching code.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV ?? "production"
  });
}

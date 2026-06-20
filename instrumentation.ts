// Next.js instrumentation hook — loads the right Sentry config per runtime.
// Required for Sentry to wire into server and edge handlers.
//
// IMPORTANT: We MUST gate the entire import on DSN presence. The Edge runtime
// disallows `eval`/code-generation, and merely importing @sentry/nextjs's
// edge SDK trips that restriction in dev mode (where webpack uses eval for
// HMR). With this guard, no DSN → no Sentry import → no Edge runtime crash.

import type { Instrumentation } from "next";

const SENTRY_DSN =
  process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export async function register() {
  if (!SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = (...args) => {
  if (!SENTRY_DSN) return;
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureRequestError(...args);
  });
};

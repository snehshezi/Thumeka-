import "server-only";

import webpush, { type PushSubscription } from "web-push";

import type { PushSubscriptionRow } from "@/lib/database.types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

let vapidConfigured = false;

/**
 * Lazy VAPID setup. We read the env at first-use rather than at module
 * import so the import chain doesn't crash a route render when the
 * keys aren't configured locally — the sendPush call itself short-
 * circuits in that case.
 */
function ensureVapid(): boolean {
  // Re-read env on every call so a deployment that rotates the keys
  // mid-process picks them up. setVapidDetails itself only runs the
  // first time we have a complete set (it's idempotent, but no need
  // to thrash it).
  const subject = process.env.VAPID_SUBJECT;
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    return false;
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
  }
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_SUBJECT &&
      (process.env.VAPID_PUBLIC_KEY ||
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
      process.env.VAPID_PRIVATE_KEY
  );
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where the notificationclick handler navigates the user. */
  url: string;
};

export type SendPushInput = PushPayload & {
  /** profiles.id of the recipient. Fans out to every device they've
   *  subscribed (work laptop + phone). */
  userId: string;
};

/**
 * Fan-out push notification to every subscription owned by `userId`.
 *
 * Uses the admin (service-role) Supabase client so action callers
 * don't need a session context — the helper runs from inside other
 * server actions where the actor is the *sender*, not the recipient.
 *
 * Failure handling:
 *  - 410 Gone / 404 Not Found → the browser unsubscribed; we prune
 *    the row to keep the table tidy.
 *  - 5xx / network → log + continue. Push isn't critical, so a flaky
 *    push service must never break the action that triggered it.
 *  - Missing VAPID env → silently no-op so non-production envs work
 *    without push setup.
 *
 * Returns the count of successful deliveries (useful in tests; callers
 * usually ignore it).
 */
export async function sendPush(input: SendPushInput): Promise<number> {
  if (!ensureVapid()) {
    console.warn("[push] VAPID keys not configured — skipping send");
    return 0;
  }

  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", input.userId);

  if (error) {
    console.warn("[push] subscription lookup failed:", error.message);
    return 0;
  }

  const subs = (rows ?? []) as PushSubscriptionRow[];
  if (subs.length === 0) return 0;

  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url
  });

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const subscription: PushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };

      try {
        await webpush.sendNotification(subscription, payload);
        return "delivered" as const;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          return "pruned" as const;
        }
        console.warn(
          "[push] send failed status=%s endpoint=%s err=%s",
          statusCode ?? "n/a",
          sub.endpoint.slice(0, 60),
          (err as Error)?.message
        );
        return "failed" as const;
      }
    })
  );

  return results.filter(
    (r) => r.status === "fulfilled" && r.value === "delivered"
  ).length;
}

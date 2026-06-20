import { NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscribeBody = {
  subscription?: {
    endpoint?: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  userAgent?: string;
};

/**
 * POST /api/push/subscribe
 *
 * The push-notification prompt component calls this after
 * `pushManager.subscribe()` succeeds. We upsert by (user_id, endpoint)
 * so re-subscribing from the same browser is idempotent (refreshing
 * the keys after a token rotation, for example).
 */
export async function POST(request: Request) {
  // requireProfile = any signed-in role can subscribe their own browser.
  const { profile } = await requireProfile();

  let body: SubscribeBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const endpoint = body.subscription?.endpoint;
  const p256dh = body.subscription?.keys?.p256dh;
  const auth = body.subscription?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string" ||
    !endpoint.startsWith("https://")
  ) {
    return NextResponse.json(
      { error: "Malformed subscription payload" },
      { status: 400 }
    );
  }

  const userAgent =
    typeof body.userAgent === "string"
      ? body.userAgent.slice(0, 500)
      : request.headers.get("user-agent")?.slice(0, 500) ?? null;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: profile.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent
      },
      { onConflict: "user_id,endpoint" }
    );

  if (error) {
    console.warn("[push] subscribe upsert failed:", error.message);
    return NextResponse.json(
      { error: "Could not save subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

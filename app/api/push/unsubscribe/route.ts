import { NextResponse } from "next/server";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/push/unsubscribe
 *
 * The prompt component calls this when the user toggles notifications
 * off — both to clean up the DB and so the browser stops getting
 * pushed to (matched alongside `pushManager.subscription.unsubscribe()`
 * on the client).
 */
export async function POST(request: Request) {
  const { profile } = await requireProfile();

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const endpoint = body.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return NextResponse.json(
      { error: "Missing or invalid endpoint" },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", profile.id)
    .eq("endpoint", endpoint);

  if (error) {
    console.warn("[push] unsubscribe failed:", error.message);
    return NextResponse.json(
      { error: "Could not remove subscription" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

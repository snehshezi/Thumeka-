import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Health check endpoint for load balancers and uptime monitoring.
 *
 * - Returns 200 with `{ status: "ok" }` when the app can reach Supabase.
 * - Returns 503 when the database round-trip fails — signals to the LB that
 *   this instance should be drained.
 *
 * Designed to be cheap: one lightweight count query, no joins.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("admin_settings")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { status: "degraded", reason: "database", message: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "down",
        reason: "uncaught",
        message: err instanceof Error ? err.message : "unknown"
      },
      { status: 503 }
    );
  }
}

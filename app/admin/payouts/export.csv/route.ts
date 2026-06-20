import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import type { PayoutRow } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Escapes a cell so commas / quotes / newlines don't break the CSV layout.
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = typeof value === "number" ? value.toString() : value;
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function resolveStatus(value: string | null): PayoutRow["status"] | null {
  if (value === "pending" || value === "paid" || value === "cancelled") return value;
  return null;
}

function resolveRecipientType(
  value: string | null
): PayoutRow["recipient_type"] | null {
  if (value === "provider" || value === "driver") return value;
  return null;
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const type = resolveRecipientType(url.searchParams.get("type"));
  const status = resolveStatus(url.searchParams.get("status"));

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("payouts")
    .select("*")
    .order("paid_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (type) query = query.eq("recipient_type", type);
  if (status) query = query.eq("status", status);

  const { data: payoutsRaw, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payouts = (payoutsRaw ?? []) as PayoutRow[];
  const recipientIds = Array.from(
    new Set(payouts.map((p) => p.recipient_user_id))
  );
  const profilesMap = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (recipientIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", recipientIds);
    for (const p of profiles ?? []) {
      profilesMap.set(p.id as string, {
        full_name: (p as { full_name: string | null }).full_name,
        email: (p as { email: string | null }).email
      });
    }
  }

  const header = [
    "payout_id",
    "recipient_type",
    "recipient_name",
    "recipient_email",
    "status",
    "period_start",
    "period_end",
    "gross_amount",
    "commission_amount",
    "net_amount",
    "payment_reference",
    "paid_at",
    "created_at"
  ];
  const lines = [header.join(",")];
  for (const payout of payouts) {
    const recipient = profilesMap.get(payout.recipient_user_id);
    const row = [
      csvCell(payout.id),
      csvCell(payout.recipient_type),
      csvCell(recipient?.full_name ?? ""),
      csvCell(recipient?.email ?? ""),
      csvCell(payout.status),
      csvCell(payout.period_start),
      csvCell(payout.period_end),
      csvCell(payout.gross_amount),
      csvCell(payout.commission_amount),
      csvCell(payout.net_amount),
      csvCell(payout.payment_reference ?? ""),
      csvCell(payout.paid_at ?? ""),
      csvCell(payout.created_at)
    ];
    lines.push(row.join(","));
  }

  const filenameSuffix = [type ?? "all", status ?? "all"].join("-");
  const csv = lines.join("\n") + "\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payouts-${filenameSuffix}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}

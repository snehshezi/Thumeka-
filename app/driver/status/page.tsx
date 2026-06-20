import Link from "next/link";
import { Truck } from "lucide-react";

import { SignOutForm } from "@/components/sign-out-form";
import { StatusPill } from "@/components/status-pill";
import { requireRole } from "@/lib/auth";
import type { DriverProfileRow } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DriverStatusPageProps = {
  searchParams: Promise<{
    submitted?: string;
  }>;
};

export default async function DriverStatusPage({ searchParams }: DriverStatusPageProps) {
  const params = await searchParams;
  const { profile } = await requireRole(["driver"]);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();
  const driver = data as DriverProfileRow | null;

  return (
    <div className="bg-mist" data-testid="page-driver-status">
      <section className="section-band">
        <div className="page-shell gap-4 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
                <Truck className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="text-display-md text-ink">Driver status</h1>
              <p className="mt-2 text-sm leading-6 text-black/60">
                Drivers can receive assignments only after approval.
              </p>
            </div>
            <SignOutForm />
          </div>
          {params.submitted ? (
            <div className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf">
              Application submitted for admin review.
            </div>
          ) : null}
        </div>
      </section>

      <section className="page-shell py-6">
        {driver ? (
          <div className="panel" data-testid="driver-status-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {profile.full_name ?? "Driver"}
                </h2>
                <p className="mt-1 text-sm text-black/60">{driver.vehicle_type ?? "Vehicle pending"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill status={driver.approval_status} />
                <StatusPill status={driver.availability_status} />
              </div>
            </div>
            {driver.rejection_reason ? (
              <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {driver.rejection_reason}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {driver.approval_status === "approved" ? (
                <Link className="btn-primary" data-testid="driver-open-dashboard-link" href="/driver/dashboard">
                  Open dashboard
                </Link>
              ) : null}
              <Link className="btn-secondary" data-testid="driver-update-application-link" href="/driver/apply">
                Update application
              </Link>
            </div>
          </div>
        ) : (
          <div className="panel" data-testid="driver-no-application-card">
            <h2 className="text-lg font-semibold">No application yet</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">
              Submit your driver application for admin review.
            </p>
            <Link className="btn-primary mt-5" data-testid="driver-start-application-link" href="/driver/apply">
              Start application
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

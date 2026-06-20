import Link from "next/link";
import { Store } from "lucide-react";

import { SignOutForm } from "@/components/sign-out-form";
import { StatusPill } from "@/components/status-pill";
import { requireRole } from "@/lib/auth";
import type { ProviderProfileRow } from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProviderStatusPageProps = {
  searchParams: Promise<{
    submitted?: string;
  }>;
};

export default async function ProviderStatusPage({ searchParams }: ProviderStatusPageProps) {
  const params = await searchParams;
  const { profile } = await requireRole(["provider"]);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();
  const provider = data as ProviderProfileRow | null;

  return (
    <div className="bg-mist" data-testid="page-provider-status">
      <section className="section-band">
        <div className="page-shell gap-4 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
                <Store className="h-5 w-5" aria-hidden="true" />
              </div>
              <h1 className="text-display-md text-ink">Provider status</h1>
              <p className="mt-2 text-sm leading-6 text-black/60">
                Providers can create live listings only after admin approval.
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
        {provider ? (
          <div className="panel" data-testid="provider-status-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {provider.business_name ?? profile.full_name ?? "Provider"}
                </h2>
                <p className="mt-1 text-sm text-black/60">{provider.suburb ?? "—"}</p>
              </div>
              <StatusPill status={provider.status} />
            </div>
            {provider.rejection_reason ? (
              <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
                {provider.rejection_reason}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {provider.status === "approved" ? (
                <Link className="btn-primary" data-testid="provider-open-dashboard-link" href="/provider/dashboard">
                  Open dashboard
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="panel" data-testid="provider-no-application-card">
            <h2 className="text-lg font-semibold">No application yet</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">
              Submit your provider application for admin review.
            </p>
            <Link className="btn-primary mt-5" data-testid="provider-start-application-link" href="/provider/apply">
              Start application
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

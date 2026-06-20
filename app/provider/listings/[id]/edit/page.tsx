import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, EyeOff, Eye, Trash2 } from "lucide-react";

import { EditListingForm } from "@/app/provider/listings/[id]/edit/edit-listing-form";
import {
  deleteProviderListingAction,
  setProviderListingActiveAction
} from "@/app/provider/dashboard/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { requireRole } from "@/lib/auth";
import type {
  CategoryRow,
  ListingRow,
  ProviderProfileRow
} from "@/lib/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Edit listing"
};

export const dynamic = "force-dynamic";

type EditListingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditListingPage({
  params
}: EditListingPageProps) {
  const { id } = await params;
  const { userId, profile } = await requireRole(["provider"]);
  const supabase = await createSupabaseServerClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Resolve the provider profile first so we can verify ownership of the
  // listing. RLS would also block a write to someone else's row but checking
  // here lets us return a clean 404 instead of a half-rendered form.
  const { data: providerData } = await supabase
    .from("provider_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();
  const providerProfile = providerData as ProviderProfileRow | null;

  if (!providerProfile || providerProfile.status !== "approved") {
    notFound();
  }

  const [{ data: listingData }, { data: categoriesData }] = await Promise.all([
    supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .eq("provider_id", providerProfile.id)
      .maybeSingle(),
    supabase.from("categories").select("*").order("sort_order")
  ]);

  const listing = listingData as ListingRow | null;
  if (!listing) {
    notFound();
  }
  const categories = (categoriesData ?? []) as CategoryRow[];

  return (
    <div className="bg-mist" data-testid="page-provider-edit-listing">
      <section className="section-band">
        <div className="page-shell gap-3 py-6">
          <Link
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-leaf hover:underline"
            data-testid="provider-edit-listing-back-link"
            href="/provider/dashboard?tab=listings"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to listings
          </Link>
          <h1 className="text-display-md text-ink">Edit listing</h1>
          <p className="text-body-sm text-black/55">
            Changes save instantly. Buyers see the new details immediately.
            {listing.is_active ? null : (
              <>
                {" "}
                This listing is currently <strong>inactive</strong> and hidden
                from the marketplace.
              </>
            )}
          </p>
        </div>
      </section>

      <section className="page-shell py-6">
        <EditListingForm
          categories={categories}
          listing={listing}
          supabaseUrl={supabaseUrl}
          userId={userId}
        />

        <div className="mt-6 panel" data-testid="provider-edit-listing-status-panel">
          <h2 className="text-h3 text-ink">Listing visibility</h2>
          <p className="mt-2 text-body-sm text-black/60">
            {listing.is_active
              ? "Deactivating hides this listing from buyers but keeps your order history intact. You can re-activate at any time."
              : "This listing is hidden from buyers. Re-activate to make it visible again."}
          </p>
          <form
            action={setProviderListingActiveAction}
            className="mt-4"
            data-testid="provider-edit-listing-status-form"
          >
            <input name="listing_id" type="hidden" value={listing.id} />
            <input
              name="is_active"
              type="hidden"
              value={listing.is_active ? "false" : "true"}
            />
            <button
              className={
                listing.is_active
                  ? "btn-secondary flex items-center gap-2 text-red-600"
                  : "btn-primary flex items-center gap-2"
              }
              data-testid="provider-edit-listing-toggle-button"
              type="submit"
            >
              {listing.is_active ? (
                <>
                  <EyeOff aria-hidden="true" className="h-4 w-4" />
                  Deactivate listing
                </>
              ) : (
                <>
                  <Eye aria-hidden="true" className="h-4 w-4" />
                  Reactivate listing
                </>
              )}
            </button>
          </form>
        </div>

        <div
          className="mt-6 panel border-red-200"
          data-testid="provider-edit-listing-danger-zone"
        >
          <h2 className="text-h3 text-ink">Danger zone</h2>
          <p className="mt-2 text-body-sm text-black/60">
            Permanently delete this listing. If buyers have ever placed an
            order against it, the listing can&apos;t be deleted — order history
            needs the row. In that case, use Deactivate above to hide it
            from the marketplace instead.
          </p>
          <form
            action={deleteProviderListingAction}
            className="mt-4"
            data-testid="provider-edit-listing-delete-form"
          >
            <input name="listing_id" type="hidden" value={listing.id} />
            <ConfirmSubmitButton
              className="btn-secondary flex items-center gap-2 border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
              data-testid="provider-edit-listing-delete-button"
              message="Delete this listing permanently? This can't be undone."
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              Delete listing
            </ConfirmSubmitButton>
          </form>
        </div>
      </section>
    </div>
  );
}

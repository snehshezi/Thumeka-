import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { CheckoutForm } from "@/app/checkout/[listingId]/checkout-form";
import { requireRole } from "@/lib/auth";
import type { ListingRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  params: Promise<{
    listingId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    quantity?: string;
  }>;
};

/**
 * Parse and clamp the `?quantity=N` URL param.
 *
 * Defaults to 1 so the legacy listing-detail "Checkout" link
 * (which doesn't pass a qty) keeps working as "buy one". Anything
 * non-integer, ≤ 0, or > 99 is treated as 1 — the cart UI clamps to 99
 * client-side, and the action re-validates on submit.
 */
function parseQuantity(raw: string | undefined): number {
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  if (parsed > 99) return 99;
  return parsed;
}

async function getListing(listingId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listingId)
    .eq("is_active", true)
    .eq("admin_disabled", false)
    .maybeSingle();

  return data as ListingRow | null;
}

export default async function CheckoutPage({
  params,
  searchParams
}: CheckoutPageProps) {
  const { listingId } = await params;
  const query = await searchParams;
  const quantity = parseQuantity(query.quantity);
  const [{ profile }, listing] = await Promise.all([
    requireRole(["buyer"]),
    getListing(listingId)
  ]);

  if (!listing) {
    return (
      <div className="page-shell max-w-xl py-8">
        <Link className="mb-4 inline-flex items-center text-sm font-semibold text-leaf" href="/listings">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Listings
        </Link>
        <div className="panel">This listing is no longer available.</div>
      </div>
    );
  }

  return (
    <div className="section-band" data-testid="page-checkout">
      <div className="page-shell max-w-2xl py-6">
        <Link className="mb-4 inline-flex items-center text-sm font-semibold text-leaf" href={`/listings/${listing.id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Listing
        </Link>
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-display-md text-ink">Checkout</h1>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Payment instructions are only shown after the provider accepts your order request.
          </p>
        </div>

        {query.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {query.error}
          </div>
        ) : null}

        <div
          className="mb-4 rounded-lg border border-black/10 bg-white p-4"
          data-testid="checkout-listing-summary"
        >
          <h2 className="font-semibold">{listing.title}</h2>
          <p className="mt-1 text-sm text-black/60">
            {formatMoney(listing.price)}
            {quantity > 1 ? (
              <>
                {" × "}
                <span
                  className="font-semibold text-ink"
                  data-testid="checkout-quantity-display"
                >
                  {quantity}
                </span>
              </>
            ) : null}
          </p>
        </div>

        <CheckoutForm
          defaultName={profile.full_name ?? ""}
          defaultPhone={profile.phone ?? ""}
          defaultWhatsapp={profile.phone ?? ""}
          listingId={listing.id}
          listingPrice={listing.price}
          quantity={quantity}
        />
      </div>
    </div>
  );
}

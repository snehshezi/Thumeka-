import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, Store } from "lucide-react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { ListingImage } from "@/components/listing-image";
import { canShopAsBuyer, getCurrentProfile } from "@/lib/auth";
import type { CategoryRow, ListingRow } from "@/lib/database.types";
import { formatMoney, titleCase } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ListingPageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getListing(id: string) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: listing } = await supabase
      .from("listings")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .eq("admin_disabled", false)
      .maybeSingle();

    if (!listing) {
      return null;
    }

    const { data: category } = await supabase
      .from("categories")
      .select("*")
      .eq("id", listing.category_id)
      .maybeSingle();

    return {
      listing: listing as ListingRow,
      category: category as Pick<CategoryRow, "name" | "slug"> | null
    };
  } catch {
    return null;
  }
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  const [data, profile] = await Promise.all([
    getListing(id),
    getCurrentProfile().catch(() => null)
  ]);

  if (!data) {
    notFound();
  }

  const { listing, category } = data;
  const canShop = canShopAsBuyer(profile);

  return (
    <div className="section-band" data-testid="page-listing-detail">
      <div className="page-shell max-w-3xl py-6">
        <Link className="mb-4 inline-flex items-center text-sm font-semibold text-leaf" href="/listings">
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Listings
        </Link>
        <div className="panel" data-testid="listing-detail-card">
          <ListingImage
            alt={listing.title}
            className="relative mb-5 aspect-[4/3] overflow-hidden rounded-md"
            storagePath={listing.image_url}
          />
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-mint px-2 py-1 text-xs font-semibold text-leaf">
              {titleCase(listing.listing_type)}
            </span>
            {category ? (
              <span className="rounded-md bg-black/5 px-2 py-1 text-xs font-semibold text-black/60">
                {category.name}
              </span>
            ) : null}
          </div>
          <h1 className="text-display-md text-ink">{listing.title}</h1>
          {listing.business_name ? (
            <p
              className="mt-2 flex items-center gap-1.5 text-sm font-medium text-black/70"
              data-testid="listing-detail-seller"
            >
              <Store aria-hidden="true" className="h-4 w-4 text-black/45" />
              Sold by{" "}
              <span className="font-semibold text-ink">
                {listing.business_name}
              </span>
            </p>
          ) : null}
          <p className="mt-3 text-xl font-semibold text-leaf">
            {formatMoney(listing.price)}
          </p>
          <p className="mt-4 text-sm leading-6 text-black/65">{listing.description}</p>
          <p className="mt-4 flex items-center gap-1 text-sm font-medium text-black/55">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {listing.suburb ?? "—"}
          </p>
          {listing.availability_notes ? (
            <p className="mt-4 rounded-md bg-mist p-3 text-sm text-black/65">
              {listing.availability_notes}
            </p>
          ) : null}
          {listing.provider_is_open === false ? (
            <div
              className="mt-4 rounded-lg border border-black/15 bg-black/5 p-3"
              data-testid="listing-detail-closed-panel"
            >
              <p className="text-body-sm font-semibold text-ink">
                This seller is closed right now
              </p>
              <p className="mt-1 text-caption text-black/60">
                Listings stay browsable but you can&apos;t place a new order
                until they reopen.
              </p>
            </div>
          ) : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
            {listing.provider_is_open === false ? (
              <button
                aria-disabled="true"
                className="cursor-not-allowed rounded-md border border-black/10 bg-black/5 px-4 py-2 text-sm font-semibold text-black/40"
                data-testid="listing-request-order-disabled"
                disabled
                type="button"
                title="This seller is closed right now."
              >
                Seller closed
              </button>
            ) : (
              <Link
                className="btn-primary inline-flex items-center justify-center gap-2"
                data-testid="listing-request-order-link"
                href={`/checkout/${listing.id}`}
              >
                Checkout
              </Link>
            )}
            {canShop && listing.provider_is_open !== false ? (
              <AddToCartButton
                data-testid="listing-detail-add-to-cart"
                item={{
                  listingId: listing.id,
                  providerId: listing.provider_id,
                  title: listing.title,
                  price: Number(listing.price),
                  imageUrl: listing.image_url ?? null,
                  businessName: listing.business_name ?? null
                }}
                variant="label"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

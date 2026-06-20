import Link from "next/link";
import { ArrowRight, Clock, MapPin, ShoppingBag } from "lucide-react";
import { Suspense } from "react";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { CategoryTileGrid } from "@/components/category-tile-grid";
import { EmptyState } from "@/components/empty-state";
import { OnboardingOverlay } from "@/components/onboarding-overlay";
import { FilterBottomSheet } from "@/components/filter-bottom-sheet";
import { ListingImage } from "@/components/listing-image";
import { MarketplaceActiveFilters } from "@/components/marketplace-active-filters";
import { MarketplaceFilterStrip } from "@/components/marketplace-filter-strip";
import { canShopAsBuyer, getCurrentProfile } from "@/lib/auth";
import { APP_NAME, SEEDED_CATEGORIES } from "@/lib/constants";
import type { CategoryRow, ListingRow } from "@/lib/database.types";
import { formatMoney, titleCase } from "@/lib/format";
import {
  type MarketplaceSort,
  parseCategoryList,
  sanitisePrice,
  sanitiseSort,
  sanitiseSuburb
} from "@/lib/marketplace-filters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type HomePageProps = {
  searchParams: Promise<{
    category?: string;
    q?: string;
    sort?: string;
    min_price?: string;
    max_price?: string;
    suburb?: string;
    open_only?: string;
  }>;
};

/**
 * Sanitise a keyword for use inside a PostgREST `or()` filter string.
 *
 * PostgREST treats `,` as a list separator and `(` / `)` for grouping inside
 * `or()`, so a search like `coffee, tea` or `pizza (large)` would silently
 * break the filter into garbage. `%` is a LIKE wildcard — letting it through
 * lets a user type `%` and match everything, which is harmless but useless.
 * `\` would be interpreted as an escape sequence.
 *
 * Strip those characters, collapse runs of whitespace, trim, and cap the
 * length so we don't ship a 5KB filter string to Postgres.
 */
function sanitiseSearchKeyword(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[%,()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

type MarketplaceFilters = {
  /** Zero or more category names — buyers can multi-select category tiles. */
  categoryNames: string[];
  searchKeyword: string | undefined;
  sort: MarketplaceSort;
  minPrice: number | null;
  maxPrice: number | null;
  suburb: string | null;
  openOnly: boolean;
};

async function getMarketplaceData(filters: MarketplaceFilters) {
  const {
    categoryNames,
    searchKeyword,
    sort,
    minPrice,
    maxPrice,
    suburb,
    openOnly
  } = filters;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: categories } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const categoryList = (categories ?? []) as CategoryRow[];
    // Resolve each picked category name to a row. Unknown names drop
    // silently — same defensive behaviour as the single-select used.
    const nameLookup = new Map(
      categoryList.map((category) => [category.name.toLowerCase(), category])
    );
    const matchedCategories = categoryNames
      .map((name) => nameLookup.get(name.toLowerCase()))
      .filter((category): category is CategoryRow => Boolean(category));

    let listingsQuery = supabase
      .from("listings")
      .select("*")
      .eq("is_active", true)
      .eq("admin_disabled", false);

    // Default sort: open stores first, newest within each open/closed band.
    // Price-asc / price-desc / oldest each override the open-first rank —
    // a buyer explicitly picking those orders is asking for that specific
    // axis, not "open now."
    if (sort === "price_asc") {
      listingsQuery = listingsQuery.order("price", { ascending: true });
    } else if (sort === "price_desc") {
      listingsQuery = listingsQuery.order("price", { ascending: false });
    } else if (sort === "oldest") {
      listingsQuery = listingsQuery.order("created_at", { ascending: true });
    } else {
      listingsQuery = listingsQuery
        .order("provider_is_open", { ascending: false })
        .order("created_at", { ascending: false });
    }
    listingsQuery = listingsQuery.limit(60);

    if (matchedCategories.length === 1) {
      listingsQuery = listingsQuery.eq(
        "category_id",
        matchedCategories[0].id
      );
    } else if (matchedCategories.length > 1) {
      listingsQuery = listingsQuery.in(
        "category_id",
        matchedCategories.map((category) => category.id)
      );
    }
    if (minPrice !== null) {
      listingsQuery = listingsQuery.gte("price", minPrice);
    }
    if (maxPrice !== null) {
      listingsQuery = listingsQuery.lte("price", maxPrice);
    }
    if (suburb) {
      listingsQuery = listingsQuery.eq("suburb", suburb);
    }
    if (openOnly) {
      listingsQuery = listingsQuery.eq("provider_is_open", true);
    }

    const safeKeyword = sanitiseSearchKeyword(searchKeyword);
    if (safeKeyword) {
      // Substring match across the most natural-language fields a buyer might
      // search by. Suburb is intentionally excluded — we treat location as a
      // distinct filter dimension, not a keyword. Categories aren't searched
      // here either; the sidebar already filters by them.
      listingsQuery = listingsQuery.or(
        `title.ilike.%${safeKeyword}%,description.ilike.%${safeKeyword}%,business_name.ilike.%${safeKeyword}%`
      );
    }

    const { data: listings } = await listingsQuery;

    return {
      listings: (listings ?? []) as ListingRow[],
      categories: categoryList,
      matchedCategories,
      configured: true
    };
  } catch {
    return {
      listings: [] as ListingRow[],
      categories: [] as CategoryRow[],
      matchedCategories: [] as CategoryRow[],
      configured: false
    };
  }
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const activeCategories = parseCategoryList(params.category);
  const activeKeyword = params.q?.trim() || undefined;
  const sort = sanitiseSort(params.sort);
  const minPrice = sanitisePrice(params.min_price);
  const maxPrice = sanitisePrice(params.max_price);
  const suburb = sanitiseSuburb(params.suburb);
  const openOnly = params.open_only === "1";

  const [{ listings, categories, matchedCategories, configured }, profile] =
    await Promise.all([
      getMarketplaceData({
        categoryNames: activeCategories,
        searchKeyword: activeKeyword,
        sort,
        minPrice,
        maxPrice,
        suburb,
        openOnly
      }),
      getCurrentProfile().catch(() => null)
    ]);

  const canShop = canShopAsBuyer(profile);
  const categoryNames = categories.length
    ? categories.map((category) => category.name)
    : SEEDED_CATEGORIES;
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );

  return (
    <div className="bg-mist" data-testid="page-home">
      {/* First-time onboarding card deck (modal) — gated by localStorage. */}
      <OnboardingOverlay />

      {/* Hero — restored at the client's request. Hidden while a keyword
          search is active so the results sit right under the navbar. */}
      {!activeKeyword ? (
        <section className="section-band" data-testid="home-hero">
          <div className="page-shell gap-4 py-8 sm:py-12">
            <div className="flex flex-col items-start gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-caption font-semibold uppercase tracking-widest text-leaf">
                  <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                  South Africa&apos;s safest marketplace
                </span>
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-sunset/15 px-3 py-1 text-caption font-semibold uppercase tracking-widest text-sunset"
                  data-testid="home-hero-open-247-badge"
                >
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  Open 24/7
                </span>
              </div>
              <h1 className="max-w-3xl text-display-lg sm:text-display-xl">
                Anything <span className="text-brand-gradient">delivered</span>{" "}
                within an average of 40 minutes.
              </h1>
            </div>
          </div>
        </section>
      ) : null}

      {/* Mobile category rail — single-row horizontal scroll, always
          visible (no toggle). Hidden while a keyword search is active
          so the listings grid takes the full viewport. */}
      {!activeKeyword ? (
        <section className="page-shell sm:hidden pt-4">
          <Suspense fallback={null}>
            <CategoryTileGrid
              activeCategories={activeCategories}
              categories={categoryNames}
              layout="mobile"
            />
          </Suspense>
        </section>
      ) : null}

      {/* Browse band: sidebar + grid. The result count strip under the
          filter row carries the contextual info ("60 listings · Food ·
          in Berea") so the band no longer needs a top heading or a
          dashboard CTA — both moved out at the user's request. */}
      <section className="page-shell pb-8 pt-4">
        {!configured ? (
          <div className="mt-4 rounded-md border border-maize/60 bg-maize/20 p-3 text-sm text-ink">
            Live listings are temporarily unavailable. Please check back
            shortly.
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-5 sm:mt-6 sm:flex-row sm:items-start">
          {/* Desktop sidebar — hidden while searching so the grid widens. */}
          <aside
            aria-label="Categories"
            className={
              activeKeyword
                ? "hidden"
                : "hidden w-56 shrink-0 sm:block"
            }
            data-testid="home-category-sidebar"
          >
            <div className="sticky top-24 rounded-lg border border-black/10 bg-white p-3">
              <p className="px-2 pb-2 text-caption font-semibold uppercase tracking-widest text-black/40">
                Refine by Category
              </p>
              <ul className="space-y-0.5 text-sm">
                <li>
                  <Link
                    className={
                      activeCategories.length
                        ? "block rounded-md px-2 py-2 text-ink hover:bg-mist"
                        : "block rounded-md bg-mint px-2 py-2 font-semibold text-leaf"
                    }
                    data-testid="home-category-link-all"
                    href="/"
                  >
                    All
                  </Link>
                </li>
                {categoryNames.map((category) => {
                  const isActive = activeCategories.some(
                    (name) => name.toLowerCase() === category.toLowerCase()
                  );
                  return (
                    <li key={category}>
                      <Link
                        className={
                          isActive
                            ? "block rounded-md bg-mint px-2 py-2 font-semibold text-leaf"
                            : "block rounded-md px-2 py-2 text-ink hover:bg-mist"
                        }
                        data-testid="home-category-link"
                        href={`/?category=${encodeURIComponent(category)}`}
                      >
                        {category}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Right pane: filters + grid */}
          <div className="min-w-0 flex-1">
            {/* Category band + filter controls + active chips all drop
                out while a keyword search is active. The page narrows to
                "search bar → results" so the buyer sees the grid filter
                as they type. */}
            {!activeKeyword ? (
              <>
                {/* Desktop has the sidebar for category navigation, so
                    no in-pane rail here — mobile gets the scroll rail
                    in its own section above. */}

                {/* Desktop sticky filter strip + mobile filter trigger.
                    The mobile strip stays inline as a single button; the
                    bottom sheet handles the actual controls. */}
                <div className="mb-4 flex items-center gap-3">
                  <Suspense fallback={null}>
                    <MarketplaceFilterStrip />
                  </Suspense>
                  <Suspense fallback={null}>
                    <FilterBottomSheet />
                  </Suspense>
                </div>

                {/* Active filter chips strip — only renders when at
                    least one filter is applied (chips read URL
                    directly). */}
                <Suspense fallback={null}>
                  <MarketplaceActiveFilters className="mb-4" />
                </Suspense>
              </>
            ) : null}

            {/* Result count line — shows the current scope so the buyer
                knows what they're looking at. */}
            <p
              className="mb-4 text-body-sm text-black/55"
              data-testid="home-result-count"
            >
              <span className="font-semibold text-ink">{listings.length}</span>{" "}
              {activeKeyword
                ? listings.length === 1
                  ? "match"
                  : "matches"
                : listings.length === 1
                  ? "listing"
                  : "listings"}
              {activeKeyword ? (
                <>
                  {" "}
                  for{" "}
                  <span className="font-semibold text-ink">
                    &ldquo;{activeKeyword}&rdquo;
                  </span>
                </>
              ) : null}
              {matchedCategories.length === 1
                ? ` · ${matchedCategories[0].name}`
                : matchedCategories.length > 1
                  ? ` · ${matchedCategories.length} categories`
                  : null}
              {suburb ? <> · in {suburb}</> : null}
              {openOnly ? <> · open now</> : null}
            </p>

            {listings.length ? (
              <div className="mobile-grid mt-5">
                {listings.map((listing) => {
                  const isOpen = listing.provider_is_open !== false;
                  return (
                  <Link
                    className="rounded-lg border border-black/10 bg-white p-2 shadow-soft transition hover:-translate-y-0.5 hover:border-leaf sm:p-4"
                    data-listing-open={isOpen}
                    data-testid="listing-card"
                    href={`/listings/${listing.id}`}
                    key={listing.id}
                  >
                    <div className="relative mb-2 sm:mb-4">
                      <ListingImage
                        alt={listing.title}
                        className="relative aspect-square overflow-hidden rounded-md sm:aspect-[4/3]"
                        storagePath={listing.image_url}
                      />
                      {/* OPEN / Closed pill, top-left of the image. Visible
                          on mobile too — the trust signal matters most for
                          buyers deciding mid-scroll. */}
                      <span
                        className={`absolute left-1.5 top-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest sm:left-2 sm:top-2 ${
                          isOpen
                            ? "bg-leaf text-white"
                            : "bg-black/55 text-white"
                        }`}
                        data-testid={`listing-card-${listing.id.slice(0, 8)}-open-badge`}
                      >
                        {isOpen ? "Open" : "Closed"}
                      </span>
                      {canShop && isOpen ? (
                        <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2">
                          <AddToCartButton
                            data-testid={`listing-card-${listing.id.slice(0, 8)}-add`}
                            item={{
                              listingId: listing.id,
                              providerId: listing.provider_id,
                              title: listing.title,
                              price: Number(listing.price),
                              imageUrl: listing.image_url ?? null,
                              businessName: listing.business_name ?? null
                            }}
                            variant="fab"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="mb-1 flex items-center justify-between gap-1 sm:mb-2 sm:gap-2">
                      <span className="hidden rounded-md bg-mint px-2 py-0.5 text-xs font-semibold text-leaf sm:inline-flex">
                        {titleCase(listing.listing_type)}
                      </span>
                      {categoriesById.get(listing.category_id) ? (
                        <span className="hidden rounded-md bg-black/5 px-2 py-0.5 text-xs font-semibold text-black/60 sm:inline-flex">
                          {categoriesById.get(listing.category_id)?.name}
                        </span>
                      ) : null}
                      <span className="text-sm font-bold text-leaf sm:text-sm sm:font-semibold sm:text-ink">
                        {formatMoney(listing.price)}
                      </span>
                    </div>
                    <h3 className="line-clamp-2 min-h-[2.25rem] text-xs font-semibold leading-snug sm:min-h-[3rem] sm:text-base sm:leading-normal">
                      {listing.title}
                    </h3>
                    {listing.business_name ? (
                      <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-black/55 sm:mt-1 sm:text-caption">
                        {listing.business_name}
                      </p>
                    ) : null}
                    <p className="mt-2 hidden line-clamp-1 text-sm leading-6 text-black/60 sm:block">
                      {listing.description}
                    </p>
                    <p className="mt-3 hidden items-center gap-1 truncate text-xs font-medium text-black/55 sm:flex">
                      <MapPin aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{listing.suburb ?? "—"}</span>
                    </p>
                  </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  body={
                    activeKeyword
                      ? `Nothing matches "${activeKeyword}"${
                          matchedCategories.length === 1
                            ? ` in ${matchedCategories[0].name}`
                            : matchedCategories.length > 1
                              ? " in the selected categories"
                              : ""
                        }. Try fewer words or browse a different category.`
                      : matchedCategories.length
                        ? `No live listings in ${
                            matchedCategories.length === 1
                              ? matchedCategories[0].name
                              : "these categories"
                          } yet. Try another category, or check back soon.`
                        : "We're onboarding our first sellers right now. Check back soon — or sign up as a provider to list yours."
                  }
                  title={activeKeyword ? "No matches" : "No live listings yet"}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Final CTA: Run your business */}
      <section className="page-shell py-12">
        <div className="panel flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-h1 text-ink">
              Run your business with {APP_NAME}.
            </h2>
            <p className="mt-2 text-body text-black/60">
              Reach buyers, ship through approved drivers, and get paid.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="btn-primary px-6"
              data-testid="home-final-sell-link"
              href="/auth/register"
            >
              Sell on {APP_NAME}
              <ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" />
            </Link>
            <Link
              className="btn-secondary px-6"
              data-testid="home-final-drive-link"
              href="/auth/register"
            >
              Drive for {APP_NAME}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, ClipboardList, Store } from "lucide-react";

import { updateProviderBusinessNameAction } from "@/app/provider/dashboard/actions";
import { CreateListingPanel } from "@/app/provider/dashboard/create-listing-panel";
import { ProviderOrdersBoard } from "@/app/provider/dashboard/provider-orders-board";
import { StoreOpenStatusPanel } from "@/app/provider/dashboard/store-open-status-panel";
import { InstallPwaNudge } from "@/components/install-pwa-nudge";
import { ListingImage } from "@/components/listing-image";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { Segmented, type SegmentedTab } from "@/components/segmented";
import { requireRole } from "@/lib/auth";
import type {
  AdminSettingsRow,
  CategoryRow,
  ListingRow,
  OrderItemRow,
  OrderRow,
  ProviderProfileRow
} from "@/lib/database.types";
import { formatMoney, getGreeting } from "@/lib/format";
import { getProviderOrderBucket } from "@/lib/order-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProviderTab = "orders" | "listings";

function resolveTab(value: string | undefined): ProviderTab {
  return value === "listings" ? "listings" : "orders";
}

type ProviderDashboardPageProps = {
  searchParams: Promise<{
    accepted?: string;
    business_name_updated?: string;
    error?: string;
    listing_created?: string;
    listing_deactivated?: string;
    listing_deleted?: string;
    listing_reactivated?: string;
    listing_updated?: string;
    store_opened?: string;
    store_closed?: string;
    tab?: string;
  }>;
};

export default async function ProviderDashboardPage({
  searchParams
}: ProviderDashboardPageProps) {
  const params = await searchParams;
  const tab = resolveTab(params.tab);
  // userId = auth user id; used by storage RLS for image uploads.
  const { userId, profile } = await requireRole(["provider"]);
  const supabase = await createSupabaseServerClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();
  const providerProfile = provider as ProviderProfileRow | null;

  if (!providerProfile || providerProfile.status !== "approved") {
    return (
      <div className="page-shell max-w-xl py-8" data-testid="page-provider-dashboard-approval-required">
        <div className="panel">
          <h1 className="text-h1 text-ink">Approval required</h1>
          <p className="mt-2 text-body-sm text-black/60">
            Provider dashboards open after admin approval.
          </p>
          <Link className="btn-primary mt-5" data-testid="provider-dashboard-status-link" href="/provider/status">
            View status
          </Link>
        </div>
      </div>
    );
  }

  const [
    { count: listingCount },
    { count: orderCount },
    { data: ordersData },
    { data: categoriesData },
    { data: listingsData },
    { data: settings }
  ] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerProfile.id),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerProfile.id),
    supabase
      .from("orders")
      .select("*")
      .eq("provider_id", providerProfile.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("categories").select("*").order("sort_order"),
    supabase
      .from("listings")
      .select("*")
      .eq("provider_id", providerProfile.id)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("admin_settings")
      .select("eft_payment_instructions")
      .limit(1)
      .maybeSingle()
  ]);
  const orders = (ordersData ?? []) as OrderRow[];
  const categories = (categoriesData ?? []) as CategoryRow[];
  const listings = (listingsData ?? []) as ListingRow[];

  // Pull line items for the orders we just loaded — needed so the drawer
  // can render a per-line list for multi-item orders. Cheap: one round
  // trip, indexed lookup, capped to the same 12 orders.
  const orderIds = orders.map((order) => order.id);
  const { data: orderItemsData } = orderIds.length
    ? await supabase
        .from("order_items")
        .select("*")
        .in("order_id", orderIds)
        .order("position", { ascending: true })
    : { data: [] };
  const orderItems = (orderItemsData ?? []) as OrderItemRow[];
  const orderItemsByOrderId = new Map<string, OrderItemRow[]>();
  for (const item of orderItems) {
    const list = orderItemsByOrderId.get(item.order_id) ?? [];
    list.push(item);
    orderItemsByOrderId.set(item.order_id, list);
  }
  const eftPaymentInstructions = (settings as Pick<
    AdminSettingsRow,
    "eft_payment_instructions"
  > | null)?.eft_payment_instructions ?? null;

  const needsAction = orders.filter(
    (order) => getProviderOrderBucket(order.status) === "needs_action"
  ).length;

  const businessName = providerProfile.business_name?.trim() || "there";
  const greetingLine =
    needsAction === 0
      ? "All caught up"
      : `${needsAction} ${needsAction === 1 ? "order needs" : "orders need"} you`;

  const tabs: SegmentedTab[] = [
    {
      value: "orders",
      label: "Orders",
      href: "/provider/dashboard",
      count: orderCount ?? 0
    },
    {
      value: "listings",
      label: "Listings",
      href: "/provider/dashboard?tab=listings",
      count: listingCount ?? 0
    }
  ];

  return (
    <div className="bg-mist" data-testid="page-provider-dashboard">
      <section className="section-band">
        <div className="page-shell gap-4 py-6">
          {/* Rail + heading speak one language: lime when caught up, warm
              sunset when there's work. The greeting itself becomes a chunky
              notification-style action card on the attention path. */}
          <div
            className={`border-l-4 pl-4 ${
              needsAction > 0 ? "border-sunset" : "border-leaf"
            }`}
          >
            <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
              {getGreeting()}, {businessName}
            </p>
            {needsAction === 0 ? (
              <h1
                className="mt-1 text-display-md text-leaf"
                data-testid="provider-dashboard-greeting"
              >
                {greetingLine}
              </h1>
            ) : (
              <div data-testid="provider-dashboard-greeting">
                <Link
                  className="group mt-3 flex max-w-md items-center gap-4 rounded-2xl bg-sunset p-4 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sunset focus:ring-offset-2"
                  data-testid="provider-dashboard-greeting-link"
                  href="/provider/dashboard#provider-needs-action"
                >
                  {/* Big circular count badge — the number is the visual
                      anchor; eye lands on it before reading anything. */}
                  <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-sunset">
                    {needsAction}
                    {/* Soft animated ping so the eye notices the change. */}
                    <span className="absolute right-0 top-0 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                    </span>
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block text-lg font-bold leading-tight">
                      {needsAction === 1 ? "Order needs you" : "Orders need you"}
                    </span>
                    <span className="block text-sm text-white/85">
                      Tap to review and accept
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 transition group-hover:translate-x-1"
                  />
                </Link>
              </div>
            )}
            <p className="mt-3 text-body-sm text-black/55">
              Accept orders quickly to unlock EFT instructions for your buyers.
            </p>
          </div>

          {/* Open/Closed store toggle. The cron sweep can auto-flip
              `is_open` to false after 3 missed orders; this panel is the
              way back. */}
          <StoreOpenStatusPanel
            isOpen={providerProfile.is_open}
            consecutiveMissedOrders={providerProfile.consecutive_missed_orders ?? 0}
            closedAt={providerProfile.closed_at}
          />
          {params.store_opened ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="provider-store-opened-message"
            >
              Your store is back open. New orders will start flowing in.
            </div>
          ) : null}
          {params.store_closed ? (
            <div
              className="rounded-md border border-black/10 bg-black/5 p-3 text-sm text-ink"
              data-testid="provider-store-closed-message"
            >
              Your store is closed. Buyers can still browse your listings but
              can&apos;t place new orders.
            </div>
          ) : null}

          {params.accepted ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="provider-order-accepted-message"
            >
              Order accepted. The buyer can now see EFT instructions.
            </div>
          ) : null}
          {params.listing_created ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="provider-listing-created-message"
            >
              Listing created.
            </div>
          ) : null}
          {params.listing_updated ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="provider-listing-updated-message"
            >
              Listing updated.
            </div>
          ) : null}
          {params.listing_deactivated ? (
            <div
              className="rounded-md border border-black/10 bg-black/5 p-3 text-sm text-ink"
              data-testid="provider-listing-deactivated-message"
            >
              Listing deactivated. Hidden from the marketplace.
            </div>
          ) : null}
          {params.listing_reactivated ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="provider-listing-reactivated-message"
            >
              Listing reactivated. Buyers can see it again.
            </div>
          ) : null}
          {params.listing_deleted ? (
            <div
              className="rounded-md border border-black/10 bg-black/5 p-3 text-sm text-ink"
              data-testid="provider-listing-deleted-message"
            >
              Listing deleted.
            </div>
          ) : null}
          {params.business_name_updated ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="provider-business-name-updated-message"
            >
              Business name updated. Your listings now show the new name.
            </div>
          ) : null}
          {params.error ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              data-testid="provider-error-message"
            >
              {params.error}
            </div>
          ) : null}
          <PushNotificationPrompt role="provider" />
          <InstallPwaNudge />
        </div>
      </section>

      <section className="page-shell py-6">
        {/* Two rounded tiles that always sit side-by-side, even on the
            smallest viewports. Each is a link to its tab — the count is now a
            primary nav action, not just a stat. */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-leaf/20 bg-white p-4 shadow-soft transition hover:border-leaf hover:shadow-md focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2"
            data-testid="provider-listings-count-card"
            href="/provider/dashboard?tab=listings"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf/10 text-leaf transition group-hover:bg-leaf group-hover:text-white">
              <Store className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">
                {listingCount ?? 0}
              </p>
              <p className="mt-1 text-body-sm text-black/60">Listings</p>
            </div>
          </Link>
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-leaf/20 bg-white p-4 shadow-soft transition hover:border-leaf hover:shadow-md focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2"
            data-testid="provider-orders-count-card"
            href="/provider/dashboard"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf/10 text-leaf transition group-hover:bg-leaf group-hover:text-white">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">
                {orderCount ?? 0}
              </p>
              <p className="mt-1 text-body-sm text-black/60">Orders</p>
            </div>
          </Link>
        </div>

        <div className="mt-6">
          <Segmented
            active={tab}
            ariaLabel="Provider dashboard sections"
            data-testid="provider-dashboard-tabs"
            tabs={tabs}
          />
        </div>

        {tab === "orders" ? (
          <ProviderOrdersBoard
            eftInstructions={eftPaymentInstructions}
            orders={orders}
            orderItemsByOrderId={Object.fromEntries(orderItemsByOrderId)}
          />
        ) : (
          <div className="space-y-4">
            <form
              action={updateProviderBusinessNameAction}
              className="panel"
              data-testid="provider-business-profile-form"
            >
              <h2 className="text-h3 text-ink">Business profile</h2>
              <p className="mt-1 text-body-sm text-black/60">
                This name shows on every listing card. Updating it here
                re-syncs all of your existing listings.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block flex-1 space-y-1">
                  <span className="label">Business / seller name</span>
                  <input
                    className="input"
                    data-testid="provider-business-name-edit-input"
                    defaultValue={providerProfile.business_name ?? ""}
                    maxLength={120}
                    name="business_name"
                    required
                  />
                </label>
                <button
                  className="btn-primary sm:w-auto"
                  data-testid="provider-business-name-save-button"
                  type="submit"
                >
                  Save name
                </button>
              </div>
            </form>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
              <CreateListingPanel
              categories={categories}
              defaultAddress={providerProfile.address}
              defaultSuburb={providerProfile.suburb}
              userId={userId}
              supabaseUrl={supabaseUrl}
            />

            <div className="panel" data-testid="provider-listings-panel">
              <h2 className="text-h3 text-ink">Your listings</h2>
              <div className="mt-4 space-y-3" data-testid="provider-listing-list">
                {listings.length ? (
                  listings.map((listing) => (
                    <div
                      className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-3 sm:flex-row sm:items-center"
                      data-testid="provider-listing-card"
                      key={listing.id}
                    >
                      <ListingImage
                        alt={listing.title}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md"
                        storagePath={listing.image_url}
                        testIdPrefix="provider-listing-image"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold">{listing.title}</p>
                          {listing.is_active ? null : (
                            <span
                              className="inline-flex items-center rounded-md bg-black/5 px-2 py-0.5 text-caption font-semibold text-black/60"
                              data-testid="provider-listing-inactive-badge"
                            >
                              Inactive
                            </span>
                          )}
                          {listing.admin_disabled ? (
                            <span
                              className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-caption font-semibold text-red-700"
                              data-testid="provider-listing-admin-disabled-badge"
                            >
                              Admin disabled
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-body-sm text-black/60">
                          {listing.suburb ?? "—"} · {formatMoney(listing.price)}
                        </p>
                      </div>
                      <Link
                        className="btn-secondary shrink-0"
                        data-testid="provider-listing-edit-link"
                        href={`/provider/listings/${listing.id}/edit`}
                      >
                        Edit
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-black/10 bg-white p-4 text-body-sm text-black/60">
                    Your new listings will appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}
      </section>
    </div>
  );
}

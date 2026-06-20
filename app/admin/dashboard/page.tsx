import { ArrowRight, ClipboardList, FileClock, Store, Truck, Wallet } from "lucide-react";
import Link from "next/link";

import {
  approveDriverAction,
  approveProviderAction,
  assignDriverAction,
  confirmEftPaymentAction,
  createDriverPayoutAction,
  createProviderPayoutAction,
  markPayoutPaidAction,
  rejectDriverAction,
  rejectProviderAction,
  updatePayoutReferencePrefixAction
} from "@/app/admin/dashboard/actions";
import { AdminPager } from "@/components/admin-pager";
import { OrderAgeChip } from "@/components/order-age-chip";
import { OrderCountdown } from "@/components/order-countdown";
import { OrderContactBlock } from "@/components/order-contact-block";
import { Segmented, type SegmentedTab } from "@/components/segmented";
import { StatusPill } from "@/components/status-pill";
import { requireRole } from "@/lib/auth";
import type {
  AdminSettingsRow,
  DocumentRow,
  DriverProfileRow,
  OrderRow,
  PayoutRow,
  ProviderProfileRow
} from "@/lib/database.types";
import { formatMoney, getGreeting } from "@/lib/format";
import {
  groupDriverPayables,
  type DriverPayoutOrder,
  type PaidPayoutItemLike
} from "@/lib/payouts";
import { pageCount, pageRange, readPageParam } from "@/lib/pagination";
import {
  DOCUMENT_LABEL_BY_TYPE,
  DRIVER_DOCUMENT_SLOTS,
  PROVIDER_DOCUMENT_SLOTS,
  type DocumentOwnerType,
  type DocumentType
} from "@/lib/storage";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AdminTab = "approvals" | "operations" | "payouts" | "settings";

function resolveAdminTab(value: string | undefined): AdminTab {
  if (value === "operations" || value === "payouts" || value === "settings") {
    return value;
  }
  return "approvals";
}

export const dynamic = "force-dynamic";

type AdminDashboardPageProps = {
  searchParams: Promise<{
    driver_assigned?: string;
    driver_approved?: string;
    driver_page?: string;
    driver_payout_created?: string;
    driver_rejected?: string;
    eft_confirmed?: string;
    error?: string;
    ops_page?: string;
    paid_page?: string;
    payout_created?: string;
    payout_paid?: string;
    prefix_updated?: string;
    provider_approved?: string;
    provider_page?: string;
    provider_rejected?: string;
    tab?: string;
  }>;
};

export default async function AdminDashboardPage({
  searchParams
}: AdminDashboardPageProps) {
  const params = await searchParams;
  const tab = resolveAdminTab(params.tab);
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const sbCookies = cookieStore
    .getAll()
    .filter((cookie) => cookie.name.startsWith("sb-"))
    .map((cookie) => cookie.name);
  console.log(
    "[admin] render tab=%s sbCookies=%s",
    tab,
    sbCookies.length ? sbCookies.join(",") : "none"
  );
  await requireRole(["admin"]);
  const supabase = await createSupabaseServerClient();

  // Paginated lists. Each follows the same shape: read page param → derive
  // the inclusive range → ask Supabase for the matching rows + count.
  const providerPage = readPageParam(params.provider_page);
  const driverPage = readPageParam(params.driver_page);
  const opsPage = readPageParam(params.ops_page);
  const paidPayoutsPage = readPageParam(params.paid_page);
  const [providerFrom, providerTo] = pageRange(providerPage);
  const [driverFrom, driverTo] = pageRange(driverPage);
  const [opsFrom, opsTo] = pageRange(opsPage);
  const [paidFrom, paidTo] = pageRange(paidPayoutsPage);

  const [
    { count: transactions },
    { count: auditLogs },
    { data: settings },
    { data: pendingProvidersData, count: pendingProvidersTotal },
    { data: pendingDriversData, count: pendingDriversTotal },
    { data: operationalOrdersData, count: opsOrdersTotal },
    { data: availableDriversData },
    { data: completedOrdersData },
    { data: payoutItemsData },
    { data: completedDriverOrdersData },
    { data: driverPendingPayoutsData },
    { data: driverPaidPayoutsData, count: paidPayoutsTotal },
    { data: driverProfilesForPayoutData }
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("admin_settings")
      .select("*")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("provider_profiles")
      .select("*", { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .range(providerFrom, providerTo),
    supabase
      .from("driver_profiles")
      .select("*", { count: "exact" })
      .eq("approval_status", "pending")
      .order("created_at", { ascending: true })
      .range(driverFrom, driverTo),
    // Operational orders: FIFO (oldest first) so the worst-stale order sits
    // at the top of the queue, with the buyer/provider/driver contact rows
    // joined inline so the admin can phone any participant from the card.
    supabase
      .from("orders")
      .select(
        `*,
         provider:provider_profiles!orders_provider_id_fkey (
           business_name,
           profile:profiles!provider_profiles_user_id_fkey ( full_name, phone )
         ),
         driver:driver_profiles!orders_driver_id_fkey (
           profile:profiles!driver_profiles_user_id_fkey ( full_name, phone )
         )`,
        { count: "exact" }
      )
      .not("status", "in", "(completed,cancelled)")
      .order("created_at", { ascending: true })
      .range(opsFrom, opsTo),
    supabase
      .from("driver_profiles")
      .select("*")
      .eq("approval_status", "approved")
      .eq("availability_status", "available")
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*")
      .eq("status", "completed")
      .eq("payment_status", "confirmed")
      .order("completed_at", { ascending: false })
      .limit(12),
    supabase.from("payout_items").select("order_id, recipient_type"),
    supabase
      .from("orders")
      .select(
        "id, driver_id, status, payment_status, delivery_fee, delivery_commission_amount, driver_earning, completed_at"
      )
      .eq("status", "completed")
      .eq("payment_status", "confirmed")
      .not("driver_id", "is", null),
    supabase
      .from("payouts")
      .select("*")
      .eq("recipient_type", "driver")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("payouts")
      .select("*", { count: "exact" })
      .eq("recipient_type", "driver")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .range(paidFrom, paidTo),
    supabase
      .from("driver_profiles")
      .select("id, user_id, profiles:user_id ( id, full_name, email )")
  ]);

  // The stat cards at the top of the page reuse the per-tab counts so we
  // don't pay for a second round trip to Supabase for the same numbers.
  const pendingProviders = pendingProvidersTotal ?? 0;
  const pendingDrivers = pendingDriversTotal ?? 0;
  const openOrders = opsOrdersTotal ?? 0;
  const providerPageCount = pageCount(pendingProvidersTotal);
  const driverPageCount = pageCount(pendingDriversTotal);
  const opsPageCount = pageCount(opsOrdersTotal);
  const paidPayoutsPageCount = pageCount(paidPayoutsTotal);

  // Pull every document attached to a currently-pending applicant so the
  // approval cards can render an inline list with View links + a missing-doc
  // hint. One round trip after the main Promise.all keeps the IN-list scoped
  // to user IDs we actually need.
  const pendingApplicantUserIds = Array.from(
    new Set([
      ...((pendingProvidersData ?? []) as ProviderProfileRow[]).map((p) => p.user_id),
      ...((pendingDriversData ?? []) as DriverProfileRow[]).map((d) => d.user_id)
    ])
  );
  let approvalDocumentsRaw: DocumentRow[] = [];
  if (pendingApplicantUserIds.length > 0) {
    const { data: docs } = await supabase
      .from("documents")
      .select("*")
      .in("owner_user_id", pendingApplicantUserIds);
    approvalDocumentsRaw = (docs ?? []) as DocumentRow[];
  }
  const approvalDocsByOwner = new Map<string, DocumentRow[]>();
  for (const doc of approvalDocumentsRaw) {
    const key = `${doc.owner_user_id}__${doc.owner_type}`;
    const list = approvalDocsByOwner.get(key) ?? [];
    list.push(doc);
    approvalDocsByOwner.set(key, list);
  }
  function getApprovalDocs(
    ownerUserId: string,
    ownerType: DocumentOwnerType
  ): DocumentRow[] {
    return approvalDocsByOwner.get(`${ownerUserId}__${ownerType}`) ?? [];
  }
  function getMissingRequiredDocs(
    docs: DocumentRow[],
    ownerType: DocumentOwnerType
  ): DocumentType[] {
    const slots =
      ownerType === "provider" ? PROVIDER_DOCUMENT_SLOTS : DRIVER_DOCUMENT_SLOTS;
    const submitted = new Set(docs.map((d) => d.document_type));
    return slots
      .filter((s) => s.required && !submitted.has(s.documentType))
      .map((s) => s.documentType);
  }

  const adminSettings = settings as AdminSettingsRow | null;
  const payoutRefPrefix = adminSettings?.payout_reference_prefix ?? "EFT-";
  const pendingProviderRows = (pendingProvidersData ?? []) as ProviderProfileRow[];
  const pendingDriverRows = (pendingDriversData ?? []) as DriverProfileRow[];
  // Operational orders carry inline provider/driver contact data (joined
  // server-side above) so the OrderContactBlock can render phone links
  // without an N+1 fetch.
  type AdminOrderRow = OrderRow & {
    provider: {
      business_name: string | null;
      profile: { full_name: string | null; phone: string | null } | null;
    } | null;
    driver: {
      profile: { full_name: string | null; phone: string | null } | null;
    } | null;
  };
  const operationalOrders = (operationalOrdersData ?? []) as unknown as AdminOrderRow[];
  const availableDrivers = (availableDriversData ?? []) as DriverProfileRow[];
  const payoutItems = (payoutItemsData ?? []) as PaidPayoutItemLike[];
  const providerPaidOrderIds = new Set(
    payoutItems.filter((i) => i.recipient_type === "provider").map((i) => i.order_id)
  );
  const payoutEligibleOrders = ((completedOrdersData ?? []) as OrderRow[]).filter(
    (order) => !providerPaidOrderIds.has(order.id)
  );

  // ---- Driver payouts -----------------------------------------------------
  // driver_profiles.id is what orders.driver_id references; we join through to
  // profiles for the name/email used in cards + emails. The query is shaped so
  // each row carries the embedded user profile inline.
  type DriverProfileForPayout = {
    id: string;
    user_id: string;
    profiles: { id: string; full_name: string | null; email: string | null } | null;
  };
  const driverProfileRows = (driverProfilesForPayoutData ??
    []) as unknown as DriverProfileForPayout[];
  const driverProfilesByProfileId = new Map<
    string,
    { user_id: string; full_name: string | null; email: string | null }
  >();
  const driverProfilesByUserId = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  for (const row of driverProfileRows) {
    driverProfilesByProfileId.set(row.id, {
      user_id: row.user_id,
      full_name: row.profiles?.full_name ?? null,
      email: row.profiles?.email ?? null
    });
    driverProfilesByUserId.set(row.user_id, {
      full_name: row.profiles?.full_name ?? null,
      email: row.profiles?.email ?? null
    });
  }
  const driverPayables = groupDriverPayables(
    (completedDriverOrdersData ?? []) as DriverPayoutOrder[],
    driverProfilesByProfileId,
    payoutItems,
    new Date().toISOString()
  );
  const pendingDriverPayouts = (driverPendingPayoutsData ?? []) as PayoutRow[];
  const paidDriverPayouts = (driverPaidPayoutsData ?? []) as PayoutRow[];
  const driversOwedCount = driverPayables.length + pendingDriverPayouts.length;
  const driverNameByUserId = (userId: string) => {
    const p = driverProfilesByUserId.get(userId);
    return p?.full_name ?? p?.email ?? "Driver";
  };

  return (
    <div className="bg-mist" data-testid="page-admin-dashboard">
      <section className="section-band">
        <div className="page-shell gap-4 py-6">
          {(() => {
            const pendingTotal = (pendingProviders ?? 0) + (pendingDrivers ?? 0);
            const hasPending = pendingTotal > 0;
            return (
              <div
                className={`border-l-4 pl-4 ${
                  hasPending ? "border-coral" : "border-brand"
                }`}
              >
                <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
                  {getGreeting()}, admin
                </p>
                {hasPending ? (
                  <div data-testid="admin-dashboard-greeting">
                    <Link
                      className="group mt-3 flex max-w-md items-center gap-4 rounded-2xl bg-coral p-4 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-coral focus:ring-offset-2"
                      data-testid="admin-dashboard-greeting-link"
                      href="/admin/dashboard#admin-approvals"
                    >
                      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-coral">
                        {pendingTotal}
                        <span className="absolute right-0 top-0 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                        </span>
                      </span>
                      <span className="flex-1 text-left">
                        <span className="block text-lg font-bold leading-tight">
                          {pendingTotal === 1 ? "Application to review" : "Applications to review"}
                        </span>
                        <span className="block text-sm text-white/85">
                          {(openOrders ?? 0) > 0
                            ? `Plus ${openOrders} open ${openOrders === 1 ? "order" : "orders"}`
                            : "Tap to triage approvals"}
                        </span>
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 transition group-hover:translate-x-1"
                      />
                    </Link>
                  </div>
                ) : (
                  <h1 className="mt-1 text-display-md text-brand" data-testid="admin-dashboard-greeting">
                    {(openOrders ?? 0) === 0
                      ? "All clear"
                      : `${openOrders} open ${openOrders === 1 ? "order" : "orders"}`}
                  </h1>
                )}
                <p className="mt-3 text-body-sm text-black/55">
                  Switch between approvals, operations, and platform settings.
                </p>
              </div>
            );
          })()}
          {params.eft_confirmed ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-eft-confirmed-message"
            >
              EFT confirmed and transaction records created.
            </div>
          ) : null}
          {params.provider_approved ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-provider-approved-message"
            >
              Provider approved.
            </div>
          ) : null}
          {params.provider_rejected ? (
            <div
              className="rounded-md border border-maize bg-maize/25 p-3 text-sm text-ink"
              data-testid="admin-provider-rejected-message"
            >
              Provider rejected.
            </div>
          ) : null}
          {params.driver_approved ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-driver-approved-message"
            >
              Driver approved.
            </div>
          ) : null}
          {params.driver_rejected ? (
            <div
              className="rounded-md border border-maize bg-maize/25 p-3 text-sm text-ink"
              data-testid="admin-driver-rejected-message"
            >
              Driver rejected.
            </div>
          ) : null}
          {params.driver_assigned ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-driver-assigned-message"
            >
              Driver assigned to order.
            </div>
          ) : null}
          {params.payout_created ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-payout-created-message"
            >
              Provider payout created.
            </div>
          ) : null}
          {params.driver_payout_created ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-driver-payout-created-message"
            >
              Driver payout created.
            </div>
          ) : null}
          {params.payout_paid ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-payout-paid-message"
            >
              Payout marked as paid. The driver has been emailed.
            </div>
          ) : null}
          {params.prefix_updated ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="admin-prefix-updated-message"
            >
              Payout reference prefix updated.
            </div>
          ) : null}
          {params.error ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              data-testid="admin-error-message"
            >
              {params.error}
            </div>
          ) : null}
        </div>
      </section>

      <section className="page-shell py-6">
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible"
          data-testid="admin-stat-strip"
        >
          <div className="panel-sky min-w-[160px] shrink-0 snap-start lg:min-w-0" data-testid="admin-pending-providers-card">
            <Store className="h-5 w-5 text-sky" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">{pendingProviders ?? 0}</p>
            <p className="text-body-sm text-black/60">Pending providers</p>
          </div>
          <div className="panel-iris min-w-[160px] shrink-0 snap-start lg:min-w-0" data-testid="admin-pending-drivers-card">
            <Truck className="h-5 w-5 text-iris" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">{pendingDrivers ?? 0}</p>
            <p className="text-body-sm text-black/60">Pending drivers</p>
          </div>
          <div className="panel-coral min-w-[160px] shrink-0 snap-start lg:min-w-0" data-testid="admin-open-orders-card">
            <ClipboardList className="h-5 w-5 text-coral" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">{openOrders ?? 0}</p>
            <p className="text-body-sm text-black/60">Open orders</p>
          </div>
          <div className="panel-sunset min-w-[160px] shrink-0 snap-start lg:min-w-0" data-testid="admin-transactions-card">
            <FileClock className="h-5 w-5 text-sunset" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">{transactions ?? 0}</p>
            <p className="text-body-sm text-black/60">Transactions</p>
          </div>
          <Link
            className="panel min-w-[160px] shrink-0 snap-start transition hover:border-leaf lg:min-w-0"
            data-testid="admin-audit-logs-card"
            href="/admin/audit-logs"
          >
            <FileClock className="h-5 w-5 text-black/55" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">{auditLogs ?? 0}</p>
            <p className="text-body-sm text-black/60">
              Audit logs <span aria-hidden="true">→</span>
            </p>
          </Link>
          <div className="panel-leaf min-w-[160px] shrink-0 snap-start lg:min-w-0" data-testid="admin-drivers-owed-card">
            <Wallet className="h-5 w-5 text-leaf" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">
              {formatMoney(driverPayables.reduce((sum, p) => sum + p.netAmount, 0))}
            </p>
            <p className="text-body-sm text-black/60">Owed to drivers</p>
          </div>
        </div>

        <div className="mt-6">
          <Segmented
            active={tab}
            ariaLabel="Admin sections"
            data-testid="admin-dashboard-tabs"
            tabs={[
              {
                value: "approvals",
                label: "Approvals",
                href: "/admin/dashboard",
                count: (pendingProviders ?? 0) + (pendingDrivers ?? 0)
              },
              {
                value: "operations",
                label: "Operations",
                href: "/admin/dashboard?tab=operations",
                count: openOrders ?? 0
              },
              {
                value: "payouts",
                label: "Payouts",
                href: "/admin/dashboard?tab=payouts",
                count: driversOwedCount
              },
              {
                value: "settings",
                label: "Settings",
                href: "/admin/dashboard?tab=settings"
              }
            ] satisfies SegmentedTab[]}
          />
        </div>

        {tab === "approvals" ? (
          <>
        {/* Anchor target for the greeting alert card. scroll-mt-20 keeps the
            header from covering the section when jumped to. */}
        <div className="dash-section dash-section-label scroll-mt-20" id="admin-approvals">
          <span className="label-text">Approvals</span>
          <span className="label-rule" />
          {(pendingProviders ?? 0) + (pendingDrivers ?? 0) > 0 && (
            <span className="label-count">
              {(pendingProviders ?? 0) + (pendingDrivers ?? 0)}
            </span>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel" data-testid="admin-provider-approvals-panel">
            <h2 className="text-base font-semibold">Provider approvals</h2>
            <div className="mt-4 space-y-3" data-testid="admin-provider-approval-list">
              {pendingProviderRows.length ? (
                pendingProviderRows.map((provider) => (
                  <div
                    className="rounded-lg border border-black/10 bg-white p-4"
                    data-testid="admin-provider-approval-card"
                    key={provider.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-black/50">
                          Provider {provider.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 font-semibold">
                          {provider.business_name ?? "Provider application"}
                        </p>
                        <p className="mt-1 text-sm text-black/60">
                          {provider.suburb ?? "—"} · {provider.provider_type ?? "individual"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                        <OrderAgeChip
                          createdAt={provider.created_at}
                          testIdPrefix={`admin-provider-${provider.id.slice(0, 8)}`}
                        />
                        <StatusPill status={provider.status} />
                      </div>
                    </div>
                    {(() => {
                      const docs = getApprovalDocs(provider.user_id, "provider");
                      const missing = getMissingRequiredDocs(docs, "provider");
                      return (
                        <div className="mt-3" data-testid="admin-approval-documents-section">
                          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                            Documents
                          </p>
                          {docs.length ? (
                            <ul
                              className="mt-1 space-y-1 text-sm"
                              data-testid="admin-approval-documents-list"
                            >
                              {docs.map((doc) => (
                                <li
                                  key={doc.id}
                                  className="flex items-center justify-between gap-3"
                                  data-testid="admin-approval-document-row"
                                >
                                  <span>
                                    {DOCUMENT_LABEL_BY_TYPE[doc.document_type as DocumentType] ?? doc.document_type}
                                  </span>
                                  <a
                                    className="text-leaf font-semibold hover:underline"
                                    data-testid="admin-approval-document-view-link"
                                    href={`/admin/documents/${doc.id}/view`}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    View
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-black/55">
                              No documents uploaded yet.
                            </p>
                          )}
                          {missing.length ? (
                            <p
                              className="mt-2 text-xs text-clay"
                              data-testid="admin-approval-documents-missing-hint"
                            >
                              Missing:{" "}
                              {missing
                                .map((t) => DOCUMENT_LABEL_BY_TYPE[t])
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                    <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                      <form action={approveProviderAction}>
                        <input name="provider_profile_id" type="hidden" value={provider.id} />
                        <button
                          className="btn-primary w-full sm:w-auto"
                          data-testid="admin-approve-provider-button"
                          type="submit"
                        >
                          Approve
                        </button>
                      </form>
                      <form
                        action={rejectProviderAction}
                        className="grid gap-2 sm:col-span-2 sm:grid-cols-[1fr_auto]"
                      >
                        <input name="provider_profile_id" type="hidden" value={provider.id} />
                        <input
                          className="input"
                          data-testid="admin-provider-rejection-reason-input"
                          name="rejection_reason"
                          placeholder="Reason"
                        />
                        <button
                          className="btn-secondary"
                          data-testid="admin-reject-provider-button"
                          type="submit"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60">
                  No provider applications are waiting for review.
                </div>
              )}
            </div>
            <AdminPager
              basePath="/admin/dashboard"
              currentPage={providerPage}
              pageCount={providerPageCount}
              pageParam="provider_page"
              preserveParams={{ tab: "approvals" }}
              testIdPrefix="admin-provider-pager"
            />
          </div>

          <div className="panel" data-testid="admin-driver-approvals-panel">
            <h2 className="text-base font-semibold">Driver approvals</h2>
            <div className="mt-4 space-y-3" data-testid="admin-driver-approval-list">
              {pendingDriverRows.length ? (
                pendingDriverRows.map((driver) => (
                  <div
                    className="rounded-lg border border-black/10 bg-white p-4"
                    data-testid="admin-driver-approval-card"
                    key={driver.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-black/50">
                          Driver {driver.id.slice(0, 8)}
                        </p>
                        <p className="mt-1 font-semibold">
                          {driver.vehicle_type ?? "Driver application"}
                        </p>
                        <p className="mt-1 text-sm text-black/60">
                          {driver.vehicle_licence_number ?? "Licence pending"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                        <OrderAgeChip
                          createdAt={driver.created_at}
                          testIdPrefix={`admin-driver-${driver.id.slice(0, 8)}`}
                        />
                        <StatusPill status={driver.approval_status} />
                      </div>
                    </div>
                    {(() => {
                      const docs = getApprovalDocs(driver.user_id, "driver");
                      const missing = getMissingRequiredDocs(docs, "driver");
                      return (
                        <div className="mt-3" data-testid="admin-approval-documents-section">
                          <p className="text-xs font-semibold uppercase tracking-wide text-black/45">
                            Documents
                          </p>
                          {docs.length ? (
                            <ul
                              className="mt-1 space-y-1 text-sm"
                              data-testid="admin-approval-documents-list"
                            >
                              {docs.map((doc) => (
                                <li
                                  key={doc.id}
                                  className="flex items-center justify-between gap-3"
                                  data-testid="admin-approval-document-row"
                                >
                                  <span>
                                    {DOCUMENT_LABEL_BY_TYPE[doc.document_type as DocumentType] ?? doc.document_type}
                                  </span>
                                  <a
                                    className="text-leaf font-semibold hover:underline"
                                    data-testid="admin-approval-document-view-link"
                                    href={`/admin/documents/${doc.id}/view`}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    View
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-sm text-black/55">
                              No documents uploaded yet.
                            </p>
                          )}
                          {missing.length ? (
                            <p
                              className="mt-2 text-xs text-clay"
                              data-testid="admin-approval-documents-missing-hint"
                            >
                              Missing:{" "}
                              {missing
                                .map((t) => DOCUMENT_LABEL_BY_TYPE[t])
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                      );
                    })()}
                    <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_auto]">
                      <form action={approveDriverAction}>
                        <input name="driver_profile_id" type="hidden" value={driver.id} />
                        <button
                          className="btn-primary w-full sm:w-auto"
                          data-testid="admin-approve-driver-button"
                          type="submit"
                        >
                          Approve
                        </button>
                      </form>
                      <form
                        action={rejectDriverAction}
                        className="grid gap-2 sm:col-span-2 sm:grid-cols-[1fr_auto]"
                      >
                        <input name="driver_profile_id" type="hidden" value={driver.id} />
                        <input
                          className="input"
                          data-testid="admin-driver-rejection-reason-input"
                          name="rejection_reason"
                          placeholder="Reason"
                        />
                        <button
                          className="btn-secondary"
                          data-testid="admin-reject-driver-button"
                          type="submit"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60">
                  No driver applications are waiting for review.
                </div>
              )}
            </div>
            <AdminPager
              basePath="/admin/dashboard"
              currentPage={driverPage}
              pageCount={driverPageCount}
              pageParam="driver_page"
              preserveParams={{ tab: "approvals" }}
              testIdPrefix="admin-driver-pager"
            />
          </div>
        </div>

          </>
        ) : null}
        {tab === "operations" ? (
          <>
        <div className="dash-section dash-section-label">
          <span className="label-text">Orders &amp; payouts</span>
          <span className="label-rule" />
          {(openOrders ?? 0) > 0 && (
            <span className="label-count">{openOrders}</span>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="panel" data-testid="admin-operational-orders-panel">
            <h2 className="text-base font-semibold">Operational orders</h2>
            <div className="mt-4 space-y-3" data-testid="admin-order-list">
              {operationalOrders.length ? (
                operationalOrders.map((order) => {
                  const canConfirmEft = [
                    "awaiting_buyer_eft",
                    "eft_submitted"
                  ].includes(order.payment_status);
                  const canAssignDriver =
                    order.payment_status === "confirmed" && !order.driver_id;

                  return (
                    <div
                      className="rounded-lg border border-black/10 bg-white p-4"
                      data-testid="admin-order-card"
                      key={order.id}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm text-black/50">Order {order.id.slice(0, 8)}</p>
                          <p className="mt-1 text-sm text-black/60">
                            {formatMoney(order.buyer_total)} · Delivery {formatMoney(order.delivery_fee)} · Payment {order.payment_status.replaceAll("_", " ")}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                          {order.eft_confirm_due_at &&
                          order.payment_status === "eft_submitted" ? (
                            <OrderCountdown
                              data-testid={`admin-order-${order.id.slice(0, 8)}-eft-countdown`}
                              deadline={order.eft_confirm_due_at}
                              label="Confirm EFT in"
                              size="sm"
                            />
                          ) : null}
                          {order.driver_assign_due_at &&
                          order.payment_status === "confirmed" &&
                          !order.driver_id ? (
                            <OrderCountdown
                              data-testid={`admin-order-${order.id.slice(0, 8)}-driver-countdown`}
                              deadline={order.driver_assign_due_at}
                              label="Assign in"
                              size="sm"
                            />
                          ) : null}
                          <OrderAgeChip
                            createdAt={order.created_at}
                            testIdPrefix={`admin-order-${order.id.slice(0, 8)}`}
                          />
                          <StatusPill status={order.status} />
                        </div>
                      </div>

                      <OrderContactBlock
                        buyer={{
                          name: order.buyer_name,
                          phone: order.buyer_phone,
                          email: order.buyer_email,
                          deliveryAddress: order.delivery_address ?? null
                        }}
                        provider={
                          order.provider
                            ? {
                                name:
                                  order.provider.business_name ??
                                  order.provider.profile?.full_name ??
                                  "Provider",
                                phone: order.provider.profile?.phone ?? null
                              }
                            : null
                        }
                        driver={
                          order.driver
                            ? {
                                name:
                                  order.driver.profile?.full_name ??
                                  (order.driver_id ? order.driver_id.slice(0, 8) : "Driver"),
                                phone: order.driver.profile?.phone ?? null
                              }
                            : null
                        }
                        testIdPrefix={`admin-order-${order.id.slice(0, 8)}-contacts`}
                      />

                      {canConfirmEft ? (
                        <form
                          action={confirmEftPaymentAction}
                          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
                          data-testid="admin-confirm-eft-form"
                        >
                          <input name="order_id" type="hidden" value={order.id} />
                          <label className="space-y-1">
                            <span className="label">Payment reference</span>
                            <input
                              className="input"
                              data-testid="admin-payment-reference-input"
                              defaultValue={`EFT-${order.id.slice(0, 8)}`}
                              name="payment_reference"
                              required
                            />
                          </label>
                          <button
                            className="btn-primary self-end"
                            data-testid="admin-confirm-eft-button"
                            type="submit"
                          >
                            Confirm EFT
                          </button>
                        </form>
                      ) : null}

                      {canAssignDriver ? (
                        <form
                          action={assignDriverAction}
                          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
                          data-testid="admin-assign-driver-form"
                        >
                          <input name="order_id" type="hidden" value={order.id} />
                          <label className="space-y-1">
                            <span className="label">Driver</span>
                            <select
                              className="input"
                              data-testid="admin-assign-driver-select"
                              disabled={!availableDrivers.length}
                              name="driver_id"
                              required
                            >
                              <option value="">Select driver</option>
                              {availableDrivers.map((driver) => (
                                <option key={driver.id} value={driver.id}>
                                  {driver.vehicle_type ?? "Driver"} · {driver.id.slice(0, 8)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="btn-primary self-end"
                            data-testid="admin-assign-driver-button"
                            disabled={!availableDrivers.length}
                            type="submit"
                          >
                            Assign
                          </button>
                        </form>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60">
                  No active orders need admin attention.
                </div>
              )}
            </div>
            <AdminPager
              basePath="/admin/dashboard"
              currentPage={opsPage}
              pageCount={opsPageCount}
              pageParam="ops_page"
              preserveParams={{ tab: "operations" }}
              testIdPrefix="admin-ops-pager"
            />
          </div>

          <div className="panel" data-testid="admin-payouts-panel">
            <h2 className="text-base font-semibold">Payout eligible</h2>
            <div className="mt-4 space-y-3" data-testid="admin-payout-list">
              {payoutEligibleOrders.length ? (
                payoutEligibleOrders.map((order) => (
                  <div
                    className="rounded-lg border border-black/10 bg-white p-4"
                    data-testid="admin-payout-card"
                    key={order.id}
                  >
                    <p className="text-sm text-black/50">Order {order.id.slice(0, 8)}</p>
                    <p className="mt-1 font-semibold">{formatMoney(order.provider_earning)}</p>
                    <p className="mt-1 text-sm text-black/60">
                      Provider earning ready for payout.
                    </p>
                    <form action={createProviderPayoutAction} className="mt-4">
                      <input name="order_id" type="hidden" value={order.id} />
                      <button
                        className="btn-primary w-full"
                        data-testid="admin-create-payout-button"
                        type="submit"
                      >
                        Create payout
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60">
                  Completed paid orders will appear here once they are payout eligible.
                </div>
              )}
            </div>
          </div>
        </div>

          </>
        ) : null}
        {tab === "payouts" ? (
          <>
        <div className="dash-section dash-section-label">
          <span className="label-text">Driver payouts</span>
          <span className="label-rule" />
          {driversOwedCount > 0 && (
            <span className="label-count">{driversOwedCount}</span>
          )}
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="panel" data-testid="admin-driver-payable-panel">
            <h2 className="text-base font-semibold">Owed to drivers</h2>
            <p className="mt-1 text-body-sm text-black/55">
              Each card sweeps every completed delivery for that driver into one
              weekly payout. The platform keeps 8% of the delivery fee.
            </p>
            <div className="mt-4 space-y-3" data-testid="admin-driver-payable-list">
              {driverPayables.length ? (
                driverPayables.map((payable) => (
                  <div
                    className="rounded-lg border border-black/10 bg-white p-4"
                    data-testid="admin-driver-payable-card"
                    key={payable.driverProfileId}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-black/50">
                          Driver {payable.driverProfileId.slice(0, 8)}
                        </p>
                        <p className="mt-1 font-semibold">{payable.driverName}</p>
                        <p className="mt-1 text-sm text-black/60">
                          {payable.orderCount}{" "}
                          {payable.orderCount === 1 ? "delivery" : "deliveries"} ·{" "}
                          {payable.periodStart} → {payable.periodEnd}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-semibold text-leaf">
                          {formatMoney(payable.netAmount)}
                        </p>
                        <p className="text-xs text-black/55">
                          of {formatMoney(payable.grossAmount)} fee · 8% kept
                        </p>
                      </div>
                    </div>
                    <form action={createDriverPayoutAction} className="mt-4">
                      <input
                        name="driver_profile_id"
                        type="hidden"
                        value={payable.driverProfileId}
                      />
                      <button
                        className="btn-primary w-full"
                        data-testid="admin-create-driver-payout-button"
                        type="submit"
                      >
                        Create payout — {formatMoney(payable.netAmount)}
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <div
                  className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60"
                  data-testid="admin-driver-payable-empty"
                >
                  No drivers are currently owed money. Completed deliveries appear
                  here once payment has been confirmed.
                </div>
              )}
            </div>
          </div>

          <div className="panel" data-testid="admin-driver-pending-payouts-panel">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">Awaiting payout</h2>
                <p className="mt-1 text-body-sm text-black/55">
                  Pay the driver via bank transfer, then enter the bank
                  reference to close the loop. The driver gets an email.
                </p>
              </div>
              {pendingDriverPayouts.length ? (
                <a
                  className="btn-secondary shrink-0"
                  data-testid="admin-driver-pending-payouts-export"
                  href="/admin/payouts/export.csv?type=driver&status=pending"
                >
                  Export
                </a>
              ) : null}
            </div>
            <div
              className="mt-4 space-y-3"
              data-testid="admin-driver-pending-payouts-list"
            >
              {pendingDriverPayouts.length ? (
                pendingDriverPayouts.map((payout) => (
                  <div
                    className="rounded-lg border border-black/10 bg-white p-4"
                    data-testid="admin-driver-pending-payout-card"
                    key={payout.id}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-black/50">
                          Ref {payout.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="mt-1 font-semibold">
                          {driverNameByUserId(payout.recipient_user_id)}
                        </p>
                        <p className="mt-1 text-sm text-black/60">
                          {payout.period_start} → {payout.period_end}
                        </p>
                      </div>
                      <p className="text-2xl font-semibold text-leaf">
                        {formatMoney(payout.net_amount)}
                      </p>
                    </div>
                    <form
                      action={markPayoutPaidAction}
                      className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
                      data-testid="admin-mark-payout-paid-form"
                    >
                      <input name="payout_id" type="hidden" value={payout.id} />
                      <label className="space-y-1">
                        <span className="label">Bank reference</span>
                        <input
                          className="input"
                          data-testid="admin-payout-reference-input"
                          defaultValue={`${payoutRefPrefix}${payout.id.slice(0, 8).toUpperCase()}`}
                          name="payment_reference"
                          required
                        />
                      </label>
                      <button
                        className="btn-primary self-end"
                        data-testid="admin-mark-payout-paid-button"
                        type="submit"
                      >
                        Mark as paid
                      </button>
                    </form>
                  </div>
                ))
              ) : (
                <div
                  className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60"
                  data-testid="admin-driver-pending-payouts-empty"
                >
                  No driver payouts are awaiting EFT.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 panel" data-testid="admin-driver-paid-history-panel">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Paid driver payouts</h2>
              <p className="mt-1 text-body-sm text-black/55">
                {paidPayoutsTotal ?? 0}{" "}
                {(paidPayoutsTotal ?? 0) === 1 ? "payout" : "payouts"} on record · page{" "}
                {paidPayoutsPage} of {paidPayoutsPageCount}
              </p>
            </div>
            <div className="flex gap-2">
              <a
                className="btn-secondary"
                data-testid="admin-driver-paid-history-export"
                href="/admin/payouts/export.csv?type=driver&status=paid"
              >
                Export CSV
              </a>
            </div>
          </div>
          <div
            className="mt-4 grid gap-3 sm:grid-cols-2"
            data-testid="admin-driver-paid-history-list"
          >
            {paidDriverPayouts.length ? (
              paidDriverPayouts.map((payout) => (
                <div
                  className="rounded-lg border border-black/10 bg-white p-4"
                  data-testid="admin-driver-paid-history-card"
                  key={payout.id}
                >
                  <p className="text-sm text-black/50">
                    Ref {payout.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-1 font-semibold">
                    {driverNameByUserId(payout.recipient_user_id)}
                  </p>
                  <p className="mt-1 text-sm text-black/60">
                    {formatMoney(payout.net_amount)} · paid{" "}
                    {payout.paid_at ? payout.paid_at.slice(0, 10) : "—"}
                  </p>
                  <p className="mt-1 text-xs text-black/50">
                    {payout.payment_reference ?? "no ref"}
                  </p>
                </div>
              ))
            ) : (
              <div
                className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60"
                data-testid="admin-driver-paid-history-empty"
              >
                {paidPayoutsPage > 1
                  ? "No payouts on this page — go back."
                  : "Paid driver payouts will appear here."}
              </div>
            )}
          </div>
          <AdminPager
            basePath="/admin/dashboard"
            currentPage={paidPayoutsPage}
            pageCount={paidPayoutsPageCount}
            pageParam="paid_page"
            preserveParams={{ tab: "payouts" }}
            testIdPrefix="admin-driver-paid-history-pager"
          />
        </div>
          </>
        ) : null}
        {tab === "settings" ? (
          <>
        <div className="dash-section dash-section-label">
          <span className="label-text">Platform settings</span>
          <span className="label-rule" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="panel" data-testid="admin-financial-defaults-card">
            <h2 className="text-base font-semibold">Financial defaults</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-black/60">Commission</dt>
                <dd className="font-semibold">
                  {adminSettings?.commission_percentage ?? "12"}%
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-black/60">Driver base rate</dt>
                <dd className="font-semibold">
                  {formatMoney(adminSettings?.driver_base_rate ?? 36)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-black/60">Provider payout day</dt>
                <dd className="font-semibold">
                  {adminSettings?.provider_payout_day ?? "Wednesday"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-black/60">Delivery commission</dt>
                <dd className="font-semibold">
                  {adminSettings?.delivery_commission_percentage ?? "8"}%
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-black/60">Driver payout day</dt>
                <dd className="font-semibold">
                  {adminSettings?.driver_payout_day ?? "Monday"}
                </dd>
              </div>
            </dl>
          </div>
          <div className="panel" data-testid="admin-payout-reference-prefix-card">
            <h2 className="text-base font-semibold">Payout reference prefix</h2>
            <p className="mt-1 text-body-sm text-black/55">
              Used to auto-fill the bank reference when you mark a payout paid.
              Current default:{" "}
              <span className="font-mono">{payoutRefPrefix}A1B2C3D4</span>
            </p>
            <form
              action={updatePayoutReferencePrefixAction}
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
              data-testid="admin-payout-prefix-form"
            >
              <label className="space-y-1">
                <span className="label">Prefix (max 20 chars)</span>
                <input
                  className="input"
                  data-testid="admin-payout-prefix-input"
                  defaultValue={payoutRefPrefix}
                  maxLength={20}
                  name="payout_reference_prefix"
                />
              </label>
              <button
                className="btn-primary self-end"
                data-testid="admin-payout-prefix-save-button"
                type="submit"
              >
                Save
              </button>
            </form>
            <p className="mt-3 text-xs text-black/50">
              e.g. <span className="font-mono">FNB-</span>,{" "}
              <span className="font-mono">CAPITEC-2026-</span>, or leave as{" "}
              <span className="font-mono">EFT-</span>.
            </p>
          </div>
          <div className="panel">
            <h2 className="text-base font-semibold">Next admin actions</h2>
            <div className="mt-4 space-y-2 text-sm text-black/60">
              <p>Approve or reject provider applications.</p>
              <p>Approve or reject driver applications.</p>
              <p>Confirm EFT payments only after provider acceptance.</p>
              <p>Assign approved drivers and mark weekly payouts paid.</p>
            </div>
          </div>
        </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

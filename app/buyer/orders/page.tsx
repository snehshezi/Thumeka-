import { ArrowRight, CheckCircle2, Clock, MessageCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { markEftSubmittedAction } from "@/app/buyer/orders/actions";

import { CartClearOnMount } from "@/components/cart-clear-on-mount";
import { EmptyState } from "@/components/empty-state";
import { InstallPwaNudge } from "@/components/install-pwa-nudge";
import { OrderCountdown } from "@/components/order-countdown";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { Segmented, type SegmentedTab } from "@/components/segmented";
import { StatusPill } from "@/components/status-pill";
import { SubmittingButton } from "@/components/submitting-button";
import { WhatsappHelpPill } from "@/components/whatsapp-help-pill";
import { requireRole } from "@/lib/auth";
import type { AdminSettingsRow, OrderRow } from "@/lib/database.types";
import { formatMoney, getGreeting } from "@/lib/format";
import {
  canBuyerSeeEftInstructions,
  type OrderRuleStatus,
  type PaymentStatus,
  paymentStatusLabelForBuyer
} from "@/lib/order-rules";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createWhatsAppUrl } from "@/lib/support";
import { buildPaymentProofMessage } from "@/lib/whatsapp-message";

export const dynamic = "force-dynamic";

type Filter = "all" | "active" | "closed";

const CLOSED_STATUSES = new Set<string>(["completed", "cancelled", "provider_rejected"]);

function resolveFilter(value: string | undefined): Filter {
  if (value === "active" || value === "closed") return value;
  return "all";
}

function bucketOf(status: string): Filter {
  return CLOSED_STATUSES.has(status) ? "closed" : "active";
}

type BuyerOrdersPageProps = {
  searchParams: Promise<{
    created?: string;
    error?: string;
    pop_marked?: string;
    status?: string;
    clear_cart?: string;
  }>;
};

/** Payment statuses where the buyer needs to send a proof of payment. */
const POP_STATUSES = new Set<string>(["awaiting_buyer_eft", "eft_submitted"]);

export default async function BuyerOrdersPage({ searchParams }: BuyerOrdersPageProps) {
  const params = await searchParams;
  const filter = resolveFilter(params.status);
  const { profile } = await requireRole(["buyer"]);
  const supabase = await createSupabaseServerClient();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", profile.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("admin_settings")
      .select("eft_payment_instructions")
      .limit(1)
      .maybeSingle()
  ]);
  const orders = (data ?? []) as OrderRow[];
  const eftPaymentInstructions = (settings as Pick<
    AdminSettingsRow,
    "eft_payment_instructions"
  > | null)?.eft_payment_instructions;

  const counts = orders.reduce(
    (acc, order) => {
      const bucket = bucketOf(order.status);
      acc[bucket] += 1;
      acc.all += 1;
      return acc;
    },
    { all: 0, active: 0, closed: 0 } as Record<Filter, number>
  );

  const visibleOrders = orders.filter((order) =>
    filter === "all" ? true : bucketOf(order.status) === filter
  );

  const displayName = profile.full_name?.split(" ")[0] ?? "there";
  const tabs: SegmentedTab[] = [
    { value: "all", label: "All", href: "/buyer/orders", count: counts.all },
    { value: "active", label: "Active", href: "/buyer/orders?status=active", count: counts.active },
    { value: "closed", label: "Closed", href: "/buyer/orders?status=closed", count: counts.closed }
  ];

  return (
    <div className="bg-mist" data-testid="page-buyer-orders">
      {/* useSearchParams in the child needs a Suspense boundary at the
          server-component layer. */}
      <Suspense fallback={null}>
        <CartClearOnMount />
      </Suspense>
      <section className="section-band">
        <div className="page-shell gap-4 py-6">
          <div className="border-l-4 border-sky pl-4">
            <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
              {getGreeting()}, {displayName}
            </p>
            {counts.active === 0 ? (
              <h1 className="mt-1 text-display-md text-sky" data-testid="buyer-orders-greeting">
                No active orders right now
              </h1>
            ) : (
              <h1 className="mt-1 text-display-md" data-testid="buyer-orders-greeting">
                <Link
                  className="inline-flex items-center gap-2 text-sky underline decoration-sky/30 decoration-2 underline-offset-4 transition hover:decoration-sky focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2 rounded-sm"
                  data-testid="buyer-orders-greeting-link"
                  href="/buyer/orders?status=active"
                >
                  {counts.active} active {counts.active === 1 ? "order" : "orders"}
                  <ArrowRight className="h-6 w-6" aria-hidden="true" />
                </Link>
              </h1>
            )}
            <p className="mt-2 text-body-sm text-black/55">
              Your orders, in one place. We&apos;ll let you know the moment a
              seller accepts.
            </p>
          </div>
          {params.created ? (
            <div className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf">
              Order placed. We&apos;ll show payment details as soon as the
              seller accepts.
            </div>
          ) : null}
          {params.pop_marked ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="buyer-pop-marked-message"
            >
              Proof of payment marked as sent. Admin will confirm and unlock
              your order shortly.
            </div>
          ) : null}
          {params.error ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              data-testid="buyer-orders-error-message"
            >
              {params.error}
            </div>
          ) : null}
          <PushNotificationPrompt role="buyer" />
          <InstallPwaNudge />
        </div>
      </section>

      <section className="page-shell py-6">
        {/* Two round tile shortcuts to Active / Closed filters. Sit side-by-
            side on every viewport so mobile users get one-tap access. */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-sky/20 bg-white p-4 shadow-soft transition hover:border-sky hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2"
            data-testid="buyer-orders-active-tile"
            href="/buyer/orders?status=active"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky/10 text-sky transition group-hover:bg-sky group-hover:text-white">
              <Clock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">{counts.active}</p>
              <p className="mt-1 text-body-sm text-black/60">Active</p>
            </div>
          </Link>
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-leaf/20 bg-white p-4 shadow-soft transition hover:border-leaf hover:shadow-md focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2"
            data-testid="buyer-orders-closed-tile"
            href="/buyer/orders?status=closed"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf/10 text-leaf transition group-hover:bg-leaf group-hover:text-white">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">{counts.closed}</p>
              <p className="mt-1 text-body-sm text-black/60">Closed</p>
            </div>
          </Link>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            active={filter}
            ariaLabel="Filter orders"
            data-testid="buyer-orders-filter"
            tabs={tabs}
          />
          <Link
            className="btn-secondary py-1.5 text-xs sm:py-2"
            data-testid="buyer-orders-browse-link"
            href="/listings"
          >
            Browse listings
          </Link>
        </div>

        {visibleOrders.length ? (
          <div className="space-y-3">
            {visibleOrders.map((order) => (
              <div
                className="rounded-xl border border-black/8 bg-white p-4 shadow-soft transition hover:border-leaf/40 hover:shadow-md"
                data-testid="buyer-order-card"
                key={order.id}
              >
                {/* Tappable header — wrapped in a Link so the whole card
                    summary navigates to the detail page. The EFT / POP /
                    Expired panels below stay outside the Link to keep their
                    own forms + anchors valid. */}
                <Link
                  className="-m-4 mb-0 block rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2"
                  data-testid="buyer-order-card-link"
                  href={`/buyer/orders/${order.id}`}
                >
                  {/* Top row: status + countdown + date */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={order.status} />
                      {order.expires_at &&
                      order.status === "order_requested" ? (
                        <OrderCountdown
                          data-testid="buyer-order-acceptance-countdown"
                          deadline={order.expires_at}
                          label="Seller has"
                          size="sm"
                          startedAt={order.created_at}
                        />
                      ) : null}
                      {order.eft_confirm_due_at &&
                      order.payment_status === "eft_submitted" ? (
                        <OrderCountdown
                          data-testid="buyer-order-eft-confirm-countdown"
                          deadline={order.eft_confirm_due_at}
                          label="Admin confirms in"
                          size="sm"
                        />
                      ) : null}
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-caption text-black/40">
                      <time>
                        {new Date(order.created_at).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric"
                        })}
                      </time>
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  {/* Amount */}
                  <p className="mt-3 text-xl font-bold text-ink">
                    {formatMoney(order.buyer_total)}
                  </p>

                  {/* Details */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-black/55">
                    <span>{order.suburb ?? "—"}</span>
                    <span aria-hidden="true">·</span>
                    <span data-testid="buyer-order-payment-status">
                      {paymentStatusLabelForBuyer(
                        order.payment_status as PaymentStatus
                      )}
                    </span>
                  </div>

                  {/* Reference */}
                  <p className="mt-2 font-mono text-caption text-black/30">
                    #{order.id.slice(0, 8)}
                  </p>
                </Link>

                {/* EFT instructions */}
                {canBuyerSeeEftInstructions(
                  {
                    status: order.status as OrderRuleStatus,
                    payment_status: order.payment_status as PaymentStatus
                  },
                  eftPaymentInstructions
                ) ? (
                  <div
                    className="mt-4 rounded-lg border border-leaf/20 bg-mint p-3 text-body-sm"
                    data-testid="buyer-order-eft-instructions"
                  >
                    <p className="font-semibold text-leaf">Payment instructions</p>
                    <p className="mt-1 text-leaf/80">{eftPaymentInstructions}</p>
                    <p className="mt-2 font-mono text-caption font-medium text-leaf/60">
                      Reference: {order.id.slice(0, 8)}
                    </p>
                  </div>
                ) : null}

                {/* WhatsApp proof-of-payment CTA — opens chat with the
                    support number with a pre-filled message containing the
                    order ref, total, and buyer name. */}
                {POP_STATUSES.has(order.payment_status)
                  ? (() => {
                      const whatsappUrl = createWhatsAppUrl(
                        buildPaymentProofMessage({
                          id: order.id,
                          buyer_name: order.buyer_name,
                          buyer_total: order.buyer_total
                        })
                      );
                      return (
                        <div
                          className="mt-4 rounded-lg border border-sky/30 bg-sky/5 p-3"
                          data-testid="buyer-order-pop-panel"
                        >
                          <p className="text-body-sm font-semibold text-sky">
                            Send your proof of payment
                          </p>
                          <p className="mt-1 text-caption text-sky/85">
                            Once we receive it, your order is approved within
                            minutes.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {whatsappUrl ? (
                              <Link
                                className="btn-primary inline-flex items-center gap-2"
                                data-testid="buyer-order-pop-whatsapp-link"
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <MessageCircle
                                  aria-hidden="true"
                                  className="h-4 w-4"
                                />
                                Open WhatsApp
                              </Link>
                            ) : (
                              <p
                                className="text-caption text-sky/70"
                                data-testid="buyer-order-pop-fallback"
                              >
                                Email your proof to{" "}
                                <a
                                  className="font-semibold underline"
                                  href="mailto:admin@thumeka.co.za"
                                >
                                  admin@thumeka.co.za
                                </a>
                                .
                              </p>
                            )}
                            {/* The "I sent it" form is what flips the order
                                to eft_submitted and starts the admin's
                                countdown. Only shown for awaiting_buyer_eft
                                — once submitted, the panel updates next
                                refresh. */}
                            {order.payment_status === "awaiting_buyer_eft" ? (
                              <form action={markEftSubmittedAction}>
                                <input
                                  name="order_id"
                                  type="hidden"
                                  value={order.id}
                                />
                                <SubmittingButton
                                  busyLabel="Sending…"
                                  className="btn-secondary"
                                  data-testid="buyer-order-mark-pop-sent-button"
                                >
                                  I sent the proof
                                </SubmittingButton>
                              </form>
                            ) : (
                              <span
                                className="text-caption text-sky/70"
                                data-testid="buyer-order-pop-submitted-note"
                              >
                                We&apos;re verifying your payment — you&apos;ll
                                get a notification when it&apos;s confirmed.
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  : null}

                {/* Expired panel — for orders the cron flipped to
                    `expired` because the provider didn't respond in
                    time. */}
                {order.status === "expired" ? (
                  <div
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3"
                    data-testid="buyer-order-expired-panel"
                  >
                    <p className="flex items-center gap-2 text-body-sm font-semibold text-red-700">
                      <XCircle aria-hidden="true" className="h-4 w-4" />
                      Seller didn&apos;t respond in time
                    </p>
                    <p className="mt-1 text-caption text-red-700/85">
                      This order expired. Browse alternatives — other open
                      sellers should respond faster.
                    </p>
                    <Link
                      className="btn-primary mt-3 inline-flex items-center gap-2"
                      data-testid="buyer-order-expired-browse-link"
                      href="/listings"
                    >
                      Browse listings
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            body={
              filter === "all"
                ? "You haven't ordered anything yet. Browse the marketplace — your money stays safe until the seller accepts."
                : filter === "active"
                  ? "No active orders. Browse listings to start one."
                  : "Nothing here yet — completed and cancelled orders will land here."
            }
            title={filter === "all" ? "No orders yet" : `No ${filter} orders`}
          />
        )}
      </section>
      <WhatsappHelpPill />
    </div>
  );
}

import { ArrowLeft, CheckCircle2, Clock, MessageCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { markEftSubmittedAction } from "@/app/buyer/orders/actions";
import { OrderCountdown } from "@/components/order-countdown";
import { StatusPill } from "@/components/status-pill";
import { SubmittingButton } from "@/components/submitting-button";
import { WhatsappHelpPill } from "@/components/whatsapp-help-pill";
import { requireRole } from "@/lib/auth";
import type {
  AdminSettingsRow,
  OrderItemRow,
  OrderRow
} from "@/lib/database.types";
import { formatMoney, titleCase } from "@/lib/format";
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

type BuyerOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Buyer-facing timeline. Each step lights up once the relevant signal
 *  is present. Payment confirmation has no dedicated timestamp column,
 *  so it ticks (without a date) whenever the payment status flips. */
function buildTimeline(order: OrderRow): Array<{
  label: string;
  at: string | null;
  done: boolean;
}> {
  return [
    { label: "Order placed", at: order.created_at, done: true },
    {
      label: "Seller accepted",
      at: order.accepted_at,
      done: Boolean(order.accepted_at)
    },
    {
      label: "Payment confirmed",
      at: null,
      done: order.payment_status === "confirmed"
    },
    {
      label: "Order completed",
      at: order.completed_at,
      done: Boolean(order.completed_at)
    }
  ];
}

export default async function BuyerOrderDetailPage({
  params
}: BuyerOrderDetailPageProps) {
  const { id } = await params;
  const { profile } = await requireRole(["buyer"]);
  const supabase = await createSupabaseServerClient();

  // Buyer-scoped fetch: `.eq("buyer_id", profile.id)` makes a deep-link
  // to someone else's order id resolve to notFound() instead of leaking
  // anything. RLS in the DB enforces the same; this is defence in depth.
  const [{ data: orderData }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("buyer_id", profile.id)
      .maybeSingle(),
    supabase
      .from("admin_settings")
      .select("eft_payment_instructions")
      .limit(1)
      .maybeSingle()
  ]);

  if (!orderData) notFound();
  const order = orderData as OrderRow;
  const eftPaymentInstructions = (settings as Pick<
    AdminSettingsRow,
    "eft_payment_instructions"
  > | null)?.eft_payment_instructions;

  const { data: itemsData } = await supabase
    .from("order_items")
    .select("*")
    .eq("order_id", order.id)
    .order("position", { ascending: true });
  const items = (itemsData ?? []) as OrderItemRow[];
  const isMultiItem = items.length > 1;
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + Number(item.line_subtotal),
    0
  );

  const showEft = canBuyerSeeEftInstructions(
    {
      status: order.status as OrderRuleStatus,
      payment_status: order.payment_status as PaymentStatus
    },
    eftPaymentInstructions
  );
  const popVisible =
    order.payment_status === "awaiting_buyer_eft" ||
    order.payment_status === "eft_submitted";
  const whatsappUrl = popVisible
    ? createWhatsAppUrl(
        buildPaymentProofMessage({
          id: order.id,
          buyer_name: order.buyer_name,
          buyer_total: order.buyer_total
        })
      )
    : null;
  const timeline = buildTimeline(order);

  return (
    <div className="bg-mist" data-testid="page-buyer-order-detail">
      <section className="section-band">
        <div className="page-shell gap-3 py-6">
          <Link
            className="inline-flex items-center gap-1 text-body-sm font-semibold text-leaf hover:underline"
            data-testid="buyer-order-detail-back-link"
            href="/buyer/orders"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to orders
          </Link>
          <div className="border-l-4 border-sky pl-4">
            <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
              Order #{order.id.slice(0, 8)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={order.status} />
              {order.expires_at && order.status === "order_requested" ? (
                <OrderCountdown
                  data-testid="buyer-order-detail-acceptance-countdown"
                  deadline={order.expires_at}
                  label="Seller has"
                  size="sm"
                  startedAt={order.created_at}
                />
              ) : null}
              {order.eft_confirm_due_at &&
              order.payment_status === "eft_submitted" ? (
                <OrderCountdown
                  data-testid="buyer-order-detail-eft-confirm-countdown"
                  deadline={order.eft_confirm_due_at}
                  label="Admin confirms in"
                  size="sm"
                />
              ) : null}
            </div>
            <p
              className="mt-2 text-body-sm text-black/65"
              data-testid="buyer-order-detail-payment-status"
            >
              {paymentStatusLabelForBuyer(
                order.payment_status as PaymentStatus
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="page-shell space-y-5 py-6">
        {/* Items */}
        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
          <h2 className="text-caption font-semibold uppercase tracking-widest text-black/40">
            {isMultiItem ? "Items" : "What you ordered"}
          </h2>
          <dl
            className="mt-3 divide-y divide-black/5"
            data-testid="buyer-order-detail-items"
          >
            {items.length ? (
              items.map((item) => (
                <div
                  className="flex items-start justify-between gap-4 py-2.5"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <dt className="text-body-sm font-semibold text-ink">
                      {item.listing_title}
                    </dt>
                    <dd className="mt-0.5 text-caption text-black/55">
                      {formatMoney(item.listing_price)}
                      {item.quantity > 1 ? ` × ${item.quantity}` : null}
                    </dd>
                  </div>
                  <span className="shrink-0 text-body-sm font-semibold text-ink">
                    {formatMoney(item.line_subtotal)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex items-start justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <dt className="text-body-sm font-semibold text-ink">
                    {titleCase(order.order_type ?? "order")}
                  </dt>
                  <dd className="mt-0.5 text-caption text-black/55">
                    {formatMoney(order.listing_price)}
                    {order.quantity && order.quantity > 1
                      ? ` × ${order.quantity}`
                      : null}
                  </dd>
                </div>
                <span className="shrink-0 text-body-sm font-semibold text-ink">
                  {formatMoney(
                    Number(order.listing_price) * (order.quantity ?? 1)
                  )}
                </span>
              </div>
            )}
          </dl>
        </div>

        {/* Delivery */}
        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
          <h2 className="text-caption font-semibold uppercase tracking-widest text-black/40">
            Delivery
          </h2>
          <dl className="mt-3 space-y-1.5">
            <DetailRow
              label="Address"
              value={order.delivery_address ?? order.suburb}
            />
            <DetailRow label="Suburb" value={order.suburb} />
            <DetailRow
              label="Requested date"
              value={formatDate(order.requested_date)}
            />
            <DetailRow
              label="Requested time"
              value={order.requested_time}
            />
          </dl>
          {order.buyer_notes ? (
            <p className="mt-3 rounded-lg border border-black/10 bg-mist p-3 text-body-sm text-black/70">
              <span className="font-semibold text-ink">Notes:</span>{" "}
              {order.buyer_notes}
            </p>
          ) : null}
        </div>

        {/* Cost */}
        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
          <h2 className="text-caption font-semibold uppercase tracking-widest text-black/40">
            Cost
          </h2>
          <dl className="mt-3 space-y-1.5">
            <DetailRow
              label={isMultiItem ? "Items subtotal" : "Item subtotal"}
              value={formatMoney(
                isMultiItem
                  ? itemsSubtotal
                  : Number(order.listing_price) * (order.quantity ?? 1)
              )}
            />
            <DetailRow
              label="Delivery"
              value={formatMoney(order.delivery_fee)}
            />
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-black/10 pt-3">
              <dt className="text-body font-semibold text-ink">Total</dt>
              <dd className="text-xl font-bold text-leaf">
                {formatMoney(order.buyer_total)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Payment panel */}
        {showEft ? (
          <div
            className="rounded-xl border border-leaf/20 bg-mint p-4 shadow-soft"
            data-testid="buyer-order-detail-eft-instructions"
          >
            <h2 className="text-caption font-semibold uppercase tracking-widest text-leaf/80">
              Payment instructions
            </h2>
            <p className="mt-2 whitespace-pre-line text-body-sm text-leaf">
              {eftPaymentInstructions}
            </p>
            <p className="mt-3 font-mono text-caption font-medium text-leaf/70">
              Reference: {order.id.slice(0, 8)}
            </p>
          </div>
        ) : null}

        {popVisible ? (
          <div
            className="rounded-xl border border-sky/30 bg-sky/5 p-4 shadow-soft"
            data-testid="buyer-order-detail-pop-panel"
          >
            <p className="text-body-sm font-semibold text-sky">
              {order.payment_status === "eft_submitted"
                ? "Proof of payment sent"
                : "Send your proof of payment"}
            </p>
            <p className="mt-1 text-caption text-sky/85">
              {order.payment_status === "eft_submitted"
                ? "We're verifying your payment — you'll get a notification when it's confirmed."
                : "Once we receive it, your order is approved within minutes."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {whatsappUrl ? (
                <Link
                  className="btn-primary inline-flex items-center gap-2"
                  data-testid="buyer-order-detail-pop-whatsapp-link"
                  href={whatsappUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <MessageCircle aria-hidden="true" className="h-4 w-4" />
                  Open WhatsApp
                </Link>
              ) : (
                <p
                  className="text-caption text-sky/70"
                  data-testid="buyer-order-detail-pop-fallback"
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
              {order.payment_status === "awaiting_buyer_eft" ? (
                <form action={markEftSubmittedAction}>
                  <input name="order_id" type="hidden" value={order.id} />
                  <SubmittingButton
                    busyLabel="Sending…"
                    className="btn-secondary"
                    data-testid="buyer-order-detail-mark-pop-sent-button"
                  >
                    I sent the proof
                  </SubmittingButton>
                </form>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Timeline */}
        <div className="rounded-xl border border-black/10 bg-white p-4 shadow-soft">
          <h2 className="text-caption font-semibold uppercase tracking-widest text-black/40">
            Timeline
          </h2>
          <ol
            className="mt-3 space-y-2"
            data-testid="buyer-order-detail-timeline"
          >
            {timeline.map((step) => (
              <li
                className="flex items-start gap-3"
                data-done={step.done}
                key={step.label}
              >
                <span
                  className={
                    step.done
                      ? "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-leaf text-white"
                      : "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/15 bg-white text-black/30"
                  }
                >
                  {step.done ? (
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                  ) : (
                    <Clock aria-hidden="true" className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      step.done
                        ? "text-body-sm font-semibold text-ink"
                        : "text-body-sm text-black/45"
                    }
                  >
                    {step.label}
                  </p>
                  {step.at ? (
                    <p className="text-caption text-black/45">
                      {formatDateTime(step.at)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Expired panel — mirror of the list view */}
        {order.status === "expired" ? (
          <div
            className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-soft"
            data-testid="buyer-order-detail-expired-panel"
          >
            <p className="flex items-center gap-2 text-body-sm font-semibold text-red-700">
              <XCircle aria-hidden="true" className="h-4 w-4" />
              Seller didn&apos;t respond in time
            </p>
            <p className="mt-1 text-caption text-red-700/85">
              This order expired. Browse alternatives — other open sellers
              should respond faster.
            </p>
            <Link
              className="btn-primary mt-3 inline-flex items-center gap-2"
              data-testid="buyer-order-detail-browse-link"
              href="/listings"
            >
              Browse listings
            </Link>
          </div>
        ) : null}
      </section>
      <WhatsappHelpPill orderId={order.id} />
    </div>
  );
}

function DetailRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-body-sm text-black/55">{label}</dt>
      <dd className="text-right text-body-sm font-medium text-ink">
        {value}
      </dd>
    </div>
  );
}

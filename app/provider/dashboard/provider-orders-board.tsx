"use client";

import { AlertCircle } from "lucide-react";
import { useState } from "react";

import { acceptProviderOrderAction } from "@/app/provider/dashboard/actions";
import { Drawer } from "@/components/drawer";
import { EmptyState } from "@/components/empty-state";
import { OrderCountdown } from "@/components/order-countdown";
import { StatusPill } from "@/components/status-pill";
import { SubmittingButton } from "@/components/submitting-button";
import type { OrderItemRow, OrderRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { getProviderOrderBucket, type ProviderOrderBucket } from "@/lib/order-rules";

type ProviderOrdersBoardProps = {
  orders: OrderRow[];
  eftInstructions: string | null;
  /** Line items keyed by order_id. Pre-grouped server-side so the
   *  drawer can render the per-line list without an extra round trip. */
  orderItemsByOrderId?: Record<string, OrderItemRow[]>;
};

const GROUPS: { bucket: ProviderOrderBucket; label: string }[] = [
  { bucket: "needs_action", label: "Needs your action" },
  { bucket: "in_progress", label: "In progress" },
  { bucket: "closed", label: "Completed" }
];

function formatDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

export function ProviderOrdersBoard({
  orders,
  eftInstructions,
  orderItemsByOrderId = {}
}: ProviderOrdersBoardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const selectedItems = selected
    ? orderItemsByOrderId[selected.id] ?? []
    : [];

  if (!orders.length) {
    return (
      <div className="dash-section">
        <EmptyState
          body="Buyer order requests will appear here once your live listings start receiving activity."
          title="No orders yet"
        />
      </div>
    );
  }

  return (
    <>
      {GROUPS.map(({ bucket, label }) => {
        const groupOrders = orders.filter(
          (order) => getProviderOrderBucket(order.status) === bucket
        );

        if (!groupOrders.length) {
          return null;
        }

        // The needs-action bucket gets a warm sunset treatment, an alert icon,
        // and a soft-tinted panel — so glancing at the dashboard tells you
        // immediately whether there's something demanding your time. Other
        // buckets keep the neutral chrome.
        const isNeedsAction = bucket === "needs_action";

        if (isNeedsAction) {
          return (
            <div className="dash-section" key={bucket}>
              {/* Anchor target for the greeting alert card. scroll-mt-20 keeps
                  the panel from landing under the sticky h-16 site header. */}
              <div
                className="rounded-2xl border-2 border-sunset/40 bg-sunset/5 p-4 shadow-soft scroll-mt-20"
                data-testid="provider-needs-action-panel"
                id="provider-needs-action"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-sunset/15 text-sunset">
                    <AlertCircle className="h-5 w-5" aria-hidden="true" />
                    {/* Tiny pulse dot — non-spinning, just a soft animated
                        ping so the eye notices without it feeling pushy. */}
                    <span className="absolute right-0 top-0 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sunset opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-sunset" />
                    </span>
                  </span>
                  <div>
                    <p className="text-h3 font-semibold text-sunset">{label}</p>
                    <p className="text-body-sm text-black/55">
                      {groupOrders.length === 1
                        ? "One order is waiting on you."
                        : `${groupOrders.length} orders are waiting on you.`}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {groupOrders.map((order) => (
                    <button
                      className="block w-full rounded-lg border border-sunset/30 bg-white p-4 text-left transition hover:border-sunset hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sunset"
                      data-testid="provider-order-card"
                      key={order.id}
                      onClick={() => setSelectedId(order.id)}
                      type="button"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="flex items-center gap-2 text-sm text-black/50">
                            Order {order.id.slice(0, 8)}
                            {order.quantity > 1 ? (
                              <span
                                className="inline-flex items-center rounded-full bg-sunset/15 px-2 py-0.5 text-caption font-bold uppercase tracking-widest text-sunset"
                                data-testid="provider-order-quantity-badge"
                              >
                                × {order.quantity}
                              </span>
                            ) : null}
                            {order.expires_at &&
                            order.status === "order_requested" ? (
                              <OrderCountdown
                                data-testid="provider-order-countdown"
                                deadline={order.expires_at}
                                label="Accept in"
                                size="sm"
                                startedAt={order.created_at}
                              />
                            ) : null}
                          </p>
                          <p className="mt-1 font-semibold">{order.buyer_name}</p>
                          <p className="mt-1 text-sm text-black/60">
                            {order.suburb ?? "—"} · {formatMoney(order.buyer_total)}
                          </p>
                        </div>
                        <StatusPill status={order.status} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="dash-section" key={bucket}>
            <div className="dash-section-label">
              <span className="label-text">{label}</span>
              <span className="label-rule" />
              <span className="label-count">{groupOrders.length}</span>
            </div>
            <div className="space-y-3">
              {groupOrders.map((order) => (
                <button
                  className="block w-full rounded-lg border border-black/10 bg-white p-4 text-left transition hover:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf"
                  data-testid="provider-order-card"
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                  type="button"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-black/50">
                        Order {order.id.slice(0, 8)}
                      </p>
                      <p className="mt-1 font-semibold">{order.buyer_name}</p>
                      <p className="mt-1 text-sm text-black/60">
                        {order.suburb ?? "—"} · {formatMoney(order.buyer_total)}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <Drawer
        data-testid="provider-order-drawer"
        onClose={() => setSelectedId(null)}
        open={Boolean(selected)}
        title={selected ? `Order ${selected.id.slice(0, 8)}` : "Order"}
      >
        {selected ? (
          <OrderDetail
            eftInstructions={eftInstructions}
            items={selectedItems}
            order={selected}
          />
        ) : null}
      </Drawer>
    </>
  );
}

function DetailRow({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-sm text-black/55">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function Section({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-black/40">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function OrderDetail({
  order,
  items,
  eftInstructions
}: {
  order: OrderRow;
  items: OrderItemRow[];
  eftInstructions: string | null;
}) {
  const bucket = getProviderOrderBucket(order.status);
  const isMultiItem = items.length > 1;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3">
        <StatusPill status={order.status} />
        {formatDate(order.created_at) ? (
          <span className="text-xs text-black/40">
            Requested {formatDate(order.created_at)}
          </span>
        ) : null}
      </div>

      <Section title="Buyer">
        <dl>
          <DetailRow label="Name" value={order.buyer_name} />
          <DetailRow
            label="Phone"
            value={
              order.buyer_phone ? (
                <a className="text-leaf hover:underline" href={`tel:${order.buyer_phone}`}>
                  {order.buyer_phone}
                </a>
              ) : null
            }
          />
          <DetailRow
            label="WhatsApp"
            value={
              order.buyer_whatsapp ? (
                <a
                  className="text-leaf hover:underline"
                  href={`https://wa.me/${order.buyer_whatsapp.replace(/[^\d]/g, "")}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {order.buyer_whatsapp}
                </a>
              ) : null
            }
          />
          <DetailRow
            label="Email"
            value={
              order.buyer_email ? (
                <a className="text-leaf hover:underline" href={`mailto:${order.buyer_email}`}>
                  {order.buyer_email}
                </a>
              ) : null
            }
          />
        </dl>
      </Section>

      {isMultiItem ? (
        <Section title="Items">
          <dl
            className="rounded-lg border border-black/10 bg-white p-3"
            data-testid="provider-order-items"
          >
            {items.map((item) => (
              <DetailRow
                key={item.id}
                label={
                  item.quantity > 1
                    ? `${item.listing_title} (${formatMoney(item.listing_price)} × ${item.quantity})`
                    : item.listing_title
                }
                value={formatMoney(item.line_subtotal)}
              />
            ))}
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-black/10 pt-2">
              <dt className="text-sm font-semibold text-ink">Subtotal</dt>
              <dd className="text-sm font-semibold text-ink">
                {formatMoney(
                  items.reduce((sum, item) => sum + Number(item.line_subtotal), 0)
                )}
              </dd>
            </div>
          </dl>
        </Section>
      ) : null}

      <Section title="Delivery">
        <dl>
          <DetailRow
            label="Address"
            value={order.delivery_address ?? order.suburb}
          />
          <DetailRow label="Suburb" value={order.suburb} />
          <DetailRow label="Requested date" value={formatDate(order.requested_date)} />
          <DetailRow label="Requested time" value={order.requested_time} />
        </dl>
        {order.buyer_notes ? (
          <p className="mt-2 rounded-lg border border-black/10 bg-white p-3 text-sm text-black/70">
            {order.buyer_notes}
          </p>
        ) : null}
      </Section>

      <Section title="Earnings">
        <dl className="rounded-lg border border-black/10 bg-white p-3">
          {isMultiItem ? (
            <DetailRow
              label="Items subtotal"
              value={formatMoney(
                items.reduce(
                  (sum, item) => sum + Number(item.line_subtotal),
                  0
                )
              )}
            />
          ) : (
            <>
              <DetailRow
                label="Listing price"
                value={
                  order.quantity > 1
                    ? `${formatMoney(order.listing_price)} × ${order.quantity}`
                    : formatMoney(order.listing_price)
                }
              />
              {order.quantity > 1 ? (
                <DetailRow
                  label="Subtotal"
                  value={formatMoney(
                    Number(order.listing_price) * order.quantity
                  )}
                />
              ) : null}
            </>
          )}
          <DetailRow
            label="Delivery fee"
            value={formatMoney(order.delivery_fee)}
          />
          <DetailRow
            label={`Commission (${order.commission_percentage ?? 0}%)`}
            value={
              order.commission_amount
                ? `– ${formatMoney(order.commission_amount)}`
                : null
            }
          />
          <div className="mt-2 flex items-center justify-between gap-4 border-t border-black/10 pt-2">
            <dt className="text-sm font-semibold text-ink">Your earning</dt>
            <dd className="text-base font-bold text-leaf">
              {formatMoney(order.provider_earning)}
            </dd>
          </div>
          <DetailRow label="Buyer total" value={formatMoney(order.buyer_total)} />
        </dl>
      </Section>

      {bucket === "needs_action" ? (
        <Section title="Accept this order">
          <form
            action={acceptProviderOrderAction}
            className="space-y-3"
            data-testid="provider-order-accept-form"
          >
            <input name="order_id" type="hidden" value={order.id} />
            <p className="rounded-lg border border-black/10 bg-white p-3 text-sm text-black/60">
              Delivery fee was calculated from the buyer&apos;s address at
              checkout — accepting confirms the order at this total.
            </p>
            <SubmittingButton
              busyLabel="Accepting…"
              className="btn-primary w-full"
              data-testid="provider-order-accept-button"
            >
              Accept order
            </SubmittingButton>
          </form>
        </Section>
      ) : null}

      {eftInstructions ? (
        <Section title="Payment instructions shared with buyer">
          <p className="rounded-lg border border-leaf/20 bg-mint p-3 text-sm text-leaf/90">
            {eftInstructions}
          </p>
        </Section>
      ) : null}
    </div>
  );
}

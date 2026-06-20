import Link from "next/link";
import { ArrowRight, ClipboardList, Truck, Wallet } from "lucide-react";

import {
  completeDeliveryAction,
  markOutForDeliveryAction,
  markPickedUpAction,
  updateDriverAvailabilityAction
} from "@/app/driver/dashboard/actions";
import { InstallPwaNudge } from "@/components/install-pwa-nudge";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";
import { StatusPill } from "@/components/status-pill";
import { requireRole } from "@/lib/auth";
import type {
  DriverProfileRow,
  OrderRow,
  PayoutRow
} from "@/lib/database.types";
import { formatMoney, getGreeting } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function saDateOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "Africa/Johannesburg"
  });
}

export const dynamic = "force-dynamic";

type DriverDashboardPageProps = {
  searchParams: Promise<{
    availability?: string;
    delivery_updated?: string;
    error?: string;
    status?: string;
  }>;
};

export default async function DriverDashboardPage({
  searchParams
}: DriverDashboardPageProps) {
  const params = await searchParams;
  const { profile } = await requireRole(["driver"]);
  const supabase = await createSupabaseServerClient();
  const { data: driver } = await supabase
    .from("driver_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();
  const driverProfile = driver as DriverProfileRow | null;

  if (!driverProfile || driverProfile.approval_status !== "approved") {
    return (
      <div className="page-shell max-w-xl py-8" data-testid="page-driver-dashboard-approval-required">
        <div className="panel">
          <h1 className="text-xl font-semibold">Approval required</h1>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Driver dashboards open after admin approval.
          </p>
          <Link className="btn-primary mt-5" data-testid="driver-dashboard-status-link" href="/driver/status">
            View status
          </Link>
        </div>
      </div>
    );
  }

  const [
    { count: deliveryCount },
    { data: deliveriesData },
    { data: myPayoutsData }
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", driverProfile.id),
    supabase
      .from("orders")
      .select("*")
      .eq("driver_id", driverProfile.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("payouts")
      .select("*")
      .eq("recipient_user_id", profile.id)
      .eq("recipient_type", "driver")
      .order("created_at", { ascending: false })
      .limit(10)
  ]);
  const deliveries = (deliveriesData ?? []) as OrderRow[];
  const myPayouts = (myPayoutsData ?? []) as PayoutRow[];
  const pendingPayoutsTotal = myPayouts
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.net_amount), 0);
  const lastPaidPayout = myPayouts.find((p) => p.status === "paid") ?? null;
  const todayInSA = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Johannesburg"
  });
  const todaysEarnings = deliveries
    .filter((order) => saDateOf(order.completed_at) === todayInSA)
    .reduce((sum, order) => sum + Number(order.driver_earning ?? 0), 0);
  const displayName = profile.full_name?.split(" ")[0] ?? "driver";
  // Deliveries that demand the driver's attention right now — the headline
  // becomes a tap-to-act link when these exist, falling back to today's
  // earnings as the "all done" view.
  const pendingPickupCount = deliveries.filter(
    (order) => order.status === "driver_assigned"
  ).length;
  const activeDeliveryCount = deliveries.filter((order) =>
    ["driver_assigned", "picked_up", "out_for_delivery"].includes(order.status)
  ).length;

  return (
    <div className="bg-mist" data-testid="page-driver-dashboard">
      <section className="section-band">
        <div className="page-shell gap-4 py-6">
          {/* When deliveries are waiting to be picked up the rail + heading
              switch to sunset (warm attention). Otherwise it's iris (steady,
              "you're up to date"). */}
          <div
            className={`border-l-4 pl-4 ${
              pendingPickupCount > 0 ? "border-sunset" : "border-iris"
            }`}
          >
            <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
              {getGreeting()}, {displayName}
            </p>
            {pendingPickupCount > 0 ? (
              <div data-testid="driver-dashboard-greeting">
                <Link
                  className="group mt-3 flex max-w-md items-center gap-4 rounded-2xl bg-sunset p-4 text-white shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sunset focus:ring-offset-2"
                  data-testid="driver-dashboard-greeting-link"
                  href="#driver-deliveries"
                >
                  <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-2xl font-bold text-sunset">
                    {pendingPickupCount}
                    <span className="absolute right-0 top-0 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                    </span>
                  </span>
                  <span className="flex-1 text-left">
                    <span className="block text-lg font-bold leading-tight">
                      {pendingPickupCount === 1 ? "Delivery to pick up" : "Deliveries to pick up"}
                    </span>
                    <span className="block text-sm text-white/85">
                      Tap to start the route
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 transition group-hover:translate-x-1"
                  />
                </Link>
              </div>
            ) : (
              <h1 className="mt-1 text-display-md text-iris" data-testid="driver-dashboard-greeting">
                {formatMoney(todaysEarnings)} earned today
              </h1>
            )}
            <p className="mt-3 text-body-sm text-black/55">
              Stay available to take deliveries as they come in.
            </p>
          </div>
          {params.delivery_updated ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="driver-delivery-updated-message"
            >
              Delivery status updated.
            </div>
          ) : null}
          {params.availability ? (
            <div
              className="rounded-md border border-mint bg-mint p-3 text-sm text-leaf"
              data-testid="driver-availability-updated-message"
            >
              Availability updated.
            </div>
          ) : null}
          {params.error ? (
            <div
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              data-testid="driver-error-message"
            >
              {params.error}
            </div>
          ) : null}
          <PushNotificationPrompt role="driver" />
          <InstallPwaNudge />
        </div>
      </section>

      <section className="page-shell py-6">
        {/* Two rounded summary tiles — current delivery load + today's
            earnings — always sit side-by-side, even on the smallest viewport. */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-iris/20 bg-white p-4 shadow-soft transition hover:border-iris hover:shadow-md focus:outline-none focus:ring-2 focus:ring-iris focus:ring-offset-2"
            data-testid="driver-active-deliveries-tile"
            href="#driver-deliveries"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-iris/10 text-iris transition group-hover:bg-iris group-hover:text-white">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">{activeDeliveryCount}</p>
              <p className="mt-1 text-body-sm text-black/60">In progress</p>
            </div>
          </Link>
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-leaf/20 bg-white p-4 shadow-soft transition hover:border-leaf hover:shadow-md focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-2"
            data-testid="driver-todays-earnings-tile"
            href="#driver-earnings"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf/10 text-leaf transition group-hover:bg-leaf group-hover:text-white">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-2xl font-semibold leading-none">{formatMoney(todaysEarnings)}</p>
              <p className="mt-1 text-body-sm text-black/60">Earned today</p>
            </div>
          </Link>
        </div>

        <div className="dash-section-label">
          <span className="label-text">Availability</span>
          <span className="label-rule" />
        </div>
        <div
          className="panel flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          data-testid="driver-availability-card"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
              <Truck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xl font-semibold capitalize">
                {driverProfile.availability_status.replaceAll("_", " ")}
              </p>
              <p className="text-sm text-black/60">Your current availability</p>
            </div>
          </div>
          {driverProfile.availability_status !== "busy" ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <form action={updateDriverAvailabilityAction}>
                <input name="availability_status" type="hidden" value="available" />
                <button
                  className="btn-primary w-full sm:w-auto"
                  data-testid="driver-set-available-button"
                  disabled={driverProfile.availability_status === "available"}
                  type="submit"
                >
                  Go available
                </button>
              </form>
              <form action={updateDriverAvailabilityAction}>
                <input name="availability_status" type="hidden" value="unavailable" />
                <button
                  className="btn-secondary w-full sm:w-auto"
                  data-testid="driver-set-unavailable-button"
                  disabled={driverProfile.availability_status === "unavailable"}
                  type="submit"
                >
                  Go offline
                </button>
              </form>
            </div>
          ) : null}
        </div>

        <div className="dash-section dash-section-label scroll-mt-20" id="driver-earnings">
          <span className="label-text">Earnings</span>
          <span className="label-rule" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2" data-testid="driver-earnings-panel">
          <div className="panel" data-testid="driver-earnings-pending-card">
            <Wallet className="h-5 w-5 text-leaf" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">
              {formatMoney(pendingPayoutsTotal)}
            </p>
            <p className="text-body-sm text-black/60">
              Pending payouts
            </p>
          </div>
          <div className="panel" data-testid="driver-earnings-last-paid-card">
            <Wallet className="h-5 w-5 text-leaf" aria-hidden="true" />
            {lastPaidPayout ? (
              <>
                <p className="mt-4 text-2xl font-semibold">
                  {formatMoney(lastPaidPayout.net_amount)}
                </p>
                <p className="text-body-sm text-black/60">
                  Last paid{" "}
                  {lastPaidPayout.paid_at
                    ? lastPaidPayout.paid_at.slice(0, 10)
                    : "—"}{" "}
                  · ref {lastPaidPayout.payment_reference ?? "—"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 text-2xl font-semibold">{formatMoney(0)}</p>
                <p className="text-body-sm text-black/60">
                  No payouts paid yet — they appear once admin marks one paid.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="dash-section dash-section-label scroll-mt-20" id="driver-deliveries">
          <span className="label-text">Deliveries</span>
          <span className="label-rule" />
          {(deliveryCount ?? 0) > 0 && (
            <span className="label-count">{deliveryCount}</span>
          )}
        </div>
        <div className="mb-3 sm:max-w-xs">
          <div className="panel" data-testid="driver-deliveries-count-card">
            <ClipboardList className="h-5 w-5 text-leaf" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">{deliveryCount ?? 0}</p>
            <p className="text-sm text-black/60">Assigned deliveries</p>
          </div>
        </div>
        <div className="space-y-3" data-testid="driver-delivery-list">
          {deliveries.length ? (
            deliveries.map((order) => {
              const action =
                order.status === "driver_assigned"
                  ? {
                      label: "Mark picked up",
                      formAction: markPickedUpAction,
                      testId: "driver-mark-picked-up-button"
                    }
                  : order.status === "picked_up"
                    ? {
                        label: "Mark out for delivery",
                        formAction: markOutForDeliveryAction,
                        testId: "driver-mark-out-for-delivery-button"
                      }
                    : order.status === "out_for_delivery"
                      ? {
                          label: "Complete delivery",
                          formAction: completeDeliveryAction,
                          testId: "driver-complete-delivery-button"
                        }
                      : null;

              return (
                <div
                  className="rounded-lg border border-black/10 bg-white p-4"
                  data-testid="driver-delivery-card"
                  key={order.id}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm text-black/50">Order {order.id.slice(0, 8)}</p>
                      <p className="mt-1 font-semibold">{order.buyer_name}</p>
                      <p className="mt-1 text-sm text-black/60">
                        {order.delivery_address ?? order.suburb ?? "—"}
                      </p>
                    </div>
                    <StatusPill status={order.status} />
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-black/60 sm:grid-cols-2">
                    <span>Total: {formatMoney(order.buyer_total)}</span>
                    <span>Driver earning: {formatMoney(order.driver_earning)}</span>
                  </div>

                  {action ? (
                    <form action={action.formAction} className="mt-4">
                      <input name="order_id" type="hidden" value={order.id} />
                      <button
                        className="btn-primary w-full sm:w-auto"
                        data-testid={action.testId}
                        type="submit"
                      >
                        {action.label}
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-black/60">
              Assigned deliveries will appear here after admin confirms payment and assigns you to an order.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

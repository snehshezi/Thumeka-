"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";

import { OrderCountdown } from "@/components/order-countdown";

type BannerKind =
  | "accept"
  | "confirm_eft"
  | "assign_driver"
  | "wait_for_seller";

type UrgentActionBannerProps = {
  kind: BannerKind;
  deadline: string;
  /** When the deadline window started (created_at, eft_submitted_at,
   *  etc.) — drives the urgency colour band. Falls back to "neutral
   *  for the whole window" when omitted. */
  startedAt?: string;
  href: string;
  totalCount: number;
};

const COPY: Record<BannerKind, { headline: string; ctaLabel: string }> = {
  accept: {
    headline: "Order needs your action — accept or reject",
    ctaLabel: "Open"
  },
  confirm_eft: {
    headline: "EFT awaiting your confirmation",
    ctaLabel: "Confirm"
  },
  assign_driver: {
    headline: "Order ready for driver assignment",
    ctaLabel: "Assign"
  },
  wait_for_seller: {
    headline: "Waiting for the seller to accept",
    ctaLabel: "View"
  }
};

/**
 * Sticky banner above the site header. Renders nothing when there's no
 * urgent action — and the layout passes `null` from the server when so.
 *
 * The "extra orders" tail ("+2 more") appears when totalCount > 1 so
 * the user knows the listed one isn't all of it. Clicking the CTA
 * routes to the role's dashboard; the countdown's onExpire calls
 * router.refresh() so the next-most-urgent order takes the slot
 * automatically.
 */
export function UrgentActionBanner({
  kind,
  deadline,
  startedAt,
  href,
  totalCount
}: UrgentActionBannerProps) {
  const router = useRouter();
  const onExpire = useCallback(() => router.refresh(), [router]);
  const { headline, ctaLabel } = COPY[kind];

  return (
    <div
      className="sticky top-0 z-50 w-full bg-sunset text-white shadow-soft"
      data-testid="urgent-action-banner"
      data-kind={kind}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {headline}
          {totalCount > 1 ? (
            <span className="ml-2 text-white/85">
              · +{totalCount - 1} more
            </span>
          ) : null}
        </p>
        <OrderCountdown
          className="shrink-0 bg-white/15 text-white"
          data-testid="urgent-action-banner-countdown"
          deadline={deadline}
          onExpire={onExpire}
          size="sm"
          startedAt={startedAt}
        />
        <Link
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-sunset transition hover:bg-white/90"
          data-testid="urgent-action-banner-cta"
          href={href}
        >
          {ctaLabel}
          <ArrowRight aria-hidden="true" className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

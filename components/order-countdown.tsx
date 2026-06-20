"use client";

import { useEffect, useRef, useState } from "react";

import { formatRemaining, urgencyOf, type UrgencyLevel } from "@/lib/sla";

type OrderCountdownProps = {
  /** ISO timestamp string of the deadline. */
  deadline: string;
  /** Optional starting timestamp; used to compute the window length so
   *  the urgency colours scale to *this* order's SLA, not a global one.
   *  When omitted, urgency is just based on absolute time remaining. */
  startedAt?: string;
  /** Visible prefix label e.g. "Accept in", "Pay by". When omitted, only
   *  the timer renders. */
  label?: string;
  /** Optional callback that fires once when the countdown crosses zero.
   *  Used by buyer-orders / provider dashboard to `router.refresh()`. */
  onExpire?: () => void;
  /** Smaller variant for inline use inside an order card. */
  size?: "sm" | "md";
  className?: string;
  "data-testid"?: string;
};

/**
 * Live MM:SS countdown to `deadline`.
 *
 * Re-renders every second via setInterval. Tab-hidden tabs throttle
 * timers automatically (browsers cap to ~1Hz), which is fine — when
 * the tab regains focus, the next tick catches up to the real elapsed
 * time because we recompute from `Date.now()` each render rather than
 * decrementing locally.
 *
 * Colour-shifts via the urgency level from `lib/sla.ts`:
 *   neutral → black-on-mint        (>50% of window remaining)
 *   amber   → black-on-maize       (25-50%)
 *   red     → white-on-coral       (<25% or last 30 seconds)
 *   expired → white-on-black/40    (past deadline)
 */
export function OrderCountdown({
  deadline,
  startedAt,
  label,
  onExpire,
  size = "md",
  className,
  "data-testid": testId
}: OrderCountdownProps) {
  const deadlineMs = new Date(deadline).getTime();
  const windowMs = startedAt
    ? deadlineMs - new Date(startedAt).getTime()
    : Number.POSITIVE_INFINITY;

  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, deadlineMs - Date.now())
  );
  const firedExpireRef = useRef(false);

  useEffect(() => {
    function tick() {
      const next = Math.max(0, deadlineMs - Date.now());
      setRemainingMs(next);
      if (next <= 0 && !firedExpireRef.current) {
        firedExpireRef.current = true;
        onExpire?.();
      }
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadlineMs, onExpire]);

  const urgency = urgencyOf(remainingMs, windowMs);
  const expired = urgency === "expired";
  const display = expired ? "Expired" : formatRemaining(remainingMs);

  const baseCls = size === "sm" ? STYLE_SM : STYLE_MD;
  const urgencyCls = URGENCY_STYLES[urgency];

  return (
    <span
      aria-label={
        label ? `${label} ${display}` : `Time remaining ${display}`
      }
      className={`${baseCls} ${urgencyCls} ${className ?? ""}`}
      data-testid={testId ?? "order-countdown"}
      data-urgency={urgency}
      role="timer"
    >
      {label ? (
        <span className="opacity-80">{label}</span>
      ) : null}
      <span className="font-mono font-semibold">{display}</span>
    </span>
  );
}

const STYLE_SM =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-semibold";
const STYLE_MD =
  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold";

const URGENCY_STYLES: Record<UrgencyLevel, string> = {
  neutral: "bg-mint text-leaf",
  amber: "bg-maize/60 text-ink",
  red: "bg-coral text-white",
  expired: "bg-black/40 text-white"
};

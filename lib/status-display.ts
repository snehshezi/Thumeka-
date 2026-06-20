import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Package,
  Truck,
  XCircle,
  type LucideIcon
} from "lucide-react";

export type StatusVariant =
  | "success"
  | "info"
  | "working"
  | "warning"
  | "danger"
  | "neutral";

export type StatusDisplay = {
  variant: StatusVariant;
  icon: LucideIcon;
  /** Tailwind classes for background + foreground colour, using existing palette tokens. */
  className: string;
};

// Each variant gets its own brand-aligned hue so a row of mixed-status pills
// reads as one coherent visual family (no more leaf-on-leaf-on-leaf).
const VARIANT_CLASS: Record<StatusVariant, string> = {
  success: "bg-mint text-leaf",        // emerald — terminal good
  info: "bg-sky/10 text-sky",          // clear blue — waiting on next actor
  working: "bg-iris/10 text-iris",     // vivid violet — actively in motion
  warning: "bg-maize/25 text-ink",     // yellow — needs attention
  danger: "bg-coral/10 text-coral",    // hot pink — terminal bad
  neutral: "bg-black/[0.06] text-black/60"
};

const STATUS_MAP: Record<string, { variant: StatusVariant; icon: LucideIcon }> = {
  // Success — terminal good outcomes
  approved: { variant: "success", icon: CheckCircle2 },
  completed: { variant: "success", icon: CheckCircle2 },
  payment_confirmed: { variant: "success", icon: CheckCircle2 },
  confirmed: { variant: "success", icon: CheckCircle2 },

  // Info — waiting on the next actor in the flow
  awaiting_provider_acceptance: { variant: "info", icon: Clock },
  accepted_by_provider: { variant: "info", icon: Clock },
  delivery_fee_calculated: { variant: "info", icon: Clock },
  awaiting_buyer_eft: { variant: "info", icon: Clock },
  eft_submitted: { variant: "info", icon: Clock },
  awaiting_driver_assignment: { variant: "info", icon: Clock },

  // Working — actively in motion
  preparing_or_scheduled: { variant: "working", icon: Package },
  driver_assigned: { variant: "working", icon: Truck },
  picked_up: { variant: "working", icon: Package },
  out_for_delivery: { variant: "working", icon: Truck },
  service_in_progress: { variant: "working", icon: Truck },

  // Warning — needs attention but not a hard failure
  provider_location_warning: { variant: "warning", icon: AlertTriangle },
  issue_reported: { variant: "warning", icon: AlertTriangle },

  // Danger — terminal bad outcomes
  rejected: { variant: "danger", icon: XCircle },
  provider_rejected: { variant: "danger", icon: XCircle },
  cancelled: { variant: "danger", icon: XCircle },
  suspended: { variant: "danger", icon: XCircle },
  failed: { variant: "danger", icon: XCircle },
  refunded_manual: { variant: "danger", icon: XCircle }
};

/** Resolve a status string to its display variant, icon, and Tailwind classes. */
export function getStatusDisplay(status: string): StatusDisplay {
  const entry = STATUS_MAP[status] ?? { variant: "neutral" as const, icon: Circle };
  return {
    variant: entry.variant,
    icon: entry.icon,
    className: VARIANT_CLASS[entry.variant]
  };
}

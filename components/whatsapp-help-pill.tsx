import { MessageCircle } from "lucide-react";
import Link from "next/link";

import { createWhatsAppUrl } from "@/lib/support";
import { buildUrgentOrderHelpMessage } from "@/lib/whatsapp-message";

type WhatsappHelpPillProps = {
  /** Optional order id — included in the pre-fill so support can pull
   *  the row up immediately. */
  orderId?: string;
  /** Override the visible label (e.g. "Need urgent help?"). */
  label?: string;
};

/**
 * Fixed bottom-right "Need urgent help?" pill that deep-links to
 * WhatsApp support with an order-aware pre-filled message. Mounted
 * on order-related buyer surfaces (orders list, order detail,
 * checkout) where a serious issue is most likely to hit.
 *
 * Falls back to a hidden no-op when the WhatsApp env isn't set —
 * we don't want a dead pill on production.
 *
 * Sits above the mobile BottomNav (bottom-24) and at the regular
 * margin (bottom-6) on desktop.
 */
export function WhatsappHelpPill({
  orderId,
  label = "Need urgent help?"
}: WhatsappHelpPillProps) {
  const url = createWhatsAppUrl(buildUrgentOrderHelpMessage(orderId));
  if (!url) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-24 right-4 z-30 sm:bottom-6 sm:right-6"
      data-testid="whatsapp-help-pill"
    >
      <Link
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-ink"
        data-testid="whatsapp-help-pill-link"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4" />
        {label}
      </Link>
    </div>
  );
}

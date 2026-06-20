import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { createWhatsAppUrl } from "@/lib/support";

export default function SupportPage() {
  const whatsappUrl = createWhatsAppUrl("Hi Thumeka, I need support with an order.");

  return (
    <div className="section-band" data-testid="page-support">
      <div className="page-shell max-w-xl py-8">
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="text-display-md text-ink">Support</h1>
        <p className="mt-2 text-sm leading-6 text-black/60">
          Thumeka handles buyer, provider, driver, refund, and dispute support through WhatsApp.
        </p>
        {whatsappUrl ? (
          <Link className="btn-primary mt-6 w-full" data-testid="support-whatsapp-link" href={whatsappUrl}>
            Open WhatsApp
          </Link>
        ) : (
          <div className="mt-6 rounded-md border border-maize/60 bg-maize/20 p-3 text-sm" data-testid="support-missing-config">
            Set NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER to enable the support link.
          </div>
        )}
      </div>
    </div>
  );
}

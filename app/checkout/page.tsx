import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { CartCheckoutForm } from "@/app/checkout/cart-checkout-form";
import { WhatsappHelpPill } from "@/components/whatsapp-help-pill";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

/**
 * Cart-aware checkout. The cart lives in localStorage (browser-only),
 * so the page renders a client shell that reads the cart and posts
 * its items to the server action. Empty carts redirect back to `/cart`
 * client-side.
 */
export default async function CartCheckoutPage({ searchParams }: CheckoutPageProps) {
  const query = await searchParams;
  const { profile } = await requireRole(["buyer"]);

  return (
    <div className="section-band" data-testid="page-cart-checkout">
      <div className="page-shell max-w-2xl py-6">
        <Link
          className="mb-4 inline-flex items-center text-sm font-semibold text-leaf"
          href="/cart"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Cart
        </Link>
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-display-md text-ink">Checkout</h1>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Payment instructions are only shown after the provider accepts
            your order request.
          </p>
        </div>

        {query.error ? (
          <div
            className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            data-testid="cart-checkout-error"
          >
            {query.error}
          </div>
        ) : null}

        <CartCheckoutForm
          defaultName={profile.full_name ?? ""}
          defaultPhone={profile.phone ?? ""}
          defaultWhatsapp={profile.phone ?? ""}
        />
      </div>
      <WhatsappHelpPill />
    </div>
  );
}

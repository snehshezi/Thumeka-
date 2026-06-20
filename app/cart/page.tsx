import { redirect } from "next/navigation";

import { canShopAsBuyer, getCurrentProfile } from "@/lib/auth";
import { roleHomePath } from "@/lib/routes";

import { CartView } from "./cart-view";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  // Server-side bounce for non-buyer roles (provider, driver, admin) — catches
  // anyone who bookmarked /cart or pasted the URL. Anonymous users fall
  // through to the cart view; they're prompted to sign in at checkout.
  const profile = await getCurrentProfile().catch(() => null);
  if (profile && !canShopAsBuyer(profile)) {
    redirect(roleHomePath(profile.role));
  }
  return <CartView />;
}

import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { CartIcon } from "@/components/cart-icon";
import { CartProvider } from "@/components/cart-provider";
import { MobileNavMenu } from "@/components/mobile-nav-menu";
import { canShopAsBuyer, getCurrentProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getUrgentDeadlineForRole } from "@/lib/urgent-orders";
import { AccountDropdown } from "@/components/account-dropdown";
import { HeaderSearchInput } from "@/components/header-search-input";
import { ReplayOnboardingLink } from "@/components/onboarding-overlay";
import { UrgentActionBanner } from "@/components/urgent-action-banner";
import { APP_NAME } from "@/lib/constants";
import { getAppUrl } from "@/lib/env";
import { roleHomePath } from "@/lib/routes";
import { createWhatsAppUrl } from "@/lib/support";
import { buildBugReportMessage } from "@/lib/whatsapp-message";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: {
    default: "Thumeka",
    template: "%s | Thumeka"
  },
  description:
    "South Africa's safest and most empowering marketplace — products, services, errands, and deliveries.",
  icons: {
    icon: [
      { url: "/thumeka.png", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    // iOS Safari only renders the apple-touch-icon when set; this drives
    // the home-screen icon after "Add to Home Screen".
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180" }
    ]
  },
  // appleWebApp turns on iOS standalone mode (no Safari chrome) when the
  // PWA is launched from the home screen. Required for iOS Web Push.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Thumeka"
  },
  openGraph: {
    title: "Thumeka",
    description:
      "South Africa's safest and most empowering marketplace — products, services, errands, and deliveries.",
    images: ["/thumeka.png"]
  }
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getCurrentProfile().catch(() => null);
  const canShop = canShopAsBuyer(profile);
  // Pre-build the WhatsApp "Report a bug" URL once per request — same
  // helper the in-app POP buttons use; falls back to null when the
  // env isn't set so we don't render a dead link.
  const bugReportUrl = createWhatsAppUrl(buildBugReportMessage());

  // Urgent-action banner across the top of every page when signed-in
  // and there's a pending order with an SLA running. Per-role queries
  // are role-restricted so a buyer doesn't see provider/admin work.
  let urgent: Awaited<ReturnType<typeof getUrgentDeadlineForRole>> | null =
    null;
  if (profile) {
    try {
      const supabase = await createSupabaseServerClient();
      urgent = await getUrgentDeadlineForRole(supabase, profile.role, profile.id);
    } catch {
      // Banner is best-effort — never break the page render over it.
      urgent = null;
    }
  }
  const urgentHref =
    profile?.role === "provider"
      ? "/provider/dashboard"
      : profile?.role === "admin"
        ? "/admin/dashboard"
        : "/buyer/orders";

  return (
    <html lang="en-ZA" className={jakarta.variable} suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col font-sans text-body text-ink antialiased"
        suppressHydrationWarning
      >
        <CartProvider>
        {urgent ? (
          <UrgentActionBanner
            deadline={urgent.deadline}
            href={urgentHref}
            kind={urgent.kind}
            startedAt={
              urgent.kind === "accept" || urgent.kind === "wait_for_seller"
                ? undefined
                : undefined
            }
            totalCount={urgent.totalCount}
          />
        ) : null}
        <header
          className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur"
          data-testid="site-header"
        >
          {/* Row 1: logo + persistent search (desktop) + cart + account.
              `justify-between` pushes the logo to the far left and the
              action cluster to the far right so the mobile header reads
              edge-to-edge instead of bunching on one side. */}
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 font-semibold"
              data-testid="nav-home-link"
            >
              <span className="brand-mark h-11 w-11 sm:h-12 sm:w-12">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={`${APP_NAME} logo`}
                  className="h-full w-full object-contain"
                  src="/thumeka.png"
                />
              </span>
            </Link>

            {/* Desktop search sits inline between logo and account cluster.
                Wrapped in Suspense — useSearchParams() forces a client-side
                bailout for static prerender otherwise. */}
            <div className="hidden min-w-0 flex-1 sm:flex">
              <Suspense fallback={<div className="h-10 w-full" />}>
                <HeaderSearchInput />
              </Suspense>
            </div>

            <nav
              aria-label="Account"
              className="flex shrink-0 items-center gap-3 sm:gap-3"
              data-testid="desktop-nav"
            >
              {canShop ? <CartIcon /> : null}
              {profile ? (
                <AccountDropdown
                  dashboardHref={roleHomePath(profile.role)}
                  email={profile.email}
                  fullName={profile.full_name ?? null}
                  role={profile.role}
                />
              ) : (
                <>
                  <Link
                    className="hidden text-sm font-semibold text-ink transition hover:text-leaf sm:inline"
                    data-testid="nav-sign-in-link"
                    href="/auth/sign-in"
                  >
                    Sign in
                  </Link>
                  <Link
                    className="rounded-full bg-ink px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-leaf"
                    data-testid="nav-register-link"
                    href="/auth/register"
                  >
                    Register
                  </Link>
                </>
              )}
              {/* Mobile-only hamburger for any remaining nav links the
                  account dropdown doesn't cover (Browse, Support). */}
              <div className="sm:hidden">
                <MobileNavMenu>
                  <Link
                    className="btn-secondary"
                    data-testid="mobile-nav-browse-link"
                    href="/"
                  >
                    Browse
                  </Link>
                  <Link
                    className="btn-secondary"
                    data-testid="mobile-nav-support-link"
                    href="/support"
                  >
                    Support
                  </Link>
                  {!profile ? (
                    <>
                      <Link
                        className="btn-secondary"
                        data-testid="mobile-nav-sell-link"
                        href="/provider/apply"
                      >
                        Sell on {APP_NAME}
                      </Link>
                      <Link
                        className="btn-secondary"
                        data-testid="mobile-nav-drive-link"
                        href="/driver/apply"
                      >
                        Drive for {APP_NAME}
                      </Link>
                      <Link
                        className="btn-primary"
                        data-testid="mobile-nav-sign-in-link"
                        href="/auth/sign-in"
                      >
                        Sign in
                      </Link>
                    </>
                  ) : null}
                </MobileNavMenu>
              </div>
            </nav>
          </div>

          {/* Row 2: mobile-only persistent search underneath the logo row. */}
          <div className="border-t border-black/5 px-4 py-2 sm:hidden">
            <Suspense fallback={<div className="h-9 w-full" />}>
              <HeaderSearchInput variant="compact" />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 pb-20 sm:pb-0" data-testid="app-main">
          {children}
        </main>
        {profile ? (
          <BottomNav
            dashboardHref={roleHomePath(profile.role)}
            email={profile.email}
            role={profile.role}
          />
        ) : null}
        <footer
          className="mt-12 border-t border-black/10 bg-white"
          data-testid="site-footer"
        >
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            <div>
              <div className="flex items-center gap-2 font-semibold text-ink">
                <span className="brand-mark h-10 w-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`${APP_NAME} logo`}
                    className="h-full w-full object-contain"
                    src="/thumeka.png"
                  />
                </span>
                <span>{APP_NAME}</span>
              </div>
              <p className="mt-3 text-body-sm text-black/55">
                A national marketplace for products, services, and errands.
              </p>
            </div>
            <div>
              <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
                Marketplace
              </p>
              <ul className="mt-3 space-y-2 text-body-sm">
                <li>
                  <Link className="text-ink hover:text-leaf" href="/">
                    Browse listings
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-ink hover:text-leaf"
                    data-testid="footer-why-thumeka-link"
                    href="/welcome"
                  >
                    Why {APP_NAME}?
                  </Link>
                </li>
                <li>
                  <Link className="text-ink hover:text-leaf" href="/auth/register">
                    Become a seller
                  </Link>
                </li>
                <li>
                  <Link className="text-ink hover:text-leaf" href="/auth/register">
                    Drive for {APP_NAME}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
                Support
              </p>
              <ul className="mt-3 space-y-2 text-body-sm">
                <li>
                  <Link className="text-ink hover:text-leaf" href="/support">
                    WhatsApp support
                  </Link>
                </li>
                {bugReportUrl ? (
                  <li>
                    <a
                      className="text-ink hover:text-leaf"
                      data-testid="footer-report-bug-link"
                      href={bugReportUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Report a bug
                    </a>
                  </li>
                ) : (
                  <li>
                    <a
                      className="text-ink hover:text-leaf"
                      data-testid="footer-report-bug-fallback"
                      href="mailto:admin@thumeka.co.za?subject=Bug%20report"
                    >
                      Report a bug
                    </a>
                  </li>
                )}
                <li>
                  <ReplayOnboardingLink className="text-ink hover:text-leaf" />
                </li>
                <li>
                  <Link className="text-ink hover:text-leaf" href="/auth/sign-in">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
                Legal
              </p>
              <ul className="mt-3 space-y-2 text-body-sm">
                <li>
                  <Link className="text-ink hover:text-leaf" href="/terms">
                    Terms
                  </Link>
                </li>
                <li>
                  <Link className="text-ink hover:text-leaf" href="/privacy">
                    Privacy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-black/10">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 text-caption text-black/45 sm:px-6 lg:px-8">
              <span>
                &copy; {new Date().getFullYear()} {APP_NAME}. Built in South Africa.
              </span>
              <span>en-ZA</span>
            </div>
          </div>
        </footer>
        </CartProvider>
      </body>
    </html>
  );
}

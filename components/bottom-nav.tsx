"use client";

import { clsx } from "clsx";
import { Home, LayoutDashboard, LogOut, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Drawer } from "@/components/drawer";
import type { AppRole } from "@/lib/constants";
import { roleClasses } from "@/lib/role-theme";

type BottomNavProps = {
  email: string;
  role: AppRole;
  dashboardHref: string;
};

const ROLE_LABEL: Record<AppRole, string> = {
  buyer: "Buyer",
  provider: "Provider",
  driver: "Driver",
  admin: "Admin"
};

/**
 * Fixed bottom navigation for signed-in mobile users. Hidden at sm+ where the
 * header nav is fully visible. The Account item opens a bottom-sheet showing
 * the email, role, and sign-out — not a route, since there's no profile page
 * yet.
 */
export function BottomNav({ email, role, dashboardHref }: BottomNavProps) {
  const pathname = usePathname() ?? "/";
  const [accountOpen, setAccountOpen] = useState(false);
  // Active items wear the signed-in user's role colour so the nav anchors
  // their space — buyer = sky, provider = leaf, driver = iris, admin = brand.
  const accent = roleClasses(role);

  const items = [
    { label: "Home", href: "/", icon: Home, testid: "bottom-nav-home" },
    { label: "Browse", href: "/listings", icon: Search, testid: "bottom-nav-browse" },
    {
      label: "Dashboard",
      href: dashboardHref,
      icon: LayoutDashboard,
      testid: "bottom-nav-dashboard"
    }
  ] as const;

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur sm:hidden"
        data-testid="bottom-nav"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-stretch">
          {items.map(({ label, href, icon: Icon, testid }) => {
            const isActive = href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-caption font-semibold transition",
                  isActive ? accent.text : "text-black/55 hover:text-ink"
                )}
                data-testid={testid}
                href={href}
                key={href}
              >
                {/* Soft role-coloured halo when active — gives the active tab
                    a clear "selected" state instead of just a colour shift. */}
                <span
                  className={clsx(
                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                    isActive && accent.bgSoft
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            className={clsx(
              "flex flex-1 flex-col items-center justify-center gap-1 text-caption font-semibold transition",
              accountOpen ? accent.text : "text-black/55 hover:text-ink"
            )}
            data-testid="bottom-nav-account"
            onClick={() => setAccountOpen(true)}
            type="button"
          >
            <span
              className={clsx(
                "flex h-9 w-9 items-center justify-center rounded-full transition",
                accountOpen && accent.bgSoft
              )}
            >
              <User aria-hidden="true" className="h-5 w-5" />
            </span>
            <span>Account</span>
          </button>
        </div>
      </nav>

      <Drawer
        data-testid="bottom-nav-account-sheet"
        onClose={() => setAccountOpen(false)}
        open={accountOpen}
        title="Account"
      >
        <div className="space-y-5">
          <div>
            <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
              Signed in as
            </p>
            <p className="mt-1 text-body font-semibold text-ink">{email}</p>
            <span
              className={clsx(
                "mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-caption font-semibold",
                accent.bgSoft,
                accent.text
              )}
              data-testid="bottom-nav-role-badge"
            >
              {ROLE_LABEL[role]}
            </span>
          </div>
          <form action="/auth/sign-out" method="post">
            <button
              className="btn-secondary w-full"
              data-testid="bottom-nav-sign-out-button"
              type="submit"
            >
              <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </div>
      </Drawer>
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Mail,
  ShoppingBag,
  Store,
  Truck
} from "lucide-react";

import { APP_NAME, type AppRole } from "@/lib/constants";

type AccountDropdownProps = {
  email: string;
  fullName: string | null;
  role: AppRole;
  dashboardHref: string;
};

/**
 * Avatar + pop-over menu replacing the loose Dashboard / Sign out /
 * Sell on Thumeka / Drive for Thumeka text links from the header right
 * cluster. Mirrors the open/close behaviour from MobileNavMenu so the
 * same outside-click + Escape interactions apply.
 *
 * The menu shape varies by role:
 *   - Buyers see "My orders" + acquisition CTAs for Sell/Drive.
 *   - Providers see "Provider status" + acquisition CTA for Drive.
 *   - Drivers see "Driver status" + acquisition CTA for Sell.
 *   - Admins just see Dashboard + Sign out.
 *
 * Signed-out users are handled at the call site — they see the
 * regular Sign in / Register buttons instead of this dropdown.
 */
export function AccountDropdown({
  email,
  fullName,
  role,
  dashboardHref
}: AccountDropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        wrapperRef.current &&
        target &&
        !wrapperRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = getInitials(fullName, email);

  return (
    <div className="relative" data-testid="account-dropdown" ref={wrapperRef}>
      <button
        aria-controls="account-dropdown-panel"
        aria-expanded={open}
        aria-label={open ? "Close account menu" : "Open account menu"}
        className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white pl-1 pr-2 py-1 transition hover:border-leaf focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-1"
        data-testid="account-dropdown-toggle"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf text-xs font-bold uppercase text-white"
        >
          {initials}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 text-black/55 transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-black/10 bg-white shadow-soft"
          data-testid="account-dropdown-panel"
          id="account-dropdown-panel"
          onClick={() => setOpen(false)}
        >
          <div className="border-b border-black/5 px-3 py-2">
            <p className="flex items-center gap-2 text-caption text-black/45">
              <Mail aria-hidden="true" className="h-3 w-3" />
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-body-sm font-semibold text-ink">
              {email}
            </p>
          </div>

          <ul className="py-1">
            <li>
              <Link
                className="flex items-center gap-2 px-3 py-2 text-body-sm text-ink transition hover:bg-mist"
                data-testid="account-dropdown-dashboard"
                href={dashboardHref}
              >
                <LayoutDashboard
                  aria-hidden="true"
                  className="h-4 w-4 text-black/55"
                />
                Dashboard
              </Link>
            </li>
            {role === "buyer" ? (
              <li>
                <Link
                  className="flex items-center gap-2 px-3 py-2 text-body-sm text-ink transition hover:bg-mist"
                  data-testid="account-dropdown-my-orders"
                  href="/buyer/orders"
                >
                  <ShoppingBag
                    aria-hidden="true"
                    className="h-4 w-4 text-black/55"
                  />
                  My orders
                </Link>
              </li>
            ) : null}
            {role === "provider" ? (
              <li>
                <Link
                  className="flex items-center gap-2 px-3 py-2 text-body-sm text-ink transition hover:bg-mist"
                  data-testid="account-dropdown-provider-status"
                  href="/provider/status"
                >
                  <Store
                    aria-hidden="true"
                    className="h-4 w-4 text-black/55"
                  />
                  Provider status
                </Link>
              </li>
            ) : null}
            {role === "driver" ? (
              <li>
                <Link
                  className="flex items-center gap-2 px-3 py-2 text-body-sm text-ink transition hover:bg-mist"
                  data-testid="account-dropdown-driver-status"
                  href="/driver/status"
                >
                  <Truck
                    aria-hidden="true"
                    className="h-4 w-4 text-black/55"
                  />
                  Driver status
                </Link>
              </li>
            ) : null}
          </ul>

          {role !== "admin" ? (
            <>
              <div className="border-t border-black/5" />
              <ul className="py-1">
                {role !== "provider" ? (
                  <li>
                    <Link
                      className="flex items-center gap-2 px-3 py-2 text-body-sm text-ink transition hover:bg-mist"
                      data-testid="account-dropdown-sell"
                      href="/provider/apply"
                    >
                      <Store
                        aria-hidden="true"
                        className="h-4 w-4 text-black/55"
                      />
                      Sell on {APP_NAME}
                    </Link>
                  </li>
                ) : null}
                {role !== "driver" ? (
                  <li>
                    <Link
                      className="flex items-center gap-2 px-3 py-2 text-body-sm text-ink transition hover:bg-mist"
                      data-testid="account-dropdown-drive"
                      href="/driver/apply"
                    >
                      <Truck
                        aria-hidden="true"
                        className="h-4 w-4 text-black/55"
                      />
                      Drive for {APP_NAME}
                    </Link>
                  </li>
                ) : null}
                <li>
                  <Link
                    className="flex items-center gap-2 px-3 py-2 text-body-sm text-ink transition hover:bg-mist"
                    data-testid="account-dropdown-support"
                    href="/support"
                  >
                    <HelpCircle
                      aria-hidden="true"
                      className="h-4 w-4 text-black/55"
                    />
                    Support
                  </Link>
                </li>
              </ul>
            </>
          ) : null}

          <div className="border-t border-black/5" />
          <Link
            className="flex items-center gap-2 px-3 py-2 text-body-sm font-semibold text-coral transition hover:bg-coral/5"
            data-testid="account-dropdown-sign-out"
            href="/auth/sign-out"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sign out
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

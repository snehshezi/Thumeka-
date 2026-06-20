"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

type MobileNavMenuProps = {
  /**
   * Items rendered inside the dropdown. Any click within bubbles up to the
   * close handler, so tapping a link both navigates AND closes the menu
   * (server-rendered <Link>s pass through unchanged).
   */
  children: React.ReactNode;
};

/**
 * Replacement for the native `<details>` / `<summary>` dropdown that used to
 * live in the header. The native version persisted its `open` state across
 * Next.js soft-navigations (the layout doesn't re-render, so the element
 * isn't reset), which made the menu appear "stuck open" after tapping a link
 * on mobile.
 *
 * This component owns its own open state and closes on:
 *   • tap of any link inside the menu (the panel itself has an onClick that
 *     resets state — link navigation still fires because we don't preventDefault)
 *   • outside click (mousedown on document outside the wrapper)
 *   • Escape key
 *
 * Visible only on mobile — desktop nav lives in the same row in app/layout.tsx
 * and is hidden via Tailwind `sm:flex` / `sm:hidden`.
 */
export function MobileNavMenu({ children }: MobileNavMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (wrapperRef.current && target && !wrapperRef.current.contains(target)) {
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

  return (
    <div
      className="relative sm:hidden"
      data-testid="mobile-nav-menu"
      ref={wrapperRef}
    >
      <button
        aria-controls="mobile-nav-panel"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-black/15 bg-white"
        data-testid="mobile-nav-toggle"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        {open ? (
          <X aria-hidden="true" className="h-5 w-5" />
        ) : (
          <Menu aria-hidden="true" className="h-5 w-5" />
        )}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 flex w-56 max-w-[calc(100vw-1.5rem)] flex-col gap-2 rounded-lg border border-black/10 bg-white p-2 shadow-soft"
          id="mobile-nav-panel"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

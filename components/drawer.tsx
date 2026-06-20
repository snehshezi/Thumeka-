"use client";

import { clsx } from "clsx";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  "data-testid"?: string;
};

export function Drawer({
  open,
  onClose,
  title,
  children,
  "data-testid": testId
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={clsx(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      <div
        className={clsx(
          "absolute inset-0 bg-ink/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />
      <div
        aria-labelledby={open ? titleId : undefined}
        aria-modal={open ? true : undefined}
        className={clsx(
          // Bottom-sheet on mobile, right-side drawer on sm+
          "absolute bottom-0 left-0 right-0 flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-mist shadow-soft outline-none transition-transform duration-300",
          "sm:bottom-0 sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none",
          "lg:max-w-lg",
          open
            ? "translate-y-0 sm:translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        )}
        data-testid={testId}
        ref={panelRef}
        role={open ? "dialog" : undefined}
        tabIndex={-1}
      >
        {/* Mobile grab handle */}
        <div
          aria-hidden="true"
          className="flex justify-center pt-2 sm:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-white px-5 py-4 sm:rounded-none">
          <h2 className="text-h2 text-ink" id={titleId}>
            {title}
          </h2>
          <button
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md text-black/50 transition hover:bg-black/5 hover:text-ink focus:outline-none focus:ring-2 focus:ring-leaf"
            data-testid="drawer-close-button"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

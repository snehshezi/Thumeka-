"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Truck,
  X,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "thumeka.onboarded";

type Card = {
  icon: LucideIcon;
  /** Icon background tint */
  tint: "leaf" | "sunset" | "sky" | "iris";
  title: string;
  body: string;
};

const CARDS: Card[] = [
  {
    icon: Clock,
    tint: "sunset",
    title: "Open 24/7",
    body: "Browse, order, and pay around the clock. Live stores rise to the top of the grid so you know who's open right now."
  },
  {
    icon: Truck,
    tint: "sky",
    title: "Anything, delivered",
    body: "Anything delivered within an average of 40 minutes. Approved drivers handle the last mile so you don't have to."
  },
  {
    icon: Sparkles,
    tint: "iris",
    title: "Start browsing",
    body: "Tap any category to begin. We'll keep you posted as your order moves — and if something breaks, the Report a bug link in the footer goes straight to our WhatsApp."
  }
];

const TINT_CLASSES: Record<Card["tint"], string> = {
  leaf: "bg-mint text-leaf",
  sunset: "bg-sunset/15 text-sunset",
  sky: "bg-sky/10 text-sky",
  iris: "bg-iris/10 text-iris"
};

/**
 * First-visit onboarding card deck. Renders nothing once dismissed
 * (localStorage key persists across reloads). Built on a native
 * `<dialog>` so focus trap + Escape come for free; we add
 * arrow-key navigation between cards and a backdrop-click close.
 *
 * Mounted on `/` (the homepage). Suppressed when the URL has a
 * `?q=` search keyword — we don't want to interrupt someone who
 * arrived mid-search.
 */
export function OnboardingOverlay() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);

  // Open the dialog once on first client commit, gated on localStorage.
  //
  // The `<dialog>` is always rendered (closed by default) so the ref is
  // attached by the time this effect runs — gating the JSX on a
  // `mounted` state would mean the ref is still null when showModal()
  // fires, and the deck would never open. Old iOS Safari (<15.4)
  // doesn't expose `showModal`, so we feature-detect and no-op rather
  // than throw.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== "function") return;
    // Skip during a keyword search — let the buyer focus on results.
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("q")?.trim()) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // localStorage unavailable (e.g. iOS Safari private mode on very
      // old iOS) — open anyway. Worst case the user dismisses again.
    }
    try {
      dialog.showModal();
    } catch {
      // showModal throws if the dialog is already open (e.g. a
      // hot-reload double-fired the effect). Nothing to do.
    }
  }, []);

  // Body scroll lock + arrow-key navigation. Native <dialog> handles
  // Escape, but we add ← / → for the carousel.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onOpenChange = () => {
      document.body.style.overflow = dialog.open ? "hidden" : "";
    };
    const onKey = (event: KeyboardEvent) => {
      if (!dialog.open) return;
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(current + 1, CARDS.length - 1));
      } else if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(current - 1, 0));
      }
    };
    const observer = new MutationObserver(onOpenChange);
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    document.addEventListener("keydown", onKey);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);

  function persistDismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Best-effort. If localStorage isn't available we'll re-show on
      // next visit — better than crashing.
    }
  }

  function close() {
    persistDismiss();
    dialogRef.current?.close();
  }

  function next() {
    if (index >= CARDS.length - 1) {
      close();
      return;
    }
    setIndex(index + 1);
  }

  function back() {
    setIndex(Math.max(index - 1, 0));
  }

  function handleDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
    // Native <dialog> reports click-on-backdrop by targeting itself.
    if (event.target === dialogRef.current) {
      close();
    }
  }

  const card = CARDS[index];
  const Icon = card.icon;
  const isLast = index === CARDS.length - 1;

  return (
    <dialog
      aria-labelledby="onboarding-title"
      className="m-auto w-full max-w-md rounded-2xl border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/55 sm:w-[min(92vw,28rem)]"
      data-testid="onboarding-overlay"
      onClick={handleDialogClick}
      ref={dialogRef}
    >
      <div className="flex flex-col gap-5 px-6 py-7 text-center sm:px-8 sm:py-8">
        <button
          aria-label="Skip the tour"
          className="absolute right-3 top-3 rounded-full p-1.5 text-black/45 transition hover:bg-mist hover:text-ink"
          data-testid="onboarding-skip"
          onClick={close}
          type="button"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>

        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${TINT_CLASSES[card.tint]}`}
        >
          <Icon aria-hidden="true" className="h-7 w-7" />
        </div>

        <div>
          <h2
            className="text-h2 text-ink"
            data-testid="onboarding-card-title"
            id="onboarding-title"
          >
            {card.title}
          </h2>
          <p className="mt-2 text-body-sm text-black/65">{card.body}</p>
        </div>

        <div
          aria-label="Onboarding progress"
          className="flex items-center justify-center gap-1.5"
          data-testid="onboarding-dots"
        >
          {CARDS.map((_, dotIndex) => (
            <span
              aria-current={dotIndex === index ? "step" : undefined}
              className={
                dotIndex === index
                  ? "h-1.5 w-6 rounded-full bg-leaf"
                  : "h-1.5 w-1.5 rounded-full bg-black/15"
              }
              key={dotIndex}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            aria-label="Previous"
            className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-body-sm font-semibold text-black/55 transition hover:text-ink disabled:invisible"
            data-testid="onboarding-back"
            disabled={index === 0}
            onClick={back}
            type="button"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            Back
          </button>

          <button
            className="btn-primary inline-flex items-center gap-2"
            data-testid={isLast ? "onboarding-done" : "onboarding-next"}
            onClick={next}
            type="button"
          >
            {isLast ? (
              <>
                Got it
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * Footer "Replay tour" link — clears the localStorage flag and reloads.
 * Useful for QA, and for buyers who dismissed too quickly.
 */
export function ReplayOnboardingLink({
  className,
  children = "Replay tour"
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  function onClick() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Best-effort.
    }
    window.location.assign("/");
  }
  return (
    <button
      className={className}
      data-testid="onboarding-replay"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

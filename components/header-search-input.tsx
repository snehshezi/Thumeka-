"use client";

import { Loader2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type HeaderSearchInputProps = {
  className?: string;
  /** Visual variant. "compact" is the mobile header row; "default" is
   *  the desktop search bar. */
  variant?: "default" | "compact";
};

/**
 * Persistent header search.
 *
 * Polymorphic behaviour driven off `usePathname()`:
 *
 *   - On `/`: behaves as a live debounced search (replace `?q=`).
 *     The homepage server component re-runs `getMarketplaceData`
 *     with the keyword and the grid refreshes in place.
 *   - Anywhere else: form-submit only. Enter / Search button routes
 *     to `/?q=<value>` via `router.push`. Buyer can search from the
 *     cart, listing detail, dashboards — they all funnel back to the
 *     marketplace.
 *
 * Active category + other filter params on the homepage are preserved
 * when the keyword changes; from off-homepage the navigate is fresh.
 */
export function HeaderSearchInput({
  className,
  variant = "default"
}: HeaderSearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHomepage = pathname === "/";

  const initialValue = isHomepage ? (searchParams.get("q") ?? "") : "";
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNavigatedRef = useRef(initialValue);

  // Sync input value from URL when the homepage navigates externally
  // (e.g. a category tile push that includes a q param).
  useEffect(() => {
    if (!isHomepage) return;
    const next = searchParams.get("q") ?? "";
    if (next !== value) {
      setValue(next);
      lastNavigatedRef.current = next;
    }
    // value intentionally excluded so live typing isn't clobbered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHomepage, searchParams]);

  function buildHomepageUrl(nextValue: string): string {
    const trimmed = nextValue.trim();
    const params = new URLSearchParams();
    // Preserve everything else on the homepage when typing.
    if (isHomepage) {
      searchParams.forEach((paramValue, key) => {
        if (key !== "q") params.set(key, paramValue);
      });
    }
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function navigateLive(nextValue: string) {
    const trimmed = nextValue.trim();
    if (trimmed === lastNavigatedRef.current) return;
    lastNavigatedRef.current = trimmed;
    startTransition(() => {
      router.replace(buildHomepageUrl(nextValue), { scroll: false });
    });
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    if (!isHomepage) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigateLive(next), 250);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isHomepage) {
      navigateLive(value);
      return;
    }
    startTransition(() => {
      router.push(buildHomepageUrl(value));
    });
  }

  const heightCls = variant === "compact" ? "h-10" : "h-11";

  return (
    <form
      action="/"
      className={`flex w-full items-center gap-2 rounded-full border border-black/10 bg-white px-2 shadow-soft transition focus-within:border-leaf focus-within:ring-2 focus-within:ring-leaf/30 ${heightCls} ${className ?? ""}`}
      data-testid="header-search-form"
      onSubmit={onSubmit}
      role="search"
    >
      {isPending ? (
        <Loader2
          aria-hidden="true"
          className="ml-2 h-4 w-4 flex-none animate-spin text-leaf"
          data-testid="header-search-loading"
        />
      ) : (
        <Search
          aria-hidden="true"
          className="ml-2 h-4 w-4 flex-none text-black/40"
        />
      )}
      <label className="sr-only" htmlFor="header-search-input">
        Search the marketplace
      </label>
      <input
        aria-busy={isPending}
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-black/40"
        data-testid="header-search-input"
        id="header-search-input"
        name="q"
        onChange={onChange}
        placeholder="Search Thumeka — food, fashion, errands…"
        type="search"
        value={value}
      />
      <button
        className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-white transition hover:bg-leaf"
        data-testid="header-search-button"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}

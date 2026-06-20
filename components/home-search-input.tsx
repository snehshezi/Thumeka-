"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";

type HomeSearchInputProps = {
  /** Initial value from the server-rendered ?q=… */
  defaultValue?: string;
  /** Active category from the sidebar, preserved on every URL update. */
  category?: string;
};

/**
 * Live keyword search for the marketplace browse page.
 *
 * Typing debounces 250ms then pushes the new `?q=…` into the URL via
 * `router.replace` — the server component re-runs `getMarketplaceData`
 * with the new keyword and the grid re-renders without a full page
 * navigation. We use `replace` (not `push`) so the browser back button
 * doesn't fill up with intermediate keystroke states.
 *
 * The form's `<button type="submit">` still works for non-JS users
 * and "press Enter to search" — when submitted, we flush the debounce
 * and fire the navigation immediately.
 *
 * `useTransition` wraps the router call so the input stays responsive
 * (no input lag) while the server renders the new results.
 */
export function HomeSearchInput({ defaultValue, category }: HomeSearchInputProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue ?? "");
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the last URL we pushed so a server-driven prop update (e.g.
  // user clicked "Clear search") doesn't trigger a redundant replace.
  const lastNavigatedRef = useRef(defaultValue ?? "");

  // External prop changes (Clear search link, category swap) should
  // sync into the controlled input so it stays in lock-step with the URL.
  useEffect(() => {
    const next = defaultValue ?? "";
    if (next !== value) {
      setValue(next);
      lastNavigatedRef.current = next;
    }
    // We intentionally exclude `value` from deps — including it would
    // overwrite live typing on every server re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  function navigate(rawValue: string) {
    const trimmed = rawValue.trim();
    if (trimmed === lastNavigatedRef.current) return;
    lastNavigatedRef.current = trimmed;

    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (trimmed) params.set("q", trimmed);
    const qs = params.toString();
    const next = qs ? `/?${qs}` : "/";

    startTransition(() => {
      router.replace(next, { scroll: false });
    });
  }

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(next), 250);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(value);
  }

  return (
    <form
      action="/"
      className="flex gap-2 rounded-lg border border-black/10 bg-white p-2"
      data-testid="home-search-form"
      onSubmit={onSubmit}
    >
      <label className="flex min-w-0 flex-1 items-center gap-2 px-2">
        {isPending ? (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 flex-none animate-spin text-leaf"
            data-testid="home-search-loading"
          />
        ) : (
          <Search
            aria-hidden="true"
            className="h-4 w-4 flex-none text-black/45"
          />
        )}
        <span className="sr-only">Search listings</span>
        <input
          aria-busy={isPending}
          className="min-h-10 w-full bg-transparent text-sm outline-none"
          data-testid="home-search-input"
          name="q"
          onChange={onChange}
          placeholder="Search food, repairs, errands"
          type="search"
          value={value}
        />
      </label>
      {category ? (
        <input name="category" type="hidden" value={category} />
      ) : null}
      <button
        className="btn-secondary px-3"
        data-testid="home-search-button"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useTransition } from "react";

import { formatMoney } from "@/lib/format";
import {
  parseCategoryList,
  serialiseCategoryList
} from "@/lib/marketplace-filters";

type ActiveFilter = {
  /** URL param key (`category`, `suburb`, etc.) used to remove this
   *  filter when the chip is dismissed. For `min_price` / `max_price`
   *  the chip removes both at once. Category chips remove one entry from
   *  the comma-separated list rather than the whole param. */
  param:
    | "category"
    | "q"
    | "suburb"
    | "open_only"
    | "sort"
    | "price"
    | "min_price"
    | "max_price";
  label: string;
  /** Set for `category` chips so removeChip knows which one to drop. */
  value?: string;
};

type MarketplaceActiveFiltersProps = {
  className?: string;
};

/**
 * Strip of dismissible chips for every applied filter.
 *
 * Reads the URL params, computes the chips inline (so the strip stays
 * in lock-step with the URL with no prop drilling), and removes one
 * filter per dismiss tap via `router.replace`. Includes a "Clear all"
 * button when more than one filter is active.
 *
 * Renders nothing when no filters are applied.
 */
export function MarketplaceActiveFilters({
  className
}: MarketplaceActiveFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const chips: ActiveFilter[] = [];
  const q = searchParams.get("q")?.trim();
  if (q) chips.push({ param: "q", label: `“${q}”` });
  // One chip per selected category — buyers can multi-select and dismiss
  // them individually.
  const activeCategories = parseCategoryList(
    searchParams.get("category") ?? ""
  );
  for (const name of activeCategories) {
    chips.push({ param: "category", label: name, value: name });
  }
  const sort = searchParams.get("sort");
  if (sort && sort !== "newest") {
    chips.push({
      param: "sort",
      label:
        sort === "price_asc"
          ? "Price: low to high"
          : sort === "price_desc"
            ? "Price: high to low"
            : sort === "oldest"
              ? "Oldest first"
              : sort
    });
  }
  const minPrice = searchParams.get("min_price");
  const maxPrice = searchParams.get("max_price");
  if (minPrice || maxPrice) {
    const min = minPrice ? formatMoney(Number(minPrice)) : "Any";
    const max = maxPrice ? formatMoney(Number(maxPrice)) : "Any";
    chips.push({ param: "price", label: `${min} – ${max}` });
  }
  const suburb = searchParams.get("suburb");
  if (suburb) chips.push({ param: "suburb", label: suburb });
  if (searchParams.get("open_only") === "1") {
    chips.push({ param: "open_only", label: "Open now" });
  }

  if (chips.length === 0) return null;

  function removeChip(filter: ActiveFilter) {
    const params = new URLSearchParams(searchParams.toString());
    if (filter.param === "price") {
      params.delete("min_price");
      params.delete("max_price");
    } else if (filter.param === "category" && filter.value) {
      // Drop only this one category; keep the rest of the multi-select.
      const next = activeCategories.filter(
        (name) => name.toLowerCase() !== filter.value!.toLowerCase()
      );
      const serialised = serialiseCategoryList(next);
      if (serialised) params.set("category", serialised);
      else params.delete("category");
    } else {
      params.delete(filter.param);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    });
  }

  function clearAll() {
    const params = new URLSearchParams();
    // Keep the keyword if we want? Decision: also clear it; the buyer
    // can tap "Browse listings" / the logo if they want fresh start.
    // Active chips are the things they explicitly applied — wipe all.
    startTransition(() => {
      router.replace(params.toString() ? `/?${params}` : "/", {
        scroll: false
      });
    });
  }

  return (
    <div
      aria-busy={isPending}
      aria-label="Active filters"
      className={`flex flex-wrap items-center gap-2 transition-opacity ${
        isPending ? "opacity-60" : ""
      } ${className ?? ""}`}
      data-testid="marketplace-active-filters"
    >
      {chips.map((chip) => (
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-leaf/30 bg-mint px-3 py-1 text-caption font-semibold text-leaf transition hover:bg-leaf hover:text-white"
          data-testid={
            chip.param === "category"
              ? `active-filter-category-${chip.value}`
              : `active-filter-${chip.param}`
          }
          key={
            chip.param === "category"
              ? `category-${chip.value}`
              : `${chip.param}-${chip.label}`
          }
          onClick={() => removeChip(chip)}
          type="button"
        >
          {chip.label}
          <X aria-hidden="true" className="h-3 w-3" />
        </button>
      ))}
      {chips.length > 1 ? (
        <button
          className="text-caption font-semibold text-black/55 underline hover:text-coral"
          data-testid="active-filters-clear-all"
          onClick={clearAll}
          type="button"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

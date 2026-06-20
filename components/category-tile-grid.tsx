"use client";

import { LayoutGrid } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import {
  CATEGORY_TINT_CLASSES,
  getCategoryVisual
} from "@/lib/category-visuals";
import {
  parseCategoryList,
  serialiseCategoryList
} from "@/lib/marketplace-filters";

type CategoryTileGridProps = {
  categories: string[];
  /** Multi-select — zero or more active category names. */
  activeCategories: string[];
  /** Visual size of each tile in the rail. Mobile keeps it tight;
   *  desktop bumps the icon + label a notch for legibility. The rail
   *  itself is the same horizontal-scroll shape either way. */
  layout: "mobile" | "desktop";
  className?: string;
};

/**
 * Icon-tile scroll rail for category discovery.
 *
 * Single-row, horizontal-scroll strip — barely takes any vertical
 * space so it can live above the filter strip permanently (no
 * "Show categories" toggle needed). Tapping a tile toggles it in the
 * URL's comma-separated `?category=` list — buyers can pick more than
 * one category at a time. Other URL params (search keyword, sort,
 * price band) are preserved.
 */
export function CategoryTileGrid({
  categories,
  activeCategories,
  layout,
  className
}: CategoryTileGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function urlFor(nextSelection: string[]): string {
    const params = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== "category") params.set(key, value);
    });
    const serialised = serialiseCategoryList(nextSelection);
    if (serialised) params.set("category", serialised);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function onTap(category: string) {
    // Re-read the URL so we don't lose selections made between renders
    // (the prop is stale once a parallel tap is in flight).
    const current = parseCategoryList(searchParams.get("category") ?? "");
    const lower = category.toLowerCase();
    const isActive = current.some((name) => name.toLowerCase() === lower);
    const next = isActive
      ? current.filter((name) => name.toLowerCase() !== lower)
      : [...current, category];
    startTransition(() => {
      router.replace(urlFor(next), { scroll: false });
    });
  }

  function onTapAll() {
    // Clear every selected category. Keeps other URL params intact
    // (sort, suburb, price band) — only the category list is wiped.
    startTransition(() => {
      router.replace(urlFor([]), { scroll: false });
    });
  }
  const allActive = activeCategories.length === 0;

  const tileWidthCls =
    layout === "mobile" ? "w-[76px]" : "w-[88px]";
  const iconBoxCls =
    layout === "mobile" ? "h-10 w-10" : "h-11 w-11";
  const iconSizeCls =
    layout === "mobile" ? "h-5 w-5" : "h-[22px] w-[22px]";

  return (
    <div
      aria-busy={isPending}
      aria-label="Categories"
      // `[&::-webkit-scrollbar]:hidden` hides the scrollbar on
      // WebKit/Blink; `[-ms-overflow-style:none] [scrollbar-width:none]`
      // covers IE/Edge legacy and Firefox. No external utility needed.
      className={`flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-pl-1 pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${className ?? ""}`}
      data-testid={`category-tile-rail-${layout}`}
    >
      {/* "All" tile — first in the rail. Tapping it clears every
          category from the URL (the listings grid widens to "no
          category filter"). Highlighted when no categories are
          selected. */}
      <button
        aria-pressed={allActive}
        className={`group flex shrink-0 snap-start flex-col items-center justify-start gap-1.5 rounded-2xl border bg-white p-2 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-1 ${tileWidthCls} ${
          allActive
            ? "border-leaf bg-mint"
            : "border-black/10 hover:border-leaf/40"
        }`}
        data-testid="category-tile-all"
        onClick={onTapAll}
        type="button"
      >
        <span
          className={`flex items-center justify-center rounded-full transition group-hover:scale-105 ${iconBoxCls} ${
            allActive ? "bg-leaf text-white" : "bg-black/5 text-black/60"
          }`}
        >
          <LayoutGrid aria-hidden="true" className={iconSizeCls} />
        </span>
        <span className="line-clamp-2 text-caption font-semibold leading-tight text-ink">
          All
        </span>
      </button>

      {categories.map((category) => {
        const isActive = activeCategories.some(
          (name) => name.toLowerCase() === category.toLowerCase()
        );
        const visual = getCategoryVisual(category);
        const tint = CATEGORY_TINT_CLASSES[visual.tint];
        const Icon = visual.icon;
        return (
          <button
            aria-pressed={isActive}
            className={`group flex shrink-0 snap-start flex-col items-center justify-start gap-1.5 rounded-2xl border bg-white p-2 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-leaf focus:ring-offset-1 ${tileWidthCls} ${
              isActive
                ? "border-leaf bg-mint"
                : "border-black/10 hover:border-leaf/40"
            }`}
            data-testid="category-tile"
            key={category}
            onClick={() => onTap(category)}
            type="button"
          >
            <span
              className={`flex items-center justify-center rounded-full transition group-hover:scale-105 ${iconBoxCls} ${tint.bg} ${tint.fg}`}
            >
              <Icon aria-hidden="true" className={iconSizeCls} />
            </span>
            <span className="line-clamp-2 text-caption font-semibold leading-tight text-ink">
              {category}
            </span>
          </button>
        );
      })}
    </div>
  );
}

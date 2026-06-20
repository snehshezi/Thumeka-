"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { DURBAN_SUBURBS } from "@/lib/constants";

type Layout = "inline" | "stacked";

type MarketplaceFilterControlsProps = {
  layout: Layout;
  /** Closes a parent surface (e.g. the mobile bottom sheet) when the
   *  user taps Apply / Clear. */
  onAfterSubmit?: () => void;
};

/**
 * Shared filter controls used by both the desktop inline strip and
 * the mobile bottom sheet.
 *
 * URL params owned:
 *   - sort:        newest (default), price_asc, price_desc
 *   - min_price:   numeric, optional
 *   - max_price:   numeric, optional
 *   - suburb:      one of DURBAN_SUBURBS
 *   - open_only:   "1" when on
 *
 * Behaviour:
 *   - Dropdowns + toggles fire `router.replace` immediately.
 *   - Number inputs debounce 300ms.
 *   - Clear button wipes only the controls listed here, preserving
 *     category + keyword (those are owned by other surfaces).
 */
export function MarketplaceFilterControls({
  layout,
  onAfterSubmit
}: MarketplaceFilterControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [minPrice, setMinPrice] = useState(
    searchParams.get("min_price") ?? ""
  );
  const [maxPrice, setMaxPrice] = useState(
    searchParams.get("max_price") ?? ""
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep inputs in lock-step when the URL changes from elsewhere
  // (active-filters chip removed, category-tile tap, etc.).
  useEffect(() => {
    setMinPrice(searchParams.get("min_price") ?? "");
    setMaxPrice(searchParams.get("max_price") ?? "");
  }, [searchParams]);

  function buildUrl(mutate: (params: URLSearchParams) => void): string {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  }

  function navigate(next: string) {
    startTransition(() => router.replace(next, { scroll: false }));
  }

  function setParam(key: string, value: string | null) {
    navigate(
      buildUrl((params) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      })
    );
  }

  function onPriceChange(field: "min_price" | "max_price", raw: string) {
    if (field === "min_price") setMinPrice(raw);
    else setMaxPrice(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const value = raw.trim();
      const numeric = Number(value);
      const usable =
        value === ""
          ? null
          : Number.isFinite(numeric) && numeric >= 0
            ? String(Math.floor(numeric))
            : null;
      navigate(
        buildUrl((params) => {
          if (usable === null) params.delete(field);
          else params.set(field, usable);
        })
      );
    }, 300);
  }

  function clearAllControls() {
    navigate(
      buildUrl((params) => {
        params.delete("sort");
        params.delete("min_price");
        params.delete("max_price");
        params.delete("suburb");
        params.delete("open_only");
      })
    );
    onAfterSubmit?.();
  }

  const containerCls =
    layout === "inline"
      ? "flex flex-wrap items-end gap-3"
      : "flex flex-col gap-4";
  const blockCls = layout === "inline" ? "flex flex-col gap-1" : "space-y-1.5";
  const inputCls =
    layout === "inline"
      ? "input h-9 min-h-0 py-1 text-sm"
      : "input";

  const currentSort = searchParams.get("sort") ?? "newest";
  const currentSuburb = searchParams.get("suburb") ?? "";
  const openOnly = searchParams.get("open_only") === "1";

  return (
    <div
      aria-busy={isPending}
      className={`${containerCls} ${isPending ? "opacity-60 transition-opacity" : "transition-opacity"}`}
      data-testid={`marketplace-filter-controls-${layout}`}
    >
      <label className={blockCls}>
        <span className="label text-caption text-black/55">Sort</span>
        <select
          className={inputCls}
          data-testid="filter-sort"
          onChange={(e) =>
            setParam("sort", e.target.value === "newest" ? null : e.target.value)
          }
          value={currentSort}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
      </label>

      <div className={blockCls}>
        <span className="label text-caption text-black/55">Price (R)</span>
        <div className="flex items-center gap-2">
          <input
            className={`${inputCls} max-w-24`}
            data-testid="filter-min-price"
            inputMode="numeric"
            min="0"
            onChange={(e) => onPriceChange("min_price", e.target.value)}
            placeholder="Min"
            type="number"
            value={minPrice}
          />
          <span aria-hidden="true" className="text-black/40">
            –
          </span>
          <input
            className={`${inputCls} max-w-24`}
            data-testid="filter-max-price"
            inputMode="numeric"
            min="0"
            onChange={(e) => onPriceChange("max_price", e.target.value)}
            placeholder="Max"
            type="number"
            value={maxPrice}
          />
        </div>
      </div>

      <label className={blockCls}>
        <span className="label text-caption text-black/55">Suburb</span>
        <select
          className={inputCls}
          data-testid="filter-suburb"
          onChange={(e) =>
            setParam("suburb", e.target.value === "" ? null : e.target.value)
          }
          value={currentSuburb}
        >
          <option value="">Any suburb</option>
          {DURBAN_SUBURBS.map((suburb) => (
            <option key={suburb} value={suburb}>
              {suburb}
            </option>
          ))}
        </select>
      </label>

      <label
        className={`inline-flex items-center gap-2 ${
          layout === "inline" ? "self-center" : "self-start"
        }`}
        data-testid="filter-open-only-label"
      >
        <input
          checked={openOnly}
          className="h-4 w-4 rounded border-black/20 text-leaf focus:ring-leaf"
          data-testid="filter-open-only"
          onChange={(e) =>
            setParam("open_only", e.target.checked ? "1" : null)
          }
          type="checkbox"
        />
        <span className="text-body-sm font-medium text-ink">Open now</span>
      </label>

      <div
        className={
          layout === "inline"
            ? "ml-auto flex items-center gap-2 self-center"
            : "mt-2 flex items-center gap-3"
        }
      >
        <button
          className="text-body-sm font-semibold text-black/55 hover:text-coral"
          data-testid="filter-clear"
          onClick={clearAllControls}
          type="button"
        >
          Clear filters
        </button>
        {layout === "stacked" ? (
          <button
            className="btn-primary flex-1"
            data-testid="filter-apply"
            onClick={() => onAfterSubmit?.()}
            type="button"
          >
            Apply
          </button>
        ) : null}
      </div>
    </div>
  );
}

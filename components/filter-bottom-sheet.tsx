"use client";

import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Drawer } from "@/components/drawer";
import { MarketplaceFilterControls } from "@/components/marketplace-filter-controls";

/**
 * Mobile-only filter button + bottom sheet. Hidden on sm+; the desktop
 * inline strip handles the same controls.
 *
 * The trigger button shows the active filter count next to "Filters" so
 * the buyer knows at a glance which surface is doing the narrowing.
 */
export function FilterBottomSheet() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // Count "advanced" filters (the ones inside the sheet — not keyword,
  // not category, which have their own dedicated surfaces).
  let activeCount = 0;
  if (searchParams.get("sort") && searchParams.get("sort") !== "newest") {
    activeCount += 1;
  }
  if (searchParams.get("min_price") || searchParams.get("max_price")) {
    activeCount += 1;
  }
  if (searchParams.get("suburb")) activeCount += 1;
  if (searchParams.get("open_only") === "1") activeCount += 1;

  return (
    <div className="sm:hidden" data-testid="filter-bottom-sheet">
      <button
        className="btn-secondary inline-flex items-center gap-2"
        data-testid="filter-bottom-sheet-trigger"
        onClick={() => setOpen(true)}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
        Filters
        {activeCount > 0 ? (
          <span
            aria-label={`${activeCount} active filters`}
            className="inline-flex items-center justify-center rounded-full bg-leaf px-2 py-0.5 text-caption font-bold text-white"
            data-testid="filter-bottom-sheet-count"
          >
            {activeCount}
          </span>
        ) : null}
      </button>

      <Drawer
        data-testid="filter-bottom-sheet-drawer"
        onClose={() => setOpen(false)}
        open={open}
        title="Filter listings"
      >
        <MarketplaceFilterControls
          layout="stacked"
          onAfterSubmit={() => setOpen(false)}
        />
      </Drawer>
    </div>
  );
}

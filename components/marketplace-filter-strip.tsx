import { MarketplaceFilterControls } from "@/components/marketplace-filter-controls";

/**
 * Desktop-only inline filter strip. Sits above the listings grid;
 * sticks just below the header on scroll. Mobile uses the bottom
 * sheet instead — this strip is hidden on small viewports.
 */
export function MarketplaceFilterStrip() {
  return (
    <div
      className="sticky top-24 z-10 hidden rounded-lg border border-black/10 bg-white p-3 shadow-soft sm:block"
      data-testid="marketplace-filter-strip"
    >
      <MarketplaceFilterControls layout="inline" />
    </div>
  );
}

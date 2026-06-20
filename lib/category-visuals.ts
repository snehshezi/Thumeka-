import {
  Briefcase,
  Car,
  ClipboardList,
  Hammer,
  Home,
  Laptop,
  Pill,
  Recycle,
  Shirt,
  ShoppingBasket,
  Sparkles,
  SprayCan,
  Tag,
  UtensilsCrossed,
  type LucideIcon
} from "lucide-react";

/**
 * Visual treatment per category. Used by the homepage tile grid and the
 * filter strip / bottom sheet to render an icon + brand-tinted background
 * for each category. Falls back to a neutral Tag icon for any DB row
 * that doesn't have an entry here yet (added category before this map
 * was updated, custom category, etc.).
 */

export type CategoryTint =
  | "coral"
  | "leaf"
  | "sky"
  | "iris"
  | "sunset"
  | "maize"
  | "ink"
  | "neutral";

export type CategoryVisual = {
  icon: LucideIcon;
  tint: CategoryTint;
};

const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  Food: { icon: UtensilsCrossed, tint: "coral" },
  Groceries: { icon: ShoppingBasket, tint: "leaf" },
  Clothing: { icon: Shirt, tint: "sky" },
  "Pre-loved": { icon: Recycle, tint: "iris" },
  Beauty: { icon: Sparkles, tint: "sunset" },
  Medication: { icon: Pill, tint: "coral" },
  "Home services": { icon: Home, tint: "leaf" },
  Cleaning: { icon: SprayCan, tint: "sky" },
  Repairs: { icon: Hammer, tint: "maize" },
  Errands: { icon: ClipboardList, tint: "iris" },
  Transport: { icon: Car, tint: "ink" },
  "Digital services": { icon: Laptop, tint: "sky" },
  Other: { icon: Briefcase, tint: "neutral" }
};

/**
 * Tailwind class fragments per tint. Kept in one place so the tile
 * grid, filter pills, and any future category surface render
 * consistently.
 */
export const CATEGORY_TINT_CLASSES: Record<
  CategoryTint,
  { bg: string; fg: string; ring: string }
> = {
  coral: { bg: "bg-coral/10", fg: "text-coral", ring: "ring-coral/30" },
  leaf: { bg: "bg-mint", fg: "text-leaf", ring: "ring-leaf/30" },
  sky: { bg: "bg-sky/10", fg: "text-sky", ring: "ring-sky/30" },
  iris: { bg: "bg-iris/10", fg: "text-iris", ring: "ring-iris/30" },
  sunset: { bg: "bg-sunset/10", fg: "text-sunset", ring: "ring-sunset/30" },
  maize: { bg: "bg-maize/30", fg: "text-ink", ring: "ring-maize/40" },
  ink: { bg: "bg-ink/10", fg: "text-ink", ring: "ring-ink/30" },
  neutral: { bg: "bg-black/5", fg: "text-black/60", ring: "ring-black/15" }
};

const FALLBACK: CategoryVisual = { icon: Tag, tint: "neutral" };

export function getCategoryVisual(name: string): CategoryVisual {
  return CATEGORY_VISUALS[name] ?? FALLBACK;
}

// Read-only export of the map for tests + lint-time exhaustiveness.
export { CATEGORY_VISUALS };

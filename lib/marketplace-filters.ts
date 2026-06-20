import { DURBAN_SUBURBS } from "@/lib/constants";

export type MarketplaceSort =
  | "newest"
  | "oldest"
  | "price_asc"
  | "price_desc";

/**
 * Coerce any incoming `?sort=` value to a known MarketplaceSort, defaulting
 * to "newest" for empty, unknown, or otherwise unsafe inputs. The default
 * keeps the page's existing ranking (open stores first, newest second).
 */
export function sanitiseSort(value: string | undefined): MarketplaceSort {
  if (
    value === "oldest" ||
    value === "price_asc" ||
    value === "price_desc"
  ) {
    return value;
  }
  return "newest";
}

/**
 * Coerce a `?min_price=` / `?max_price=` URL fragment into a non-negative
 * integer (or null when unset / garbage). Floors fractional rands and
 * rejects negatives so the Supabase query never sees something unexpected.
 */
export function sanitisePrice(value: string | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
}

/**
 * Allowlist `?suburb=` against the seeded Durban list. Anything else (custom
 * URL crafting, stale links from before a rename) collapses to null so the
 * Supabase query falls back to "any suburb".
 */
export function sanitiseSuburb(value: string | undefined): string | null {
  if (!value) return null;
  return (DURBAN_SUBURBS as readonly string[]).includes(value) ? value : null;
}

/**
 * Parse the `?category=` URL param into a de-duplicated list of category
 * names. We accept comma-separated values (`?category=Food,Beauty`) so the
 * URL stays short and copy-pasteable. Empty / whitespace segments are
 * dropped; order is preserved so the active-chips strip renders in the
 * order the user picked them.
 */
export function parseCategoryList(value: string | undefined): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Inverse of `parseCategoryList` — serialise the multi-select state back
 * into a URL fragment (or null when the list is empty so the param drops
 * out of the URL entirely).
 */
export function serialiseCategoryList(values: string[]): string | null {
  if (!values.length) return null;
  return values.join(",");
}

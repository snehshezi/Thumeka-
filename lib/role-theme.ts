import type { AppRole } from "@/lib/constants";

/**
 * Each role wears one hue from the brand palette. The mapping is intentional:
 * - buyer    → sky    — "trusted commerce" blue, you're spending money
 * - provider → leaf   — growth/produce green, matches the logo bag, money flows in
 * - driver   → iris   — kinetic violet, picks up the logo's motion lines
 * - admin    → brand  — deep authoritative indigo, anchors the wordmark
 *
 * The gradient (logo, section bands, btn-primary) stays brand-level — role
 * colour only shows up on *your* dashboard surfaces so the brand identity
 * never gets diluted.
 */
export type RoleAccentToken = "sky" | "leaf" | "iris" | "brand";

const ACCENT_TOKEN_BY_ROLE: Record<AppRole, RoleAccentToken> = {
  buyer: "sky",
  provider: "leaf",
  driver: "iris",
  admin: "brand"
};

export function roleAccentToken(role: AppRole): RoleAccentToken {
  return ACCENT_TOKEN_BY_ROLE[role];
}

/**
 * Static Tailwind class strings per token. Required so the JIT compiler can
 * see every class in source — dynamic `text-${token}` would be invisible to
 * the build step and the styles wouldn't ship.
 */
export type RoleClasses = {
  text: string;
  border: string;
  bgSoft: string;
  ring: string;
};

const CLASSES_BY_TOKEN: Record<RoleAccentToken, RoleClasses> = {
  sky: {
    text: "text-sky",
    border: "border-sky",
    bgSoft: "bg-sky/10",
    ring: "ring-sky"
  },
  leaf: {
    text: "text-leaf",
    border: "border-leaf",
    bgSoft: "bg-leaf/10",
    ring: "ring-leaf"
  },
  iris: {
    text: "text-iris",
    border: "border-iris",
    bgSoft: "bg-iris/10",
    ring: "ring-iris"
  },
  brand: {
    text: "text-brand",
    border: "border-brand",
    bgSoft: "bg-brand/10",
    ring: "ring-brand"
  }
};

export function roleClasses(role: AppRole): RoleClasses {
  return CLASSES_BY_TOKEN[roleAccentToken(role)];
}

import { describe, expect, it } from "vitest";
import { Recycle, Tag, UtensilsCrossed } from "lucide-react";

import {
  CATEGORY_TINT_CLASSES,
  CATEGORY_VISUALS,
  getCategoryVisual
} from "@/lib/category-visuals";
import { SEEDED_CATEGORIES } from "@/lib/constants";

describe("category visuals", () => {
  it("returns the mapped icon + tint for a known category", () => {
    expect(getCategoryVisual("Food").icon).toBe(UtensilsCrossed);
    expect(getCategoryVisual("Food").tint).toBe("coral");
  });

  it("returns Recycle + iris for the new Pre-loved category", () => {
    expect(getCategoryVisual("Pre-loved").icon).toBe(Recycle);
    expect(getCategoryVisual("Pre-loved").tint).toBe("iris");
  });

  it("falls back to the neutral Tag visual for unknown categories", () => {
    const fallback = getCategoryVisual("Not a real category");
    expect(fallback.icon).toBe(Tag);
    expect(fallback.tint).toBe("neutral");
  });

  it("covers every seeded category so no tile renders the fallback", () => {
    for (const name of SEEDED_CATEGORIES) {
      expect(
        CATEGORY_VISUALS[name],
        `${name} is missing a visual mapping`
      ).toBeDefined();
    }
  });

  it("includes Tailwind classes for every tint a visual can return", () => {
    for (const visual of Object.values(CATEGORY_VISUALS)) {
      expect(CATEGORY_TINT_CLASSES[visual.tint]).toBeDefined();
    }
  });
});

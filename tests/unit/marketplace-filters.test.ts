import { describe, expect, it } from "vitest";

import {
  parseCategoryList,
  sanitisePrice,
  sanitiseSort,
  sanitiseSuburb,
  serialiseCategoryList
} from "@/lib/marketplace-filters";

describe("sanitiseSort", () => {
  it("passes through known sort values", () => {
    expect(sanitiseSort("price_asc")).toBe("price_asc");
    expect(sanitiseSort("price_desc")).toBe("price_desc");
    expect(sanitiseSort("oldest")).toBe("oldest");
  });

  it("defaults to newest for missing / unknown / unsafe input", () => {
    expect(sanitiseSort(undefined)).toBe("newest");
    expect(sanitiseSort("")).toBe("newest");
    expect(sanitiseSort("newest")).toBe("newest");
    expect(sanitiseSort("random_garbage")).toBe("newest");
    expect(sanitiseSort("PRICE_ASC")).toBe("newest");
  });
});

describe("sanitisePrice", () => {
  it("returns null for missing or empty input", () => {
    expect(sanitisePrice(undefined)).toBeNull();
    expect(sanitisePrice("")).toBeNull();
  });

  it("returns a floored non-negative integer for valid input", () => {
    expect(sanitisePrice("50")).toBe(50);
    expect(sanitisePrice("199.99")).toBe(199);
    expect(sanitisePrice("0")).toBe(0);
  });

  it("returns null for negative or non-numeric input", () => {
    expect(sanitisePrice("-1")).toBeNull();
    expect(sanitisePrice("not a number")).toBeNull();
    expect(sanitisePrice("Infinity")).toBeNull();
    expect(sanitisePrice("NaN")).toBeNull();
  });
});

describe("sanitiseSuburb", () => {
  it("passes through values that appear in DURBAN_SUBURBS", () => {
    expect(sanitiseSuburb("Berea")).toBe("Berea");
    expect(sanitiseSuburb("Umhlanga")).toBe("Umhlanga");
  });

  it("rejects values not in the seeded list", () => {
    expect(sanitiseSuburb("Cape Town")).toBeNull();
    expect(sanitiseSuburb("berea")).toBeNull(); // case-sensitive on purpose
    expect(sanitiseSuburb("")).toBeNull();
    expect(sanitiseSuburb(undefined)).toBeNull();
  });
});

describe("parseCategoryList", () => {
  it("returns an empty array for missing / empty input", () => {
    expect(parseCategoryList(undefined)).toEqual([]);
    expect(parseCategoryList("")).toEqual([]);
    expect(parseCategoryList(",,,")).toEqual([]);
  });

  it("splits comma-separated names and trims whitespace", () => {
    expect(parseCategoryList("Food, Beauty,Clothing ")).toEqual([
      "Food",
      "Beauty",
      "Clothing"
    ]);
  });

  it("de-duplicates case-insensitively, preserving first occurrence", () => {
    expect(parseCategoryList("Food,Beauty,food,FOOD")).toEqual([
      "Food",
      "Beauty"
    ]);
  });
});

describe("serialiseCategoryList", () => {
  it("returns null for an empty list so the URL param drops out", () => {
    expect(serialiseCategoryList([])).toBeNull();
  });

  it("joins entries with commas in order", () => {
    expect(serialiseCategoryList(["Food", "Beauty"])).toBe("Food,Beauty");
  });

  it("round-trips with parseCategoryList", () => {
    const list = ["Food", "Beauty", "Pre-loved"];
    const serialised = serialiseCategoryList(list);
    expect(serialised).not.toBeNull();
    expect(parseCategoryList(serialised ?? undefined)).toEqual(list);
  });
});

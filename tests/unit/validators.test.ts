import { describe, expect, it } from "vitest";

import {
  validateAndNormalizeZaPhone,
  validateZaBankAccountNumber,
  validateZaBranchCode,
  valueOrThrow
} from "@/lib/validators";

describe("validateAndNormalizeZaPhone", () => {
  describe("accepts common SA shapes", () => {
    it.each([
      ["0712345678", "0712345678"],
      ["071 234 5678", "0712345678"],
      ["071-234-5678", "0712345678"],
      ["(071) 234 5678", "0712345678"],
      ["+27712345678", "0712345678"],
      ["+27 71 234 5678", "0712345678"],
      ["+27 (71) 234-5678", "0712345678"],
      ["27712345678", "0712345678"],
      ["031 123 4567", "0311234567"], // Durban landline
      ["0211234567", "0211234567"] // Cape Town landline
    ])("normalizes %s → %s", (input, expected) => {
      const r = validateAndNormalizeZaPhone(input);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value).toBe(expected);
    });
  });

  describe("rejects invalid inputs", () => {
    it.each([
      ["", /required/],
      ["   ", /required/],
      [null, /required/],
      [undefined, /required/],
      ["071234", /South African/],     // too short
      ["07123456789", /South African/], // 11 digits
      ["12345678901", /South African/], // no SA prefix
      ["+44 7123456789", /South African/], // wrong country
      ["abc", /South African/],
      ["0+27712345678", /isn't valid/], // misplaced +
      ["27 71 234 567", /South African/], // missing a digit
      ["0012345678", /doesn't look like/], // starts with 00
      ["0912345678", /doesn't look like/]  // 09 not valid first-digit
    ])("rejects %s", (input, errPattern) => {
      const r = validateAndNormalizeZaPhone(input as string | null);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(errPattern);
    });
  });

  it("treats a number with mixed spaces and punctuation as one input", () => {
    const r = validateAndNormalizeZaPhone(" +27 (071) 234-5678 ");
    // The leading 0 inside parens after +27 makes this ambiguous — strict
    // path rejects because +27 should be followed by 9 digits (not 10).
    expect(r.ok).toBe(false);
  });
});

describe("validateZaBankAccountNumber", () => {
  it("accepts digit-only numbers within bounds", () => {
    expect(validateZaBankAccountNumber("1234567890")).toEqual({
      ok: true,
      value: "1234567890"
    });
    expect(validateZaBankAccountNumber("123456")).toEqual({
      ok: true,
      value: "123456"
    });
    expect(validateZaBankAccountNumber("1234567890123")).toEqual({
      ok: true,
      value: "1234567890123"
    });
  });

  it("strips spaces and dashes from input", () => {
    expect(validateZaBankAccountNumber("12-34-56-78-90")).toEqual({
      ok: true,
      value: "1234567890"
    });
    expect(validateZaBankAccountNumber("123 456 7890")).toEqual({
      ok: true,
      value: "1234567890"
    });
  });

  it("rejects too-short and too-long", () => {
    const short = validateZaBankAccountNumber("12345");
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toMatch(/6 and 13 digits/);

    const long = validateZaBankAccountNumber("12345678901234");
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toMatch(/6 and 13 digits/);
  });

  it("rejects non-digit characters in the cleaned form", () => {
    const letters = validateZaBankAccountNumber("123abc456");
    expect(letters.ok).toBe(false);
    if (!letters.ok) expect(letters.error).toMatch(/digits only/);
  });

  it("rejects empty and missing", () => {
    expect(validateZaBankAccountNumber("").ok).toBe(false);
    expect(validateZaBankAccountNumber(null).ok).toBe(false);
    expect(validateZaBankAccountNumber("   ").ok).toBe(false);
  });
});

describe("validateZaBranchCode", () => {
  it("accepts six-digit codes from real banks", () => {
    // Standard universal codes.
    expect(validateZaBranchCode("250655").ok).toBe(true); // FNB
    expect(validateZaBranchCode("051001").ok).toBe(true); // Standard
    expect(validateZaBranchCode("632005").ok).toBe(true); // ABSA
    expect(validateZaBranchCode("470010").ok).toBe(true); // Capitec
  });

  it("strips spaces and dashes", () => {
    expect(validateZaBranchCode("250 655")).toEqual({ ok: true, value: "250655" });
    expect(validateZaBranchCode("250-655")).toEqual({ ok: true, value: "250655" });
  });

  it("rejects anything that isn't exactly 6 digits", () => {
    expect(validateZaBranchCode("25065").ok).toBe(false); // 5 digits
    expect(validateZaBranchCode("2506556").ok).toBe(false); // 7 digits
    expect(validateZaBranchCode("25065a").ok).toBe(false);
    expect(validateZaBranchCode("").ok).toBe(false);
    expect(validateZaBranchCode(null).ok).toBe(false);
  });
});

describe("valueOrThrow", () => {
  it("returns the value when ok", () => {
    expect(valueOrThrow({ ok: true, value: "hello" })).toBe("hello");
  });

  it("throws ValidationError with the message when not ok", () => {
    expect(() => valueOrThrow({ ok: false, error: "nope" })).toThrow("nope");
  });
});

// Server-side input validators for South African-specific fields. Pure
// functions so they can be tested without a DB and called from any action.
//
// Each validator returns a discriminated union — callers can pattern-match on
// `ok` or use the convenience `valueOrError(result, label)` helper to bounce
// out of an action with a friendly redirect.

export type ValidationResult<T = string> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Phone numbers (South Africa)
// ---------------------------------------------------------------------------

/**
 * Accepts common South African phone-number shapes and returns the canonical
 * `0XXXXXXXXX` form (10 digits, leading 0). Rejects anything that isn't a
 * SA-shaped number.
 *
 * Accepted inputs:
 *   "0712345678"        → "0712345678"
 *   "071 234 5678"      → "0712345678"
 *   "+27 71 234 5678"   → "0712345678"
 *   "+27712345678"      → "0712345678"
 *   "27712345678"       → "0712345678"
 *   "(071) 234-5678"    → "0712345678"
 *
 * Rejected:
 *   "071234"            → too short
 *   "12345"             → no SA prefix
 *   "+44 7123456789"    → wrong country code
 *   ""                  → empty
 */
export function validateAndNormalizeZaPhone(
  input: string | null | undefined
): ValidationResult<string> {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "Phone number is required." };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Phone number is required." };
  }

  // Strip every character that isn't a digit or `+`. Catches spaces, dashes,
  // parens, dots — whatever a human might type.
  const cleaned = trimmed.replace(/[^\d+]/g, "");

  // Reject duplicate plus signs and stray plus signs not at position 0.
  const plusCount = (cleaned.match(/\+/g) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && cleaned[0] !== "+")) {
    return { ok: false, error: "Phone number format isn't valid." };
  }

  // Resolve to a "national" form: 10 digits beginning with `0`.
  let national: string;
  if (cleaned.startsWith("+27")) {
    // +27 followed by 9 digits (SA subscriber number) → prepend `0`.
    const tail = cleaned.slice(3);
    if (tail.length !== 9 || !/^\d{9}$/.test(tail)) {
      return { ok: false, error: "Phone number format isn't valid." };
    }
    national = `0${tail}`;
  } else if (cleaned.startsWith("27") && cleaned.length === 11) {
    // 27 followed by 9 digits — same shape as +27 without the plus.
    const tail = cleaned.slice(2);
    if (!/^\d{9}$/.test(tail)) {
      return { ok: false, error: "Phone number format isn't valid." };
    }
    national = `0${tail}`;
  } else if (cleaned.startsWith("0") && cleaned.length === 10) {
    if (!/^\d{10}$/.test(cleaned)) {
      return { ok: false, error: "Phone number format isn't valid." };
    }
    national = cleaned;
  } else {
    return {
      ok: false,
      error:
        "Phone number must be a South African number — e.g. 071 234 5678 or +27 71 234 5678."
    };
  }

  // Second-digit sanity: SA mobile/landline subscriber numbers start 1-8 after
  // the leading 0. Catches "0000000000" / "0123" style nonsense.
  if (!/^0[1-8]\d{8}$/.test(national)) {
    return {
      ok: false,
      error: "That doesn't look like a South African mobile or landline number."
    };
  }

  return { ok: true, value: national };
}

// ---------------------------------------------------------------------------
// Bank account number
// ---------------------------------------------------------------------------

/**
 * SA bank account numbers are digits-only. Length varies by bank but is
 * almost always between 6 and 13 digits. Accepts spaces/dashes in input but
 * the returned value is digits only.
 */
export function validateZaBankAccountNumber(
  input: string | null | undefined
): ValidationResult<string> {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "Bank account number is required." };
  }
  const cleaned = input.trim().replace(/[\s-]/g, "");
  if (!cleaned) {
    return { ok: false, error: "Bank account number is required." };
  }
  if (!/^\d+$/.test(cleaned)) {
    return {
      ok: false,
      error: "Bank account number must contain digits only."
    };
  }
  if (cleaned.length < 6 || cleaned.length > 13) {
    return {
      ok: false,
      error: "Bank account number must be between 6 and 13 digits."
    };
  }
  return { ok: true, value: cleaned };
}

// ---------------------------------------------------------------------------
// Bank branch code (South Africa)
// ---------------------------------------------------------------------------

/**
 * Universal branch codes in South Africa are 6 digits. Common ones:
 * FNB 250655, Standard Bank 051001, ABSA 632005, Nedbank 198765,
 * Capitec 470010, TymeBank 678910.
 *
 * Accepts spaces/dashes in input; returned value is digits only.
 */
export function validateZaBranchCode(
  input: string | null | undefined
): ValidationResult<string> {
  if (!input || typeof input !== "string") {
    return { ok: false, error: "Branch code is required." };
  }
  const cleaned = input.trim().replace(/[\s-]/g, "");
  if (!cleaned) {
    return { ok: false, error: "Branch code is required." };
  }
  if (!/^\d{6}$/.test(cleaned)) {
    return {
      ok: false,
      error: "Branch code must be exactly 6 digits (e.g. 250655)."
    };
  }
  return { ok: true, value: cleaned };
}

// ---------------------------------------------------------------------------
// Helper: pick the value or bounce out
// ---------------------------------------------------------------------------

/**
 * Throws a typed error when validation fails so server actions can
 * `try { … } catch { redirectWithError(...) }` in one place. Useful when
 * several validations need to run before any DB write.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function valueOrThrow<T>(result: ValidationResult<T>): T {
  if (result.ok) return result.value;
  throw new ValidationError(result.error);
}

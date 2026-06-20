/**
 * Tiny shared pagination helpers — extracted from the admin dashboard's
 * `?paid_page=` block so every paginated list (operations queue, provider
 * approvals, driver approvals, paid payouts, audit logs) reads the same.
 *
 * `readPageParam` clamps invalid input to page 1.
 * `pageRange` returns the inclusive Postgres-style range for `.range(from, to)`.
 * `pageCount` derives the total page count from a `select("*", { count: "exact" })`
 * result.
 */

export const DEFAULT_PAGE_SIZE = 10;
export const AUDIT_LOGS_PAGE_SIZE = 50;

export function readPageParam(value: string | undefined): number {
  const raw = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

export function pageRange(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE
): [from: number, to: number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function pageCount(
  total: number | null | undefined,
  pageSize: number = DEFAULT_PAGE_SIZE
): number {
  if (!total || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

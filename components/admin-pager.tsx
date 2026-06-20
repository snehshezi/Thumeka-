import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type AdminPagerProps = {
  basePath: string;
  pageParam: string;
  currentPage: number;
  pageCount: number;
  /**
   * Other query params that should round-trip across page navigation —
   * e.g. {tab: "operations"} so the user doesn't lose their tab when they
   * click Next.
   */
  preserveParams?: Record<string, string | undefined>;
  testIdPrefix?: string;
};

/**
 * Single-line "Previous / Page X of Y / Next" pager used by every paginated
 * list on the admin surface (operations queue, approvals, payouts, audit
 * logs). Renders nothing when there's only one page so callers can drop it
 * in unconditionally.
 */
export function AdminPager({
  basePath,
  pageParam,
  currentPage,
  pageCount,
  preserveParams,
  testIdPrefix
}: AdminPagerProps) {
  if (pageCount <= 1) return null;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < pageCount;
  const buildHref = (page: number) => {
    const qs = new URLSearchParams();
    if (preserveParams) {
      for (const [k, v] of Object.entries(preserveParams)) {
        if (v !== undefined && v !== "") qs.set(k, v);
      }
    }
    qs.set(pageParam, String(page));
    return `${basePath}?${qs.toString()}`;
  };

  const linkCls =
    "inline-flex items-center gap-1 rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:border-leaf";
  const disabledCls =
    "inline-flex items-center gap-1 rounded-md border border-black/10 bg-black/5 px-3 py-1.5 text-sm font-medium text-black/35";
  const prefix = testIdPrefix ?? "admin-pager";

  return (
    <div
      className="mt-4 flex items-center justify-between gap-3"
      data-testid={prefix}
    >
      {hasPrev ? (
        <Link
          className={linkCls}
          data-testid={`${prefix}-prev-link`}
          href={buildHref(currentPage - 1)}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledCls} data-testid={`${prefix}-prev-disabled`}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Previous
        </span>
      )}

      <span className="text-caption text-black/55" data-testid={`${prefix}-status`}>
        Page {currentPage} of {pageCount}
      </span>

      {hasNext ? (
        <Link
          className={linkCls}
          data-testid={`${prefix}-next-link`}
          href={buildHref(currentPage + 1)}
        >
          Next
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledCls} data-testid={`${prefix}-next-disabled`}>
          Next
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

import { clsx } from "clsx";
import Link from "next/link";

export type SegmentedTab = {
  /** Stable identifier matched against `active`. */
  value: string;
  /** Visible label. */
  label: string;
  /** Destination URL. Typically the current pathname with a search-param flip. */
  href: string;
  /** Optional count badge (e.g. number of items in this tab). */
  count?: number;
};

type SegmentedProps = {
  tabs: SegmentedTab[];
  active: string;
  "data-testid"?: string;
  ariaLabel?: string;
};

/**
 * Server-rendered segmented control. Each tab is a Link so URL state is
 * authoritative — bookmarks, back button, and right-click work.
 *
 * Style tokens live in `globals.css` under `.dash-tabs` / `.dash-tab`.
 */
export function Segmented({
  tabs,
  active,
  "data-testid": testId,
  ariaLabel
}: SegmentedProps) {
  return (
    <div
      aria-label={ariaLabel}
      className="dash-tabs"
      data-testid={testId}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            aria-selected={isActive}
            className={clsx("dash-tab", isActive && "is-active")}
            data-testid={`tab-${tab.value}`}
            href={tab.href}
            key={tab.value}
            role="tab"
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && tab.count > 0 ? (
              <span className="dash-tab-count">{tab.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

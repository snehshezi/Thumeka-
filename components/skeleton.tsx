type SkeletonProps = {
  className?: string;
  /** Hidden but read by assistive tech so the page reads as loading. */
  label?: string;
};

/**
 * Animated grey block used by route-level `loading.tsx` fallbacks
 * (and any other "data not ready" surface). Single source of truth so
 * every skeleton renders identical pulse + colour.
 */
export function Skeleton({
  className,
  label = "Loading"
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-black/10 ${className ?? ""}`}
      data-testid="skeleton"
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

import { Skeleton } from "@/components/skeleton";

/**
 * Homepage skeleton — shown during the initial server-component fetch
 * for `/`. Matches the post-load layout roughly: a "Show categories"
 * pill at the top, a filter strip row, and a 6-card grid placeholder.
 */
export default function HomeLoading() {
  return (
    <div className="bg-mist" data-testid="page-home-loading">
      <section className="page-shell pb-8 pt-4">
        <Skeleton className="mb-5 h-9 w-40" label="Loading categories" />

        <div className="mt-5 flex flex-col gap-5 sm:mt-6 sm:flex-row sm:items-start">
          <aside
            aria-hidden="true"
            className="hidden w-56 shrink-0 sm:block"
          >
            <Skeleton className="sticky top-24 h-64" />
          </aside>

          <div className="min-w-0 flex-1">
            <Skeleton className="mb-4 h-12" label="Loading filters" />
            <Skeleton className="mb-4 h-4 w-40" label="Loading results" />
            <div className="mobile-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  className="aspect-[3/4] sm:aspect-square"
                  key={index}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

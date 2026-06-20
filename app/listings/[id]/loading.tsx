import { Skeleton } from "@/components/skeleton";

/** Listing detail skeleton — image placeholder + body + actions. */
export default function ListingDetailLoading() {
  return (
    <div className="bg-mist" data-testid="page-listing-detail-loading">
      <section className="page-shell py-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Skeleton
            className="aspect-square w-full sm:aspect-[4/3]"
            label="Loading image"
          />
          <div className="space-y-3">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-11 w-44" label="Loading action" />
          </div>
        </div>
      </section>
    </div>
  );
}

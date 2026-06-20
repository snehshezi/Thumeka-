import { Skeleton } from "@/components/skeleton";

/** Buyer order detail skeleton — status header + four stacked panels. */
export default function BuyerOrderDetailLoading() {
  return (
    <div className="bg-mist" data-testid="page-buyer-order-detail-loading">
      <section className="section-band">
        <div className="page-shell gap-3 py-6">
          <Skeleton className="h-4 w-28" label="Loading back link" />
          <Skeleton className="mt-3 h-4 w-32" label="Loading order ref" />
          <Skeleton className="mt-3 h-7 w-40" label="Loading status" />
          <Skeleton className="mt-3 h-4 w-56" />
        </div>
      </section>
      <section className="page-shell space-y-5 py-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton className="h-32" key={index} />
        ))}
      </section>
    </div>
  );
}

import { Skeleton } from "@/components/skeleton";

/** Buyer order-list skeleton — three stacked card placeholders. */
export default function BuyerOrdersLoading() {
  return (
    <div className="bg-mist" data-testid="page-buyer-orders-loading">
      <section className="section-band">
        <div className="page-shell gap-4 py-6">
          <Skeleton className="h-4 w-32" label="Loading greeting" />
          <Skeleton className="mt-2 h-10 w-64" label="Loading status" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
      </section>
      <section className="page-shell py-6">
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton className="h-36" key={index} label="Loading order" />
          ))}
        </div>
      </section>
    </div>
  );
}

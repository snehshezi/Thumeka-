import { Skeleton } from "@/components/skeleton";

/** Checkout skeleton — form fields + quote panel + submit button. */
export default function CheckoutLoading() {
  return (
    <div className="bg-mist" data-testid="page-checkout-loading">
      <section className="page-shell py-6">
        <Skeleton className="mb-6 h-8 w-48" label="Loading checkout" />
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton className="h-12 w-full" key={index} />
            ))}
            <Skeleton className="h-11 w-full" label="Loading submit" />
          </div>
          <Skeleton className="h-64 w-full" label="Loading quote" />
        </div>
      </section>
    </div>
  );
}

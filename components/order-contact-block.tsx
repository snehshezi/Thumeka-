import { Mail, MapPin, Phone, Store, Truck, User } from "lucide-react";

type Contact = {
  name: string;
  phone?: string | null;
};

type OrderContactBlockProps = {
  buyer: {
    name: string;
    phone: string;
    email: string;
    deliveryAddress?: string | null;
  };
  provider?: Contact | null;
  driver?: Contact | null;
  testIdPrefix?: string;
};

/**
 * Compact contacts panel for an order card. Replaces the old
 * "Driver: 4a8c1b… · Unassigned" single-line summary with three rows
 * (buyer / provider / driver) that surface name + tel/email links so the
 * admin can phone or email any participant from the dashboard. Buyer is
 * always present (NOT NULL on the orders row); provider/driver only render
 * when assigned.
 */
export function OrderContactBlock({
  buyer,
  provider,
  driver,
  testIdPrefix
}: OrderContactBlockProps) {
  const prefix = testIdPrefix ?? "order-contact-block";

  return (
    <div
      className="mt-3 grid gap-2 rounded-md bg-mist p-3 text-sm"
      data-testid={prefix}
    >
      {/* Buyer */}
      <div
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        data-testid={`${prefix}-buyer`}
      >
        <div className="flex items-center gap-2 text-ink">
          <User aria-hidden="true" className="h-4 w-4 text-black/45" />
          <span className="font-semibold">{buyer.name}</span>
          <span className="text-caption text-black/45">Buyer</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm">
          <a
            className="inline-flex items-center gap-1 font-medium text-leaf hover:underline"
            data-testid={`${prefix}-buyer-phone`}
            href={`tel:${buyer.phone}`}
          >
            <Phone aria-hidden="true" className="h-3.5 w-3.5" />
            {buyer.phone}
          </a>
          <a
            className="inline-flex items-center gap-1 font-medium text-leaf hover:underline"
            data-testid={`${prefix}-buyer-email`}
            href={`mailto:${buyer.email}`}
          >
            <Mail aria-hidden="true" className="h-3.5 w-3.5" />
            {buyer.email}
          </a>
        </div>
      </div>
      {buyer.deliveryAddress ? (
        <div
          className="flex items-start gap-2 text-body-sm text-black/65"
          data-testid={`${prefix}-buyer-address`}
        >
          <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-black/45" />
          <span>{buyer.deliveryAddress}</span>
        </div>
      ) : null}

      {/* Provider */}
      {provider ? (
        <div
          className="flex flex-col gap-1 border-t border-black/5 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          data-testid={`${prefix}-provider`}
        >
          <div className="flex items-center gap-2 text-ink">
            <Store aria-hidden="true" className="h-4 w-4 text-black/45" />
            <span className="font-semibold">{provider.name}</span>
            <span className="text-caption text-black/45">Provider</span>
          </div>
          {provider.phone ? (
            <a
              className="inline-flex items-center gap-1 font-medium text-leaf hover:underline"
              data-testid={`${prefix}-provider-phone`}
              href={`tel:${provider.phone}`}
            >
              <Phone aria-hidden="true" className="h-3.5 w-3.5" />
              {provider.phone}
            </a>
          ) : (
            <span className="text-caption text-black/45">No phone on file</span>
          )}
        </div>
      ) : null}

      {/* Driver */}
      {driver ? (
        <div
          className="flex flex-col gap-1 border-t border-black/5 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          data-testid={`${prefix}-driver`}
        >
          <div className="flex items-center gap-2 text-ink">
            <Truck aria-hidden="true" className="h-4 w-4 text-black/45" />
            <span className="font-semibold">{driver.name}</span>
            <span className="text-caption text-black/45">Driver</span>
          </div>
          {driver.phone ? (
            <a
              className="inline-flex items-center gap-1 font-medium text-leaf hover:underline"
              data-testid={`${prefix}-driver-phone`}
              href={`tel:${driver.phone}`}
            >
              <Phone aria-hidden="true" className="h-3.5 w-3.5" />
              {driver.phone}
            </a>
          ) : (
            <span className="text-caption text-black/45">No phone on file</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { getDeliveryQuote } from "@/lib/delivery";

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "buyer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    listingId?: string;
    address?: string;
    suburb?: string;
    quantity?: number;
    /** Multi-item: the buyer's subtotal computed from the live cart on
     *  the server. When set, the quote uses it as the line subtotal
     *  instead of `unitPrice × quantity`. */
    lineSubtotal?: number;
    lat?: number;
    lng?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const listingId = typeof body.listingId === "string" ? body.listingId : "";
  const address = typeof body.address === "string" ? body.address : "";
  const suburb = typeof body.suburb === "string" ? body.suburb : "";
  // Clamp quantity to [1, 99] so a hostile / typo'd value can't produce
  // a malformed quote. The cart UI clamps too; this is belt-and-braces.
  const rawQuantity =
    typeof body.quantity === "number" && Number.isInteger(body.quantity)
      ? body.quantity
      : 1;
  const quantity = Math.min(99, Math.max(1, rawQuantity));
  const lineSubtotalOverride =
    typeof body.lineSubtotal === "number" &&
    Number.isFinite(body.lineSubtotal) &&
    body.lineSubtotal > 0
      ? body.lineSubtotal
      : undefined;
  const dest =
    typeof body.lat === "number" &&
    typeof body.lng === "number" &&
    Number.isFinite(body.lat) &&
    Number.isFinite(body.lng)
      ? { lat: body.lat, lng: body.lng }
      : null;

  if (!listingId || !address.trim()) {
    return NextResponse.json(
      { error: "A listing and delivery address are required" },
      { status: 400 }
    );
  }

  const quote = await getDeliveryQuote({
    listingId,
    address,
    suburb,
    quantity,
    lineSubtotalOverride,
    dest
  });
  if (!quote) {
    return NextResponse.json(
      {
        error:
          "We couldn't calculate a delivery fee for that address. Check it and try again."
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    distanceKm: quote.distanceKm,
    deliveryFee: quote.deliveryFee,
    buyerTotal: quote.buyerTotal,
    lineSubtotal: quote.lineSubtotal,
    quantity: quote.quantity
  });
}

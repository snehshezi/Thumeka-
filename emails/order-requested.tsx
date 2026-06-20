import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { EmailBase, styles } from "@/emails/base";

export type OrderRequestedLineItem = {
  title: string;
  /** Unit price. */
  price: number;
  quantity: number;
  /** `price × quantity`. */
  subtotal: number;
};

export type OrderRequestedEmailProps = {
  providerName: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail: string;
  listingTitle: string;
  listingPrice: number;
  /** Units ordered. Defaults to 1 — older order rows pre-dating
   *  migration 016 won't pass this. */
  quantity?: number;
  /** Already qty-multiplied subtotal (listingPrice × quantity).
   *  Pre-computed at the call site so the email doesn't have to. */
  lineSubtotal?: number;
  /** Multi-item orders pass the full line list; when present (and
   *  `length > 1`) the email renders an itemised table instead of the
   *  single Listing/Price/Qty rows. Single-line orders omit this. */
  lineItems?: OrderRequestedLineItem[];
  deliveryAddress: string | null;
  suburb: string | null;
  buyerNotes: string | null;
  requestedDate: string | null;
  requestedTime: string | null;
  orderId: string;
  appUrl: string;
  dashboardUrl: string;
};

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

export function OrderRequestedEmail({
  providerName,
  buyerName,
  buyerPhone,
  buyerEmail,
  listingTitle,
  listingPrice,
  quantity = 1,
  lineSubtotal,
  lineItems,
  deliveryAddress,
  suburb,
  buyerNotes,
  requestedDate,
  requestedTime,
  orderId,
  appUrl,
  dashboardUrl,
}: OrderRequestedEmailProps) {
  const subtotal = lineSubtotal ?? listingPrice * quantity;
  const isMultiItem = Boolean(lineItems && lineItems.length > 1);
  return (
    <EmailBase preview={`New order request — ${APP_NAME}`} appUrl={appUrl}>
      <h1 style={styles.heading}>New order request 📦</h1>
      <p style={styles.paragraph}>Hi {providerName},</p>
      <p style={styles.paragraph}>
        You have received a new order request on {APP_NAME}. Please review the
        details below and accept or decline from your dashboard.
      </p>

      <hr style={styles.divider} />
      <p style={{ ...styles.muted, fontWeight: "600", marginBottom: "8px" }}>Order details</p>
      {isMultiItem ? (
        <>
          {lineItems!.map((item, index) => (
            <div key={`${item.title}-${index}`} style={styles.infoRow}>
              <span style={styles.infoLabel}>
                {item.title}
                {item.quantity > 1 ? ` (${formatMoney(item.price)} × ${item.quantity})` : ""}
              </span>
              <span style={styles.infoValue}>{formatMoney(item.subtotal)}</span>
            </div>
          ))}
          <div style={{ ...styles.infoRow, fontWeight: "600" }}>
            <span style={styles.infoLabel}>Subtotal</span>
            <span style={styles.infoValue}>{formatMoney(subtotal)}</span>
          </div>
        </>
      ) : (
        <>
          <InfoRow label="Listing" value={listingTitle} />
          {quantity > 1 ? (
            <>
              <InfoRow label="Quantity" value={`${quantity}`} />
              <InfoRow
                label="Price"
                value={`${formatMoney(listingPrice)} × ${quantity} = ${formatMoney(subtotal)}`}
              />
            </>
          ) : (
            <InfoRow label="Price" value={formatMoney(listingPrice)} />
          )}
        </>
      )}
      <InfoRow label="Order ref" value={orderId.slice(0, 8).toUpperCase()} />

      <hr style={styles.divider} />
      <p style={{ ...styles.muted, fontWeight: "600", marginBottom: "8px" }}>Buyer details</p>
      <InfoRow label="Name" value={buyerName} />
      <InfoRow label="Phone" value={buyerPhone} />
      <InfoRow label="Email" value={buyerEmail} />
      <InfoRow label="Delivery address" value={deliveryAddress} />
      <InfoRow label="Suburb" value={suburb} />
      <InfoRow label="Requested date" value={requestedDate} />
      <InfoRow label="Requested time" value={requestedTime} />
      <InfoRow label="Notes" value={buyerNotes} />

      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={dashboardUrl} style={styles.button}>
          View order on dashboard
        </a>
      </p>
    </EmailBase>
  );
}

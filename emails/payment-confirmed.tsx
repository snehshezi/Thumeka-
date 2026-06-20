import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { EmailBase, styles } from "@/emails/base";

export type PaymentConfirmedEmailProps = {
  recipientName: string;
  role: "buyer" | "provider";
  listingTitle: string;
  buyerTotal: number;
  paymentReference: string;
  orderId: string;
  appUrl: string;
  dashboardUrl: string;
};

export function PaymentConfirmedEmail({
  recipientName,
  role,
  listingTitle,
  buyerTotal,
  paymentReference,
  orderId,
  appUrl,
  dashboardUrl,
}: PaymentConfirmedEmailProps) {
  const isBuyer = role === "buyer";
  const heading = isBuyer
    ? "Your payment has been confirmed! ✅"
    : "Payment confirmed for your order";
  const body = isBuyer
    ? `Great news! Your EFT payment of ${formatMoney(buyerTotal)} for "${listingTitle}" has been confirmed. Your order is now being prepared.`
    : `The buyer's EFT payment of ${formatMoney(buyerTotal)} for order "${listingTitle}" has been confirmed by admin. The order is ready to proceed.`;

  return (
    <EmailBase
      preview={`Payment confirmed — ${APP_NAME}`}
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>{heading}</h1>
      <p style={styles.paragraph}>Hi {recipientName},</p>
      <p style={styles.paragraph}>{body}</p>

      <div style={{ ...styles.infoRow, borderBottom: "none", margin: "16px 0" }}>
        <span style={styles.infoLabel}>Order ref</span>
        <span style={styles.infoValue}>{orderId.slice(0, 8).toUpperCase()}</span>
      </div>
      <div style={{ ...styles.infoRow, borderBottom: "none", margin: "0 0 16px" }}>
        <span style={styles.infoLabel}>Payment ref</span>
        <span style={styles.infoValue}>{paymentReference}</span>
      </div>

      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={dashboardUrl} style={styles.button}>
          {isBuyer ? "View my orders" : "Go to dashboard"}
        </a>
      </p>
    </EmailBase>
  );
}

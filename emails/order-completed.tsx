import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { EmailBase, styles } from "@/emails/base";

export type OrderCompletedEmailProps = {
  buyerName: string;
  listingTitle: string;
  buyerTotal: number;
  orderId: string;
  appUrl: string;
  ordersUrl: string;
};

export function OrderCompletedEmail({
  buyerName,
  listingTitle,
  buyerTotal,
  orderId,
  appUrl,
  ordersUrl,
}: OrderCompletedEmailProps) {
  return (
    <EmailBase
      preview={`Your order has been delivered — ${APP_NAME}`}
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>Your order has been delivered! 🎉</h1>
      <p style={styles.paragraph}>Hi {buyerName},</p>
      <p style={styles.paragraph}>
        Your order for <strong>{listingTitle}</strong> has been successfully
        delivered. Thank you for using {APP_NAME}!
      </p>

      <div style={styles.infoRow}>
        <span style={styles.infoLabel}>Order ref</span>
        <span style={styles.infoValue}>{orderId.slice(0, 8).toUpperCase()}</span>
      </div>
      <div style={{ ...styles.infoRow, borderBottom: "none" }}>
        <span style={styles.infoLabel}>Total paid</span>
        <span style={{ ...styles.infoValue, fontWeight: "700" }}>
          {formatMoney(buyerTotal)}
        </span>
      </div>

      <p style={{ ...styles.paragraph, marginTop: "20px" }}>
        We hope you had a great experience. If you have any concerns about your
        order, please reach out to us via WhatsApp support.
      </p>

      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={ordersUrl} style={styles.button}>
          View order history
        </a>
      </p>
    </EmailBase>
  );
}

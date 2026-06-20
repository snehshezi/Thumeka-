import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { EmailBase, styles } from "@/emails/base";

export type PayoutCreatedEmailProps = {
  recipientName: string;
  recipientType: "provider" | "driver";
  netAmount: number;
  grossAmount: number;
  commissionAmount: number;
  periodStart: string;
  payoutId: string;
  appUrl: string;
  dashboardUrl: string;
};

export function PayoutCreatedEmail({
  recipientName,
  recipientType,
  netAmount,
  grossAmount,
  commissionAmount,
  periodStart,
  payoutId,
  appUrl,
  dashboardUrl,
}: PayoutCreatedEmailProps) {
  const label = recipientType === "provider" ? "Provider" : "Driver";

  return (
    <EmailBase
      preview={`Your payout has been created — ${APP_NAME}`}
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>Payout created 💸</h1>
      <p style={styles.paragraph}>Hi {recipientName},</p>
      <p style={styles.paragraph}>
        A payout has been created for your completed {label.toLowerCase()}{" "}
        earnings on {APP_NAME}. Payment will be processed to your registered bank
        account.
      </p>

      <div
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "20px 24px",
          margin: "20px 0",
        }}
      >
        <p style={{ ...styles.muted, fontWeight: "700", marginBottom: "12px", color: "#166534" }}>
          PAYOUT BREAKDOWN
        </p>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Order value</span>
          <span style={styles.infoValue}>{formatMoney(grossAmount)}</span>
        </div>
        {recipientType === "provider" && (
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Platform commission</span>
            <span style={{ ...styles.infoValue, color: "#dc2626" }}>
              − {formatMoney(commissionAmount)}
            </span>
          </div>
        )}
        <div style={{ ...styles.infoRow, borderBottom: "none" }}>
          <span style={{ ...styles.infoLabel, fontWeight: "700" }}>You receive</span>
          <span
            style={{
              ...styles.infoValue,
              fontWeight: "700",
              fontSize: "18px",
              color: "#166534",
            }}
          >
            {formatMoney(netAmount)}
          </span>
        </div>
      </div>

      <div style={styles.infoRow}>
        <span style={styles.infoLabel}>Period</span>
        <span style={styles.infoValue}>{periodStart}</span>
      </div>
      <div style={{ ...styles.infoRow, borderBottom: "none" }}>
        <span style={styles.infoLabel}>Payout ref</span>
        <span style={styles.infoValue}>{payoutId.slice(0, 8).toUpperCase()}</span>
      </div>

      <p style={{ ...styles.muted, marginTop: "16px" }}>
        Payments are processed weekly. If you have not received your payment
        within 5 business days, contact us via WhatsApp support.
      </p>

      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={dashboardUrl} style={styles.button}>
          Go to dashboard
        </a>
      </p>
    </EmailBase>
  );
}

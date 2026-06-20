import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { EmailBase, styles } from "@/emails/base";

export type PayoutPaidEmailProps = {
  recipientName: string;
  netAmount: number;
  grossAmount: number;
  commissionAmount: number;
  paymentReference: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  payoutId: string;
  appUrl: string;
  dashboardUrl: string;
};

export function PayoutPaidEmail({
  recipientName,
  netAmount,
  grossAmount,
  commissionAmount,
  paymentReference,
  paidAt,
  periodStart,
  periodEnd,
  payoutId,
  appUrl,
  dashboardUrl
}: PayoutPaidEmailProps) {
  return (
    <EmailBase preview={`Your payout has been paid — ${APP_NAME}`} appUrl={appUrl}>
      <h1 style={styles.heading}>Payout sent 🚚💸</h1>
      <p style={styles.paragraph}>Hi {recipientName},</p>
      <p style={styles.paragraph}>
        Your delivery earnings for the period {periodStart} → {periodEnd} have
        been paid by EFT. Funds typically reflect within 1–2 business days.
      </p>

      <div
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "20px 24px",
          margin: "20px 0"
        }}
      >
        <p
          style={{
            ...styles.muted,
            fontWeight: "700",
            marginBottom: "12px",
            color: "#166534"
          }}
        >
          PAYOUT BREAKDOWN
        </p>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Delivery fees collected</span>
          <span style={styles.infoValue}>{formatMoney(grossAmount)}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Platform commission (8%)</span>
          <span style={{ ...styles.infoValue, color: "#dc2626" }}>
            − {formatMoney(commissionAmount)}
          </span>
        </div>
        <div style={{ ...styles.infoRow, borderBottom: "none" }}>
          <span style={{ ...styles.infoLabel, fontWeight: "700" }}>
            You received
          </span>
          <span
            style={{
              ...styles.infoValue,
              fontWeight: "700",
              fontSize: "18px",
              color: "#166534"
            }}
          >
            {formatMoney(netAmount)}
          </span>
        </div>
      </div>

      <div style={styles.infoRow}>
        <span style={styles.infoLabel}>Payment reference</span>
        <span style={styles.infoValue}>{paymentReference}</span>
      </div>
      <div style={styles.infoRow}>
        <span style={styles.infoLabel}>Paid on</span>
        <span style={styles.infoValue}>{paidAt.slice(0, 10)}</span>
      </div>
      <div style={{ ...styles.infoRow, borderBottom: "none" }}>
        <span style={styles.infoLabel}>Payout ref</span>
        <span style={styles.infoValue}>
          {payoutId.slice(0, 8).toUpperCase()}
        </span>
      </div>

      <p style={{ ...styles.muted, marginTop: "16px" }}>
        If you don&apos;t see the funds within 2 business days, reply to this
        email or message us on WhatsApp support and quote the payment reference
        above.
      </p>

      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={dashboardUrl} style={styles.button}>
          Go to dashboard
        </a>
      </p>
    </EmailBase>
  );
}

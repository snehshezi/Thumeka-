import * as React from "react";

import { APP_NAME, ADMIN_EMAIL } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { EmailBase, styles } from "@/emails/base";

export type OrderAcceptedEftEmailProps = {
  buyerName: string;
  listingTitle: string;
  buyerTotal: number;
  providerName: string;
  bankAccountName: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  orderId: string;
  appUrl: string;
  ordersUrl: string;
  /** wa.me deep-link to the support number with a pre-filled proof-of-
   *  payment message. When set, the email renders an "Open WhatsApp" CTA
   *  in place of the "email proof to admin@thumeka.co.za" line.
   *  Caller (provider-accept action) builds it from
   *  `createWhatsAppUrl(buildPaymentProofMessage(order))`. */
  whatsappPopUrl?: string | null;
};

export function OrderAcceptedEftEmail({
  buyerName,
  listingTitle,
  buyerTotal,
  providerName,
  bankAccountName,
  bankName,
  bankAccountNumber,
  bankBranchCode,
  orderId,
  appUrl,
  ordersUrl,
  whatsappPopUrl,
}: OrderAcceptedEftEmailProps) {
  const reference = `THMK-${orderId.slice(0, 8).toUpperCase()}`;

  return (
    <EmailBase
      preview={`Your order has been accepted — EFT payment required — ${APP_NAME}`}
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>Your order has been accepted! 🎉</h1>
      <p style={styles.paragraph}>Hi {buyerName},</p>
      <p style={styles.paragraph}>
        <strong>{providerName}</strong> has accepted your order for{" "}
        <strong>{listingTitle}</strong>. To confirm your order, please make an
        EFT payment using the details below.
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
          EFT PAYMENT DETAILS
        </p>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Amount</span>
          <span style={{ ...styles.infoValue, fontWeight: "700", fontSize: "16px" }}>
            {formatMoney(buyerTotal)}
          </span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Account name</span>
          <span style={styles.infoValue}>{bankAccountName}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Bank</span>
          <span style={styles.infoValue}>{bankName}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Account number</span>
          <span style={styles.infoValue}>{bankAccountNumber}</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Branch code</span>
          <span style={styles.infoValue}>{bankBranchCode}</span>
        </div>
        <div style={{ ...styles.infoRow, borderBottom: "none" }}>
          <span style={styles.infoLabel}>Reference</span>
          <span style={{ ...styles.infoValue, fontWeight: "700", color: "#166534" }}>
            {reference}
          </span>
        </div>
      </div>

      <p style={{ ...styles.muted, fontWeight: "600" }}>
        ⚠️ Use <strong>{reference}</strong> as your payment reference — it helps
        us match your payment quickly.
      </p>
      {whatsappPopUrl ? (
        <>
          <p style={styles.muted}>
            Once payment is made, send us the proof on WhatsApp — we&apos;ll
            approve your order in seconds.
          </p>
          <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
            <a href={whatsappPopUrl} style={styles.button}>
              Open WhatsApp
            </a>
          </p>
          <p style={{ ...styles.muted, fontSize: 12, textAlign: "center" as const }}>
            Or{" "}
            <a href={ordersUrl} style={{ color: "#6b7280" }}>
              view my orders
            </a>
            .
          </p>
        </>
      ) : (
        <>
          <p style={styles.muted}>
            Once payment is received, email your proof of payment to{" "}
            <a href={`mailto:${ADMIN_EMAIL}`} style={{ color: "#1a1a2e" }}>
              {ADMIN_EMAIL}
            </a>{" "}
            and your order will be confirmed.
          </p>
          <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
            <a href={ordersUrl} style={styles.button}>
              View my orders
            </a>
          </p>
        </>
      )}
    </EmailBase>
  );
}

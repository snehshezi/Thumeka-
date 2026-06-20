import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { EmailBase, styles } from "@/emails/base";

export type DriverAssignedEmailProps = {
  recipientName: string;
  role: "buyer" | "driver";
  listingTitle: string;
  deliveryAddress: string | null;
  suburb: string | null;
  driverEarning?: number;
  orderId: string;
  appUrl: string;
  dashboardUrl: string;
};

export function DriverAssignedEmail({
  recipientName,
  role,
  listingTitle,
  deliveryAddress,
  suburb,
  driverEarning,
  orderId,
  appUrl,
  dashboardUrl,
}: DriverAssignedEmailProps) {
  const isBuyer = role === "buyer";

  return (
    <EmailBase
      preview={
        isBuyer
          ? `A driver has been assigned to your order — ${APP_NAME}`
          : `You have been assigned a delivery — ${APP_NAME}`
      }
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>
        {isBuyer ? "Driver assigned to your order 🚗" : "New delivery assigned to you 🚗"}
      </h1>
      <p style={styles.paragraph}>Hi {recipientName},</p>
      {isBuyer ? (
        <p style={styles.paragraph}>
          A driver has been assigned to your order for{" "}
          <strong>{listingTitle}</strong>. Your order is on its way soon!
        </p>
      ) : (
        <p style={styles.paragraph}>
          You have been assigned a delivery for{" "}
          <strong>{listingTitle}</strong>. Please check your dashboard for full
          pickup and delivery details.
        </p>
      )}

      {(deliveryAddress || suburb) && (
        <>
          <hr style={styles.divider} />
          <p style={{ ...styles.muted, fontWeight: "600", marginBottom: "8px" }}>
            Delivery details
          </p>
          {deliveryAddress && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Address</span>
              <span style={styles.infoValue}>{deliveryAddress}</span>
            </div>
          )}
          {suburb && (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Suburb</span>
              <span style={styles.infoValue}>{suburb}</span>
            </div>
          )}
        </>
      )}

      {!isBuyer && driverEarning !== undefined && driverEarning > 0 && (
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Your delivery earning</span>
          <span style={{ ...styles.infoValue, fontWeight: "700" }}>
            {formatMoney(driverEarning)}
          </span>
        </div>
      )}

      <div style={{ ...styles.infoRow, borderBottom: "none", margin: "16px 0 0" }}>
        <span style={styles.infoLabel}>Order ref</span>
        <span style={styles.infoValue}>{orderId.slice(0, 8).toUpperCase()}</span>
      </div>

      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={dashboardUrl} style={styles.button}>
          {isBuyer ? "Track my order" : "Go to dashboard"}
        </a>
      </p>
    </EmailBase>
  );
}

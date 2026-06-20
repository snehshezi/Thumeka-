import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { EmailBase, styles } from "@/emails/base";

export type ApplicationRejectedEmailProps = {
  fullName: string;
  applicantType: "provider" | "driver";
  reason: string;
  appUrl: string;
  applyUrl: string;
};

export function ApplicationRejectedEmail({
  fullName,
  applicantType,
  reason,
  appUrl,
  applyUrl,
}: ApplicationRejectedEmailProps) {
  const label = applicantType === "provider" ? "provider" : "driver";

  return (
    <EmailBase
      preview={`Update on your ${label} application — ${APP_NAME}`}
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>Application update</h1>
      <p style={styles.paragraph}>Hi {fullName},</p>
      <p style={styles.paragraph}>
        Thank you for applying to be a <strong>{label}</strong> on {APP_NAME}.
        After reviewing your application, we are unable to approve it at this
        time.
      </p>
      {reason && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            padding: "16px",
            margin: "16px 0",
          }}
        >
          <p style={{ ...styles.muted, margin: "0", fontWeight: "600", color: "#991b1b" }}>
            Reason:
          </p>
          <p style={{ ...styles.paragraph, margin: "4px 0 0", color: "#7f1d1d" }}>
            {reason}
          </p>
        </div>
      )}
      <p style={styles.paragraph}>
        You are welcome to address the above and reapply. If you believe this
        decision is incorrect, please reach out via WhatsApp support.
      </p>
      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={applyUrl} style={styles.button}>
          Reapply
        </a>
      </p>
    </EmailBase>
  );
}

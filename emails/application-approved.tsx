import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { EmailBase, styles } from "@/emails/base";

export type ApplicationApprovedEmailProps = {
  fullName: string;
  applicantType: "provider" | "driver";
  appUrl: string;
  dashboardUrl: string;
};

export function ApplicationApprovedEmail({
  fullName,
  applicantType,
  appUrl,
  dashboardUrl,
}: ApplicationApprovedEmailProps) {
  const label = applicantType === "provider" ? "provider" : "driver";

  const nextStep =
    applicantType === "provider"
      ? "You can now create listings and start receiving orders."
      : "Set your availability to start receiving delivery assignments.";

  return (
    <EmailBase
      preview={`Your ${label} application has been approved — ${APP_NAME}`}
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>You&apos;ve been approved! 🎊</h1>
      <p style={styles.paragraph}>Hi {fullName},</p>
      <p style={styles.paragraph}>
        Great news — your <strong>{label} application</strong> on {APP_NAME}{" "}
        has been <strong>approved</strong>!
      </p>
      <p style={styles.paragraph}>{nextStep}</p>
      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={dashboardUrl} style={styles.button}>
          Go to your dashboard
        </a>
      </p>
    </EmailBase>
  );
}

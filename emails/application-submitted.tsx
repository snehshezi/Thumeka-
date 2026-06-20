import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { EmailBase, styles } from "@/emails/base";

export type ApplicationSubmittedEmailProps = {
  fullName: string;
  applicantType: "provider" | "driver";
  appUrl: string;
  statusUrl: string;
};

export function ApplicationSubmittedEmail({
  fullName,
  applicantType,
  appUrl,
  statusUrl,
}: ApplicationSubmittedEmailProps) {
  const label = applicantType === "provider" ? "provider" : "driver";

  return (
    <EmailBase
      preview={`Your ${label} application has been received — ${APP_NAME}`}
      appUrl={appUrl}
    >
      <h1 style={styles.heading}>Application received ✅</h1>
      <p style={styles.paragraph}>Hi {fullName},</p>
      <p style={styles.paragraph}>
        Thank you for submitting your <strong>{label} application</strong> on{" "}
        {APP_NAME}. Our team will review your details and get back to you
        shortly.
      </p>
      <p style={styles.paragraph}>
        You&apos;ll receive an email once a decision has been made. In the meantime
        you can check your application status at any time.
      </p>
      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={statusUrl} style={styles.button}>
          Check application status
        </a>
      </p>
      <p style={styles.muted}>
        Questions? Contact us via WhatsApp support on the {APP_NAME} website.
      </p>
    </EmailBase>
  );
}

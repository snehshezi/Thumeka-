import * as React from "react";

import { APP_NAME } from "@/lib/constants";
import { EmailBase, styles } from "@/emails/base";

export type WelcomeEmailProps = {
  fullName: string;
  role: string;
  appUrl: string;
  dashboardUrl: string;
};

export function WelcomeEmail({ fullName, role, appUrl, dashboardUrl }: WelcomeEmailProps) {
  const roleLabel =
    role === "provider"
      ? "Provider"
      : role === "driver"
        ? "Driver"
        : "Buyer";

  const nextStep =
    role === "provider"
      ? "Submit your provider application to get listed on the marketplace."
      : role === "driver"
        ? "Submit your driver profile to start accepting deliveries."
        : "Browse local listings and place your first order.";

  return (
    <EmailBase preview={`Welcome to ${APP_NAME}!`} appUrl={appUrl}>
      <h1 style={styles.heading}>Welcome to {APP_NAME}, {fullName}! 🎉</h1>
      <p style={styles.paragraph}>
        Your {roleLabel} account is ready. {nextStep}
      </p>
      <p style={{ textAlign: "center" as const, margin: "24px 0" }}>
        <a href={dashboardUrl} style={styles.button}>
          Go to your dashboard
        </a>
      </p>
      <p style={styles.muted}>
        If you did not create this account, please contact us immediately via
        WhatsApp support.
      </p>
    </EmailBase>
  );
}

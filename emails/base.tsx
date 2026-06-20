import * as React from "react";

import { APP_NAME } from "@/lib/constants";

const colors = {
  brand: "#1a1a2e",
  accent: "#e94560",
  bg: "#f7f7f7",
  card: "#ffffff",
  text: "#1a1a2e",
  muted: "#6b7280",
  border: "#e5e7eb",
};

const styles = {
  body: {
    backgroundColor: colors.bg,
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    margin: "0",
    padding: "0",
  } as React.CSSProperties,
  wrapper: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "32px 16px",
  } as React.CSSProperties,
  header: {
    backgroundColor: colors.brand,
    borderRadius: "8px 8px 0 0",
    padding: "24px 32px",
    textAlign: "center" as const,
  },
  headerText: {
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0",
    letterSpacing: "0.5px",
  } as React.CSSProperties,
  card: {
    backgroundColor: colors.card,
    borderRadius: "0 0 8px 8px",
    border: `1px solid ${colors.border}`,
    borderTop: "none",
    padding: "32px",
  } as React.CSSProperties,
  heading: {
    color: colors.text,
    fontSize: "20px",
    fontWeight: "700",
    margin: "0 0 16px",
  } as React.CSSProperties,
  paragraph: {
    color: colors.text,
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 16px",
  } as React.CSSProperties,
  muted: {
    color: colors.muted,
    fontSize: "13px",
    lineHeight: "1.5",
    margin: "0 0 8px",
  } as React.CSSProperties,
  divider: {
    borderTop: `1px solid ${colors.border}`,
    margin: "24px 0",
  } as React.CSSProperties,
  button: {
    display: "inline-block",
    backgroundColor: colors.accent,
    color: "#ffffff",
    borderRadius: "6px",
    padding: "12px 24px",
    textDecoration: "none",
    fontWeight: "600",
    fontSize: "15px",
    margin: "8px 0",
  } as React.CSSProperties,
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: `1px solid ${colors.border}`,
    fontSize: "14px",
  } as React.CSSProperties,
  infoLabel: { color: colors.muted, marginRight: "8px" } as React.CSSProperties,
  infoValue: { color: colors.text, fontWeight: "500", textAlign: "right" as const } as React.CSSProperties,
  footer: {
    textAlign: "center" as const,
    marginTop: "24px",
    color: colors.muted,
    fontSize: "12px",
    lineHeight: "1.5",
  },
};

type Props = {
  preview: string;
  children: React.ReactNode;
  appUrl: string;
};

export function EmailBase({ preview, children, appUrl }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{preview}</title>
      </head>
      <body style={styles.body}>
        <div style={styles.wrapper}>
          <div style={styles.header}>
            <p style={styles.headerText}>{APP_NAME}</p>
          </div>
          <div style={styles.card}>
            {children}
            <hr style={styles.divider} />
            <div style={styles.footer}>
              <p style={{ margin: "0 0 4px" }}>
                © {new Date().getFullYear()} {APP_NAME} · Durban, South Africa
              </p>
              <p style={{ margin: "0" }}>
                <a href={appUrl} style={{ color: colors.muted }}>
                  {appUrl.replace(/^https?:\/\//, "")}
                </a>
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

export { styles, colors };

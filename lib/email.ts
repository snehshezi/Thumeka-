import "server-only";

import { Resend } from "resend";

const EMAIL_FROM = process.env.EMAIL_FROM || "Thumeka <noreply@thumeka.co.za>";

export type SendEmailOptions = {
  to: string | string[];
  subject: string;
  /** Pass a React element produced by one of the emails/ templates. */
  react: React.ReactElement;
};

/**
 * Sends a transactional email via Resend.
 *
 * Silently skips (logs a warning) when RESEND_API_KEY is not set so that
 * local development without an API key never throws.
 *
 * Errors from the Resend API are logged and re-thrown so callers can
 * decide whether to surface them to the user.
 */
export async function sendEmail({ to, subject, react }: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      `[email] Skipping "${subject}" — RESEND_API_KEY is not set.`
    );
    return;
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    react,
  });

  if (error) {
    console.error(`[email] Failed to send "${subject}":`, error);
    throw new Error(error.message);
  }
}

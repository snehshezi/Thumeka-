import Link from "next/link";

import { APP_NAME } from "@/lib/constants";

/**
 * Body of the Privacy Policy stub, used by both the standalone /privacy page
 * and the registration-flow modal. Real policy content will replace this
 * when supplied by the client; the page chrome / modal chrome stays put.
 */
export function PrivacyContent() {
  return (
    <div
      className="space-y-4 text-body text-black/75 leading-7"
      data-testid="privacy-content"
    >
      <p>
        Our Privacy Policy is being finalised. In the meantime, please refer
        to our{" "}
        <Link className="text-leaf hover:underline" href="/terms">
          Terms &amp; Conditions
        </Link>{" "}
        &mdash; section 17 covers how {APP_NAME} handles personal information
        under POPIA (the Protection of Personal Information Act).
      </p>
      <p>
        For specific questions about your data, contact us at{" "}
        <a
          className="text-leaf hover:underline"
          href="mailto:info@thumeka.co.za"
        >
          info@thumeka.co.za
        </a>{" "}
        or via{" "}
        <Link className="text-leaf hover:underline" href="/support">
          Support
        </Link>
        .
      </p>
    </div>
  );
}

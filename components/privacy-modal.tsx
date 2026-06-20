"use client";

import { LegalModalTrigger } from "@/components/legal-modal";
import { PrivacyContent } from "@/components/privacy-content";

type PrivacyModalTriggerProps = {
  /** Visual children inside the trigger button — rendered like a link. */
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Renders a text-link-style button that opens a centred modal containing the
 * Privacy Policy. Currently shows the stub content from
 * [[privacy-content]] — when the full policy ships, only that file changes.
 */
export function PrivacyModalTrigger({
  children,
  className,
  "data-testid": testId
}: PrivacyModalTriggerProps) {
  return (
    <LegalModalTrigger
      modalTestId="privacy-modal"
      subtitle="Coming soon"
      title="Privacy Policy"
      triggerClassName={className}
      triggerLabel={children}
      triggerTestId={testId}
    >
      <PrivacyContent />
    </LegalModalTrigger>
  );
}

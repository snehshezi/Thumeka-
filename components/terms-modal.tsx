"use client";

import { LegalModalTrigger } from "@/components/legal-modal";
import { TermsContent } from "@/components/terms-content";

type TermsModalTriggerProps = {
  /** Visual children inside the trigger button — rendered like a link. */
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * Renders a text-link-style button that opens a centred modal containing the
 * full Terms & Conditions. Used on the registration form so users can
 * quick-scroll the terms without losing the half-filled form. Modal chrome
 * lives in [[legal-modal]].
 */
export function TermsModalTrigger({
  children,
  className,
  "data-testid": testId
}: TermsModalTriggerProps) {
  return (
    <LegalModalTrigger
      modalTestId="terms-modal"
      subtitle="Effective 5 June 2026"
      title="Terms and Conditions"
      triggerClassName={className}
      triggerLabel={children}
      triggerTestId={testId}
    >
      <TermsContent />
    </LegalModalTrigger>
  );
}

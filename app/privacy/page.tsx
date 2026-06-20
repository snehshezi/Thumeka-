import type { Metadata } from "next";

import { PrivacyContent } from "@/components/privacy-content";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy"
};

export const dynamic = "force-static";

export default function PrivacyPage() {
  return (
    <div data-testid="page-privacy">
      <section className="section-band">
        <div className="page-shell gap-3 py-10 sm:py-14">
          <p className="text-caption font-semibold uppercase tracking-widest text-leaf">
            Legal
          </p>
          <h1 className="text-display-md text-ink">Privacy Policy</h1>
          <p className="text-body-sm text-black/55">
            Coming soon &middot; {APP_NAME} Online (Pty) Ltd
          </p>
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="panel max-w-2xl p-6">
          <PrivacyContent />
        </div>
      </section>
    </div>
  );
}

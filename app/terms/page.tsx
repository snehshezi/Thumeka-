import type { Metadata } from "next";
import Link from "next/link";

import { TermsContent, TERMS_SECTIONS } from "@/components/terms-content";

export const metadata: Metadata = {
  title: "Terms and Conditions"
};

export const dynamic = "force-static";

export default function TermsPage() {
  return (
    <div data-testid="page-terms">
      <section className="section-band">
        <div className="page-shell gap-3 py-10 sm:py-14">
          <p className="text-caption font-semibold uppercase tracking-widest text-leaf">
            Legal
          </p>
          <h1 className="text-display-md text-ink">Terms and Conditions</h1>
          <p className="text-body-sm text-black/55">
            Thumeka Online (Pty) Ltd · Effective 5 June 2026
          </p>
        </div>
      </section>

      <section className="page-shell py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <aside
            aria-label="Table of contents"
            className="w-full shrink-0 md:w-64"
            data-testid="terms-toc"
          >
            <div className="md:sticky md:top-24">
              <p className="text-caption font-semibold uppercase tracking-widest text-black/40">
                Contents
              </p>
              <ol className="mt-3 space-y-1 text-body-sm">
                {TERMS_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      className="text-ink hover:text-leaf"
                      href={`#${section.id}`}
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </aside>

          <article className="min-w-0 flex-1">
            <TermsContent />

            <p className="mt-10 border-t border-black/10 pt-6 text-body-sm text-black/55">
              Questions about these Terms? Reach us at{" "}
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
          </article>
        </div>
      </section>
    </div>
  );
}

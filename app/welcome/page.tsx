import { ArrowRight, Clock, ShoppingBag, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Why ${APP_NAME}?`,
  description:
    "Thumeka is South Africa's safest marketplace — products, services, errands, and deliveries from trusted local stores."
};

export default function WelcomePage() {
  return (
    <div className="bg-mist" data-testid="page-welcome">
      <section className="section-band">
        <div className="page-shell gap-6 py-10 sm:py-16">
          <div className="flex flex-col items-start gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-mint px-3 py-1 text-caption font-semibold uppercase tracking-widest text-leaf">
                <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
                South Africa&apos;s safest marketplace
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sunset/15 px-3 py-1 text-caption font-semibold uppercase tracking-widest text-sunset"
                data-testid="welcome-open-247-badge"
              >
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                Open 24/7
              </span>
            </div>
            <h1 className="max-w-3xl text-display-lg sm:text-display-xl">
              Anything <span className="text-brand-gradient">delivered</span>{" "}
              within an average of 40 minutes.
            </h1>
            <p className="max-w-2xl text-body text-black/65 sm:text-base sm:leading-7">
              {APP_NAME} is a Durban-first marketplace for products, services,
              errands, and deliveries. Browse trusted local stores, pay by
              EFT, and let approved drivers handle the last mile.
            </p>
            <Link
              className="btn-primary inline-flex items-center gap-2"
              data-testid="welcome-start-browsing-link"
              href="/"
            >
              Start browsing
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="page-shell py-12">
        <div className="grid gap-5 sm:grid-cols-2">
          <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sunset/15 text-sunset">
              <Clock aria-hidden="true" className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-h3 text-ink">Always on</h2>
            <p className="mt-1 text-body-sm text-black/60">
              Browse, order, and pay around the clock. Live stores rise to
              the top of the grid so you know who&apos;s open right now.
            </p>
          </article>
          <article className="rounded-2xl border border-black/10 bg-white p-5 shadow-soft">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky/10 text-sky">
              <Sparkles aria-hidden="true" className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-h3 text-ink">Built for Durban</h2>
            <p className="mt-1 text-body-sm text-black/60">
              Local stores, approved drivers, and suburb-by-suburb delivery —
              from Berea to Umhlanga, Pinetown to the Bluff.
            </p>
          </article>
        </div>

        <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl border border-leaf/20 bg-mint p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-h2 text-leaf">Ready when you are.</h2>
            <p className="mt-1 text-body-sm text-leaf/85">
              Browse the marketplace and place your first order in minutes.
            </p>
          </div>
          <Link
            className="btn-primary inline-flex items-center gap-2"
            data-testid="welcome-footer-cta-link"
            href="/"
          >
            Browse listings
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

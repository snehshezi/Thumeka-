import Link from "next/link";

import { APP_NAME } from "@/lib/constants";

export default function NotFound() {
  return (
    <div
      className="section-band"
      data-testid="page-not-found"
    >
      <div className="page-shell max-w-2xl py-16 text-center">
        <p className="text-caption font-semibold uppercase tracking-widest text-iris">
          404
        </p>
        <h1 className="mt-3 text-display-md sm:text-display-lg">
          That page is{" "}
          <span className="text-brand-gradient">somewhere else.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-body text-black/65">
          The link you followed might be old or mistyped. Head back to the
          marketplace and we&apos;ll get you on your way.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            className="btn-primary px-6"
            data-testid="not-found-home-link"
            href="/"
          >
            Back to {APP_NAME}
          </Link>
          <Link
            className="btn-secondary px-6"
            data-testid="not-found-listings-link"
            href="/listings"
          >
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}

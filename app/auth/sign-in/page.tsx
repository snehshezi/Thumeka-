import type { Metadata } from "next";
import Link from "next/link";
import { LogIn } from "lucide-react";

import { SignInForm } from "@/app/auth/sign-in/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in"
};

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    expired?: string;
    next?: string;
    registered?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  return (
    <div className="section-band" data-testid="page-sign-in">
      <div className="page-shell max-w-xl py-8">
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
            <LogIn className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-display-md text-ink">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Access your buyer orders, provider listings, driver deliveries, or admin workspace.
          </p>
        </div>

        {params.expired ? (
          <div
            className="mb-4 rounded-md border border-maize/60 bg-maize/20 p-3 text-sm text-ink"
            data-testid="sign-in-expired-message"
          >
            Your session expired. Please sign in again to continue.
          </div>
        ) : null}
        {params.registered ? (
          <div className="mb-4 rounded-md border border-mint bg-mint p-3 text-sm text-leaf">
            Account created. Sign in once email confirmation is complete.
          </div>
        ) : null}

        <SignInForm initialError={params.error} next={params.next} />

        <p className="mt-5 text-center text-sm text-black/60">
          Need an account?{" "}
          <Link className="font-semibold text-leaf" data-testid="sign-in-register-link" href="/auth/register">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

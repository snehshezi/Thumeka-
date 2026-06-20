import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";

import { registerAction } from "@/app/auth/actions";
import { PasswordInput } from "@/components/password-input";
import { PrivacyModalTrigger } from "@/components/privacy-modal";
import { TermsModalTrigger } from "@/components/terms-modal";

export const metadata: Metadata = {
  title: "Register"
};

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  return (
    <div className="section-band" data-testid="page-register">
      <div className="page-shell max-w-xl py-8">
        <div className="mb-6">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-mint text-leaf">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="text-display-md text-ink">Create account</h1>
          <p className="mt-2 text-sm leading-6 text-black/60">
            Choose the role you need for orders, listings, or deliveries.
          </p>
        </div>

        {params.error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {params.error}
          </div>
        ) : null}

        <form action={registerAction} className="panel space-y-4" data-testid="register-form">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Full name</span>
              <input className="input" data-testid="register-full-name-input" name="full_name" required />
            </label>
            <label className="space-y-1">
              <span className="label">Phone</span>
              <input
                autoComplete="tel"
                className="input"
                data-testid="register-phone-input"
                inputMode="tel"
                maxLength={20}
                name="phone"
                placeholder="071 234 5678"
                type="tel"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="label">Email</span>
            <input
              autoComplete="email"
              className="input"
              data-testid="register-email-input"
              inputMode="email"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block space-y-1">
            <span className="label">Password</span>
            <PasswordInput
              autoComplete="new-password"
              data-testid="register-password-input"
              minLength={8}
              name="password"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="label">Confirm password</span>
            <PasswordInput
              autoComplete="new-password"
              data-testid="register-confirm-password-input"
              minLength={8}
              name="confirm_password"
              required
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="label">Role</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ["buyer", "Buyer"],
                ["provider", "Provider"],
                ["driver", "Driver"]
              ].map(([value, label]) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-black/15 bg-white px-3 py-3 text-sm font-medium has-[:checked]:border-leaf has-[:checked]:bg-mint"
                  key={value}
                >
                  <input
                    className="h-4 w-4 accent-leaf"
                    data-testid={`register-role-${value}-input`}
                    defaultChecked={value === "buyer"}
                    name="role"
                    type="radio"
                    value={value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label
            className="flex items-start gap-2 text-body-sm text-black/70"
            data-testid="register-terms-label"
          >
            <input
              className="mt-0.5 h-4 w-4 accent-leaf"
              data-testid="register-terms-checkbox"
              name="terms_accepted"
              required
              type="checkbox"
              value="1"
            />
            <span>
              I have read and agree to the{" "}
              <TermsModalTrigger
                className="font-semibold text-leaf hover:underline"
                data-testid="register-terms-trigger"
              >
                Terms &amp; Conditions
              </TermsModalTrigger>
              {" "}and{" "}
              <PrivacyModalTrigger
                className="font-semibold text-leaf hover:underline"
                data-testid="register-privacy-trigger"
              >
                Privacy Policy
              </PrivacyModalTrigger>
              .
            </span>
          </label>
          <button className="btn-primary w-full" data-testid="register-submit-button" type="submit">
            Create account
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-black/60">
          Already registered?{" "}
          <Link className="font-semibold text-leaf" data-testid="register-sign-in-link" href="/auth/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

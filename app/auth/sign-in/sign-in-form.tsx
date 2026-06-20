"use client";

import { useEffect, useState } from "react";

import { PasswordInput } from "@/components/password-input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SignInFormProps = {
  next?: string;
  /**
   * Optional initial error to show — used when the page is loaded with
   * `?error=...` from a redirect (e.g. legacy server action error path).
   */
  initialError?: string;
};

/**
 * Client-side sign-in form. Calls `supabase.auth.signInWithPassword` via the
 * browser Supabase client, which sets session cookies directly via
 * `document.cookie` and POSTs straight to Supabase's REST API — bypassing
 * our Node / iisnode / IIS stack entirely. That dodges the iisnode bug where
 * `Set-Cookie` headers from Server Action 303 responses occasionally get
 * stripped before they reach the browser, which was making fresh sign-ins
 * require two attempts.
 *
 * After a successful sign-in we hand off to `/auth/role-redirect`, a small
 * server route handler that reads the new session, runs `ensureProfile`
 * (creating the profile row if this is the user's first sign-in after
 * email confirmation), and redirects to either the `next` URL or the
 * caller's role-home path.
 */
export function SignInForm({ next, initialError }: SignInFormProps) {
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  // Disable the submit button until the client has hydrated so a fast
  // tap before the React handlers attach doesn't submit a no-op form.
  useEffect(() => {
    setHydrated(true);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Hand off to the server route that resolves the role and redirects.
      // Using window.location instead of router.push so the new server-side
      // cookies (just written by the browser SDK) are read on a hard nav
      // and we don't rely on Next's client-side cache state.
      const target = `/auth/role-redirect${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      window.location.assign(target);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Sign in failed. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <form
      className="panel space-y-4"
      data-testid="sign-in-form"
      onSubmit={handleSubmit}
    >
      <input name="next" type="hidden" value={next ?? ""} />
      {error ? (
        <div
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          data-testid="sign-in-error"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <label className="block space-y-1">
        <span className="label">Email</span>
        <input
          autoComplete="email"
          className="input"
          data-testid="sign-in-email-input"
          inputMode="email"
          name="email"
          required
          type="email"
        />
      </label>
      <label className="block space-y-1">
        <span className="label">Password</span>
        <PasswordInput
          autoComplete="current-password"
          data-testid="sign-in-password-input"
          name="password"
          required
        />
      </label>
      <button
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
        data-testid="sign-in-submit-button"
        disabled={!hydrated || loading}
        type="submit"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}


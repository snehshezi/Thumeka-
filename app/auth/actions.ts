"use server";

import { redirect } from "next/navigation";

import { ADMIN_EMAIL, PUBLIC_ROLES, type PublicRole } from "@/lib/constants";
import { getAppUrl } from "@/lib/env";
import { ensureProfile } from "@/lib/profile";
import { roleHomePath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateAndNormalizeZaPhone } from "@/lib/validators";

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function encodeError(message: string) {
  return encodeURIComponent(message);
}

function normalizePublicRole(value: string): PublicRole {
  if (PUBLIC_ROLES.includes(value as PublicRole)) {
    return value as PublicRole;
  }

  return "buyer";
}

export async function registerAction(formData: FormData) {
  const fullName = readString(formData, "full_name");
  const phone = readString(formData, "phone");
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const confirmPassword = readString(formData, "confirm_password");
  const role = normalizePublicRole(readString(formData, "role"));
  const termsAccepted = readString(formData, "terms_accepted") === "1";

  if (!fullName || !email || !password) {
    redirect("/auth/register?error=Full%20name%2C%20email%20and%20password%20are%20required");
  }

  if (email === ADMIN_EMAIL) {
    redirect("/auth/register?error=Use%20the%20admin%20invite%20flow%20for%20this%20email");
  }

  if (password.length < 8) {
    redirect("/auth/register?error=Password%20must%20be%20at%20least%208%20characters%20and%20contain%20letters%20and%20numbers");
  }

  // Server-side belt-and-braces check; the browser-side `required` on the
  // confirm field catches the empty case, but does not check equality.
  if (password !== confirmPassword) {
    redirect("/auth/register?error=Passwords%20do%20not%20match");
  }

  if (!termsAccepted) {
    redirect(
      "/auth/register?error=You%20must%20agree%20to%20the%20Terms%20%26%20Conditions%20to%20register"
    );
  }

  // Phone is optional at registration; if supplied, normalise to 0XXXXXXXXX.
  // An invalid value blocks submission with a friendly error rather than
  // silently storing garbage in user_metadata.
  let normalizedPhone: string | null = null;
  if (phone) {
    const phoneResult = validateAndNormalizeZaPhone(phone);
    if (!phoneResult.ok) {
      redirect(`/auth/register?error=${encodeError(phoneResult.error)}`);
    }
    normalizedPhone = phoneResult.value;
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
      data: {
        full_name: fullName,
        phone: normalizedPhone,
        role,
        terms_accepted_at: new Date().toISOString()
      }
    }
  });

  if (error) {
    redirect(`/auth/register?error=${encodeError(error.message)}`);
  }

  // With email confirmations enabled Supabase always returns session=null here.
  // The welcome email is sent from /auth/callback after the user confirms.
  redirect("/auth/sign-in?registered=1");
}

export async function signInAction(formData: FormData) {
  const email = readString(formData, "email").toLowerCase();
  const password = readString(formData, "password");
  const next = readString(formData, "next");

  if (!email || !password) {
    redirect("/auth/sign-in?error=Email%20and%20password%20are%20required");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error || !data.user) {
    redirect(`/auth/sign-in?error=${encodeError(error?.message ?? "Unable to sign in")}`);
  }

  const profile = await ensureProfile(supabase, data.user);

  if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }

  redirect(roleHomePath(profile.role));
}

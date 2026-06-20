import { redirect } from "next/navigation";

import type { AppRole } from "@/lib/constants";
import type { ProfileRow } from "@/lib/database.types";
import { ensureProfile } from "@/lib/profile";
import { roleHomePath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionProfile = {
  userId: string;
  profile: ProfileRow;
};

export async function getCurrentProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  return ensureProfile(supabase, user);
}

export async function requireProfile(): Promise<SessionProfile> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.warn(
      "[auth] redirecting to /auth/sign-in cause=%s error=%s",
      userError ? "getuser-error" : "no-user",
      userError?.message ?? "n/a"
    );
    redirect("/auth/sign-in");
  }

  const profile = await ensureProfile(supabase, user);
  return { userId: user.id, profile };
}

export function canShopAsBuyer(
  profile: ProfileRow | null | undefined
): boolean {
  // Anonymous users keep the cart (sign-in is prompted at checkout, not at
  // "Add to cart"). Signed-in non-buyer roles — provider, driver, admin —
  // see a pure non-buyer experience.
  return !profile || profile.role === "buyer";
}

export async function requireRole(roles: AppRole[]): Promise<SessionProfile> {
  const session = await requireProfile();

  if (!roles.includes(session.profile.role)) {
    console.warn(
      "[auth] redirecting to role-home cause=wrong-role have=%s need=%s",
      session.profile.role,
      roles.join("|")
    );
    redirect(roleHomePath(session.profile.role));
  }

  return session;
}

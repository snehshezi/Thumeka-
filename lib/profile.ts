import type { User } from "@supabase/supabase-js";

import { ADMIN_EMAIL, type AppRole, PUBLIC_ROLES } from "@/lib/constants";
import type { ProfileRow } from "@/lib/database.types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseProfileClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function normalizeRole(value: unknown): AppRole {
  if (
    typeof value === "string" &&
    PUBLIC_ROLES.includes(value as (typeof PUBLIC_ROLES)[number])
  ) {
    return value as AppRole;
  }

  return "buyer";
}

export async function ensureProfile(
  supabase: SupabaseProfileClient,
  user: User
): Promise<ProfileRow> {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (existing) {
    return existing as ProfileRow;
  }

  const metadata = user.user_metadata ?? {};
  const email = user.email ?? "";
  const role =
    email.toLowerCase() === ADMIN_EMAIL
      ? "admin"
      : normalizeRole(metadata.role);

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: user.id,
      email,
      role,
      full_name:
        typeof metadata.full_name === "string" ? metadata.full_name : null,
      phone: typeof metadata.phone === "string" ? metadata.phone : null,
      terms_accepted_at:
        typeof metadata.terms_accepted_at === "string"
          ? metadata.terms_accepted_at
          : null
    })
    .select("*")
    .single();

  if (insertError) {
    throw insertError;
  }

  return created as ProfileRow;
}

/**
 * One-off script: provision the admin account against the production
 * Supabase project, bypassing the email-verification step (Resend isn't
 * wired yet, so the verification email would never arrive).
 *
 * Usage (from the repo root):
 *
 *   set -a && source .env.production.local && set +a && \
 *     npx tsx scripts/create-admin.ts '<password>'
 *
 * Bash will splat the env file into process.env, then tsx runs this. The
 * password is the first CLI arg — quote it if it contains shell-special
 * characters.
 *
 * Idempotent: if the admin already exists, the script updates their
 * password instead of failing.
 */

import { createClient } from "@supabase/supabase-js";

import { ADMIN_EMAIL } from "@/lib/constants";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.argv[2];

if (!url || !serviceRole) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Source .env.production.local first."
  );
  process.exit(1);
}

if (!password || password.length < 8) {
  console.error("Pass the admin password as the first CLI argument (≥ 8 chars).");
  process.exit(1);
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const fullName = "Thumeka Admin";

async function main() {
  // listUsers returns paginated; the admin will be in page 1 (the project
  // is brand new and small).
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200
  });

  if (listError) {
    throw new Error(`listUsers failed: ${listError.message}`);
  }

  const existing = list.users.find(
    (u) => (u.email ?? "").toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  if (existing) {
    console.log(
      `Admin user already exists (id=${existing.id}). Updating password…`
    );
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        ...existing.user_metadata,
        full_name: existing.user_metadata?.full_name ?? fullName,
        role: "admin"
      }
    });
    if (error) {
      throw new Error(`updateUserById failed: ${error.message}`);
    }
    console.log("✓ Password updated.");
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "admin" }
  });

  if (error || !data.user) {
    throw new Error(`createUser failed: ${error?.message ?? "no user returned"}`);
  }

  console.log(`✓ Admin user created (id=${data.user.id}).`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Sign in:  https://thumeka.co.za/auth/sign-in`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

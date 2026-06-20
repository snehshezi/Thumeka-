"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * `process.env.NEXT_PUBLIC_*` references MUST be written statically (literal
 * property access) so Next.js's compiler can replace them with the actual
 * values at build time. The shared `getRequiredEnv(name)` helper uses
 * dynamic indexing — fine server-side where Node has a real `process.env`,
 * but in the browser bundle `process.env` is essentially `{}` and the
 * dynamic lookup returns undefined. That's why uploads were throwing
 * "NEXT_PUBLIC_SUPABASE_URL is required" client-side even though the env
 * file had it set. Keep the static access here.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client missing NEXT_PUBLIC_SUPABASE_URL or " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY at build time. Rebuild after setting them."
    );
  }

  return createBrowserClient(url, anonKey);
}

import "server-only";

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { getRequiredEnv } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Drop deletion writes — under iisnode the server SSR
              // client occasionally tries to clear cookies after reading
              // a freshly-set browser session, which silently wipes
              // the user out within a second of sign-in. The browser
              // SDK owns the session lifecycle; the server only needs
              // to be able to refresh (real value) — not delete.
              if (!value) return;
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components cannot set cookies; middleware and route handlers can.
          }
        }
      }
    }
  );
}

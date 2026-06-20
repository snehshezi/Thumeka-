import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getPublicOrigin } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  // Sign-out wants to clear cookies — but our setAll callback drops
  // empty-value writes (defends against iisnode wiping freshly-set
  // sessions). So we explicitly delete every sb-* cookie here on the
  // way out instead of relying on the SDK's deletion attempt.
  const cookieStore = await cookies();
  cookieStore
    .getAll()
    .filter((cookie) => cookie.name.startsWith("sb-"))
    .forEach((cookie) => {
      cookieStore.delete(cookie.name);
    });

  // Build the redirect off the public origin (X-Forwarded-Host) so iisnode's
  // internal loopback URL doesn't leak into the Location header.
  return NextResponse.redirect(
    new URL("/auth/sign-in", getPublicOrigin(request))
  );
}

export async function GET(request: Request) {
  return POST(request);
}

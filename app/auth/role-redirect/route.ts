import { NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";
import { getPublicOrigin } from "@/lib/env";
import { roleHomePath } from "@/lib/routes";

/**
 * Post-sign-in landing route. The client-side sign-in form writes session
 * cookies to the browser directly (via the Supabase browser SDK), then
 * navigates here. We read the now-fresh session server-side, run
 * `ensureProfile` (which creates the row on a first sign-in after email
 * confirmation), and redirect to either the requested `next` URL or the
 * caller's role-home path.
 *
 * If the session somehow isn't visible to this server render (cookie
 * propagation race), we redirect back to /auth/sign-in with no error
 * banner — the user can try the form again, which is rare but handled.
 *
 * We honour `?next=/...` only if it's a safe relative path so this isn't an
 * open-redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get("next");
  const origin = getPublicOrigin(request);

  const profile = await getCurrentProfile().catch(() => null);

  if (!profile) {
    return NextResponse.redirect(new URL("/auth/sign-in", origin));
  }

  if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
    return NextResponse.redirect(new URL(nextParam, origin));
  }

  return NextResponse.redirect(new URL(roleHomePath(profile.role), origin));
}

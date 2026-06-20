import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { isSupabaseConfigured } from "@/lib/env";
import { isProtectedPath } from "@/lib/routes";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Drop deletion writes. The SSR client occasionally tries to
          // clear cookies under iisnode (cookie format being read
          // differently than the browser SDK wrote them, refresh dance
          // failing in confusing ways), which would wipe sessions the
          // browser SDK has just legitimately set. The browser handles
          // its own session lifecycle; the server-side SDK should be
          // read-only for the empty-value case. Real cookie writes
          // (refresh tokens, sign-in callback, etc.) still go through.
          const realWrites = cookiesToSet.filter(({ value }) => Boolean(value));
          if (realWrites.length < cookiesToSet.length) {
            console.warn(
              "[middleware] skipped %d empty-value cookie write(s) — likely SDK deletion attempt",
              cookiesToSet.length - realWrites.length
            );
          }
          if (realWrites.length === 0) return;
          realWrites.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          realWrites.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(request.nextUrl.pathname)) {
    // Diagnostic only — emit a console.warn so we can read in Plesk's Node
    // stdout why a redirect fired (e.g. cookie names present, getUser
    // error). We intentionally do NOT clear sb-* cookies here and we do
    // NOT set `expired=1` on the redirect URL — under iisnode there's a
    // race where the cookies set by signInAction aren't visible to the
    // middleware on the immediate next request, so the earlier
    // "clear + flag" defence was wiping freshly-set sessions and bouncing
    // users to sign-in TWICE on a clean login. Leaving cookies alone
    // means the next sign-in just overwrites them; no loop, no false
    // "expired" banner.
    const sbCookies = request.cookies
      .getAll()
      .filter((cookie) => cookie.name.startsWith("sb-"));
    console.warn(
      "[middleware] redirecting to /auth/sign-in path=%s sbCookies=%s userError=%s",
      request.nextUrl.pathname,
      sbCookies.map((cookie) => cookie.name).join(",") || "none",
      userError?.message ?? "n/a"
    );

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/sign-in";
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};

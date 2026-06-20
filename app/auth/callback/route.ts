import { NextResponse } from "next/server";

import { WelcomeEmail } from "@/emails/welcome";
import { sendEmail } from "@/lib/email";
import { getAppUrl, getPublicOrigin } from "@/lib/env";
import { ensureProfile } from "@/lib/profile";
import { roleHomePath } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Anchor the redirect to the public origin (X-Forwarded-Host) rather than
  // request.url's origin, which under iisnode is the internal loopback.
  const redirectTo = new URL("/dashboard", getPublicOrigin(request));

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const profile = await ensureProfile(supabase, user);
      redirectTo.pathname = roleHomePath(profile.role);

      // Send welcome email after the user has confirmed their email address.
      // Non-fatal — a failed email must never break the sign-in redirect.
      const appUrl = getAppUrl();
      sendEmail({
        to: user.email!,
        subject: "Welcome to Thumeka!",
        react: WelcomeEmail({
          fullName: profile.full_name ?? user.email!,
          role: profile.role,
          appUrl,
          dashboardUrl: `${appUrl}${roleHomePath(profile.role)}`,
        }),
      }).catch((err: Error) =>
        console.warn("[email] Welcome email failed, continuing:", err.message)
      );
    }
  }

  return NextResponse.redirect(redirectTo);
}

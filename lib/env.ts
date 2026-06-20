export function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/**
 * The public-facing origin of the request — i.e. `https://thumeka.co.za`
 * in production, `http://127.0.0.1:3000` locally.
 *
 * Why this exists: under iisnode on Plesk Windows, the IIS reverse proxy
 * forwards requests to the Node worker on a loopback pipe. `request.url`
 * inside a Route Handler reflects what Node sees, which is something like
 * `http://localhost:<port>/...` — building a redirect off that produces a
 * URL the browser can't open.
 *
 * Resolution order:
 *
 *  1. **`NEXT_PUBLIC_APP_URL`** (preferred). In production this is the
 *     canonical origin. Trusting the env var avoids guessing scheme/host
 *     from proxy headers — Plesk's IIS in particular has been observed
 *     forwarding `X-Forwarded-Proto: http` even when the original request
 *     was HTTPS (TLS is terminated by a layer upstream of iisnode). That
 *     caused redirects built off the forwarded headers to land on
 *     `http://thumeka.co.za/…` and trip the browser's mixed-content
 *     blocker.
 *  2. `X-Forwarded-Host` + `X-Forwarded-Proto` — covers Vercel /
 *     Netlify / Cloudflare deployments that set both correctly.
 *  3. `Host` header — vanilla Node behind a transparent proxy or local
 *     dev.
 *  4. `getAppUrl()` — final safety net.
 */
export function getPublicOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const xfHost = request.headers.get("x-forwarded-host");
  const xfProto = request.headers.get("x-forwarded-proto");
  if (xfHost) {
    return `${xfProto ?? "https"}://${xfHost}`;
  }

  const host = request.headers.get("host");
  if (host) {
    const proto = request.url.startsWith("https://") ? "https" : "http";
    return `${proto}://${host}`;
  }

  return getAppUrl();
}

export function getSupportWhatsAppNumber() {
  return process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER || "";
}

export function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY || "";
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}


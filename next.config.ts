import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Plesk's Phusion Passenger expects a server.js at the application root
  // that calls Next.js programmatically. See ./server.js — using the standard
  // build output keeps node_modules on the server (Plesk auto-runs npm ci)
  // and avoids the file-shuffling dance that a standalone build requires.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co"
      }
    ]
  }
};

// Sentry wraps the build to enable source-map upload + tunneling. When
// SENTRY_AUTH_TOKEN is unset (local dev, CI without secrets) the wrapper is
// inert — no warnings, no upload attempts — so the same config works
// everywhere.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  disableLogger: true,
  tunnelRoute: "/monitoring"
});

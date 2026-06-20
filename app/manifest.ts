import type { MetadataRoute } from "next";

/**
 * PWA manifest. Next.js's typed manifest convention — exporting from
 * `app/manifest.ts` serves `/manifest.webmanifest` automatically.
 *
 * Why this matters: iOS Safari 16.4+ only delivers Web Push to
 * installed PWAs. Without a valid manifest + a user tapping
 * Share → Add to Home Screen, iPhone users get nothing. Android
 * Chrome also uses the manifest for the install prompt + Add-to-home
 * shortcut.
 *
 * Icons live in `public/icons/` and are referenced by relative URL.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Thumeka",
    short_name: "Thumeka",
    description:
      "South Africa's safest and most empowering marketplace — products, services, errands, and deliveries.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a2e",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}

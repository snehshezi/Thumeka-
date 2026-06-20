/* Thumeka service worker — Web Push handler.
 *
 * Two events:
 *   - push: shows a native system notification using the JSON payload
 *     we sent from lib/push.ts (title / body / url).
 *   - notificationclick: focuses an existing tab on the deep-link URL
 *     if one exists; opens a new window otherwise.
 *
 * Deliberately tiny — no caching, no offline support, no background
 * sync. Adding any of those is a separate decision (and risks shipping
 * stale HTML if done wrong).
 */

self.addEventListener("install", () => {
  // Activate immediately on first install so users don't have to reload
  // before notifications start working.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all open pages without a reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Malformed payload — show a generic ping rather than crashing.
    data = {};
  }

  const title = data.title || "Thumeka";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge.png",
    data: { url: data.url || "/" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      // Prefer an already-open tab on the same origin; navigate it
      // to the target URL and focus it.
      const sameOrigin = allClients.find((client) => {
        try {
          const clientOrigin = new URL(client.url).origin;
          const targetOrigin = new URL(targetUrl, client.url).origin;
          return clientOrigin === targetOrigin;
        } catch {
          return false;
        }
      });

      if (sameOrigin) {
        if (sameOrigin.navigate) {
          await sameOrigin.navigate(targetUrl);
        }
        return sameOrigin.focus();
      }

      // Otherwise pop a fresh window.
      return self.clients.openWindow(targetUrl);
    })()
  );
});

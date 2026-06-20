"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";

type Role = "buyer" | "provider" | "driver";

type PushNotificationPromptProps = {
  role: Role;
};

const COPY: Record<Role, { title: string; body: string }> = {
  provider: {
    title: "Get pinged the moment a buyer orders",
    body: "Browser notifications mean you don't have to refresh the dashboard. Works on Chrome, Edge, Firefox, and installed Safari (Add to Home Screen on iPhone)."
  },
  buyer: {
    title: "Know the second your order is accepted",
    body: "Get notified the moment a seller accepts, the driver picks up, and the order is delivered. No need to refresh."
  },
  driver: {
    title: "Get the next delivery as soon as it's assigned",
    body: "We'll ping you the moment admin assigns a delivery to you — your phone notifies you even when this tab is closed."
  }
};

type Status =
  | "checking"        // initial mount: detecting support + permission state
  | "unsupported"     // browser doesn't have Push API, Notification API,
                       //   or the deployment hasn't set VAPID keys yet
  | "needs_pwa_install" // iOS Safari, not in standalone PWA mode
  | "blocked"         // user denied permission previously
  | "enabled"         // permission granted + subscription registered
  | "available"       // can prompt; user hasn't decided yet
  | "working"         // mid-subscribe flow
  | "error";          // unexpected failure

/** iOS Safari exposes `navigator.standalone` (a non-standard flag).
 *  When it's `false` we're in mobile Safari proper; when `true` the
 *  page is launched from the Home Screen (PWA standalone). Other
 *  browsers leave the property `undefined`. */
function isIosSafariNonStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = (window.navigator as { standalone?: boolean }).standalone;
  return standalone === false;
}

/**
 * Contextual "Enable browser notifications" panel. Each dashboard mounts
 * it with the matching role; the panel renders nothing once the user
 * has enabled (or explicitly blocked) notifications, so it only takes
 * up space when there's an action to take.
 *
 * The full flow on click:
 *   1. Register `/sw.js` (idempotent — browsers cache it).
 *   2. Call `Notification.requestPermission()`.
 *   3. On grant, `reg.pushManager.subscribe({ userVisibleOnly: true,
 *      applicationServerKey: VAPID_PUBLIC_KEY })`.
 *   4. POST the subscription JSON to `/api/push/subscribe`.
 *
 * Failure modes are surfaced inline rather than redirecting — push is
 * a nice-to-have, not a critical path.
 */
export function PushNotificationPrompt({ role }: PushNotificationPromptProps) {
  const [status, setStatus] = useState<Status>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (typeof window === "undefined") return;

      // No-op the panel entirely when the deployment hasn't shipped
      // VAPID keys — the subscribe call would 100% fail, so don't
      // present a button that doesn't work. (NEXT_PUBLIC_* is inlined
      // at build time, so this check is reliable client-side.)
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        // iOS Safari (non-standalone) gets a friendlier nudge — Push
        // works after Add to Home Screen, not before.
        if (!cancelled) {
          setStatus(
            isIosSafariNonStandalone() ? "needs_pwa_install" : "unsupported"
          );
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("blocked");
        return;
      }

      if (Notification.permission === "granted") {
        // Permission already granted in a previous session — check if we
        // still have a live subscription. If not, the user re-installed
        // the browser or cleared site data and needs to opt in again.
        try {
          const reg = await navigator.serviceWorker.getRegistration("/sw.js");
          const sub = await reg?.pushManager.getSubscription();
          if (!cancelled) setStatus(sub ? "enabled" : "available");
        } catch {
          if (!cancelled) setStatus("available");
        }
        return;
      }

      if (!cancelled) setStatus("available");
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setStatus("working");
    setErrorMessage(null);

    // `detect()` already gates on this env var being present — defensive
    // re-check keeps TS happy and protects against a stale render.
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      setStatus("unsupported");
      return;
    }

    try {
      const registration =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "available");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent:
            typeof navigator !== "undefined" ? navigator.userAgent : null
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            `Subscribe failed (HTTP ${response.status})`
        );
      }

      setStatus("enabled");
    } catch (err) {
      console.warn("[push-prompt] enable failed:", err);
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    }
  }

  // Don't render anything when there's nothing for the user to do:
  // still detecting, already enabled, or the browser / deployment
  // can't support push at all.
  if (status === "checking" || status === "enabled") return null;
  if (status === "unsupported") return null;

  // iOS Safari (non-standalone): show a small Add to Home Screen tip
  // instead of the regular Enable button — push won't work in mobile
  // Safari, but it will after the user installs the PWA.
  if (status === "needs_pwa_install") {
    return (
      <div
        className="rounded-lg border border-sky/30 bg-sky/5 p-3"
        data-status="needs_pwa_install"
        data-testid="push-notification-prompt"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky/15 text-sky">
            <Bell aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-semibold text-sky">
              Turn on notifications on iPhone
            </p>
            <p className="mt-1 text-caption text-sky/80">
              Tap the share icon in Safari, then <strong>Add to Home Screen</strong>.
              Open Thumeka from your Home Screen and you&apos;ll be able to enable
              notifications from here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { title, body } = COPY[role];

  return (
    <div
      className="rounded-lg border border-sky/30 bg-sky/5 p-3"
      data-testid="push-notification-prompt"
      data-status={status}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky/15 text-sky">
          {status === "blocked" ? (
            <BellOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Bell aria-hidden="true" className="h-4 w-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-sky">{title}</p>
          {status === "blocked" ? (
            <p className="mt-1 text-caption text-sky/80">
              You blocked notifications for Thumeka. Re-enable in your
              browser&apos;s site settings (look for a 🔒 or ⓘ in the address
              bar) to turn them back on.
            </p>
          ) : (
            <p className="mt-1 text-caption text-sky/80">{body}</p>
          )}
          {status === "error" && errorMessage ? (
            <p className="mt-1 text-caption text-red-700">{errorMessage}</p>
          ) : null}
          {status !== "blocked" ? (
            <button
              className="btn-primary mt-3 inline-flex items-center gap-2"
              data-testid="push-notification-enable-button"
              disabled={status === "working"}
              onClick={enable}
              type="button"
            >
              {status === "working" ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Enabling…
                </>
              ) : (
                <>
                  <Bell aria-hidden="true" className="h-4 w-4" />
                  Enable notifications
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * VAPID public keys are distributed as base64url; the Web Push API needs
 * them as a Uint8Array of the decoded bytes. Standard helper, lifted
 * from MDN.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

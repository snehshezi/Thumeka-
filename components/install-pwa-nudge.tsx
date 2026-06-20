"use client";

import { useEffect, useState } from "react";
import { Share, X } from "lucide-react";

const DISMISS_KEY = "thumeka.install-nudge.dismissed";

/**
 * iOS Safari install nudge. Detects:
 *   - iOS user agent
 *   - Safari (not Chrome on iOS — Chrome on iOS *is* WKWebView, but
 *     Push only works through Safari's own engine)
 *   - Not already running as a standalone PWA
 *
 * When all three are true, renders a small banner telling the user
 * how to add Thumeka to the home screen — required for Web Push on
 * iOS 16.4+. Dismiss is sticky via localStorage so we don't pester.
 *
 * Android Chrome handles install itself (beforeinstallprompt event +
 * native UI) and doesn't need our nudge. Desktop is no-op.
 */
export function InstallPwaNudge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(DISMISS_KEY) === "1") return;

    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    if (!isIos) return;

    // navigator.standalone is iOS-only — true when launched from the
    // home screen.
    const isStandalone =
      "standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Chrome on iOS rides on WebKit but uses its own UA suffix `CriOS`,
    // and crucially can't deliver Web Push. Hint them to switch to
    // Safari before installing.
    const isCriOS = /CriOS/.test(ua);
    if (isCriOS) return;

    setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // localStorage disabled (private mode); the banner just stays
      // gone for this tab.
    }
  }

  if (!visible) return null;

  return (
    <div
      className="rounded-lg border border-sunset/40 bg-sunset/10 p-3"
      data-testid="install-pwa-nudge"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunset/20 text-sunset">
          <Share aria-hidden="true" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-sunset">
            Install Thumeka for notifications
          </p>
          <p className="mt-1 text-caption text-sunset/85">
            Tap the <strong>Share</strong> icon in Safari and choose{" "}
            <strong>Add to Home Screen</strong>. Then open Thumeka from your
            home screen to receive order notifications.
          </p>
        </div>
        <button
          aria-label="Dismiss"
          className="shrink-0 rounded-full p-1 text-sunset/70 transition hover:bg-sunset/15 hover:text-sunset"
          data-testid="install-pwa-nudge-dismiss"
          onClick={dismiss}
          type="button"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

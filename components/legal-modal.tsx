"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type LegalModalTriggerProps = {
  /** Modal title — e.g. "Terms and Conditions". */
  title: string;
  /** Short subtitle under the title — e.g. "Effective 5 June 2026". */
  subtitle: string;
  /** Visual content of the trigger button (rendered link-style). */
  triggerLabel: React.ReactNode;
  /** Class applied to the trigger button. */
  triggerClassName?: string;
  /** Test id for the trigger button. */
  triggerTestId?: string;
  /**
   * Unique prefix for the modal's test ids — e.g. "terms-modal" yields
   * `terms-modal`, `terms-modal-body`, `terms-modal-close-x`,
   * `terms-modal-close-button`. Keeps multiple legal modals on the same
   * page independently addressable in tests.
   */
  modalTestId?: string;
  /** The scrollable body content rendered inside the modal. */
  children: React.ReactNode;
};

/**
 * Generic legal-document modal: trigger button + native `<dialog>` containing
 * a scrollable body. Used by [[terms-modal]] and [[privacy-modal]]. Built on
 * the native `<dialog>` element so focus trap, Escape-to-close, and
 * `::backdrop` come for free. We add click-on-backdrop-to-close (which the
 * native element doesn't do automatically) and body-scroll-lock-while-open.
 */
export function LegalModalTrigger({
  title,
  subtitle,
  triggerLabel,
  triggerClassName,
  triggerTestId,
  modalTestId = "legal-modal",
  children
}: LegalModalTriggerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `${modalTestId}-title`;

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  // The native <dialog> click target includes its own ::backdrop. If the
  // click landed directly on the dialog element (not on any descendant
  // content), treat it as a backdrop click and close.
  function handleDialogClick(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      close();
    }
  }

  // Lock body scroll while the modal is open. Native <dialog> lets the
  // background page keep scrolling otherwise. Toggle via a MutationObserver
  // on the `open` attribute since there's no native open/close event.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onOpenChange = () => {
      document.body.style.overflow = dialog.open ? "hidden" : "";
    };
    const observer = new MutationObserver(onOpenChange);
    observer.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    return () => {
      observer.disconnect();
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <button
        className={triggerClassName}
        data-testid={triggerTestId}
        onClick={open}
        type="button"
      >
        {triggerLabel}
      </button>
      <dialog
        aria-labelledby={titleId}
        className="m-auto w-full max-w-2xl rounded-lg border border-black/10 bg-white p-0 shadow-soft backdrop:bg-black/45 sm:w-[min(90vw,42rem)]"
        data-testid={modalTestId}
        onClick={handleDialogClick}
        ref={dialogRef}
      >
        <div className="flex max-h-[85vh] flex-col">
          <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-black/10 bg-white px-5 py-4">
            <div>
              <h2 className="text-h3 text-ink" id={titleId}>
                {title}
              </h2>
              <p className="text-body-sm text-black/55">{subtitle}</p>
            </div>
            <button
              aria-label="Close"
              className="rounded-md p-2 text-black/45 transition hover:bg-mist hover:text-ink"
              data-testid={`${modalTestId}-close-x`}
              onClick={close}
              type="button"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>

          <div
            className="flex-1 overflow-y-auto px-5 py-6"
            data-testid={`${modalTestId}-body`}
          >
            {children}
          </div>

          <footer className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-black/10 bg-white px-5 py-3">
            <button
              className="btn-primary"
              data-testid={`${modalTestId}-close-button`}
              onClick={close}
              type="button"
            >
              Close
            </button>
          </footer>
        </div>
      </dialog>
    </>
  );
}

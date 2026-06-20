"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

type SubmittingButtonProps = {
  children: React.ReactNode;
  /** Label shown next to the spinner while the form action is pending. */
  busyLabel?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">;

/**
 * Submit button that reads its parent `<form>`'s pending state via
 * React 19's `useFormStatus()`. Disables itself, dims, and shows a
 * spinner + busy label while a server action is in flight.
 *
 * Drop-in replacement for a plain `<button type="submit">`. Inherits
 * any className passed in so existing button styles (btn-primary etc.)
 * carry through.
 *
 * Note: `useFormStatus()` only reports the pending state of the form
 * that directly contains this button. It MUST be a descendant of the
 * `<form>` whose action you're tracking.
 */
export function SubmittingButton({
  children,
  className,
  busyLabel = "Working…",
  disabled,
  ...rest
}: SubmittingButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button
      {...rest}
      className={`${className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}
      data-pending={pending || undefined}
      disabled={pending || disabled}
      type="submit"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {busyLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

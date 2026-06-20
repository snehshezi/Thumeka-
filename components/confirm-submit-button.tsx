"use client";

import type { ReactNode } from "react";

type ConfirmSubmitButtonProps = {
  /** The browser confirm() prompt text. Submission aborts if the user cancels. */
  message: string;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
};

/**
 * A submit button that pops a browser `confirm()` before the form actually
 * submits. Use inside a `<form action={…}>` whose action is destructive
 * (Delete, etc.) so the seller has a chance to back out of a mis-tap.
 */
export function ConfirmSubmitButton({
  message,
  children,
  className,
  "data-testid": testId
}: ConfirmSubmitButtonProps) {
  return (
    <button
      className={className}
      data-testid={testId}
      onClick={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
      type="submit"
    >
      {children}
    </button>
  );
}

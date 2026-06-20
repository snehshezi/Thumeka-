"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  name: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: "current-password" | "new-password";
  className?: string;
  "data-testid"?: string;
};

export function PasswordInput({
  className = "input",
  "data-testid": testId,
  ...inputProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...inputProps}
        className={`${className} pr-10`}
        data-testid={testId}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-black/40 hover:text-leaf"
        data-testid={testId ? `${testId}-toggle` : undefined}
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        type="button"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Eye aria-hidden="true" className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

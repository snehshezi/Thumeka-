import { clsx } from "clsx";

import { titleCase } from "@/lib/format";
import { getStatusDisplay } from "@/lib/status-display";

type StatusPillProps = {
  status: string;
};

export function StatusPill({ status }: StatusPillProps) {
  const { icon: Icon, className } = getStatusDisplay(status);

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-caption font-semibold",
        className
      )}
      data-testid="status-pill"
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {titleCase(status)}
    </span>
  );
}

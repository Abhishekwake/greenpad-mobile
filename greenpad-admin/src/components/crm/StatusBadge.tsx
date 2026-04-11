"use client";

import { cn } from "@/lib/utils";
import { adminStatusLabel, statusBadgeClass } from "@/lib/lead-status";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        statusBadgeClass(status),
        className
      )}
    >
      {adminStatusLabel(status)}
    </span>
  );
}

import { cn } from "@/lib/utils";
import type { LeadSource } from "@/types/lead";

const SOURCE_CONFIG: Record<
  LeadSource,
  { label: string; className: string }
> = {
  mobile: { label: "📱 App", className: "bg-blue-50 text-blue-700 border-blue-200" },
  manual: { label: "✏ Manual", className: "bg-gray-50 text-gray-700 border-gray-200" },
  walk_in: { label: "🚶 Walk-in", className: "bg-amber-50 text-amber-800 border-amber-200" },
  referral: { label: "👥 Referral", className: "bg-green-50 text-green-700 border-green-200" },
};

export function SourceBadge({ source }: { source?: LeadSource | null }) {
  const key = source && SOURCE_CONFIG[source] ? source : "mobile";
  const cfg = SOURCE_CONFIG[key];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

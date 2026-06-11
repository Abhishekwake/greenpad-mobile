export const LEAD_STATUSES = ["pending", "contacted", "visited", "converted", "lost", "voided"] as const;

/** Shown in status dropdown (void uses separate action) */
export const LEAD_STATUS_SELECT = ["pending", "contacted", "visited", "converted", "lost"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** Legacy values still seen in API responses until DB migration runs everywhere */
const LEGACY_LOST = new Set(["not_converted", "cancelled", "rejected"]);

export function normalizeLeadStatusForUi(s: string): string {
  if (LEGACY_LOST.has(s)) return "lost";
  return s;
}

export function adminStatusLabel(s: string): string {
  const v = normalizeLeadStatusForUi(s);
  switch (v) {
    case "lost":
      return "Lost";
    case "voided":
      return "Voided";
    case "converted":
      return "Converted";
    default:
      return v.charAt(0).toUpperCase() + v.slice(1);
  }
}

export function statusBadgeClass(s: string): string {
  const v = normalizeLeadStatusForUi(s);
  switch (v) {
    case "pending":
      return "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80";
    case "contacted":
      return "bg-blue-50 text-blue-800 ring-1 ring-blue-200/80";
    case "visited":
      return "bg-violet-50 text-violet-800 ring-1 ring-violet-200/80";
    case "converted":
      return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80";
    case "lost":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/90";
    case "voided":
      return "bg-red-50 text-red-800 ring-1 ring-red-200/80 line-through decoration-red-300/60";
    default:
      return "bg-gray-50 text-gray-800 ring-1 ring-gray-200/80";
  }
}

/** Linear funnel for mock timeline seeding (excludes terminal Lost) */
export const SALES_FUNNEL: readonly Exclude<LeadStatus, "lost">[] = [
  "pending",
  "contacted",
  "visited",
  "converted",
] as const;

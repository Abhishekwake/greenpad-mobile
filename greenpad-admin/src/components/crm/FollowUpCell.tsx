import { format, startOfDay } from "date-fns";

export function FollowUpCell({ date }: { date?: string | null }) {
  if (!date) {
    return <span className="text-gray-400">—</span>;
  }

  const d = new Date(date);
  const overdue = d < startOfDay(new Date());
  const formatted = format(d, "MMM d, yyyy");

  if (overdue) {
    return (
      <span className="font-medium text-red-600">
        ⚠ {formatted}
      </span>
    );
  }

  return <span className="text-gray-700">{formatted}</span>;
}

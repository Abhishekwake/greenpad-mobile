/** Fulfillment status for reward redemption transactions (type === "redeem"). */

export function fulfillmentLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pending install";
    case "completed":
      return "Installed / delivered";
    case "cancelled":
      return "Cancelled (refunded)";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

export function fulfillmentBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-900";
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "cancelled":
      return "bg-gray-200 text-gray-700";
    case "failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

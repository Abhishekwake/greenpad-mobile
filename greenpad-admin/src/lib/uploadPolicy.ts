export type UploadMode =
  | "off"
  | "customer_optional"
  | "customer_required"
  | "team_optional"
  | "team_required";

export type UploadPolicyFields = {
  customerUploadPolicy?: "none" | "optional" | "required";
  teamUploadPolicy?: "none" | "optional" | "required";
  docRequired?: boolean;
  mediaUploadPolicy?: "none" | "optional" | "required";
};

export function taskUploadMode(task: UploadPolicyFields): UploadMode {
  const customer = task.customerUploadPolicy;
  const team = task.teamUploadPolicy;
  if (customer === "required") return "customer_required";
  if (customer === "optional") return "customer_optional";
  if (team === "required") return "team_required";
  if (team === "optional") return "team_optional";
  return "off";
}

export function applyUploadMode<T extends UploadPolicyFields>(
  task: T,
  mode: UploadMode
): T & UploadPolicyFields {
  const base = {
    ...task,
    docRequired: false,
    mediaUploadPolicy: "none" as const,
  };
  switch (mode) {
    case "customer_optional":
      return { ...base, customerUploadPolicy: "optional", teamUploadPolicy: "none" };
    case "customer_required":
      return {
        ...base,
        customerUploadPolicy: "required",
        teamUploadPolicy: "none",
        docRequired: true,
      };
    case "team_optional":
      return { ...base, customerUploadPolicy: "none", teamUploadPolicy: "optional" };
    case "team_required":
      return { ...base, customerUploadPolicy: "none", teamUploadPolicy: "required" };
    default:
      return { ...base, customerUploadPolicy: "none", teamUploadPolicy: "none" };
  }
}

export function normalizeTaskUpload<T extends UploadPolicyFields>(task: T) {
  return applyUploadMode(task, taskUploadMode(task));
}

export const UPLOAD_MODE_LABELS: Record<UploadMode, string> = {
  off: "Off — no file uploads",
  customer_optional: "Customer — optional",
  customer_required: "Customer — required to complete",
  team_optional: "Team — optional (attach in admin)",
  team_required: "Team — required to complete",
};

export function teamUploadEnabled(task: UploadPolicyFields) {
  const mode = taskUploadMode(task);
  return mode === "team_optional" || mode === "team_required";
}

export function teamUploadRequired(task: UploadPolicyFields) {
  return taskUploadMode(task) === "team_required";
}

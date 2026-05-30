export type AdminRole = "super_admin" | "ops";

export function getAdminRole(): AdminRole | null {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem("adminRole");
  if (role === "super_admin" || role === "ops") return role;
  return null;
}

export function isSuperAdmin(): boolean {
  return getAdminRole() === "super_admin";
}

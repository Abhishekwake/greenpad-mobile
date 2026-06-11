export type AdminRole = "super_admin" | "ops";

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;
    const json = atob(segment.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when localStorage token is an admin JWT (typ === "admin"). */
export function isAdminToken(token: string | null | undefined): boolean {
  if (!token) return false;
  return parseJwtPayload(token)?.typ === "admin";
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminName");
  localStorage.removeItem("adminRole");
}

export function getAdminRole(): AdminRole | null {
  if (typeof window === "undefined") return null;
  const role = localStorage.getItem("adminRole");
  if (role === "super_admin" || role === "ops") return role;
  return null;
}

export function isSuperAdmin(): boolean {
  return getAdminRole() === "super_admin";
}

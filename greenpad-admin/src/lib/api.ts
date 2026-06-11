import axios from "axios";
import { clearAdminSession } from "@/lib/adminRole";

/**
 * Central Axios client for the admin app. All server routes use paths like `/admin/...`
 * (baseURL already includes `/api`).
 *
 * Base URL: **only** `process.env.NEXT_PUBLIC_API_URL` (set in `.env.development` for `next dev`,
 * `.env.production` / host env for production — see repo `.env.example` files).
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new Error(
      "[admin] NEXT_PUBLIC_API_URL is not set. For local dev ensure `.env.development` exists; " +
        "for production set it in `.env.production` or your host (see README)."
    );
  }
  let base = raw.replace(/\/+$/, "");
  // Backend mounts routes under /api — avoid 404 "Route not found" when env omits it
  if (!base.endsWith("/api")) {
    base = `${base}/api`;
  }
  return base;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 60_000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("adminToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

function shouldForceLogin(status: number | undefined): boolean {
  if (typeof window === "undefined" || !status) return false;
  return status === 401 || status === 403;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (shouldForceLogin(error.response?.status)) {
      clearAdminSession();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

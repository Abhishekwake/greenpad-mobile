import axios from "axios";

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
  return raw.replace(/\/+$/, "");
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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminName");
      localStorage.removeItem("adminRole");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

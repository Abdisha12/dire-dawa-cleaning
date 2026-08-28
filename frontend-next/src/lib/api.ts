// lib/api.ts — Typed API client (x-session-token), mirrors frontend/js/api.js
// No `any`: strict boundaries, documented.

const getApiOrigin = (): string => {
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  if (protocol === "file:") return "http://127.0.0.1:5000";
  const isDefaultWebPort = port === "" || port === "80" || port === "443";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (isDefaultWebPort) return "";
  if (isLocalHost) return "http://127.0.0.1:5000";
  return "";
};

const BASE = typeof window !== "undefined" ? `${getApiOrigin()}/api` : "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ddcms_token");
}

export function getStoredToken(): string | null {
  return getToken();
}

type FetchOptions = {
  isFormData?: boolean;
};

async function req<T>(method: string, path: string, body?: unknown, opts: FetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "x-session-token": getToken() || "",
  };
  if (!opts.isFormData) headers["Content-Type"] = "application/json";

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = opts.isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new Error(`Unable to connect to backend (${BASE}). Check if backend is running on port 5000.`);
  }

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ddcms_token");
      localStorage.removeItem("ddcms_user");
      window.location.hash = "#login";
      // For Next.js, also redirect to /login if in app shell
      if (window.location.pathname !== "/login") {
        // soft redirect; caller can also handle 401
      }
    }
    throw new Error("Session expired — please sign in again.");
  }

  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const msg = (json as { error?: string }).error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export const api = {
  // Public
  getPublicStats: () => req<{ kebeles: number; zones: number; workers: number; businesses: number }>("GET", "/public/stats"),

  // Auth
  login: (username: string, password: string) =>
    req<{ token: string; user: import("@/types").User }>("POST", "/auth/login", { username, password }),
  logout: () => req<void>("POST", "/auth/logout"),
  me: () => req<import("@/types").User>("GET", "/auth/me"),

  // Users
  getUsers: (params: Record<string, string> = {}) =>
    req<{ users: import("@/types").User[] }>("GET", `/users?${new URLSearchParams(params).toString()}`),
  getLeaders: () => req<{ leaders: import("@/types").User[] }>("GET", "/users/leaders"),

  // Kebeles / Zones
  getKebeles: () => req<{ kebeles: import("@/types").Kebele[] }>("GET", "/kebeles"),
  getSaferZones: (params: Record<string, string> = {}) =>
    req<{ zones: import("@/types").SaferZone[] }>("GET", `/safer-zones?${new URLSearchParams(params).toString()}`),

  // Businesses / Workers / Payments / Inspections
  getBusinesses: (params: Record<string, string> = {}) =>
    req<{ businesses: import("@/types").Business[] }>("GET", `/businesses?${new URLSearchParams(params).toString()}`),
  getWorkers: (params: Record<string, string> = {}) =>
    req<{ workers: import("@/types").Worker[] }>("GET", `/workers?${new URLSearchParams(params).toString()}`),
  getPayments: (params: Record<string, string> = {}) =>
    req<{ payments: import("@/types").Payment[] }>("GET", `/payments?${new URLSearchParams(params).toString()}`),
  getInspections: (params: Record<string, string> = {}) =>
    req<{ inspections: import("@/types").Inspection[] }>("GET", `/inspections?${new URLSearchParams(params).toString()}`),

  // Notifications
  getNotifications: (params: Record<string, string> = {}) =>
    req<{ notifications: import("@/types").Notification[]; total: number }>(
      "GET",
      `/notifications?${new URLSearchParams(params).toString()}`
    ),
  getUnreadCount: () => req<{ unreadCount: number }>("GET", "/notifications/unread-count"),
};

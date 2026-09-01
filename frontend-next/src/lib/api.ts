// lib/api.ts — Central frontend API client (Phase 3 §17)
// Architecture: Component → Feature service/hook → lib/api.ts → Backend API
// No component should call fetch directly. All go through `api`.
// Mirrors frontend/js/api.js but typed, with timeout/abort and status handling.
// No `any`, strict boundaries, no secrets in source.

const getApiOrigin = (): string => {
  // Allow explicit override for Docker/prod (e.g., NEXT_PUBLIC_API_URL=http://backend:5000)
  const envUrl = typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_API_URL as string | undefined) : undefined;
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  const { protocol, hostname, port } = window.location;
  if (protocol === "file:") return "http://127.0.0.1:5000";
  const isDefaultWebPort = port === "" || port === "80" || port === "443";
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (isDefaultWebPort) return "";
  if (isLocalHost) return "http://127.0.0.1:5000";
  return "";
};

const BASE = typeof window !== "undefined" ? `${getApiOrigin()}/api` : (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : "/api");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ddcms_token");
}

export function getStoredToken(): string | null {
  return getToken();
}

// Typed API error — carries HTTP status and optional details (Zod issues etc.)
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, opts: { code?: string; details?: unknown } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = opts.code;
    this.details = opts.details;
  }
}

export type FetchOptions = {
  isFormData?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number; // default 15000
};

async function req<T>(method: string, path: string, body?: unknown, opts: FetchOptions = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // Merge external signal if provided (e.g., abort controller from caller)
  if (opts.signal) {
    opts.signal.addEventListener("abort", () => controller.abort());
  }

  const headers: Record<string, string> = {
    // Backend supports x-session-token and Authorization: Bearer (auth.js:6)
    "x-session-token": getToken() || "",
  };
  // Also send Bearer for future cookie migration compatibility
  const tok = getToken();
  if (tok) headers["Authorization"] = `Bearer ${tok}`;
  if (!opts.isFormData) headers["Content-Type"] = "application/json";

  const init: RequestInit = { method, headers, signal: controller.signal };
  if (body !== undefined) {
    init.body = opts.isFormData ? (body as BodyInit) : JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(`Request timeout after ${timeoutMs}ms (${method} ${path})`, 408, { code: "TIMEOUT" });
    }
    throw new ApiError(`Unable to connect to backend (${BASE}). Check if backend is running on port 5000.`, 0, { code: "NETWORK" });
  } finally {
    clearTimeout(timeout);
  }

  // 401 — session expired (auth.js returns 401 for missing/expired token)
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ddcms_token");
      localStorage.removeItem("ddcms_user");
      // Soft redirect for both hash and Next.js routes
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    const body = await res.json().catch(() => ({}));
    throw new ApiError((body as { error?: string }).error || "Session expired — please sign in again.", 401, { code: "UNAUTHORIZED" });
  }

  // Parse JSON (handle empty 204)
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string; details?: unknown };

  if (!res.ok) {
    const msg = (json as { error?: string }).error || `HTTP ${res.status} ${method} ${path}`;
    // Map known statuses for typed handling
    const code =
      (json as { code?: string }).code ||
      (res.status === 403 ? "FORBIDDEN" : res.status === 404 ? "NOT_FOUND" : res.status === 409 ? "CONFLICT" : res.status === 429 ? "RATE_LIMITED" : undefined);
    throw new ApiError(msg, res.status, { code, details: (json as { details?: unknown }).details ?? (json as unknown) });
  }

  return json as T;
}

// Convenience: typed helpers that enforce Component → lib/api.ts pattern
export const api = {
  // Public (no auth)
  getPublicStats: (opts?: FetchOptions) =>
    req<{ kebeles: number; zones: number; workers: number; businesses: number }>("GET", "/public/stats", undefined, opts),

  // Auth — preserve backend business logic (session uuid, 8h expiry, bcrypt, lockout 5/15m, /me zone)
  login: (username: string, password: string, opts?: FetchOptions) =>
    req<{ token: string; user: import("@/types").User }>("POST", "/auth/login", { username, password }, opts),
  logout: (opts?: FetchOptions) => req<{ message: string }>("POST", "/auth/logout", undefined, opts),
  me: (opts?: FetchOptions) => req<import("@/types").User>("GET", "/auth/me", undefined, opts),

  // Users
  getUsers: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<{ users: import("@/types").User[] }>("GET", `/users?${new URLSearchParams(params).toString()}`, undefined, opts),
  getLeaders: (opts?: FetchOptions) =>
    req<{ leaders: import("@/types").User[] }>("GET", "/users/leaders", undefined, opts),

  // Kebeles / Zones — actual DB records, not hardcoded IDs
  getKebeles: (opts?: FetchOptions) => {
    // Backend returns {kebeles: [...]} or array; normalize
    return req<{ kebeles: import("@/types").Kebele[] } | import("@/types").Kebele[]>("GET", "/kebeles", undefined, opts).then(
      (res) => (Array.isArray(res) ? { kebeles: res } : res) as { kebeles: import("@/types").Kebele[] }
    );
  },
  getSaferZones: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<{ zones: import("@/types").SaferZone[] } | import("@/types").SaferZone[]>(
      "GET",
      `/safer-zones?${new URLSearchParams(params).toString()}`,
      undefined,
      opts
    ).then((res) => (Array.isArray(res) ? { zones: res } : res) as { zones: import("@/types").SaferZone[] }),

  // Businesses — backend returns array or paginated {data,total,page,pages}
  getBusinesses: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<
      import("@/types").Business[] | { businesses: import("@/types").Business[] } | { data: import("@/types").Business[]; total: number; page: number; pages: number }
    >("GET", `/businesses?${new URLSearchParams(params).toString()}`, undefined, opts) as Promise<unknown>,
  getBusiness: (id: number, opts?: FetchOptions) =>
    req<import("@/types").Business>("GET", `/businesses/${id}`, undefined, opts),
  createBusiness: (data: Record<string, unknown>, opts?: FetchOptions) =>
    req<{ id: number }>("POST", "/businesses", data, opts),
  updateBusiness: (id: number, data: Record<string, unknown>, opts?: FetchOptions) =>
    req<{ message: string }>("PUT", `/businesses/${id}`, data, opts),
  deleteBusiness: (id: number, opts?: FetchOptions) =>
    req<{ message: string }>("DELETE", `/businesses/${id}`, undefined, opts),
  // Workers — backend returns array directly (workers.js: res.json(rows))
  getWorkers: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<import("@/types").Worker[] | { workers: import("@/types").Worker[] }>(
      "GET",
      `/workers?${new URLSearchParams(params).toString()}`,
      undefined,
      opts
    ).then((res) => (Array.isArray(res) ? res : (res as { workers: import("@/types").Worker[] }).workers)),
  getWorkerStats: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<import("@/types").Worker[]>("GET", `/workers/summary/stats?${new URLSearchParams(params).toString()}`, undefined, opts),
  createWorker: (data: Record<string, unknown>, opts?: FetchOptions) =>
    req<{ id: number }>("POST", "/workers", data, opts),
  updateWorker: (id: number, data: Record<string, unknown>, opts?: FetchOptions) =>
    req<{ message: string }>("PUT", `/workers/${id}`, data, opts),
  deleteWorker: (id: number, opts?: FetchOptions) => req<{ message: string }>("DELETE", `/workers/${id}`, undefined, opts),
  bulkAttendance: (data: { date: string; records: { workerId: number; present: boolean; bonus?: number | null }[] }, opts?: FetchOptions) =>
    req<{ message: string }>("POST", "/workers/attendance/bulk", data, opts),
  getAttendance: (workerId: number, params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<unknown[]>("GET", `/workers/${workerId}/attendance?${new URLSearchParams(params).toString()}`, undefined, opts),
  getWorkerSalary: (workerId: number, opts?: FetchOptions) =>
    req<unknown[]>("GET", `/workers/${workerId}/salary`, undefined, opts),
  paySalary: (workerId: number, data: Record<string, unknown>, opts?: FetchOptions) =>
    req<{ id: number }>("POST", `/workers/${workerId}/salary`, data, opts),
  // Payments
  getPayments: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<
      { payments: import("@/types").Payment[] } | import("@/types").Payment[] | { data: import("@/types").Payment[]; total: number; page: number; pages: number }
    >("GET", `/payments?${new URLSearchParams(params).toString()}`, undefined, opts) as Promise<unknown>,
  createPayment: (data: Record<string, unknown>, opts?: FetchOptions) =>
    req<{ id: number; receiptNumber: string; paidAt: string | null; status: string; paymentUrl: string | null; gatewayName: string | null }>(
      "POST",
      "/payments",
      data,
      opts
    ),
  updatePayment: (id: number, data: Record<string, unknown>, opts?: FetchOptions) =>
    req<{ message: string }>("PUT", `/payments/${id}`, data, opts),
  deletePayment: (id: number, opts?: FetchOptions) =>
    req<{ message: string }>("DELETE", `/payments/${id}`, undefined, opts),
  verifyPayment: (id: number, opts?: FetchOptions) =>
    req<{ status: string }>("GET", `/payments/${id}/verify`, undefined, opts),
  getDashboardSummary: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<{ totals: { total_collected: string; total_pending: string; total_overdue: string }; byKebele: unknown[]; monthly: unknown[] }>(
      "GET",
      `/payments/summary/dashboard?${new URLSearchParams(params).toString()}`,
      undefined,
      opts
    ),
  // Reports — monthly payments CSV/PDF export helper (used by legacy payments CSV button)
  getPaymentReport: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<unknown[]>("GET", `/reports/payments/monthly?${new URLSearchParams(params).toString()}`, undefined, opts),
  csvUrl: (path: string, params: Record<string, string> = {}) => {
    const base = typeof window !== "undefined" ? `${getApiOrigin()}/api` : (process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/api` : "/api");
    return `${base}${path}?${new URLSearchParams({ ...params, format: "csv" }).toString()}`;
  },
  getInspections: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<{ inspections: import("@/types").Inspection[] } | import("@/types").Inspection[]>(
      "GET",
      `/inspections?${new URLSearchParams(params).toString()}`,
      undefined,
      opts
    ).then((res) => (Array.isArray(res) ? { inspections: res } : res) as { inspections: import("@/types").Inspection[] }),

  // Notifications
  getNotifications: (params: Record<string, string> = {}, opts?: FetchOptions) =>
    req<{ notifications: import("@/types").Notification[]; total: number }>(
      "GET",
      `/notifications?${new URLSearchParams(params).toString()}`,
      undefined,
      opts
    ),
  getUnreadCount: (opts?: FetchOptions) => req<{ unreadCount: number }>("GET", "/notifications/unread-count", undefined, opts),
};

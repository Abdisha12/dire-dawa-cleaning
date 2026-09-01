// features/businesses/services/businesses-api.ts
// Feature-specific API service layer — uses lib/api.ts, no direct fetch

import { api, FetchOptions } from "@/lib/api";
import type { Business } from "@/types";

export type BusinessPaginated = { data: Business[]; total: number; page: number; pages: number };

function normalizeBusinessRows(rows: Business[]): Business[] {
  return rows;
}

export const businessesApi = {
  // Businesses — supports paginated {data,total,page,pages} or legacy array
  getAll: async (params?: Record<string, string>, opts?: FetchOptions): Promise<Business[] | BusinessPaginated> => {
    const res = (await api.getBusinesses(params, opts)) as unknown;
    if (Array.isArray(res)) return res as Business[];
    if (res && typeof res === "object" && "data" in (res as Record<string, unknown>)) return res as BusinessPaginated;
    if (res && typeof res === "object" && "businesses" in (res as Record<string, unknown>)) {
      return ((res as { businesses: Business[] }).businesses) as Business[];
    }
    return [] as Business[];
  },

  getById: (id: number, opts?: FetchOptions) => api.getBusiness(id, opts),

  create: (data: Record<string, unknown>, opts?: FetchOptions) => api.createBusiness(data, opts),

  update: (id: number, data: Record<string, unknown>, opts?: FetchOptions) => api.updateBusiness(id, data, opts),

  delete: (id: number, opts?: FetchOptions) => api.deleteBusiness(id, opts),

  // Zones / Kebeles — reuse workers pattern
  getZones: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getSaferZones(params, opts).then((r) => r.zones),

  getKebeles: (opts?: FetchOptions) => api.getKebeles(opts).then((r) => r.kebeles),
};

// Re-export helpers for monetary display (reuse workers-api but keep local for independence)
export function addETB(...amounts: (number | null | undefined)[]): number {
  return amounts.reduce((sum: number, val) => {
    const num = typeof val === "string" ? parseFloat(val as unknown as string) : (val ?? 0);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}
export { normalizeBusinessRows };

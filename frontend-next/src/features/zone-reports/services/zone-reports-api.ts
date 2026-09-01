// features/zone-reports/services/zone-reports-api.ts
import { api, FetchOptions } from "@/lib/api";

export const zoneReportsApi = {
  getAll: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getZoneReports(params, opts),
  getById: (id: number, opts?: FetchOptions) =>
    api.getZoneReport(id, opts),
  create: (data: Record<string, unknown>, opts?: FetchOptions) =>
    api.createZoneReport(data, opts),
  update: (id: number, data: Record<string, unknown>, opts?: FetchOptions) =>
    api.updateZoneReport(id, data, opts),
  review: (id: number, data: Record<string, unknown>, opts?: FetchOptions) =>
    api.reviewZoneReport(id, data, opts),
  delete: (id: number, opts?: FetchOptions) =>
    api.deleteZoneReport(id, opts),
  getZones: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getSaferZones(params, opts).then((r) => r.zones),
};

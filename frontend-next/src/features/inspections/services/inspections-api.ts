// features/inspections/services/inspections-api.ts
import { api, FetchOptions } from "@/lib/api";

export const inspectionsApi = {
  getAll: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getInspections(params, opts),
  getById: (id: number, opts?: FetchOptions) =>
    api.getInspection(id, opts),
  create: (data: FormData, opts?: FetchOptions) =>
    api.createInspection(data, opts),
  update: (id: number, data: FormData, opts?: FetchOptions) =>
    api.updateInspection(id, data, opts),
  delete: (id: number, opts?: FetchOptions) =>
    api.deleteInspection(id, opts),
  deletePhoto: (photoId: number, opts?: FetchOptions) =>
    api.deleteInspectionPhoto(photoId, opts),
  getZones: (params?: Record<string, string>, opts?: FetchOptions) =>
    api.getSaferZones(params, opts).then((r) => r.zones),
  getKebeles: (opts?: FetchOptions) =>
    api.getKebeles(opts).then((r) => r.kebeles),
};

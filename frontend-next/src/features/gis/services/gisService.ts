import { api } from "@/lib/api";

/** Minimal typed FeatureCollection as returned by our /gis/* endpoints. */
export interface GeoResponse {
  type: "FeatureCollection";
  features: GeoJSON.Feature[];
  total?: number;
  page?: number;
  pages?: number;
}

export interface GisLayerStatus {
  loading: boolean;
  error: string | null;
  data: GeoJSON.FeatureCollection | null;
}

/** Fetch kebele boundaries with optional kebeleId filter (for non-admin). */
export async function fetchKebelesGeoJSON(params?: Record<string, string>): Promise<GeoResponse> {
  return api.getKebelesGeoJSON(params) as Promise<GeoResponse>;
}

/** Fetch safer-zone boundaries. */
export async function fetchSaferZonesGeoJSON(params?: Record<string, string>): Promise<GeoResponse> {
  return api.getSaferZonesGeoJSON(params) as Promise<GeoResponse>;
}

/** Fetch business points with optional scoping. */
export async function fetchBusinessesGeoJSON(params?: Record<string, string>): Promise<GeoResponse> {
  return api.getBusinessesGeoJSON(params) as Promise<GeoResponse>;
}

/** Fetch worker points. */
export async function fetchWorkersGeoJSON(params?: Record<string, string>): Promise<GeoResponse> {
  return api.getWorkersGeoJSON(params) as Promise<GeoResponse>;
}

/** Fetch inspection points. */
export async function fetchInspectionsGeoJSON(params?: Record<string, string>): Promise<GeoResponse> {
  return api.getInspectionsGeoJSON(params) as Promise<GeoResponse>;
}
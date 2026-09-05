"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import CityMap from "@/features/gis/components/CityMap";
import { MapListAlternative } from "@/features/gis/components/MapStates";
import {
  fetchKebelesGeoJSON,
  fetchSaferZonesGeoJSON,
  fetchBusinessesGeoJSON,
  fetchWorkersGeoJSON,
  fetchInspectionsGeoJSON,
  type GisLayerStatus,
} from "@/features/gis/services/gisService";

interface LayerToggle {
  id: string;
  label: string;
  color: string;
  enabled: boolean;
}

export default function GisMapPage() {
  const { user } = useAuth();
  const [view, setView] = useState<"map" | "list">("map");
  const [selectedFeature, setSelectedFeature] = useState<GeoJSON.Feature | null>(null);
  const [search, setSearch] = useState("");
  const [kebeles, setKebeles] = useState<GisLayerStatus>({ loading: true, error: null, data: null });
  const [zones, setZones] = useState<GisLayerStatus>({ loading: true, error: null, data: null });
  const [businesses, setBiz] = useState<GisLayerStatus>({ loading: false, error: null, data: null });
  const [workers, setWorkers] = useState<GisLayerStatus>({ loading: false, error: null, data: null });
  const [inspections, setInspections] = useState<GisLayerStatus>({ loading: false, error: null, data: null });

  const [layerToggles, setLayerToggles] = useState<LayerToggle[]>([
    { id: "kebeles", label: "Kebeles", color: "#3b82f644", enabled: true },
    { id: "zones", label: "Safer Zones", color: "#6366f144", enabled: true },
    { id: "businesses", label: "Businesses", color: "#10b981", enabled: false },
    { id: "workers", label: "Workers", color: "#f59e0b", enabled: false },
    { id: "inspections", label: "Inspections", color: "#ef4444", enabled: false },
  ]);

  useEffect(() => {
    const params = search ? { search } : undefined;
    const load = async () => {
      setKebeles((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetchKebelesGeoJSON(params);
        setKebeles({ loading: false, error: null, data: res as unknown as GeoJSON.FeatureCollection });
      } catch (e) {
        setKebeles({ loading: false, error: (e as Error).message, data: null });
      }
      setZones((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await fetchSaferZonesGeoJSON(params);
        setZones({ loading: false, error: null, data: res as unknown as GeoJSON.FeatureCollection });
      } catch (e) {
        setZones({ loading: false, error: (e as Error).message, data: null });
      }
    };
    load();
  }, [search]);

  const handleLoadLayer = useCallback(async (id: string) => {
    switch (id) {
      case "businesses": {
        setBiz((s) => ({ ...s, loading: true, error: null }));
        try {
          const res = await fetchBusinessesGeoJSON();
          setBiz({ loading: false, error: null, data: res as unknown as GeoJSON.FeatureCollection });
        } catch (e) {
          setBiz({ loading: false, error: (e as Error).message, data: null });
        }
        break;
      }
      case "workers": {
        setWorkers((s) => ({ ...s, loading: true, error: null }));
        try {
          const res = await fetchWorkersGeoJSON();
          setWorkers({ loading: false, error: null, data: res as unknown as GeoJSON.FeatureCollection });
        } catch (e) {
          setWorkers({ loading: false, error: (e as Error).message, data: null });
        }
        break;
      }
      case "inspections": {
        setInspections((s) => ({ ...s, loading: true, error: null }));
        try {
          const res = await fetchInspectionsGeoJSON();
          setInspections({ loading: false, error: null, data: res as unknown as GeoJSON.FeatureCollection });
        } catch (e) {
          setInspections({ loading: false, error: (e as Error).message, data: null });
        }
        break;
      }
    }
  }, []);

  const toggleLayer = useCallback(
    (id: string) => {
      setLayerToggles((prev) => prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)));
      const layer = layerToggles.find((l) => l.id === id);
      if (layer && !layer.enabled) handleLoadLayer(id);
    },
    [layerToggles, handleLoadLayer],
  );

  const layerConfigs = useMemo(() => {
    const configs = [];
    for (const lt of layerToggles) {
      let sourceData: GeoJSON.FeatureCollection | null = null;
      let type: "fill" | "line" | "circle" | "symbol" = "circle";
      let paint: Record<string, unknown> = {};

      if (lt.id === "kebeles") {
        sourceData = kebeles?.data || null;
        type = "fill";
        paint = { "fill-color": "#3b82f6", "fill-opacity": 0.15, "fill-outline-color": "#2563eb" };
      } else if (lt.id === "zones") {
        sourceData = zones?.data || null;
        type = "line";
        paint = { "line-color": "#6366f1", "line-width": 1.5, "line-opacity": 0.7 };
      } else if (lt.id === "businesses") {
        sourceData = businesses?.data || null;
        type = "circle";
        paint = { "circle-color": "#10b981", "circle-radius": 5, "circle-opacity": 0.8, "circle-stroke-width": 1, "circle-stroke-color": "#059669" };
      } else if (lt.id === "workers") {
        sourceData = workers?.data || null;
        type = "circle";
        paint = { "circle-color": "#f59e0b", "circle-radius": 4, "circle-opacity": 0.7, "circle-stroke-width": 1, "circle-stroke-color": "#d97706" };
      } else if (lt.id === "inspections") {
        sourceData = inspections?.data || null;
        type = "circle";
        paint = { "circle-color": "#ef4444", "circle-radius": 5, "circle-opacity": 0.8, "circle-stroke-width": 1, "circle-stroke-color": "#dc2626" };
      }

      configs.push({
        id: lt.id,
        label: lt.label,
        visible: lt.enabled,
        color: lt.color,
        sourceId: lt.id,
        sourceData: sourceData ?? undefined,
        type,
        paint,
      });
    }
    return configs;
  }, [layerToggles, kebeles?.data, zones?.data, businesses?.data, workers?.data, inspections?.data]);

  const allFeatures = useMemo(() => {
    const sources = layerConfigs.filter((l) => l.sourceData).map((l) => l.sourceData!);
    const combined: GeoJSON.Feature[] = [];
    for (const fc of sources) {
      combined.push(...(fc.features || []));
    }
    return { type: "FeatureCollection", features: combined } as GeoJSON.FeatureCollection;
  }, [layerConfigs]);

  const popupContent = selectedFeature ? (
    <div className="p-2 max-w-[240px] text-sm space-y-1">
      {(() => {
        const p = selectedFeature.properties ?? {};
        const name = p.name || p.fullName || p.code || `#${p.id}`;
        return (
          <>
            <p className="font-semibold">{name}</p>
            {p.kebeleName && <p className="text-xs text-muted-foreground">Kebele: {p.kebeleName}</p>}
            {p.saferZoneName && <p className="text-xs text-muted-foreground">Zone: {p.saferZoneName}</p>}
            {p.date && <p className="text-xs">Date: {p.date}</p>}
            {p.status && <p className="text-xs">Status: {p.status}</p>}
            {p.type && <p className="text-xs">Type: {p.type}</p>}
            {p.locationUnavailable && <p className="text-xs italic text-muted-foreground">Location unavailable</p>}
          </>
        );
      })()}
    </div>
  ) : null;

  const listItems = useMemo(() => {
    const items: Array<{ id: number; name?: string; fullName?: string; entityType: string }> = [];
    for (const fc of [kebeles?.data, zones?.data, businesses?.data, workers?.data, inspections?.data]) {
      if (!fc) continue;
      for (const f of fc.features || []) {
        const p = f.properties ?? {};
        items.push({ id: p.id, name: p.name, fullName: p.fullName, entityType: p.entityType ?? "entity" });
      }
    }
    return items;
  }, [kebeles?.data, zones?.data, businesses?.data, workers?.data, inspections?.data]);

  const loading = kebeles.loading || zones.loading;

  return (
    <div className="flex flex-col h-[calc(100vh-var(--navbar-height,64px))]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b gap-4">
        <h1 className="text-lg font-semibold">GIS Map</h1>
        <div className="flex items-center gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-40 rounded-md border px-2 text-sm"
            aria-label="Search locations"
          />
          {/* View toggle */}
          <div className="flex border rounded-md text-sm" role="tablist" aria-label="Map or list view">
            <button
              role="tab"
              aria-selected={view === "map"}
              onClick={() => setView("map")}
              className={`px-3 py-1 rounded-l-md ${view === "map" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              Map
            </button>
            <button
              role="tab"
              aria-selected={view === "list"}
              onClick={() => setView("list")}
              className={`px-3 py-1 rounded-r-md ${view === "list" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Layer toggles */}
      <div className="flex flex-wrap gap-2 px-4 py-2 border-b" role="group" aria-label="Visible layers">
        {layerToggles.map((lt) => (
          <label key={lt.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={lt.enabled}
              onChange={() => toggleLayer(lt.id)}
              className="accent-primary"
            />
            <span style={{ color: lt.color }}>●</span>
            {lt.label}
          </label>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 relative">
        {view === "map" ? (
          <>
            <CityMap
              features={allFeatures}
              loading={loading}
              error={kebeles.error || zones.error}
              onFeatureClick={(f) => setSelectedFeature(f)}
              layers={layerConfigs}
              selectedFeature={selectedFeature}
            />
            {/* Popup */}
            {selectedFeature && popupContent && (
              <div className="absolute bottom-4 left-4 bg-background border rounded-lg shadow-lg z-10">
                {popupContent}
                <button
                  onClick={() => setSelectedFeature(null)}
                  className="absolute top-1 right-1 text-xs text-muted-foreground hover:text-foreground p-1"
                  aria-label="Close popup"
                >
                  ✕
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-4">
            <p className="text-sm text-muted-foreground mb-2">
              {listItems.length} {listItems.length === 1 ? "entity" : "entities"} found
            </p>
            <MapListAlternative
              items={listItems}
              onSelect={(item) => {
                // Find the feature and set it
                setView("map");
              }}
              entityType="entity"
            />
          </div>
        )}
      </div>
    </div>
  );
}
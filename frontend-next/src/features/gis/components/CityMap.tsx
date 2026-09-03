// frontend-next/features/gis/components/CityMap.tsx
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapLoadingState, MapEmptyState, MapErrorState } from "./MapStates";

interface LayerConfig {
  id: string;
  label: string;
  visible: boolean;
  color: string;
  sourceId: string;
  sourceData?: GeoJSON.FeatureCollection;
  type: "fill" | "line" | "circle" | "symbol";
  paint: Record<string, unknown>;
}

interface CityMapProps {
  features: GeoJSON.FeatureCollection | null;
  loading: boolean;
  error: string | null;
  onFeatureClick?: (feature: GeoJSON.Feature) => void;
  layers: LayerConfig[];
  interactive?: boolean;
  /** Optional selected/clicked layer. When set, updates center/zoom. */
  selectedFeature?: GeoJSON.Feature | null;
  onSearch?: (query: string) => void;
  onLayerToggle?: (layerId: string, visible: boolean) => void;
  showLayerControl?: boolean;
  containerClassName?: string;
}

export default function CityMap({
  features,
  loading,
  error,
  onFeatureClick,
  layers: layerConfigs,
  interactive = true,
  selectedFeature,
  containerClassName,
}: CityMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize the map once
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: [41.3, 9.6], // Dire Dawa approximate center
      zoom: 11,
    });

    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.on("load", () => setMapLoaded(true));
    map.current = m;

    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // When feature data is ready and map is loaded, add/update sources and layers
  useEffect(() => {
    if (!mapLoaded || !map.current) return;

    for (const lc of layerConfigs) {
      const srcId = lc.sourceId;
      const srcData = lc.sourceData || features;

      // Remove existing source + layers to replace with fresh data
      if (map.current.getSource(srcId)) {
        map.current.removeLayer(`${srcId}-layer`);
        map.current.removeSource(srcId);
      }
      if (srcData && srcData.features.length > 0) {
        map.current.addSource(srcId, { type: "geojson", data: srcData });
        type AddLayerParam = Parameters<maplibregl.Map["addLayer"]>[0];
        const layerDef = {
          id: `${srcId}-layer`,
          source: srcId,
          type: lc.type === "fill" ? "fill" : lc.type === "line" ? "line" : "circle",
          paint: lc.paint,
          layout: { visibility: lc.visible ? "visible" : "none" },
        } as unknown as AddLayerParam;
        map.current.addLayer(layerDef);

        if (interactive && onFeatureClick) {
          map.current.on("click", `${srcId}-layer`, (e: maplibregl.MapLayerMouseEvent) => {
            const feature = e.features?.[0];
            if (feature) onFeatureClick(feature as unknown as GeoJSON.Feature);
          });
        }
      }
    }

    return () => {
      if (!map.current) return;
      for (const lc of layerConfigs) {
        if (map.current.getSource(lc.sourceId)) {
          try {
            map.current.removeLayer(`${lc.sourceId}-layer`);
            map.current.removeSource(lc.sourceId);
          } catch { /* already removed */ }
        }
      }
    };
  }, [mapLoaded, features, layerConfigs, interactive, onFeatureClick]);

  // Zoom to selected feature
  useEffect(() => {
    if (!map.current || !selectedFeature?.geometry) return;
    const coords =
      selectedFeature.geometry.type === "Point"
        ? (selectedFeature.geometry as GeoJSON.Point).coordinates
        : null;
    if (coords) {
      map.current.flyTo({ center: coords as [number, number], zoom: 14 });
    }
  }, [selectedFeature]);

  if (error) return <MapErrorState message={error} />;
  if (loading) return <MapLoadingState />;
  if (!features || features.features.length === 0) return <MapEmptyState />;

  return (
    <div className={containerClassName ?? "relative h-full w-full min-h-[400px]"}>
      <div ref={mapContainer} className="h-full w-full rounded-lg border" />
    </div>
  );
}
"use client";

import dynamic from "next/dynamic";

const GisMapPage = dynamic(
  () => import("@/features/gis/components/GisMapPage"),
  { ssr: false, loading: () => <p className="p-4 text-sm text-muted-foreground">Loading map…</p> },
);

export default function MapPage() {
  return <GisMapPage />;
}

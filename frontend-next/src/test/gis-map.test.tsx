import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MapLoadingState,
  MapErrorState,
  MapEmptyState,
  MapListAlternative,
} from "@/features/gis/components/MapStates";

vi.mock("@/lib/api", () => ({
  api: {
    getKebelesGeoJSON: vi.fn().mockResolvedValue({ type: "FeatureCollection", features: [] }),
  },
}));

import { fetchKebelesGeoJSON } from "@/features/gis/services/gisService";
import { api } from "@/lib/api";

describe("GIS map states + list alternative", () => {
  it("shows loading, error, and empty states", async () => {
    const { unmount } = render(<MapLoadingState />);
    expect(screen.getByText("Loading map data…")).toBeInTheDocument();
    unmount();

    render(<MapErrorState message="boom" />);
    expect(screen.getByText("Map error")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("shows empty state when no geometry", () => {
    render(<MapEmptyState />);
    expect(screen.getByText("No geographic data available for your scope.")).toBeInTheDocument();
  });

  it("list alternative selects an entity without requiring the visual map", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <MapListAlternative
        items={[
          { id: 1, name: "Kebele 01" },
          { id: 2, name: "Kebele 02" },
        ]}
        onSelect={onSelect}
        entityType="kebele"
      />,
    );
    await user.click(screen.getByText("Kebele 02"));
    expect(onSelect).toHaveBeenCalledWith({ id: 2, name: "Kebele 02" });
  });

  it("gis service calls the backend GeoJSON endpoint", async () => {
    await fetchKebelesGeoJSON({ search: "K01" });
    expect(api.getKebelesGeoJSON).toHaveBeenCalledWith({ search: "K01" });
  });
});

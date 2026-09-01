// test/inspections-zone-responsive.test.tsx — Phase 6 validation + responsive
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InspectionFormModal } from "@/features/inspections/components/inspection-dialogs";
import { ZoneReportFormModal } from "@/features/zone-reports/components/zone-report-dialogs";
import { InspectionCard } from "@/features/inspections/components/inspection-card";
import { ZoneReportCard } from "@/features/zone-reports/components/zone-report-card";
import { renderWithQuery, inspectionFixture, zoneReportFixture, zoneFixture } from "./helpers";
import { ToasterProvider } from "@/components/ui/toast";
import type { User } from "@/types";

const apiStore = vi.hoisted(() => ({
  api: {
    getSaferZones: vi.fn(),
    getKebeles: vi.fn(),
    getInspections: vi.fn(),
    createInspection: vi.fn(),
    updateInspection: vi.fn(),
    getZoneReports: vi.fn(),
    createZoneReport: vi.fn(),
    updateZoneReport: vi.fn(),
  },
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError, api: apiStore.api };
});
vi.mock("@/lib/auth-context", () => {
  const useAuth = () => ({
    user: null as User | null,
    loading: false,
    error: null,
    login: async () => {},
    logout: async () => {},
    refresh: async () => {},
  });
  return { useAuth, AuthProvider: ({ children }: { children: React.ReactNode }) => children };
});

const inspection = inspectionFixture({ id: 1 });
const report = zoneReportFixture({ id: 1 });

describe("Inspection form validation (real component)", () => {
  it("requires kebele and date", async () => {
    apiStore.api.createInspection = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <ToasterProvider>
        <InspectionFormModal inspection={null} kebeles={[{ id: 5, name: "K05", code: "K05", collector_id: null, created_at: "", updated_at: "" }]} zones={[zoneFixture]} onClose={() => {}} onSaved={onSaved} />
      </ToasterProvider>
    );
    // Try save without kebele
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(screen.getByText(/kebele is required/i)).toBeInTheDocument());
    expect(apiStore.api.createInspection).not.toHaveBeenCalled();
  });

  it("creates inspection with valid data", async () => {
    apiStore.api.createInspection = vi.fn().mockResolvedValue({ id: 99 });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <ToasterProvider>
        <InspectionFormModal inspection={null} kebeles={[{ id: 5, name: "K05", code: "K05", collector_id: null, created_at: "", updated_at: "" }]} zones={[zoneFixture]} onClose={() => {}} onSaved={onSaved} />
      </ToasterProvider>
    );
    await user.selectOptions(screen.getByLabelText(/kebele/i), "5");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(apiStore.api.createInspection).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("Zone report form validation (real component)", () => {
  it("requires zone and date", async () => {
    apiStore.api.createZoneReport = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <ToasterProvider>
        <ZoneReportFormModal report={null} zones={[zoneFixture]} onClose={() => {}} onSaved={() => {}} />
      </ToasterProvider>
    );
    // Clear date to trigger required
    const dateInput = screen.getByLabelText(/report date \*/i);
    await user.clear(dateInput);
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(apiStore.api.createZoneReport).not.toHaveBeenCalled();
  });

  it("creates report with valid data", async () => {
    apiStore.api.createZoneReport = vi.fn().mockResolvedValue({ id: 10, status: "draft" });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <ToasterProvider>
        <ZoneReportFormModal report={null} zones={[zoneFixture]} onClose={() => {}} onSaved={onSaved} />
      </ToasterProvider>
    );
    await user.selectOptions(screen.getByLabelText(/zone \*/i), String(zoneFixture.id));
    // date is prefilled, just save
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(apiStore.api.createZoneReport).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("Responsive — inspection & zone report cards", () => {
  it("renders inspection card with 44px actions", () => {
    render(<InspectionCard inspection={inspection} canEdit isAdmin onEdit={() => {}} onDelete={() => {}} onViewPhotos={() => {}} />);
    expect(screen.getByText(/K05/)).toBeInTheDocument();
    const edit = screen.getByRole("button", { name: /edit inspection 1/i });
    expect(edit.className).toMatch(/min-h-\[44px\]/);
  });
  it("renders zone report card with workflow buttons", () => {
    render(<ZoneReportCard report={report} isLeader canReview={false} onView={() => {}} onEdit={() => {}} onSubmit={() => {}} onReview={() => {}} onApprove={() => {}} />);
    expect(screen.getByText("Zone 10")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
  });
  it("zone report card shows status text not just color", () => {
    render(<ZoneReportCard report={zoneReportFixture({ status: "submitted" })} isLeader={false} canReview onView={() => {}} onEdit={() => {}} onSubmit={() => {}} onReview={() => {}} onApprove={() => {}} />);
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });
});

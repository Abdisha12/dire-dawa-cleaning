// test/complaints.test.tsx — Complaints page (P1-2)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const apiStore = vi.hoisted(() => ({
  api: {
    me: vi.fn(),
    getSaferZones: vi.fn(),
    getComplaints: vi.fn(),
    getComplaintSummary: vi.fn(),
    createComplaint: vi.fn(),
    updateComplaintStatus: vi.fn(),
    deleteComplaint: vi.fn(),
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

import { AuthProvider } from "@/lib/auth-context";
import { ToasterProvider } from "@/components/ui/toast";
import ComplaintsPage from "@/app/(app)/community/complaints/page";
import type { User, Complaint } from "@/types";

function makeUser(role: User["role"] = "admin"): User {
  return {
    id: 1,
    username: "test",
    full_name: "Test User",
    fayda_id: null,
    phone: null,
    role,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function renderPage(
  user = makeUser(),
  opts: {
    complaints?: Complaint[];
    summary?: { total: number; new: number; in_progress: number; resolved: number };
    zones?: { id: number; name: string }[];
  } = {}
) {
  localStorage.setItem("ddcms_token", "tok");
  localStorage.setItem("ddcms_user", JSON.stringify(user));
  apiStore.api.me.mockResolvedValue(user);
  apiStore.api.getSaferZones.mockResolvedValue({ zones: opts.zones ?? [] });
  apiStore.api.getComplaints.mockResolvedValue(
    opts.complaints
      ? { data: opts.complaints, total: opts.complaints.length, page: 1, pages: 1 }
      : { data: [], total: 0, page: 1, pages: 1 }
  );
  apiStore.api.getComplaintSummary.mockResolvedValue(
    opts.summary ?? { total: 0, new: 0, in_progress: 0, resolved: 0 }
  );
  return render(
    <ToasterProvider>
      <AuthProvider>
        <ComplaintsPage />
      </AuthProvider>
    </ToasterProvider>
  );
}

describe("ComplaintsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page heading", async () => {
    renderPage();
    expect(await screen.findByText("Community Complaints")).toBeInTheDocument();
  });

  it("displays summary stat card counts", async () => {
    renderPage(makeUser(), {
      summary: { total: 12, new: 5, in_progress: 3, resolved: 4 },
    });
    await waitFor(() => {
      expect(screen.getByText("Total")).toBeInTheDocument();
      // "Resolved" also appears as a filter option, so use getAllByText
      expect(screen.getAllByText("Resolved").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("shows empty state when no complaints", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No complaints")).toBeInTheDocument();
    });
  });

  it("renders complaint titles in the mobile card list", async () => {
    renderPage(makeUser(), {
      complaints: [
        { id: 1, title: "Illegal dump near market", category: "illegal_dumping", status: "new", zone_name: "Zone A", created_at: "2026-09-01T10:00:00Z", description: "test", safer_zone_id: 1, reporter_name: null, reporter_phone: null, assigned_to: null, assigned_name: null, resolution_notes: null, resolved_by: null, resolved_name: null, resolved_at: null, created_by: null, created_by_name: null, updated_at: "" },
        { id: 2, title: "Blocked drain on Road 5", category: "blocked_drain", status: "in_progress", zone_name: "Zone B", created_at: "2026-09-02T10:00:00Z", description: "test2", safer_zone_id: 2, reporter_name: null, reporter_phone: null, assigned_to: null, assigned_name: null, resolution_notes: null, resolved_by: null, resolved_name: null, resolved_at: null, created_by: null, created_by_name: null, updated_at: "" },
      ],
    });
    await waitFor(() => {
      expect(screen.getAllByText("Illegal dump near market").length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText("Blocked drain on Road 5").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows New Complaint button for admin and opens the create modal", async () => {
    renderPage(makeUser(), { zones: [{ id: 1, name: "Zone A" }] });
    await waitFor(() => {
      expect(screen.getByText("New Complaint")).toBeInTheDocument();
    });
    screen.getByText("New Complaint").click();
    await waitFor(() => {
      expect(screen.getByText("File a complaint")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it("calls api.createComplaint on valid form submit", async () => {
    apiStore.api.createComplaint.mockResolvedValue({ id: 1, status: "new" });
    renderPage(makeUser(), { zones: [{ id: 1, name: "Zone A" }] });
    await waitFor(() => { expect(screen.getByText("New Complaint")).toBeInTheDocument(); });
    screen.getByText("New Complaint").click();
    await waitFor(() => { expect(screen.getByText("File a complaint")).toBeInTheDocument(); });

    const nativeInputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const titleInput = screen.getByLabelText(/title/i);
    nativeInputSetter.call(titleInput, "Test title");
    titleInput.dispatchEvent(new Event("input", { bubbles: true }));

    const descArea = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(descArea, "Detailed description of the problem");
    descArea.dispatchEvent(new Event("input", { bubbles: true }));

    const zoneSelect = screen.getByLabelText(/zone/i);
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(zoneSelect, "1");
    zoneSelect.dispatchEvent(new Event("change", { bubbles: true }));

    screen.getByRole("button", { name: /^create$/i }).click();
    await waitFor(() => {
      expect(apiStore.api.createComplaint).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Test title", description: "Detailed description of the problem", saferZoneId: 1 })
      );
    });
  });

  it("viewer role does not see the New Complaint button", async () => {
    renderPage(makeUser("viewer"));
    await waitFor(() => {
      expect(screen.getByText("Community Complaints")).toBeInTheDocument();
    });
    expect(screen.queryByText("New Complaint")).not.toBeInTheDocument();
  });

  it("non-admin viewer does not see the delete action", async () => {
    renderPage(makeUser("leader"), {
      complaints: [
        { id: 1, title: "Leader Complaint", category: "litter", status: "resolved", zone_name: "Zone A", created_at: "2026-09-01T00:00:00Z", description: "d", safer_zone_id: 1, reporter_name: null, reporter_phone: null, assigned_to: null, assigned_name: null, resolution_notes: null, resolved_by: null, resolved_name: null, resolved_at: null, created_by: null, created_by_name: null, updated_at: "" },
      ],
    });
    await waitFor(() => {
      expect(screen.getAllByText("Leader Complaint").length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.queryByLabelText(/delete leader complaint/i)).not.toBeInTheDocument();
  });
});
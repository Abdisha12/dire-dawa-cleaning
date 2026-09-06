// test/dashboard.test.tsx — Dashboard KPIs (P1-1) + Operational Overview
// Renders the real AuthProvider + KebeleProvider + DashboardPage with a mocked
// network layer (@/lib/api), so KPIs and the overview exercise the real data path.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

const apiStore = vi.hoisted(() => ({
  api: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    getKebeles: vi.fn(),
    getSaferZones: vi.fn(),
    getWorkers: vi.fn(),
    getBusinesses: vi.fn(),
    getDashboardOverview: vi.fn(),
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
import { KebeleProvider } from "@/lib/kebele-context";
import DashboardPage from "@/app/(app)/dashboard/page";
import type { DashboardOverview } from "@/lib/api";
import type { User } from "@/types";

type KebeleRecord = { id: number; name: string; code: string; collector_id: number | null };

function kebeleRecords(n: number): KebeleRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Kebele ${String(i + 1).padStart(2, "0")}`,
    code: `K${String(i + 1).padStart(2, "0")}`,
    collector_id: null,
  }));
}

function makeUser(role: User["role"], id: number, zone?: User["zone"]): User {
  return {
    id,
    username: `u${id}`,
    full_name: "Test User",
    fayda_id: null,
    phone: null,
    role,
    is_active: true,
    created_at: "",
    updated_at: "",
    ...(zone ? { zone } : {}),
  };
}

function emptyOverview(role = "admin"): DashboardOverview {
  return {
    revenue: { totalCollected: "0", totalPending: "0", totalOverdue: "0", target: null, achievementPct: null, monthly: [] },
    attendance: { totalRecords: 0, presentCount: 0, absentCount: 0, attendanceRate: null },
    inspections: { total: 0, active: 0, warning: 0, danger: 0 },
    kebeles: [],
    scope: { role },
  };
}

function overviewRows(n: number): DashboardOverview["kebeles"] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    code: `K${String(i + 1).padStart(2, "0")}`,
    name: `Kebele ${String(i + 1).padStart(2, "0")}`,
    zones: 12,
    workerCount: 10 + i,
    businessCount: 20 + i,
    target: String(5000 * (i + 1)),
    collected: String(1000 * (i + 1)),
    achievementPct: 20,
    attendanceRate: 80 + i,
    inspectionTotal: 5 + i,
    activeInspections: 3,
    warningInspections: 1,
    dangerInspections: 1,
  }));
}

function renderDashboard(
  user: User,
  opts: {
    kebeles?: KebeleRecord[];
    getKebelesImpl?: () => Promise<unknown>;
    overview?: DashboardOverview;
    overviewImpl?: () => Promise<DashboardOverview>;
  } = {}
) {
  localStorage.setItem("ddcms_token", "tok");
  localStorage.setItem("ddcms_user", JSON.stringify(user));
  apiStore.api.me.mockResolvedValue(user);
  apiStore.api.getSaferZones.mockResolvedValue({ zones: [] });
  apiStore.api.getWorkers.mockResolvedValue([]);
  apiStore.api.getBusinesses.mockResolvedValue({ data: [] });
  if (opts.getKebelesImpl) apiStore.api.getKebeles.mockImplementation(opts.getKebelesImpl);
  else apiStore.api.getKebeles.mockResolvedValue({ kebeles: opts.kebeles ?? [] });
  if (opts.overviewImpl) apiStore.api.getDashboardOverview.mockImplementation(opts.overviewImpl);
  else apiStore.api.getDashboardOverview.mockResolvedValue(opts.overview ?? emptyOverview());
  return render(
    <AuthProvider>
      <KebeleProvider>
        <DashboardPage />
      </KebeleProvider>
    </AuthProvider>
  );
}

function kebelesCard() {
  return screen.getByText("Kebeles", { exact: true }).parentElement as HTMLElement;
}

describe("Dashboard — Kebeles KPI (P1-1)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it("shows the authoritative Kebele count from the backend — no hardcoded fallback", async () => {
    renderDashboard(makeUser("admin", 1), { kebeles: kebeleRecords(5) });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("5")).toBeInTheDocument());
    expect(within(card).getByText("Dire Dawa")).toBeInTheDocument();
    expect(within(card).queryByText("9")).not.toBeInTheDocument();
  });

  it("renders 9 for the full authorized roster (Dire Dawa — 9 actual kebeles)", async () => {
    renderDashboard(makeUser("admin", 1), { kebeles: kebeleRecords(9) });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("9")).toBeInTheDocument());
    expect(within(card).getByText("Dire Dawa")).toBeInTheDocument();
  });

  it("Kebele Admin receives the same authorized city-wide roster (kebeles endpoint is not role-scoped)", async () => {
    renderDashboard(makeUser("collector", 2), { kebeles: kebeleRecords(9) });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("9")).toBeInTheDocument());
  });

  it("Zone Leader receives the same authorized city-wide roster (kebeles endpoint is not role-scoped)", async () => {
    const leaderZone = { id: 10, name: "Zone 10", kebele_id: 1, leader_id: 3, description: null, created_at: "", updated_at: "" };
    renderDashboard(makeUser("leader", 3, leaderZone), { kebeles: kebeleRecords(9) });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("9")).toBeInTheDocument());
  });

  it("shows Loading… while kebele data is pending — no misleading pre-value", async () => {
    renderDashboard(makeUser("admin", 1), { getKebelesImpl: () => new Promise(() => {}) });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("Loading…")).toBeInTheDocument());
    expect(within(card).getByText("—")).toBeInTheDocument();
    expect(within(card).queryByText("Dire Dawa")).not.toBeInTheDocument();
  });

  it("treats a legitimate zero-return as 0, not an error", async () => {
    renderDashboard(makeUser("admin", 1), { kebeles: [] });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("0")).toBeInTheDocument());
    expect(within(card).getByText("Dire Dawa")).toBeInTheDocument();
  });

  it("shows Unavailable when the authoritative source fails — no fallback to 9", async () => {
    renderDashboard(makeUser("admin", 1), { getKebelesImpl: () => Promise.reject(new Error("boom")) });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("Unavailable")).toBeInTheDocument());
    expect(within(card).getByText("—")).toBeInTheDocument();
    expect(within(card).queryByText("9")).not.toBeInTheDocument();
  });

  it("never exposes more kebeles than the authorized backend dataset returned", async () => {
    renderDashboard(makeUser("admin", 1), { kebeles: kebeleRecords(3) });
    const card = kebelesCard();
    await waitFor(() => expect(within(card).getByText("3")).toBeInTheDocument());
  });
});

describe("Dashboard — Operational Overview", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it("renders revenue, attendance and inspection totals from the backend overview", async () => {
    const ov = emptyOverview();
    ov.revenue.totalCollected = "12000";
    ov.revenue.totalPending = "3000";
    ov.revenue.totalOverdue = "500";
    ov.revenue.target = "20000";
    ov.revenue.achievementPct = 60;
    ov.revenue.monthly = [
      { month: 5, collected: "4000" },
      { month: 6, collected: "8000" },
    ];
    ov.attendance = { totalRecords: 100, presentCount: 75, absentCount: 25, attendanceRate: 75 };
    ov.inspections = { total: 40, active: 30, warning: 7, danger: 3 };
    renderDashboard(makeUser("admin", 1), { overview: ov });

    await waitFor(() => expect(screen.getByText("ETB 12,000.00")).toBeInTheDocument());
    expect(screen.getByText("ETB 20,000.00")).toBeInTheDocument();
    expect(screen.getByText("Achievement 60.0%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/May: ETB 4,000.00/)).toBeInTheDocument();
  });

  it("lists every authorized kebele with real per-kebele counts — no more placeholders", async () => {
    const ov = { ...emptyOverview("admin"), kebeles: overviewRows(3) };
    renderDashboard(makeUser("admin", 1), { overview: ov, kebeles: kebeleRecords(3) });

    const table = () => within(screen.getByRole("table"));
    await waitFor(() => expect(table().getByText("Kebele 01 — K01")).toBeInTheDocument());
    expect(table().getByText("Kebele 02 — K02")).toBeInTheDocument();
    expect(table().getByText("Kebele 03 — K03")).toBeInTheDocument();
    expect(table().getByText("Workers", { exact: true })).toBeInTheDocument();
    expect(table().getByText("10", { exact: true })).toBeInTheDocument();
    expect(table().getByText("20", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });

  it("Kebele Admin comparison is scoped server-side: only their kebele row is rendered", async () => {
    const ov = { ...emptyOverview("collector"), kebeles: [overviewRows(1)[0]] };
    renderDashboard(makeUser("collector", 2), { overview: ov, kebeles: kebeleRecords(9) });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Kebele Operational Overview" })).toBeInTheDocument()
    );
    const table = () => within(screen.getByRole("table"));
    expect(table().getByText("Kebele 01 — K01")).toBeInTheDocument();
    expect(table().queryByText("Kebele 02 — K02")).not.toBeInTheDocument();
    expect(table().queryByText("Kebele 03 — K03")).not.toBeInTheDocument();
  });

  it("Zone Leader comparison shows a single kebele (their zone's kebele)", async () => {
    const leaderZone = { id: 10, name: "Zone 10", kebele_id: 1, leader_id: 3, description: null, created_at: "", updated_at: "" };
    const ov = { ...emptyOverview("leader"), kebeles: [overviewRows(1)[0]] };
    renderDashboard(makeUser("leader", 3, leaderZone), { overview: ov, kebeles: kebeleRecords(9) });

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "My Kebele — Operational Overview" })).toBeInTheDocument()
    );
    const table = () => within(screen.getByRole("table"));
    expect(table().getByText("Kebele 01 — K01")).toBeInTheDocument();
    expect(table().queryByText("Kebele 02 — K02")).not.toBeInTheDocument();
  });

  it("attendance with no records shows No data — a 0% rate is never fabricated", async () => {
    renderDashboard(makeUser("admin", 1), { overview: emptyOverview() });

    const attendanceSection = await screen.findByLabelText("Attendance overview");
    expect(within(attendanceSection).getByText("No data")).toBeInTheDocument();
    expect(within(attendanceSection).getByText("No attendance records this period")).toBeInTheDocument();
    expect(within(attendanceSection).queryByText("0%")).not.toBeInTheDocument();
  });

  it("achievement and its column appear only when a monthly target exists", async () => {
    renderDashboard(makeUser("admin", 1), { overview: emptyOverview() });

    await waitFor(() => expect(screen.getByText("No target data")).toBeInTheDocument());
    expect(screen.queryByText("Achievement %")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Achievement /)).not.toBeInTheDocument();
  });

  it("shows an alert and no fabricated numbers when the overview endpoint fails", async () => {
    renderDashboard(makeUser("admin", 1), {
      kebeles: kebeleRecords(9),
      overviewImpl: () => Promise.reject(new Error("overview failed")),
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("overview failed")).toBeInTheDocument();
    expect(screen.getByText("Operational overview")).toBeInTheDocument();
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
  });

  it("shows skeletons while the overview is loading — no premature numbers", async () => {
    renderDashboard(makeUser("admin", 1), {
      kebeles: kebeleRecords(9),
      overviewImpl: () => new Promise(() => {}),
    });

    await waitFor(() => expect(screen.getByText("Operational overview")).toBeInTheDocument());
    expect(screen.queryByText("Revenue")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
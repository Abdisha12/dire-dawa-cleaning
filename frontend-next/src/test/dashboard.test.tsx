// test/dashboard.test.tsx — Dashboard Kebeles KPI (P1-1)
// Renders the real AuthProvider + KebeleProvider + DashboardPage with a mocked
// network layer (@/lib/api), so the KPI exercises the authoritative data path.
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

function renderDashboard(
  user: User,
  opts: { kebeles?: KebeleRecord[]; getKebelesImpl?: () => Promise<unknown> } = {}
) {
  localStorage.setItem("ddcms_token", "tok");
  localStorage.setItem("ddcms_user", JSON.stringify(user));
  apiStore.api.me.mockResolvedValue(user);
  apiStore.api.getSaferZones.mockResolvedValue({ zones: [] });
  apiStore.api.getWorkers.mockResolvedValue([]);
  apiStore.api.getBusinesses.mockResolvedValue({ data: [] });
  if (opts.getKebelesImpl) apiStore.api.getKebeles.mockImplementation(opts.getKebelesImpl);
  else apiStore.api.getKebeles.mockResolvedValue({ kebeles: opts.kebeles ?? [] });
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
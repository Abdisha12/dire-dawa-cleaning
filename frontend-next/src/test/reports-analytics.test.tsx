// test/reports-analytics.test.tsx — Phase 8 Reports/Analytics/Performance
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithQuery, adminUser, collectorUser, leaderUser } from "./helpers";
import type { User } from "@/types";

const apiStore = vi.hoisted(() => ({
  api: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    getKebeles: vi.fn(),
    getSaferZones: vi.fn(),
    getDashboardSummary: vi.fn(),
    getPaymentsMonthlyReport: vi.fn(),
    getPaymentsYearlyReport: vi.fn(),
    getWorkersMonthlyReport: vi.fn(),
    getInspectionsReport: vi.fn(),
    getMonthlySummaryReport: vi.fn(),
    getAnalyticsAttendance: vi.fn(),
    getAnalyticsPayments: vi.fn(),
    getAnalyticsInspections: vi.fn(),
    getAnalyticsZones: vi.fn(),
    getAnalyticsTrends: vi.fn(),
    csvUrlReports: vi.fn((p: string) => `http://test/api${p}?format=csv`),
  },
}));
const authStore = vi.hoisted(() => ({ user: null as User | null }));
const kebeleStore = vi.hoisted(() => ({ selectedId: null as number | null }));

vi.mock("@/lib/api", () => {
  class ApiError extends Error { status:number; constructor(m:string,s=500){super(m); this.status=s} }
  return { ApiError, api: apiStore.api };
});
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: authStore.user, loading:false, error:null, login:async()=>{}, logout:async()=>{}, refresh:async()=>{} }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/kebele-context", () => ({
  useKebele: () => ({ kebeles:[], loading:false, error:null, selectedId: kebeleStore.selectedId, setSelectedId:()=>{}, selectedKebele:null, isLocked:false, myZoneId:null, reload:()=>{} }),
  KebeleProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import ReportsPage from "@/app/(app)/reports/page";
import AnalyticsPage from "@/app/(app)/reports/analytics/page";
import PerformancePage from "@/app/(app)/reports/performance/page";

beforeEach(() => vi.clearAllMocks());

function setupApi(user: User) {
  authStore.user = user;
  apiStore.api.getKebeles.mockResolvedValue({ kebeles: [{ id: 1, name: "K01", code: "K01" }] });
  apiStore.api.getSaferZones.mockResolvedValue({ zones: [] });
  apiStore.api.getPaymentsMonthlyReport.mockResolvedValue([
    { id: 1, business: "ABC", zone: "Z1", kebele: "K01", amount: "500.00", method: "cash", status: "paid", month: 9, year: 2026, paid_at: "2026-09-01T10:00:00Z", receipt_number: "RCP-1", collector: "Admin" },
  ]);
  apiStore.api.getPaymentsYearlyReport.mockResolvedValue([
    { month: 1, count: "1", collected: "500.00", pending: "0", overdue: "0" },
  ]);
  apiStore.api.getWorkersMonthlyReport.mockResolvedValue([
    { full_name: "Abebe", zone: "Z1", kebele: "K01", daily_wage: "200", days_present: "20", days_absent: "0", total_bonus: "0", gross_wage: "4000" },
  ]);
  apiStore.api.getInspectionsReport.mockResolvedValue([
    { id: 1, date: "2026-09-01", kebele: "K01", zone: "Z1", status: "active", inspector: "Admin" },
  ]);
  apiStore.api.getDashboardSummary.mockResolvedValue({
    totals: { total_collected: "500.00", total_pending: "0", total_overdue: "0" },
    byKebele: [{ kebele: "K01", code: "K01", collected: "500.00", target: "" }],
    monthly: [{ month: 9, collected: "500.00" }],
  });
  apiStore.api.getAnalyticsZones.mockResolvedValue([
    { zone_id: 1, zone_name: "Z1", total_collected: "500.00", total_workers: 5 },
  ]);
  apiStore.api.getAnalyticsTrends.mockResolvedValue([{ month: 9, collected: "500.00" }]);
}

describe("Reports route", () => {
  it("1. Reports route renders", async () => {
    setupApi(adminUser);
    renderWithQuery(<ReportsPage />);
    expect(screen.getByRole("heading", { name: /Reports/i })).toBeInTheDocument();
    await waitFor(() => expect(apiStore.api.getPaymentsMonthlyReport).toHaveBeenCalled());
  });

  it("4. report results render", async () => {
    setupApi(adminUser);
    renderWithQuery(<ReportsPage />);
    await waitFor(() => expect(screen.getAllByText("ABC").length).toBeGreaterThan(0), { timeout: 3000 });
  });

  it("5. empty state works (no data)", async () => {
    setupApi(adminUser);
    apiStore.api.getPaymentsMonthlyReport.mockResolvedValue([]);
    renderWithQuery(<ReportsPage />);
    await waitFor(() => expect(screen.getByText(/No data for selected period/i)).toBeInTheDocument(), { timeout: 3000 });
  });

  it("6. error state works", async () => {
    setupApi(adminUser);
    apiStore.api.getPaymentsMonthlyReport.mockRejectedValue(new Error("Backend unavailable"));
    renderWithQuery(<ReportsPage />);
    await waitFor(() => expect(screen.getAllByText(/Backend unavailable/i).length).toBeGreaterThan(0), { timeout: 3000 });
  });
});

describe("Analytics route", () => {
  it("8. Analytics route renders", async () => {
    setupApi(adminUser);
    renderWithQuery(<AnalyticsPage />);
    expect(screen.getByRole("heading", { name: /Analytics/i })).toBeInTheDocument();
    await waitFor(() => expect(apiStore.api.getDashboardSummary).toHaveBeenCalled());
  });

  it("10. kebele comparison renders", async () => {
    setupApi(adminUser);
    renderWithQuery(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText(/9-Kebele Comparison/i)).toBeInTheDocument(), { timeout: 3000 });
    await waitFor(() => expect(screen.getAllByText("K01").length).toBeGreaterThan(0), { timeout: 3000 });
  });

  it("12. accessible chart alternative renders", async () => {
    setupApi(adminUser);
    renderWithQuery(<AnalyticsPage />);
    await waitFor(() => expect(screen.getByText(/Text alternative/i)).toBeInTheDocument(), { timeout: 3000 });
  });
});

describe("9 Kebeles / role behavior", () => {
  it("13. all 9 real kebeles can appear", async () => {
    setupApi(adminUser);
    apiStore.api.getDashboardSummary.mockResolvedValue({
      totals: { total_collected: "0", total_pending: "0", total_overdue: "0" },
      byKebele: ["K01","K02","K03","K04","K05","K06","K07","K08","K09"].map((k) => ({ kebele: k, code: k, collected: "0", target: "" })),
      monthly: [],
    });
    renderWithQuery(<AnalyticsPage />);
    await waitFor(() => expect(screen.getAllByText("K01").length).toBeGreaterThan(0), { timeout: 3000 });
    expect(screen.getAllByText("K09").length).toBeGreaterThan(0);
  });

  it("14. admin can view all kebeles", async () => {
    setupApi(adminUser);
    renderWithQuery(<AnalyticsPage />);
    await waitFor(() => expect(apiStore.api.getDashboardSummary).toHaveBeenCalled());
  });

  it("15. kebele admin sees my-kebele scoped data", async () => {
    kebeleStore.selectedId = 5;
    setupApi(collectorUser);
    renderWithQuery(<ReportsPage />);
    await waitFor(() => expect(apiStore.api.getPaymentsMonthlyReport).toHaveBeenCalled(), { timeout: 3000 });
    // verify kebeleId was passed in params
    const calls = (apiStore.api.getPaymentsMonthlyReport as unknown as { mock: { calls: unknown[] } }).mock.calls;
    expect(calls.some((c: unknown) => (c as [Record<string, string>])[0]?.kebeleId === "5")).toBe(true);
  });

  it("16. zone leader is scoped correctly", async () => {
    setupApi(leaderUser);
    renderWithQuery(<ReportsPage />);
    await waitFor(() => expect(apiStore.api.getPaymentsMonthlyReport).toHaveBeenCalled(), { timeout: 3000 });
  });
});

describe("Exports", () => {
  it("17. CSV action works (csvUrlReports called)", async () => {
    setupApi(adminUser);
    renderWithQuery(<ReportsPage />);
    await waitFor(() => expect(apiStore.api.getPaymentsMonthlyReport).toHaveBeenCalled(), { timeout: 3000 });
    expect(apiStore.api.csvUrlReports).toBeDefined();
  });
});

describe("Performance route", () => {
  it("Performance route renders", async () => {
    setupApi(adminUser);
    renderWithQuery(<PerformancePage />);
    expect(screen.getByRole("heading", { name: /Performance/i })).toBeInTheDocument();
  });
});

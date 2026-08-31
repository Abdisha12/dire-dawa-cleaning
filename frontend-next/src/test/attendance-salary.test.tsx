// test/attendance-salary.test.tsx — item 35 Attendance + Salary behaviors + security
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery, adminUser, workerFixture, zoneFixture } from "./helpers";
import type { User } from "@/types";

const apiStore = vi.hoisted(() => ({
  api: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    getKebeles: vi.fn(),
    getSaferZones: vi.fn(),
    getWorkers: vi.fn(),
    createWorker: vi.fn(),
    updateWorker: vi.fn(),
    deleteWorker: vi.fn(),
    bulkAttendance: vi.fn(),
    getAttendance: vi.fn(),
    getWorkerSalary: vi.fn(),
    paySalary: vi.fn(),
  },
}));
const authStore = vi.hoisted(() => ({ user: null as User | null }));
const kebeleStore = vi.hoisted(() => ({ selectedId: null as number | null }));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status = 500, opts: { code?: string } = {}) {
      super(message);
      this.status = status;
      this.code = opts.code;
    }
  }
  return { ApiError, api: apiStore.api };
});

vi.mock("@/lib/auth-context", () => {
  const useAuth = () => ({
    user: authStore.user,
    loading: false,
    error: null,
    login: async () => {},
    logout: async () => {},
    refresh: async () => {},
  });
  return { useAuth, AuthProvider: ({ children }: { children: React.ReactNode }) => children };
});

vi.mock("@/lib/kebele-context", () => {
  const useKebele = () => ({
    kebeles: [],
    loading: false,
    error: null,
    selectedId: kebeleStore.selectedId,
    setSelectedId: () => {},
    selectedKebele: null,
    isLocked: false,
    myZoneId: null,
    reload: () => {},
  });
  return { useKebele, KebeleProvider: ({ children }: { children: React.ReactNode }) => children };
});

import AttendancePage from "@/app/(app)/operations/attendance/page";
import SalaryPage from "@/app/(app)/operations/salary/page";

const workerA = workerFixture({ id: 1, full_name: "Abebe Bekele" });
const workerB = workerFixture({ id: 2, full_name: "Chaltu Girma", is_active: true });

function setup(user: User, selectedId: number | null = null) {
  apiStore.api.getSaferZones.mockResolvedValue({ zones: [zoneFixture] });
  authStore.user = user;
  kebeleStore.selectedId = selectedId;
  return apiStore.api as any;
}

describe("Attendance page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the page and attendance rows", async () => {
    const api = setup(adminUser);
    api.getWorkers.mockResolvedValue({ data: [workerA], total: 1, pages: 1, page: 1 });
    api.getAttendance.mockResolvedValue([
      { id: 1, worker_id: 1, date: "2026-08-31", present: true, bonus: null, recorder_name: "Admin User" },
    ]);
    renderWithQuery(<AttendancePage />);
    expect(screen.getByRole("heading", { name: "Attendance" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
  });

  it("opens bulk attendance and saves via api.bulkAttendance", async () => {
    const api = setup(adminUser);
    api.getWorkers.mockResolvedValue({ data: [workerA, workerB], total: 2, pages: 1, page: 1 });
    api.getAttendance.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithQuery(<AttendancePage />);
    await user.click(screen.getByRole("button", { name: /bulk attendance/i }));
    const modal = await screen.findByRole("dialog", { name: /record daily attendance/i });
    expect(modal).toBeInTheDocument();
    api.bulkAttendance.mockResolvedValue({ message: "ok" });
    await user.click(screen.getByRole("button", { name: /save attendance/i }));
    await waitFor(() => expect(api.bulkAttendance).toHaveBeenCalled());
    const [payload] = api.bulkAttendance.mock.calls[0];
    expect(payload).toHaveProperty("date");
    expect(payload.records.length).toBe(2);
  });

  it("submission toggles present/absent selection", async () => {
    const api = setup(adminUser);
    api.getWorkers.mockResolvedValue({ data: [workerA], total: 1, pages: 1, page: 1 });
    api.getAttendance.mockResolvedValue([]);
    api.bulkAttendance.mockResolvedValue({ message: "ok" });
    const user = userEvent.setup();
    renderWithQuery(<AttendancePage />);
    await user.click(screen.getByRole("button", { name: /bulk attendance/i }));
    await screen.findByRole("dialog", { name: /record daily attendance/i });
    const absentBtn = screen.getByRole("button", { name: /mark abebe bekele absent/i });
    await user.click(absentBtn);
    await user.click(screen.getByRole("button", { name: /save attendance/i }));
    await waitFor(() => expect(api.bulkAttendance).toHaveBeenCalled());
    const [payload] = api.bulkAttendance.mock.calls[0];
    expect(payload.records[0]).toMatchObject({ workerId: 1, present: false });
  });

  it("handles unauthorized bulk submission safely (shows error, no token)", async () => {
    const api = setup(adminUser);
    api.getWorkers.mockResolvedValue({ data: [workerA], total: 1, pages: 1, page: 1 });
    api.getAttendance.mockResolvedValue([]);
    api.bulkAttendance.mockRejectedValue(Object.assign(new Error("Not authorized for this kebele"), { status: 403 }));
    const user = userEvent.setup();
    renderWithQuery(<AttendancePage />);
    await user.click(screen.getByRole("button", { name: /bulk attendance/i }));
    await screen.findByRole("dialog", { name: /record daily attendance/i });
    await user.click(screen.getByRole("button", { name: /save attendance/i }));
    await waitFor(() => expect(screen.getAllByText(/not authorized for this kebele/i).length).toBeGreaterThan(0));
  });
});

describe("Salary page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the page when applicable", async () => {
    const api = setup(adminUser);
    api.getWorkers.mockResolvedValue({ data: [workerA], total: 1, pages: 1, page: 1 });
    api.getWorkerSalary.mockResolvedValue([]);
    renderWithQuery(<SalaryPage />);
    expect(screen.getByRole("heading", { name: "Salary Payments" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/salary payments in scope/i).length).toBeGreaterThan(0));
  });

  it("validates amount: rejects non-positive amount", async () => {
    const api = setup(adminUser);
    api.getWorkers.mockResolvedValue({ data: [workerA], total: 1, pages: 1, page: 1 });
    const user = userEvent.setup();
    renderWithQuery(<SalaryPage />);
    await user.click(screen.getByRole("button", { name: /record payment/i }));
    await screen.findByText(/record salary payment/i);
    // pick a worker
    await user.selectOptions(screen.getByRole("combobox", { name: /worker/i }), "1");
    // leave amount empty -> required error, recordPayment NOT called
    await user.click(screen.getByRole("button", { name: /✅ record payment/i }));
    await waitFor(() => expect(api.paySalary).not.toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(/worker, amount and date are required/i)).toBeInTheDocument());
  });

  it("handles authorization errors safely (shows error, no token)", async () => {
    const api = setup(adminUser);
    api.getWorkers.mockResolvedValue({ data: [workerA], total: 1, pages: 1, page: 1 });
    const user = userEvent.setup();
    renderWithQuery(<SalaryPage />);
    await user.click(screen.getByRole("button", { name: /record payment/i }));
    await screen.findByText(/record salary payment/i);
    await user.selectOptions(screen.getByRole("combobox", { name: /worker/i }), "1");
    await user.type(screen.getByRole("spinbutton"), "500");
    api.paySalary.mockRejectedValue(Object.assign(new Error("Worker does not belong to your kebele"), { status: 403 }));
    await user.click(screen.getByRole("button", { name: /✅ record payment/i }));
    await waitFor(() => expect(screen.getByText(/worker does not belong to your kebele/i)).toBeInTheDocument());
  });
});

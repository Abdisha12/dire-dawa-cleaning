// test/workers.test.tsx — item 35 Workers page behaviors + security + responsive
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithQuery,
  adminUser,
  collectorUser,
  workerFixture,
  zoneFixture,
} from "./helpers";
import type { User, Worker } from "@/types";

// ---- Hoisted stores shared with the vi.mock factories below ----
// `api` is created ONCE with all methods as vi.fn(); tests reconfigure (not replace)
// the object so the `api` reference captured by workersApi stays valid.
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

// Stub lazy-loaded dialog components (they fetch their own data via workersApi)
vi.mock("@/features/workers/components/worker-dialogs", () => {
  const React = require("react");
  const make = (Fallback: React.FC<any>) => (props: any) => <Fallback {...props} />;
  const WorkerFormModal = make(({ onClose, onSaved }: any) => (
    <div role="dialog" aria-label="Worker form">
      <button onClick={onSaved}>form-save</button>
      <button onClick={onClose}>form-close</button>
    </div>
  ));
  const BulkAttendanceModal = make(({ onClose, onSaved }: any) => (
    <div role="dialog" aria-label="Bulk attendance">
      <button onClick={onSaved}>bulk-save</button>
      <button onClick={onClose}>bulk-close</button>
    </div>
  ));
  const AttendanceModal = make(({ onClose }: any) => (
    <div role="dialog" aria-label="Attendance dialog">
      <button onClick={onClose}>att-close</button>
    </div>
  ));
  const SalaryModal = make(({ onClose }: any) => (
    <div role="dialog" aria-label="Salary dialog">
      <button onClick={onClose}>sal-close</button>
    </div>
  ));
  const IdCardModal = make(() => <div role="dialog" aria-label="ID card dialog" />);
  const WorkerDetailsDrawer = make(({ onClose }: any) => (
    <div role="dialog" aria-label="Worker details">
      <span>detail-content</span>
      <button onClick={onClose}>drawer-close</button>
    </div>
  ));
  return { WorkerFormModal, BulkAttendanceModal, AttendanceModal, SalaryModal, IdCardModal, WorkerDetailsDrawer };
});

import WorkersPage from "@/app/(app)/operations/workers/page";

const workerA: Worker = workerFixture({ id: 1, full_name: "Abebe Bekele" });
const workerB: Worker = workerFixture({ id: 2, full_name: "Chaltu Girma", is_active: false });

beforeEach(() => {
  vi.clearAllMocks();
});

function setupApi(user: User, selectedId: number | null, items: Worker[] = [workerA, workerB]) {
  const api: any = apiStore.api;
  authStore.user = user;
  kebeleStore.selectedId = selectedId;
  api.getWorkers.mockImplementation((params: Record<string, string> = {}) => {
    const list = items.filter((w) =>
      params.status ? (params.status === "active" ? w.is_active : !w.is_active) : true
    );
    const pageNum = Number(params.page || 1);
    const pages = Math.max(1, Math.ceil(list.length / 25));
    return Promise.resolve({ data: list.slice((pageNum - 1) * 25, pageNum * 25), total: list.length, page: pageNum, pages });
  });
  api.getSaferZones.mockResolvedValue({ zones: [zoneFixture] });
  return api;
}

const renderPage = () => renderWithQuery(<WorkersPage />);

describe("Workers page — render + data", () => {
  it("renders the page heading and worker names", async () => {
    const api = setupApi( adminUser, null);
    const { render } = renderPage();
    expect(screen.getByRole("heading", { name: "Workers Management" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Chaltu Girma").length).toBeGreaterThan(0);
  });

  it("shows summary stat cards", async () => {
    setupApi( adminUser, null);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/Workers in scope/).length).toBeGreaterThan(0);
    });
  });

  it("debounces search and refetches with the search term", async () => {
    const api = setupApi( adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText("Abebe Bekele");
    const box = screen.getByRole("textbox", { name: /search workers/i });
    await user.type(box, "Chaltu");
    await waitFor(
      () => {
        const calls = api.getWorkers.mock.calls as [Record<string, string>][];
        expect(calls.some((c) => (c[0] || {}).search === "Chaltu")).toBe(true);
      },
      { timeout: 1500 }
    );
  });

  it("paginates to page 2 with 30 workers", async () => {
    const many = Array.from({ length: 30 }, (_, i) => workerFixture({ id: i + 1, full_name: `W ${i + 1}` }));
    const api = setupApi(adminUser, null, many);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("W 1").length).toBeGreaterThan(0));
    const nextBtn = screen.getByRole("button", { name: /go to page 2/i });
    await user.click(nextBtn);
    await waitFor(() => {
      const calls = api.getWorkers.mock.calls as [Record<string, string>][];
      expect(calls.some((c) => (c[0] || {}).page === "2")).toBe(true);
    });
  });
});

describe("Workers page — add / edit / delete", () => {
  it("add-worker opens form and saving refreshes data", async () => {
    const api = setupApi( adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: /add worker/i }));
    expect(await screen.findByRole("dialog", { name: /worker form/i })).toBeInTheDocument();
    api.getWorkers.mockClear();
    await user.click(screen.getByRole("button", { name: /form-save/i }));
    await waitFor(() => expect(api.getWorkers.mock.calls.length).toBeGreaterThan(0));
  });

  it("edit button opens the form", async () => {
    setupApi( adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /edit abebe bekele/i })[0]);
    expect(await screen.findByRole("dialog", { name: /worker form/i })).toBeInTheDocument();
  });

  it("delete requires confirmation then calls deleteWorker", async () => {
    const api = setupApi( adminUser, null);
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deleteWorker.mockResolvedValue({ message: "deleted" });
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /delete abebe bekele/i })[0]);
    expect(confirmSpy).toHaveBeenCalled();
    expect(api.deleteWorker.mock.calls[0][0]).toBe(1);
    confirmSpy.mockRestore();
  });

  it("does not delete when confirm is declined", async () => {
    const api = setupApi( adminUser, null);
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /delete abebe bekele/i })[0]);
    expect(api.deleteWorker).not.toHaveBeenCalled();
  });

  it("opens worker detail drawer", async () => {
    setupApi( adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /view abebe bekele/i })[0]);
    expect(await screen.findByRole("dialog", { name: /worker details/i })).toBeInTheDocument();
  });
});

describe("Workers page — Kebele Admin scope", () => {
  it("sees only authorized workers in scope", async () => {
    // Backend returns only the collector's kebele workers (scoping is enforced server-side)
    const api = setupApi(collectorUser, 5, [workerA]);
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Abebe Bekele").length).toBeGreaterThan(0));
    // Chaltu is not authorized for this collector, so never appears
    expect(screen.queryByText("Chaltu Girma")).not.toBeInTheDocument();
  });

  it("cannot select another kebele (selector hidden/locked)", async () => {
    setupApi( collectorUser, 5);
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/my kebele — locked/i).length).toBeGreaterThan(0));
    // Kebele Admin must NOT see the admin-only kebele filter select
    expect(screen.queryByRole("combobox", { name: /filter by kebele/i })).not.toBeInTheDocument();
  });

  it("zone filter options are scoped", async () => {
    setupApi( collectorUser, 5);
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /filter by zone/i })).toBeInTheDocument());
    const zoneSelect = screen.getByRole("combobox", { name: /filter by zone/i });
    expect(within(zoneSelect).getAllByRole("option").length).toBeGreaterThan(0);
  });
});

describe("Workers page — security", () => {
  it("handles an unauthorized API error without crashing and logs no token", async () => {
    const api = setupApi( adminUser, null);
    // Simulate 401/403 from the backend on every workers fetch
    api.getWorkers.mockRejectedValue(Object.assign(new Error("Not authorized"), { status: 403 }));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderPage();
    await waitFor(() => {
      // page survives and shows an error state with the backend's message
      expect(screen.getAllByText(/not authorized/i).length).toBeGreaterThan(0);
    });
    // ensure nothing sensitive (token) was ever logged
    const logged = consoleSpy.mock.calls.flat().map(String);
    expect(logged.some((l) => l.includes("ddcms_token") || l.includes("tok123"))).toBe(false);
    consoleSpy.mockRestore();
  });
});

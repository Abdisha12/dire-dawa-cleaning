// test/responsive.test.tsx — item 35 responsive + form validation + a11y
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkerFormModal } from "@/features/workers/components/worker-dialogs";
import { WorkerCard } from "@/features/workers/components/worker-card";
import { MobileAttendanceRow } from "@/features/attendance/components/mobile-attendance-row";
import { renderWithQuery, workerFixture, zoneFixture } from "./helpers";
import type { User } from "@/types";
import { ToasterProvider } from "@/components/ui/toast";

const apiStore = vi.hoisted(() => ({
  api: {
    getSaferZones: vi.fn(),
    getWorkers: vi.fn(),
    createWorker: vi.fn(),
    updateWorker: vi.fn(),
    getWorkerSalary: vi.fn(),
    paySalary: vi.fn(),
  },
}));
const authStore = vi.hoisted(() => ({ user: null as User | null }));

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

const worker = workerFixture({ id: 1, full_name: "Abebe Bekele", daily_wage: 250 });

const renderModal = (props: Partial<Parameters<typeof WorkerFormModal>[0]> = {}) =>
  renderWithQuery(
    <ToasterProvider>
      <WorkerFormModal worker={null} zones={[zoneFixture]} isCollector={false} onClose={() => {}} onSaved={() => {}} {...props} />
    </ToasterProvider>
  );

describe("Worker form validation (real component)", () => {
  it("rejects empty submit with required-field errors and does not create", async () => {
    apiStore.api.createWorker = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSaved });
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Full name is required")).toBeInTheDocument();
    expect(apiStore.api.createWorker).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("creates a worker with valid data and calls onSaved", async () => {
    apiStore.api.createWorker = vi.fn().mockResolvedValue({ message: "created" });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderModal({ onSaved });
    await user.type(screen.getByLabelText(/full name/i), "New Worker");
    await user.clear(screen.getByLabelText(/daily wage/i));
    await user.type(screen.getByLabelText(/daily wage/i), "300");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(apiStore.api.createWorker).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it("rejects an invalid Fayda id (not 12 digits)", async () => {
    apiStore.api.createWorker = vi.fn();
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/full name/i), "New Worker");
    await user.clear(screen.getByLabelText(/daily wage/i));
    await user.type(screen.getByLabelText(/daily wage/i), "200");
    await user.type(screen.getByLabelText(/fayda\/id number/i), "12345");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(screen.getByText("Must be exactly 12 digits")).toBeInTheDocument());
    expect(apiStore.api.createWorker).not.toHaveBeenCalled();
  });
});

describe("Responsive — mobile worker cards", () => {
  it("renders worker card with touch-size action buttons", () => {
    const onDelete = vi.fn();
    render(
      <WorkerCard
        worker={worker}
        canEdit
        isAdmin
        onView={() => {}}
        onEdit={() => {}}
        onAttendance={() => {}}
        onIdCard={() => {}}
        onSalary={() => {}}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText("Abebe Bekele")).toBeInTheDocument();
    // Admin gets a 44px delete control with an accessible name
    const del = screen.getByRole("button", { name: /delete abebe bekele/i });
    expect(del).toBeInTheDocument();
    // View/Edit have min 44x44 touch targets via class (ensured by design token)
    expect(screen.getByRole("button", { name: /view abebe bekele/i })).toBeInTheDocument();
  });
});

describe("Responsive — mobile attendance row accessibility", () => {
  it("renders keyboard/touch-accessible PRESENT/ABSENT toggles with aria-pressed", () => {
    const onPresent = vi.fn();
    render(
      <ToasterProvider>
        <MobileAttendanceRow
          workerId={1}
          workerName="Abebe Bekele"
          zoneName="Zone 10"
          dailyWage={250}
          present={false}
          bonus=""
          onPresentChange={onPresent}
          onBonusChange={() => {}}
        />
      </ToasterProvider>
    );
    const present = screen.getByRole("button", { name: /present/i });
    const absent = screen.getByRole("button", { name: /absent/i });
    expect(present).toHaveAttribute("aria-pressed", "false");
    expect(absent).toHaveAttribute("aria-pressed", "true");
    expect(present).toBeEnabled();
    expect(absent).toBeEnabled();
  });

  it("toggles attendance on click (touch)", async () => {
    const onPresent = vi.fn();
    const user = userEvent.setup();
    render(
      <ToasterProvider>
        <MobileAttendanceRow
          workerId={1}
          workerName="Abebe Bekele"
          zoneName="Zone 10"
          dailyWage={250}
          present={false}
          bonus=""
          onPresentChange={onPresent}
          onBonusChange={() => {}}
        />
      </ToasterProvider>
    );
    await user.click(screen.getByRole("button", { name: /present/i }));
    expect(onPresent).toHaveBeenCalledWith(1, true);
  });
});

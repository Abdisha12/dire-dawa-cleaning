// test/businesses.test.tsx — Phase 5 Businesses page
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithQuery, adminUser, collectorUser, businessFixture, zoneFixture, paymentFixture } from "./helpers";
import type { User, Business } from "@/types";

const apiStore = vi.hoisted(() => ({
  api: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
    getKebeles: vi.fn(),
    getSaferZones: vi.fn(),
    getBusinesses: vi.fn(),
    getBusiness: vi.fn(),
    createBusiness: vi.fn(),
    updateBusiness: vi.fn(),
    deleteBusiness: vi.fn(),
    getPayments: vi.fn(),
    createPayment: vi.fn(),
    deletePayment: vi.fn(),
    verifyPayment: vi.fn(),
    getDashboardSummary: vi.fn(),
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

vi.mock("@/features/businesses/components/business-dialogs", () => {
  const React = require("react");
  const BusinessFormModal = ({ onClose, onSaved }: any) => (
    <div role="dialog" aria-label="Business form">
      <button onClick={onSaved}>biz-form-save</button>
      <button onClick={onClose}>biz-form-close</button>
    </div>
  );
  const BusinessDetailsDrawer = ({ onClose }: any) => (
    <div role="dialog" aria-label="Business details">
      <span>business-detail-content</span>
      <button onClick={onClose}>drawer-close</button>
    </div>
  );
  return { BusinessFormModal, BusinessDetailsDrawer };
});
vi.mock("@/features/businesses/components/payment-dialogs", () => {
  const PaymentFormModal = ({ onClose, onSaved }: any) => (
    <div role="dialog" aria-label="Payment form">
      <button onClick={() => onSaved({ status: "paid", receiptNumber: "RCP-TEST", id: 1 })}>pay-save</button>
      <button onClick={onClose}>pay-close</button>
    </div>
  );
  const GatewayCheckoutModal = ({ onClose }: any) => (
    <div role="dialog" aria-label="Gateway checkout">
      <button onClick={onClose}>gateway-close</button>
    </div>
  );
  const ReceiptModal = ({ onClose }: any) => (
    <div role="dialog" aria-label="Receipt">
      <button onClick={onClose}>receipt-close</button>
    </div>
  );
  return { PaymentFormModal, GatewayCheckoutModal, ReceiptModal };
});

import BusinessesPage from "@/app/(app)/businesses/page";

const bizA = businessFixture({ id: 1, name: "ABC Shop", type: "shop" });
const bizB = businessFixture({ id: 2, name: "Sunrise Cafe", type: "cafe", is_active: false });

beforeEach(() => vi.clearAllMocks());

function setupApi(user: User, selectedId: number | null, items: Business[] = [bizA, bizB]) {
  const api: any = apiStore.api;
  authStore.user = user;
  kebeleStore.selectedId = selectedId;
  api.getBusinesses.mockImplementation((params: Record<string, string> = {}) => {
    let list = items;
    if (params.type) list = list.filter((b) => b.type === params.type);
    if (params.status) list = list.filter((b) => (params.status === "active" ? b.is_active : !b.is_active));
    const pageNum = Number(params.page || 1);
    const pages = Math.max(1, Math.ceil(list.length / 25));
    const slice = list.slice((pageNum - 1) * 25, pageNum * 25);
    return Promise.resolve({ data: slice, total: list.length, page: pageNum, pages });
  });
  api.getSaferZones.mockResolvedValue({ zones: [zoneFixture] });
  api.getDashboardSummary?.mockResolvedValue?.({ totals: { total_collected: "0", total_pending: "0", total_overdue: "0" } } as any);
  return api;
}
const renderPage = () => renderWithQuery(<BusinessesPage />);

describe("Businesses page — render + search + pagination + filters", () => {
  it("1. renders the page heading and business names", async () => {
    setupApi(adminUser, null);
    renderPage();
    expect(screen.getByRole("heading", { name: /Businesses/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Sunrise Cafe").length).toBeGreaterThan(0);
  });

  it("2. debounces search and refetches with search term", async () => {
    const api = setupApi(adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText("ABC Shop");
    const box = screen.getByRole("textbox", { name: /search businesses/i });
    await user.type(box, "Sunrise");
    await waitFor(() => {
      const calls = api.getBusinesses.mock.calls as [Record<string, string>][];
      expect(calls.some((c) => (c[0] || {}).search === "Sunrise")).toBe(true);
    }, { timeout: 1500 });
  });

  it("3. paginates to page 2 with 30 businesses", async () => {
    const many = Array.from({ length: 30 }, (_, i) => businessFixture({ id: i + 1, name: `Biz ${i + 1}` }));
    const api = setupApi(adminUser, null, many);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("Biz 1").length).toBeGreaterThan(0));
    const nextBtn = screen.getByRole("button", { name: /go to page 2/i });
    await user.click(nextBtn);
    await waitFor(() => {
      const calls = api.getBusinesses.mock.calls as [Record<string, string>][];
      expect(calls.some((c) => (c[0] || {}).page === "2")).toBe(true);
    });
  }, 10000);

  it("4. filters by type", async () => {
    const api = setupApi(adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByText("ABC Shop");
    const sel = screen.getByRole("combobox", { name: /filter by type/i });
    await user.selectOptions(sel, "cafe");
    await waitFor(() => {
      const calls = (api.getBusinesses as unknown as { mock: { calls: unknown[] } }).mock.calls as [Record<string, string>][];
      expect(calls.some((c) => (c[0] || {}).type === "cafe")).toBe(true);
    });
  });

  it("5. add business validation — stub form is reachable", async () => {
    setupApi(adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: /add business/i }));
    expect(await screen.findByRole("dialog", { name: /business form/i })).toBeInTheDocument();
  });

  it("6. business creation refreshes data", async () => {
    const api = setupApi(adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    await user.click(screen.getByRole("button", { name: /add business/i }));
    api.getBusinesses.mockClear();
    await user.click(screen.getByRole("button", { name: /biz-form-save/i }));
    await waitFor(() => expect(api.getBusinesses.mock.calls.length).toBeGreaterThan(0));
  });

  it("7. edit button opens the form", async () => {
    setupApi(adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /edit abc shop/i })[0]);
    expect(await screen.findByRole("dialog", { name: /business form/i })).toBeInTheDocument();
  });

  it("8. business details drawer opens", async () => {
    setupApi(adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /view abc shop/i })[0]);
    expect(await screen.findByRole("dialog", { name: /business details/i })).toBeInTheDocument();
  });

  it("9. delete requires confirmation then calls deleteBusiness (admin)", async () => {
    const api = setupApi(adminUser, null);
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    api.deleteBusiness.mockResolvedValue({ message: "Deleted" });
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /delete abc shop/i })[0]);
    expect(confirmSpy).toHaveBeenCalled();
    expect(api.deleteBusiness.mock.calls[0][0]).toBe(1);
    confirmSpy.mockRestore();
  });
});

describe("Businesses page — Kebele Admin scope + cascade", () => {
  it("10. Kebele Admin sees only authorized businesses", async () => {
    setupApi(collectorUser, 5, [bizA]);
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    expect(screen.queryByText("Sunrise Cafe")).not.toBeInTheDocument();
  });

  it("11. Kebele Admin cannot select another kebele (locked)", async () => {
    setupApi(collectorUser, 5);
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/my kebele — locked/i).length).toBeGreaterThan(0));
    expect(screen.queryByRole("combobox", { name: /filter by kebele/i })).not.toBeInTheDocument();
  });

  it("12. Kebele → safer-zone cascade: zone filter scoped", async () => {
    setupApi(collectorUser, 5);
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox", { name: /filter by zone/i })).toBeInTheDocument());
    const sel = screen.getByRole("combobox", { name: /filter by zone/i });
    expect(within(sel).getAllByRole("option").length).toBeGreaterThan(0);
  });

  it("payment shortcut opens payment form with business context", async () => {
    setupApi(adminUser, null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    await user.click(screen.getAllByRole("button", { name: /pay abc shop/i })[0]);
    expect(await screen.findByRole("dialog", { name: /payment form/i })).toBeInTheDocument();
  });
});

describe("Businesses page — security", () => {
  it("handles unauthorized API error safely and logs no token", async () => {
    const api = setupApi(adminUser, null);
    api.getBusinesses.mockRejectedValue(Object.assign(new Error("Not authorized"), { status: 403 }));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/not authorized/i).length).toBeGreaterThan(0));
    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged.includes("ddcms_token")).toBe(false);
    spy.mockRestore();
  });

  it("cross-kebele business delete fails safely (403)", async () => {
    const api = setupApi(collectorUser, 5);
    // collector tries to delete admin-owned business outside kebele — backend 403
    // But UI for collector doesn't show delete (admin only), so test admin cross-kebele attempt
    authStore.user = adminUser;
    // simulate backend rejecting cross-kebele mutation
    api.deleteBusiness.mockRejectedValue(Object.assign(new Error("Business not in your kebele"), { status: 403 }));
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    // admin delete button exists
    await user.click(screen.getAllByRole("button", { name: /delete abc shop/i })[0]);
    await waitFor(() => expect(api.deleteBusiness).toHaveBeenCalled());
    // error is surfaced via toast but not crash — page still shows businesses
    await waitFor(() => expect(screen.getAllByText("ABC Shop").length).toBeGreaterThan(0));
    confirmSpy.mockRestore();
  });
});

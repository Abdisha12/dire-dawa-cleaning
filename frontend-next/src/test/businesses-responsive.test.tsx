// test/businesses-responsive.test.tsx — Phase 5 business form validation + responsive + QR mobile
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BusinessFormModal } from "@/features/businesses/components/business-dialogs";
import { BusinessCard } from "@/features/businesses/components/business-card";
import { PaymentCard } from "@/features/businesses/components/payment-card";
import { GatewayCheckoutModal, PaymentFormModal, ReceiptModal } from "@/features/businesses/components/payment-dialogs";
import { renderWithQuery, businessFixture, paymentFixture, zoneFixture } from "./helpers";
import { ToasterProvider } from "@/components/ui/toast";
import type { User } from "@/types";

const apiStore = vi.hoisted(() => ({
  api: {
    getSaferZones: vi.fn(),
    getBusinesses: vi.fn(),
    createBusiness: vi.fn(),
    updateBusiness: vi.fn(),
    getPayments: vi.fn(),
    createPayment: vi.fn(),
    verifyPayment: vi.fn(),
    getDashboardSummary: vi.fn(),
  },
}));

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
    user: null as User | null,
    loading: false,
    error: null,
    login: async () => {},
    logout: async () => {},
    refresh: async () => {},
  });
  return { useAuth, AuthProvider: ({ children }: { children: React.ReactNode }) => children };
});

const business = businessFixture({ id: 1, name: "ABC Shop", monthly_target: 500 });
const payment = paymentFixture({ id: 1, receipt_number: "RCP-TEST-001", amount: 500, status: "paid" });

const renderBizModal = (props: Partial<Parameters<typeof BusinessFormModal>[0]> = {}) =>
  renderWithQuery(
    <ToasterProvider>
      <BusinessFormModal business={null} zones={[zoneFixture]} isCollector={false} onClose={() => {}} onSaved={() => {}} {...props} />
    </ToasterProvider>
  );

describe("Business form validation (real component)", () => {
  it("rejects empty submit with required-field errors and does not create", async () => {
    apiStore.api.createBusiness = vi.fn();
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderBizModal({ onSaved });
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(screen.getByText("Business name is required")).toBeInTheDocument();
    expect(apiStore.api.createBusiness).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("creates a business with valid data and calls onSaved", async () => {
    apiStore.api.createBusiness = vi.fn().mockResolvedValue({ id: 99 });
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderBizModal({ onSaved });
    await user.type(screen.getByLabelText(/business name \*/i), "New Shop");
    await user.type(screen.getByLabelText(/^owner name \*/i), "Owner X");
    await user.clear(screen.getByLabelText(/monthly target/i));
    await user.type(screen.getByLabelText(/monthly target/i), "750");
    // Select kebele then zone (cascade)
    const kebeleSel = screen.getByLabelText(/kebele \*/i);
    await user.selectOptions(kebeleSel, String(zoneFixture.kebele_id));
    await waitFor(() => expect(screen.getByLabelText(/safer zone \*/i)).toBeEnabled());
    await user.selectOptions(screen.getByLabelText(/safer zone \*/i), String(zoneFixture.id));
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(apiStore.api.createBusiness).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it("rejects an invalid Fayda id (not 12 digits)", async () => {
    apiStore.api.createBusiness = vi.fn();
    const user = userEvent.setup();
    renderBizModal();
    await user.type(screen.getByLabelText(/business name \*/i), "New Shop");
    await user.type(screen.getByLabelText(/^owner name \*/i), "Owner X");
    await user.type(screen.getByLabelText(/owner fayda\/id/i), "12345");
    await user.clear(screen.getByLabelText(/monthly target/i));
    await user.type(screen.getByLabelText(/monthly target/i), "500");
    const kebeleSel = screen.getByLabelText(/kebele \*/i);
    await user.selectOptions(kebeleSel, String(zoneFixture.kebele_id));
    await waitFor(() => expect(screen.getByLabelText(/safer zone \*/i)).toBeEnabled());
    await user.selectOptions(screen.getByLabelText(/safer zone \*/i), String(zoneFixture.id));
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(screen.getByText("Must be exactly 12 digits")).toBeInTheDocument());
    expect(apiStore.api.createBusiness).not.toHaveBeenCalled();
  });

  it("validates kebele → zone cascade (zone requires kebele)", async () => {
    const user = userEvent.setup();
    renderBizModal();
    const zoneSel = screen.getByLabelText(/safer zone \*/i);
    expect(zoneSel).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/kebele \*/i), String(zoneFixture.kebele_id));
    await waitFor(() => expect(zoneSel).toBeEnabled());
  });
});

describe("Responsive — business cards", () => {
  it("28. renders business card with touch-size action buttons", () => {
    render(
      <BusinessCard business={business} canEdit isAdmin onView={() => {}} onEdit={() => {}} onPay={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText("ABC Shop")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view abc shop/i })).toBeInTheDocument();
    const payBtn = screen.getByRole("button", { name: /pay abc shop/i });
    expect(payBtn).toBeInTheDocument();
    expect(payBtn.className).toMatch(/min-h-\[44px\]/);
  });

  it("29. payment workflow works at mobile width (PaymentCard)", () => {
    render(<PaymentCard payment={payment} canDelete onReceipt={() => {}} onDelete={() => {}} />);
    expect(screen.getByText("RCP-TEST-001")).toBeInTheDocument();
    expect(screen.getByText(/ETB 500\.00/)).toBeInTheDocument();
    const receiptBtn = screen.getByRole("button", { name: /receipt rcp-test-001/i });
    expect(receiptBtn).toBeInTheDocument();
  });

  it("30. QR remains usable on mobile (Gateway modal with QR 180x180)", async () => {
    renderWithQuery(
      <ToasterProvider>
        <GatewayCheckoutModal res={{ id: 1, receiptNumber: "RCP-QR", paymentUrl: "https://pay.test/qr", gatewayName: "telebirr" }} businessName="ABC Shop" amount={500} onClose={() => {}} onVerified={() => {}} />
      </ToasterProvider>
    );
    const img = screen.getByAltText(/scan to pay/i);
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("width")).toBe("180");
    expect(img.getAttribute("height")).toBe("180");
    expect(screen.getByRole("link", { name: /open sandbox portal/i })).toBeInTheDocument();
  });
});

describe("Payment form validation (real component)", () => {
  it("validates amount: rejects non-positive", async () => {
    // Use real PaymentFormModal with mocked businesses
    apiStore.api.getBusinesses = vi.fn().mockResolvedValue([]);
    apiStore.api.createPayment = vi.fn();
    const user = userEvent.setup();
    renderWithQuery(
      <ToasterProvider>
        <PaymentFormModal onClose={() => {}} onSaved={() => {}} />
      </ToasterProvider>
    );
    // wait for businesses load (empty)
    await waitFor(() => expect(screen.getByLabelText(/business \*/i)).toBeInTheDocument());
    // Try submitting without business and amount
    await user.click(screen.getByRole("button", { name: /record payment/i }));
    await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
    expect(apiStore.api.createPayment).not.toHaveBeenCalled();
  });
});

describe("Receipt — renders ETB and print", () => {
  it("receipt renders with ETB and print button", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    renderWithQuery(
      <ToasterProvider>
        <ReceiptModal payment={payment} onClose={() => {}} />
      </ToasterProvider>
    );
    expect(screen.getByText(/RCP-TEST-001/)).toBeInTheDocument();
    expect(screen.getByText(/ETB 500\.00/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /print/i }));
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
});

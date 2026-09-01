// test/helpers.tsx — shared test utilities for item 35
// Boundary: mock the network layer (@/lib/api) and auth/kebele contexts so the
// Workers page logic runs against controlled data.

import * as React from "react";
import { vi } from "vitest";
import { render } from "@testing-library/react";
import { ToasterProvider } from "@/components/ui/toast";
import type { Worker, SaferZone, User, Business, Payment } from "@/types";

// NOTE: `vi.mock` declarations must live in the consuming test file (vitest hoists
// per-file and mocks don't reliably apply across helper modules for the page graph).
// This module provides fixtures + types only.

export type ApiMockFn = ReturnType<typeof vi.fn>;

// Configure a fresh API mock object. Callers assign it to their hoisted apiStore.
export function buildApiMocks(overrides: Record<string, unknown> = {}) {
  return {
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
    getPaymentReport: vi.fn(),
    ...overrides,
  };
}

// Render with a toast provider wrapper (no TanStack Query — selective refetch is used).
export function renderWithQuery(ui: React.ReactElement) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ToasterProvider>{children}</ToasterProvider>
  );
  return render(ui, { wrapper });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
export const adminUser: User = {
  id: 1,
  username: "admin",
  full_name: "Admin User",
  fayda_id: null,
  phone: null,
  role: "admin",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const collectorUser: User = {
  id: 2,
  username: "collector",
  full_name: "Kebele Admin",
  fayda_id: null,
  phone: null,
  role: "collector",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

export const leaderUser: User = {
  id: 3,
  username: "leader",
  full_name: "Zone Leader",
  fayda_id: null,
  phone: null,
  role: "leader",
  is_active: true,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  zone: { id: 10, name: "Zone 10", kebele_id: 5, leader_id: 3, description: null, created_at: "", updated_at: "" },
};

export const zoneFixture: SaferZone = {
  id: 10,
  name: "Zone 10",
  kebele_id: 5,
  leader_id: 3,
  leader_name: "Zone Leader",
  kebele_name: "K05",
  description: null,
  created_at: "",
  updated_at: "",
};

export function workerFixture(overrides: Partial<Worker> = {}): Worker {
  return {
    id: 1,
    full_name: "Abebe Bekele",
    contact: "0911000000",
    fayda_id: null,
    daily_wage: 200,
    safer_zone_id: 10,
    zone_name: "Zone 10",
    kebele_name: "K05",
    is_active: true,
    custom_attributes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function paginatedWorkers(items: Worker[]) {
  return { data: items, total: items.length, page: 1, pages: 1 };
}

export function businessFixture(overrides: Partial<Business> = {}): Business {
  return {
    id: 1,
    name: "ABC Shop",
    owner_name: "Ahmed Ali",
    owner_fayda_id: "123456789012",
    owner_phone: "0911000001",
    type: "shop",
    monthly_target: 500,
    safer_zone_id: 10,
    safer_zone_name: "Zone 10",
    kebele_name: "K05",
    kebele_id: 5,
    is_active: true,
    notes: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

export function paymentFixture(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 1,
    business_id: 1,
    business_name: "ABC Shop",
    safer_zone_name: "Zone 10",
    kebele_name: "K05",
    amount: 500,
    method: "cash",
    status: "paid",
    month: 9,
    year: 2026,
    paid_at: "2026-09-01T10:00:00Z",
    receipt_number: "RCP-TEST-001",
    notes: null,
    collected_by: 1,
    collector_name: "Admin User",
    gateway_name: null,
    gateway_ref: null,
    payment_url: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

export function paginatedBusinesses(items: Business[]) {
  return { data: items, total: items.length, page: 1, pages: 1 };
}

export function paginatedPayments(items: Payment[]) {
  return { data: items, total: items.length, page: 1, pages: 1 };
}

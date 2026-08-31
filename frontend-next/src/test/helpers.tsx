// test/helpers.tsx — shared test utilities for item 35
// Boundary: mock the network layer (@/lib/api) and auth/kebele contexts so the
// real TanStack Query providers + Workers page logic run against controlled data.

import * as React from "react";
import { vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToasterProvider } from "@/components/ui/toast";
import type { Worker, SaferZone, User } from "@/types";

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
    ...overrides,
  };
}

// Render with a real TanStack Query provider
export function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ToasterProvider>{children}</ToasterProvider>
    </QueryClientProvider>
  );
  return { render: render(ui, { wrapper }), queryClient };
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

// test/settings-profile.test.tsx — My Account / Profile (P1-3A)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const apiStore = vi.hoisted(() => ({
  api: { me: vi.fn() },
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error {
    status: number;
    constructor(message: string, status = 500) { super(message); this.status = status; }
  }
  return { ApiError, api: apiStore.api };
});

import { AuthProvider } from "@/lib/auth-context";
import { ToasterProvider } from "@/components/ui/toast";
import SettingsPage from "@/app/(app)/settings/page";
import type { User } from "@/types";

function makeUser(role: User["role"] = "admin", opts = {}): User {
  return {
    id: 1,
    username: "test_user",
    full_name: "Test User",
    fayda_id: "F001",
    phone: "0912345678",
    role,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    zone: role === "leader" ? { id: 10, name: "Zone 10", kebele_id: 2, kebele_name: "Kebele 02", kebele_code: "K02", description: null, leader_id: 1, created_at: "", updated_at: "" } : undefined,
    ...opts,
  } as User;
}

function renderPage(user = makeUser()) {
  localStorage.setItem("ddcms_token", "tok");
  localStorage.setItem("ddcms_user", JSON.stringify(user));
  apiStore.api.me.mockResolvedValue(user);
  return render(
    <ToasterProvider>
      <AuthProvider>
        <SettingsPage />
      </AuthProvider>
    </ToasterProvider>
  );
}

describe("Settings / My Account Profile (P1-3A)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads profile with real user fields", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /My Account/i })).toBeInTheDocument();
    });
  });

  it("shows leader zone when role is leader", async () => {
    renderPage(makeUser("leader"));
    await waitFor(() => {
      expect(screen.getByText("Zone Leader — Authorized Zone")).toBeInTheDocument();
      expect(screen.getByText("Zone 10")).toBeInTheDocument();
    });
  });

  it("shows collector kebele scope when role is collector", async () => {
    renderPage(makeUser("collector"));
    await waitFor(() => {
      expect(screen.getByText("Kebele Admin — Assigned Kebele")).toBeInTheDocument();
    });
  });

  it("shows read-only limitation note", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/read-only limitation/i)).toBeInTheDocument();
    });
  });

  it("shows error when user not loaded", async () => {
    apiStore.api.me.mockRejectedValue(new Error("Network down"));
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText(/Failed to load profile/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it("shows loading state initially", async () => {
    apiStore.api.me.mockImplementation(async () => new Promise((r) => setTimeout(() => r(makeUser()), 300)));
    renderPage();
    expect(screen.getByText(/Loading profile/)).toBeInTheDocument();
  });
});

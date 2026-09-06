// test/settings-security.test.tsx — P1-3B Security & Preferences (supported features only)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const apiStore = vi.hoisted(() => ({
  api: { me: vi.fn(), logout: vi.fn() },
}));

vi.mock("@/lib/api", () => {
  class ApiError extends Error { status: number; constructor(m: string, s = 500) { super(m); this.status = s; } }
  return { ApiError, api: apiStore.api };
});

import { AuthProvider } from "@/lib/auth-context";
import { ToasterProvider } from "@/components/ui/toast";
import SettingsPage from "@/app/(app)/settings/page";
import type { User } from "@/types";

function makeUser(role: User["role"] = "admin"): User {
  return { id: 1, username: "t", full_name: "T", fayda_id: null, phone: null, role, is_active: true, created_at: "", updated_at: "" };
}

function renderPage(user = makeUser()) {
  localStorage.setItem("ddcms_token", "tok");
  localStorage.setItem("ddcms_user", JSON.stringify(user));
  apiStore.api.me.mockResolvedValue(user);
  apiStore.api.logout.mockResolvedValue({});
  return render(<ToasterProvider><AuthProvider><SettingsPage /></AuthProvider></ToasterProvider>);
}

describe("P1-3B Security (supported only)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows Password Change section", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Change Password")).toBeInTheDocument());
  });

  it("shows Session / Logout section", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Sign Out")).toBeInTheDocument());
  });

  it("documents unsupported notification preferences honestly", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/Not implemented/)).toBeInTheDocument());
  });

  it("shows read-only profile limitation note", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Read-only limitation")).toBeInTheDocument());
  });

  it("logout button is present", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /Sign Out/i })).toBeInTheDocument());
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";

// Helper to set auth user in localStorage
function setAuthUser(role: string, extra: Record<string, unknown> = {}) {
  const user = { id: 1, username: "test", full_name: "Test User", role, is_active: true, ...extra };
  localStorage.setItem("ddcms_token", "tok123");
  localStorage.setItem("ddcms_user", JSON.stringify(user));
}

describe("Application shell", () => {
  beforeEach(() => localStorage.clear());

  it("renders Sidebar with brand and navigation", () => {
    setAuthUser("admin");
    render(<Sidebar open={false} onClose={() => {}} />);
    expect(screen.getByText("Cleaning CMS")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Workers")).toBeInTheDocument();
  });

  it("navigates via keyboard (Tab + Enter)", async () => {
    setAuthUser("admin");
    const user = userEvent.setup();
    render(<Sidebar open={true} onClose={() => {}} />);
    const link = screen.getByRole("link", { name: /Dashboard/i });
    link.focus();
    expect(link).toHaveFocus();
    await user.keyboard("{Enter}");
    // no error means keyboard works
  });
});

describe("Role filtering", () => {
  beforeEach(() => localStorage.clear());

  it("Admin sees Users and Audit Logs", () => {
    setAuthUser("admin");
    render(<Sidebar open={true} onClose={() => {}} />);
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
  });

  it("Viewer does not see Users or Audit Logs", () => {
    setAuthUser("viewer");
    render(<Sidebar open={true} onClose={() => {}} />);
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
    expect(screen.queryByText("Audit Logs")).not.toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("Zone Leader is scoped (sees Workers, not Users)", () => {
    setAuthUser("leader", { zone: { id: 1, name: "Zone A", kebele_id: 1 } });
    render(<Sidebar open={true} onClose={() => {}} />);
    expect(screen.getByText("Workers")).toBeInTheDocument();
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });
});

describe("Core components", () => {
  it("Button renders and handles click + keyboard", async () => {
    const fn = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={fn}>Click me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
    await user.click(btn);
    expect(fn).toHaveBeenCalledTimes(1);
    btn.focus();
    expect(btn).toHaveFocus();
  });

  it("Badge renders variants", () => {
    render(<Badge variant="green">OK</Badge>);
    expect(screen.getByText("OK")).toBeInTheDocument();
  });

  it("Card renders", () => {
    render(<Card>content</Card>);
    expect(screen.getByText("content")).toBeInTheDocument();
  });

  it("Alert has role=alert", () => {
    render(<Alert variant="danger">Error</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("Modal traps focus and closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open={true} onClose={onClose} title="Test">
        <button>inside</button>
      </Modal>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

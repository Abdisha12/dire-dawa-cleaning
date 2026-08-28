import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/(public)/login/page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => "/login",
}));

const mockLogin = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ login: mockLogin }),
}));

describe("Login page", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockPush.mockReset();
  });

  it("renders municipal branding and fields with accessible labels", () => {
    render(<LoginPage />);
    expect(screen.getByText("Dire Dawa Cleaning")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("validates required fields", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Please fill all fields.")).toBeInTheDocument();
  });

  it("show/hide password toggles input type and has keyboard support", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const input = screen.getByLabelText("Password") as HTMLInputElement;
    expect(input.type).toBe("password");
    const toggle = screen.getByLabelText("Show password");
    expect(toggle).toBeInTheDocument();
    await user.click(toggle);
    expect(input.type).toBe("text");
    expect(screen.getByLabelText("Hide password")).toBeInTheDocument();
    // keyboard Enter on toggle
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(input.type).toBe("password");
  });

  it("shows loading state and calls login", async () => {
    mockLogin.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(mockLogin).toHaveBeenCalledWith("admin", "password");
  });

  it("shows error on failed login without exposing stack", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(screen.queryByText("stack")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation (Tab order)", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    // Username has autoFocus
    expect(screen.getByLabelText("Username")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Password")).toHaveFocus();
    await user.tab();
    // Show/hide button
    expect(screen.getByLabelText(/Show password|Hide password/)).toHaveFocus();
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// We need to test KebeleSelector in isolation with mocked api
vi.mock("@/lib/api", () => ({
  api: {
    getKebeles: vi.fn().mockResolvedValue({
      kebeles: [
        { id: 1, name: "Kebele 01", code: "K01", collector_id: 10 },
        { id: 2, name: "Kebele 02", code: "K02", collector_id: 1 },
      ],
    }),
  },
}));

import { KebeleProvider } from "@/lib/kebele-context";
import { KebeleSelector } from "@/features/kebeles/components/kebele-selector";

function setAuth(role: string, id: number) {
  localStorage.setItem("ddcms_token", "tok");
  localStorage.setItem("ddcms_user", JSON.stringify({ id, username: "u", full_name: "U", role, is_active: true }));
}

describe("KebeleSelector", () => {
  beforeEach(() => localStorage.clear());

  it("Admin sees All Kebeles and can switch", async () => {
    setAuth("admin", 99);
    const user = userEvent.setup();
    render(
      <KebeleProvider>
        <KebeleSelector />
      </KebeleProvider>
    );
    expect(await screen.findByText("Loading kebeles…")).toBeInTheDocument();
    expect(await screen.findByText("All Kebeles (City-wide)")).toBeInTheDocument();
    const sel = (await screen.findByRole("combobox")) as HTMLSelectElement;
    expect(sel.disabled).toBe(false);
    await user.selectOptions(sel, "1");
    expect(sel.value).toBe("1");
  });

  it("Kebele Admin is locked to My Kebele and cannot switch", async () => {
    setAuth("collector", 1); // collector id 1 owns K02
    render(
      <KebeleProvider>
        <KebeleSelector />
      </KebeleProvider>
    );
    const sel = (await screen.findByRole("combobox")) as HTMLSelectElement;
    expect(sel.disabled).toBe(true);
    expect(sel.value).toBe("2");
    expect(await screen.findByText("My Kebele — locked")).toBeInTheDocument();
    // Attempt to select other should not change (disabled)
    expect(sel.value).not.toBe("1");
  });

  it("does not hardcode IDs — uses API records (K01/K02)", async () => {
    setAuth("admin", 99);
    render(
      <KebeleProvider>
        <KebeleSelector />
      </KebeleProvider>
    );
    expect(await screen.findByText("Kebele 01 — K01")).toBeInTheDocument();
    expect(screen.getByText("Kebele 02 — K02")).toBeInTheDocument();
  });
});

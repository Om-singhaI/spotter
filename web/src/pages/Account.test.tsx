import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Account from "./Account";
import { apiGet, apiPatch } from "../lib/api";
import { loadPlateSettings } from "../lib/plateSettings";

vi.mock("../lib/api", () => ({ apiGet: vi.fn(), apiPatch: vi.fn() }));
vi.mock("../auth/AuthProvider", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(apiPatch).mockReset();
  vi.mocked(apiGet).mockResolvedValue({
    id: "alice",
    display_name: "Alice",
    weight_unit: "lb",
    share_numbers: false,
    email: "alice@example.com",
  });
});

describe("Account plate settings", () => {
  it("lets users select 55 lb plates and saves that choice", async () => {
    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>,
    );

    const plate = await screen.findByRole("checkbox", { name: "55 lb" });
    expect(plate).not.toBeChecked();
    fireEvent.click(plate);
    expect(plate).toBeChecked();
    await waitFor(() => expect(loadPlateSettings("alice", "lb").availablePlates).toContain(55));
  });

  it("persists custom bar weight and can reset to defaults", async () => {
    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>,
    );

    const bar = await screen.findByRole("spinbutton", { name: "Bar weight (lb)" });
    fireEvent.change(bar, { target: { value: "35" } });
    await waitFor(() => expect(loadPlateSettings("alice", "lb").barWeight).toBe(35));
    fireEvent.click(screen.getByRole("button", { name: "Reset defaults" }));
    await waitFor(() => expect(loadPlateSettings("alice", "lb").barWeight).toBe(45));
  });
});

describe("Account weight units", () => {
  it("switches to kg and shows the corresponding plate settings", async () => {
    vi.mocked(apiPatch).mockResolvedValue({
      id: "alice",
      display_name: "Alice",
      weight_unit: "kg",
      share_numbers: false,
      email: "alice@example.com",
    });

    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>,
    );

    const units = await screen.findByRole("combobox", { name: "Weight units" });
    fireEvent.change(units, { target: { value: "kg" } });

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith("/me", { weight_unit: "kg" });
      expect(screen.getByRole("spinbutton", { name: "Bar weight (kg)" })).toHaveValue(20);
    });
    expect(screen.getByRole("checkbox", { name: "25 kg" })).toBeChecked();
  });

  it("keeps the previous unit and reports an error when saving fails", async () => {
    vi.mocked(apiPatch).mockRejectedValue(new Error("network offline"));
    render(
      <MemoryRouter>
        <Account />
      </MemoryRouter>,
    );
    const units = await screen.findByRole("combobox", { name: "Weight units" });
    fireEvent.change(units, { target: { value: "kg" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update units");
    expect(units).toHaveValue("lb");
    expect(screen.getByRole("spinbutton", { name: "Bar weight (lb)" })).toHaveValue(45);
  });
});

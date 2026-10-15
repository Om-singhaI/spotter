import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { AuthProvider } from "./AuthProvider";
import { fake, fakeSession, state } from "../test/fakeSupabase";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

function mockApi(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body)))),
  );
}

describe("auth", () => {
  it("sends a logged out visitor from the account page to login", async () => {
    mockApi({ ok: true });
    renderAt("/account");
    expect(await screen.findByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("logs in and lands on the account page with the profile", async () => {
    mockApi({
      id: "x",
      display_name: "Ana",
      weight_unit: "lb",
      share_numbers: false,
      email: "ana@example.com",
    });
    renderAt("/login");
    await screen.findByRole("heading", { name: "Log in" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "correct horse",
    });
    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    // the profile request carried the session token
    const [, init] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect((init as RequestInit).headers).toEqual({ Authorization: "Bearer fake-access-token" });
  });

  it("shows the login error from Supabase", async () => {
    fake.auth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    } as never);
    renderAt("/login");
    await screen.findByRole("heading", { name: "Log in" });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
  });

  it("signs up with a display name", async () => {
    mockApi({
      id: "x",
      display_name: "Ben",
      weight_unit: "lb",
      share_numbers: false,
      email: "ben@example.com",
    });
    renderAt("/signup");
    await screen.findByRole("heading", { name: "Create an account" });
    fireEvent.change(screen.getByLabelText("What should we call you?"), {
      target: { value: "Ben" },
    });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ben@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "long enough" } });
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(fake.auth.signUp).toHaveBeenCalledWith({
      email: "ben@example.com",
      password: "long enough",
      options: { data: { display_name: "Ben" }, emailRedirectTo: "http://localhost:3000/login" },
    });
    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
  });

  it("skips the login form when already signed in", async () => {
    state.session = fakeSession();
    mockApi({
      id: "x",
      display_name: "Ana",
      weight_unit: "lb",
      share_numbers: false,
      email: "ana@example.com",
    });
    renderAt("/login");
    expect(await screen.findByRole("heading", { name: "Your account" })).toBeInTheDocument();
  });

  it("logs out and goes home", async () => {
    state.session = fakeSession();
    mockApi({
      id: "x",
      display_name: "Ana",
      weight_unit: "lb",
      share_numbers: false,
      email: "ana@example.com",
    });
    renderAt("/account");
    await screen.findByText("Ana");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(fake.auth.signOut).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Spotter" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: "Log in" })).toBeInTheDocument();
  });
});

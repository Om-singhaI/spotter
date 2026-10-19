import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

vi.mock("./repo.js", () => ({
  ensureProfile: vi.fn(async (id: string, fallbackName: string) => ({
    id,
    display_name: fallbackName,
    weight_unit: "lb",
    share_numbers: false,
  })),
}));

import { app } from "../app.js";
import { ensureProfile } from "./repo.js";

const secret = new TextEncoder().encode("test-secret-that-is-at-least-32-characters-long");
const USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function token(claims: Record<string, unknown>) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(secret);
}

describe("GET /me", () => {
  beforeEach(() => {
    vi.mocked(ensureProfile).mockClear();
    vi.unstubAllGlobals();
  });

  it("needs a token", async () => {
    const res = await request(app).get("/me");
    expect(res.status).toBe(401);
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it("rejects a token it cannot verify", async () => {
    const res = await request(app).get("/me").set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
  });

  it("answers 503, not 401, when the signing keys cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const { privateKey } = await generateKeyPair("ES256");
    const t = await new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setSubject(USER_ID)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(privateKey);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(app).get("/me").set("Authorization", `Bearer ${t}`);
    spy.mockRestore();
    expect(res.status).toBe(503);
    expect(ensureProfile).not.toHaveBeenCalled();
  });

  it("creates the profile from the display name and returns it with the email", async () => {
    const t = await token({ email: "ben@example.com", user_metadata: { display_name: "Ben" } });
    const res = await request(app).get("/me").set("Authorization", `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(ensureProfile).toHaveBeenCalledWith(USER_ID, "Ben");
    expect(res.body).toMatchObject({ id: USER_ID, display_name: "Ben", email: "ben@example.com" });
  });

  it("falls back to the email name when the display name is missing or blank", async () => {
    await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${await token({ email: "jo.smith@example.com" })}`);
    expect(ensureProfile).toHaveBeenLastCalledWith(USER_ID, "jo.smith");
    await request(app)
      .get("/me")
      .set(
        "Authorization",
        `Bearer ${await token({ email: "jo.smith@example.com", user_metadata: { display_name: "   " } })}`,
      );
    expect(ensureProfile).toHaveBeenLastCalledWith(USER_ID, "jo.smith");
  });

  it("keeps a long name to forty characters without splitting an emoji", async () => {
    const name = "\u{1F4AA}".repeat(45);
    await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${await token({ user_metadata: { display_name: name } })}`);
    expect(ensureProfile).toHaveBeenLastCalledWith(USER_ID, "\u{1F4AA}".repeat(40));
  });
  void exportJWK;
});

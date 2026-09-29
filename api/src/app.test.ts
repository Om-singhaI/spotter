import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "./app.js";

describe("GET /health", () => {
  it("answers ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("unknown routes", () => {
  it("return 404", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
  });
});

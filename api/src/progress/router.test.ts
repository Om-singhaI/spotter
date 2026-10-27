import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";

vi.mock("./repo.js", () => ({
  exercisesWithHistory: vi.fn(async () => []),
  exerciseProgress: vi.fn(async () => []),
}));

import { app } from "../app.js";
import * as repo from "./repo.js";

const secret = new TextEncoder().encode("test-secret-that-is-at-least-32-characters-long");
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let auth = "";

beforeEach(async () => {
  vi.clearAllMocks();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(secret);
  auth = `Bearer ${token}`;
});

describe("progress", () => {
  it("needs a login", async () => {
    expect((await request(app).get("/progress")).status).toBe(401);
    expect((await request(app).get("/exercises/Barbell_Squat/progress")).status).toBe(401);
  });

  it("lists the exercises the user has history for", async () => {
    vi.mocked(repo.exercisesWithHistory).mockResolvedValueOnce([
      {
        id: "Barbell_Squat",
        name: "Barbell Squat",
        sessions: 4,
        last_performed_at: new Date("2026-10-22T10:00:00Z"),
      },
    ]);
    const res = await request(app).get("/progress").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(repo.exercisesWithHistory).toHaveBeenCalledWith(USER_ID);
    expect(res.body.exercises[0]).toMatchObject({ id: "Barbell_Squat", sessions: 4 });
  });

  it("returns the points for one exercise", async () => {
    vi.mocked(repo.exerciseProgress).mockResolvedValueOnce([
      {
        workout_id: "11111111-1111-4111-8111-111111111111",
        started_at: new Date("2026-10-01T10:00:00Z"),
        best_e1rm_kg: 77.564,
        top_weight_kg: 61.235,
        volume_kg: 1469.64,
        sets: 3,
        in_progress: false,
      },
    ]);
    const res = await request(app)
      .get("/exercises/Barbell_Squat/progress")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(repo.exerciseProgress).toHaveBeenCalledWith(USER_ID, "Barbell_Squat");
    expect(res.body.points[0].best_e1rm_kg).toBe(77.564);
  });
});

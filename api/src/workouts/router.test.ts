import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";

vi.mock("./repo.js", () => ({
  openWorkout: vi.fn(),
  startWorkout: vi.fn(),
  finishWorkout: vi.fn(),
  discardIfEmpty: vi.fn(async () => false),
  workoutSets: vi.fn(async () => []),
  canLogExercise: vi.fn(async () => true),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  ghostRow: vi.fn(async () => []),
}));

vi.mock("../me/repo.js", () => ({
  ensureProfile: vi.fn(async (id: string, name: string) => ({
    id,
    display_name: name,
    weight_unit: "lb",
    share_numbers: false,
  })),
}));

import { app } from "../app.js";
import { ensureProfile } from "../me/repo.js";
import * as repo from "./repo.js";

const secret = new TextEncoder().encode("test-secret-that-is-at-least-32-characters-long");
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKOUT_ID = "11111111-1111-4111-8111-111111111111";
const open = { id: WORKOUT_ID, started_at: new Date("2026-10-19T10:00:00Z"), finished_at: null };

let auth = "";
beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(repo.workoutSets).mockResolvedValue([]);
  vi.mocked(repo.canLogExercise).mockResolvedValue(true);
  vi.mocked(repo.ghostRow).mockResolvedValue([]);
  vi.mocked(repo.discardIfEmpty).mockResolvedValue(false);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(secret);
  auth = `Bearer ${token}`;
});

describe("workouts", () => {
  it("every route needs a login", async () => {
    expect((await request(app).get("/workouts/current")).status).toBe(401);
    expect((await request(app).post("/workouts")).status).toBe(401);
  });

  it("reports no open workout", async () => {
    vi.mocked(repo.openWorkout).mockResolvedValue(null);
    const res = await request(app).get("/workouts/current").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ workout: null, sets: [] });
  });

  it("starts a workout, and returns the open one instead of starting another", async () => {
    vi.mocked(repo.openWorkout).mockResolvedValueOnce(null).mockResolvedValueOnce(open);
    vi.mocked(repo.startWorkout).mockResolvedValue(open);
    const first = await request(app).post("/workouts").set("Authorization", auth);
    expect(first.status).toBe(201);
    expect(repo.startWorkout).toHaveBeenCalledWith(USER_ID);
    const second = await request(app).post("/workouts").set("Authorization", auth);
    expect(second.status).toBe(200);
    expect(repo.startWorkout).toHaveBeenCalledTimes(1);
    expect(second.body.workout.id).toBe(WORKOUT_ID);
    expect(ensureProfile).toHaveBeenCalledWith(USER_ID, expect.any(String));
  });

  it("hands back the winner when two starts race", async () => {
    vi.mocked(repo.openWorkout).mockResolvedValueOnce(null).mockResolvedValueOnce(open);
    vi.mocked(repo.startWorkout).mockResolvedValue(null);
    const res = await request(app).post("/workouts").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.workout.id).toBe(WORKOUT_ID);
  });

  it("discards an empty workout instead of finishing it", async () => {
    vi.mocked(repo.discardIfEmpty).mockResolvedValueOnce(true);
    const res = await request(app)
      .post(`/workouts/${WORKOUT_ID}/finish`)
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ workout: null, discarded: true });
    expect(repo.finishWorkout).not.toHaveBeenCalled();
  });

  it("finishes the open workout and 404s otherwise", async () => {
    vi.mocked(repo.finishWorkout).mockResolvedValueOnce({ ...open, finished_at: new Date() });
    const ok = await request(app).post(`/workouts/${WORKOUT_ID}/finish`).set("Authorization", auth);
    expect(ok.status).toBe(200);
    expect(repo.finishWorkout).toHaveBeenCalledWith(USER_ID, WORKOUT_ID);
    vi.mocked(repo.finishWorkout).mockResolvedValueOnce(null);
    const gone = await request(app)
      .post(`/workouts/${WORKOUT_ID}/finish`)
      .set("Authorization", auth);
    expect(gone.status).toBe(404);
    const bad = await request(app).post("/workouts/not-a-uuid/finish").set("Authorization", auth);
    expect(bad.status).toBe(400);
  });
});

describe("sets", () => {
  const set = { exercise_id: "Barbell_Squat", weight: 135, unit: "lb", reps: 8 };

  it("stores a set in kilograms on the open workout", async () => {
    vi.mocked(repo.openWorkout).mockResolvedValue(open);
    vi.mocked(repo.addSet).mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      exercise_id: "Barbell_Squat",
      exercise_name: "Barbell Squat",
      weight_kg: 61.235,
      reps: 8,
      rpe: null,
      is_warmup: false,
      performed_at: new Date(),
    });
    const res = await request(app)
      .post(`/workouts/${WORKOUT_ID}/sets`)
      .set("Authorization", auth)
      .send(set);
    expect(res.status).toBe(201);
    expect(repo.addSet).toHaveBeenCalledWith(USER_ID, WORKOUT_ID, {
      exerciseId: "Barbell_Squat",
      weightKg: 61.235,
      reps: 8,
      isWarmup: false,
    });
    expect(res.body.set.exercise_name).toBe("Barbell Squat");
  });

  it("refuses a set on a workout that is not the open one", async () => {
    vi.mocked(repo.openWorkout).mockResolvedValue(null);
    const res = await request(app)
      .post(`/workouts/${WORKOUT_ID}/sets`)
      .set("Authorization", auth)
      .send(set);
    expect(res.status).toBe(404);
    expect(repo.addSet).not.toHaveBeenCalled();
  });

  it("refuses an exercise the user cannot log", async () => {
    vi.mocked(repo.openWorkout).mockResolvedValue(open);
    vi.mocked(repo.canLogExercise).mockResolvedValue(false);
    const res = await request(app)
      .post(`/workouts/${WORKOUT_ID}/sets`)
      .set("Authorization", auth)
      .send(set);
    expect(res.status).toBe(400);
  });

  it("validates the body", async () => {
    vi.mocked(repo.openWorkout).mockResolvedValue(open);
    for (const bad of [
      { ...set, reps: 0 },
      { ...set, weight: -1 },
      { ...set, unit: "stone" },
      { ...set, exercise_id: "" },
    ]) {
      const res = await request(app)
        .post(`/workouts/${WORKOUT_ID}/sets`)
        .set("Authorization", auth)
        .send(bad);
      expect(res.status).toBe(400);
    }
    expect(repo.addSet).not.toHaveBeenCalled();
  });

  it("deletes only the owner's set", async () => {
    vi.mocked(repo.deleteSet).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const id = "22222222-2222-4222-8222-222222222222";
    expect((await request(app).delete(`/sets/${id}`).set("Authorization", auth)).status).toBe(204);
    expect(repo.deleteSet).toHaveBeenCalledWith(USER_ID, id);
    expect((await request(app).delete(`/sets/${id}`).set("Authorization", auth)).status).toBe(404);
  });
});

describe("ghost row", () => {
  it("asks for the previous session, excluding the open workout when given", async () => {
    const res = await request(app)
      .get(`/exercises/Barbell_Squat/ghost?workout=${WORKOUT_ID}`)
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(repo.ghostRow).toHaveBeenCalledWith(USER_ID, "Barbell_Squat", WORKOUT_ID);
    await request(app).get("/exercises/Barbell_Squat/ghost").set("Authorization", auth);
    expect(repo.ghostRow).toHaveBeenLastCalledWith(USER_ID, "Barbell_Squat", null);
  });
});

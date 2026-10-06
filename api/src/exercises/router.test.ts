import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("./repo.js", () => ({
  searchExercises: vi.fn(async (q: string, limit: number) => [
    {
      id: "Barbell_Bench_Press_-_Medium_Grip",
      name: `result for ${q} with limit ${limit}`,
      category: "strength",
      equipment: "barbell",
      primary_muscles: ["chest"],
      secondary_muscles: ["triceps"],
      images: ["Barbell_Bench_Press_-_Medium_Grip/0.jpg"],
    },
  ]),
}));

import { app } from "../app.js";
import { searchExercises } from "./repo.js";

describe("GET /exercises", () => {
  beforeEach(() => {
    vi.mocked(searchExercises).mockClear();
  });

  it("passes the search term and a default limit through", async () => {
    const res = await request(app).get("/exercises?q=bench");
    expect(res.status).toBe(200);
    expect(searchExercises).toHaveBeenCalledWith("bench", 20);
    expect(res.body.exercises[0].name).toBe("result for bench with limit 20");
  });

  it("defaults to an empty term", async () => {
    const res = await request(app).get("/exercises");
    expect(res.status).toBe(200);
    expect(searchExercises).toHaveBeenCalledWith("", 20);
  });

  it("rejects a limit outside 1 to 50", async () => {
    expect((await request(app).get("/exercises?limit=0")).status).toBe(400);
    expect((await request(app).get("/exercises?limit=51")).status).toBe(400);
    expect(searchExercises).not.toHaveBeenCalled();
  });

  it("rejects a term longer than 60 characters", async () => {
    const res = await request(app).get("/exercises?q=" + "x".repeat(61));
    expect(res.status).toBe(400);
  });
});

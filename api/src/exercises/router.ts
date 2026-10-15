import { Router } from "express";
import { z } from "zod";
import { searchExercises } from "./repo.js";

const querySchema = z.object({
  q: z.string().trim().max(60).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const exercisesRouter = Router();

exercisesRouter.get("/exercises", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad query", issues: parsed.error.issues });
    return;
  }
  const exercises = await searchExercises(parsed.data.q, parsed.data.limit);
  res.json({ exercises });
});

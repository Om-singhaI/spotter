import { Router } from "express";
import { z } from "zod";
import { currentUser, requireUser } from "../auth/middleware.js";
import { nameFor } from "../me/name.js";
import { ensureProfile } from "../me/repo.js";
import { toKg } from "../units.js";
import * as repo from "./repo.js";

export const workoutsRouter = Router();

const idParam = z.object({ id: z.uuid() });

const newSet = z.object({
  exercise_id: z.string().min(1).max(120),
  weight: z.number().min(0).max(2000),
  unit: z.enum(["kg", "lb"]),
  reps: z.number().int().min(1).max(1000),
  is_warmup: z.boolean().default(false),
});

async function currentWithSets(userId: string) {
  const workout = await repo.openWorkout(userId);
  if (!workout) return { workout: null, sets: [] };
  return { workout, sets: await repo.workoutSets(userId, workout.id) };
}

workoutsRouter.get("/workouts/current", requireUser, async (_req, res) => {
  res.json(await currentWithSets(currentUser(res).id));
});

// Starting twice is harmless: the open workout is returned instead of a second one.
workoutsRouter.post("/workouts", requireUser, async (_req, res) => {
  const user = currentUser(res);
  const open = await repo.openWorkout(user.id);
  if (open) {
    res.json({ workout: open, sets: await repo.workoutSets(user.id, open.id) });
    return;
  }
  // workouts.user_id points at profiles, which only exists once /me has been called
  await ensureProfile(user.id, nameFor(user));
  const started = await repo.startWorkout(user.id);
  if (started) {
    res.status(201).json({ workout: started, sets: [] });
    return;
  }
  // lost a race with another request from the same user; hand back the winner
  const winner = await repo.openWorkout(user.id);
  res.json({ workout: winner, sets: winner ? await repo.workoutSets(user.id, winner.id) : [] });
});

workoutsRouter.post("/workouts/:id/finish", requireUser, async (req, res) => {
  const params = idParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "bad workout id" });
    return;
  }
  const user = currentUser(res);
  if (await repo.discardIfEmpty(user.id, params.data.id)) {
    res.json({ workout: null, discarded: true });
    return;
  }
  const workout = await repo.finishWorkout(user.id, params.data.id);
  if (!workout) {
    res.status(404).json({ error: "no open workout with that id" });
    return;
  }
  res.json({ workout, discarded: false });
});

workoutsRouter.post("/workouts/:id/sets", requireUser, async (req, res) => {
  const user = currentUser(res);
  const params = idParam.safeParse(req.params);
  const body = newSet.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "bad set", issues: body.success ? [] : body.error.issues });
    return;
  }
  const open = await repo.openWorkout(user.id);
  if (!open || open.id !== params.data.id) {
    res.status(404).json({ error: "that workout is not open" });
    return;
  }
  if (!(await repo.canLogExercise(user.id, body.data.exercise_id))) {
    res.status(400).json({ error: "unknown exercise" });
    return;
  }
  const set = await repo.addSet(user.id, open.id, {
    exerciseId: body.data.exercise_id,
    weightKg: toKg(body.data.weight, body.data.unit),
    reps: body.data.reps,
    isWarmup: body.data.is_warmup,
  });
  res.status(201).json({ set });
});

workoutsRouter.delete("/sets/:id", requireUser, async (req, res) => {
  const params = idParam.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "bad set id" });
    return;
  }
  const gone = await repo.deleteSet(currentUser(res).id, params.data.id);
  res.status(gone ? 204 : 404).end();
});

const ghostQuery = z.object({ workout: z.uuid().optional() });

workoutsRouter.get("/exercises/:id/ghost", requireUser, async (req, res) => {
  const query = ghostQuery.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "bad workout id" });
    return;
  }
  const sets = await repo.ghostRow(
    currentUser(res).id,
    String(req.params.id),
    query.data.workout ?? null,
  );
  res.json({ sets });
});

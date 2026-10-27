import { Router } from "express";
import { currentUser, requireUser } from "../auth/middleware.js";
import * as repo from "./repo.js";

export const progressRouter = Router();

progressRouter.get("/progress", requireUser, async (_req, res) => {
  res.json({ exercises: await repo.exercisesWithHistory(currentUser(res).id) });
});

progressRouter.get("/exercises/:id/progress", requireUser, async (req, res) => {
  res.json({ points: await repo.exerciseProgress(currentUser(res).id, String(req.params.id)) });
});

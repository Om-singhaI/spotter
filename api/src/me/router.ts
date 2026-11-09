import { Router } from "express";
import { z } from "zod";
import { currentUser, requireUser } from "../auth/middleware.js";
import { nameFor } from "./name.js";
import { ensureProfile, updateWeightUnit } from "./repo.js";

export const meRouter = Router();

meRouter.get("/me", requireUser, async (_req, res) => {
  const user = currentUser(res);
  const profile = await ensureProfile(user.id, nameFor(user));
  res.json({ ...profile, email: user.email });
});

const updateUnitsBody = z.object({ weight_unit: z.enum(["lb", "kg"]) }).strict();

meRouter.patch("/me", requireUser, async (req, res) => {
  const body = updateUnitsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "bad weight unit" });
    return;
  }
  const user = currentUser(res);
  await ensureProfile(user.id, nameFor(user));
  const profile = await updateWeightUnit(user.id, body.data.weight_unit);
  res.json({ ...profile, email: user.email });
});

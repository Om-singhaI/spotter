import { Router } from "express";
import { currentUser, requireUser } from "../auth/middleware.js";
import { nameFor } from "./name.js";
import { ensureProfile } from "./repo.js";

export const meRouter = Router();

meRouter.get("/me", requireUser, async (_req, res) => {
  const user = currentUser(res);
  const profile = await ensureProfile(user.id, nameFor(user));
  res.json({ ...profile, email: user.email });
});

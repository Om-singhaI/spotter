import { Router } from "express";
import { currentUser, requireUser } from "../auth/middleware.js";
import { ensureProfile } from "./repo.js";

export const meRouter = Router();

// First choice is the display name from sign up, then the part of the email before @.
// The profiles check allows 1 to 40 characters, counted as characters, not UTF 16 units.
function nameFor(user: { displayName: string | null; email: string | null }): string {
  const raw = user.displayName?.trim() || user.email?.split("@")[0]?.trim() || "lifter";
  return Array.from(raw).slice(0, 40).join("") || "lifter";
}

meRouter.get("/me", requireUser, async (_req, res) => {
  const user = currentUser(res);
  const profile = await ensureProfile(user.id, nameFor(user));
  res.json({ ...profile, email: user.email });
});

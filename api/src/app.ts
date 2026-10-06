import express from "express";
import type { NextFunction, Request, Response } from "express";
import { exercisesRouter } from "./exercises/router.js";

// The app is separate from the server so tests can import it without opening a port.
export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(exercisesRouter);

// Express 5 hands rejected promises from route handlers to this.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "server error" });
});

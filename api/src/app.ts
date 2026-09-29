import express from "express";

// The app is separate from the server so tests can import it without opening a port.
export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

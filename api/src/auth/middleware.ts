import type { NextFunction, Request, Response } from "express";
import { errors } from "jose";
import { verifyAccessToken, type AuthUser } from "./verify.js";

// Errors that mean the token itself is bad. Anything else (JWKS unreachable, wrong
// SUPABASE_URL, timeouts) is our problem, not the user's, and must not read as "logged out".
const tokenErrors = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWSSignatureVerificationFailed,
  errors.JWSInvalid,
  errors.JWTInvalid,
  errors.JWKSNoMatchingKey,
  errors.JOSENotSupported,
  errors.JOSEAlgNotAllowed,
];

// Put on any route that needs a signed in user. Reads "Authorization: Bearer <token>".
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) {
    res.status(401).json({ error: "log in first" });
    return;
  }
  try {
    res.locals.user = await verifyAccessToken(token);
  } catch (err) {
    if (tokenErrors.some((E) => err instanceof E)) {
      res.status(401).json({ error: "your session is not valid, log in again" });
    } else {
      console.error("could not verify a token:", err);
      res.status(503).json({ error: "could not check your session, try again in a moment" });
    }
    return;
  }
  next();
}

export function currentUser(res: Response): AuthUser {
  return res.locals.user as AuthUser;
}

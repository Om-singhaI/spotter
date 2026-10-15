import { createRemoteJWKSet, decodeProtectedHeader, errors, jwtVerify } from "jose";
import { env } from "../env.js";

export type AuthUser = {
  id: string;
  email: string | null;
  displayName: string | null;
};

const jwks = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", env.SUPABASE_URL), {
  // keep the last good keys for an hour so a short Supabase blip does not log everyone out
  cacheMaxAge: 60 * 60 * 1000,
});
const secret = env.SUPABASE_JWT_SECRET ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET) : null;
const audience = "authenticated";

// Supabase access tokens are either HS256 (legacy shared secret) or signed with a key
// published at the project's JWKS endpoint. Each path only accepts its own algorithms, so
// a token cannot pick a weaker check by changing its header.
export async function verifyAccessToken(token: string): Promise<AuthUser> {
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw new errors.JWSInvalid("malformed token");
  }
  let payload;
  if (alg === "HS256") {
    if (!secret) throw new errors.JOSEAlgNotAllowed("HS256 tokens are not accepted here");
    payload = (await jwtVerify(token, secret, { audience, algorithms: ["HS256"] })).payload;
  } else {
    payload = (await jwtVerify(token, jwks, { audience, algorithms: ["ES256", "RS256"] })).payload;
  }
  if (!payload.sub) throw new errors.JWTInvalid("token has no subject");
  const meta = (payload.user_metadata ?? {}) as { display_name?: unknown };
  return {
    id: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null,
    displayName: typeof meta.display_name === "string" ? meta.display_name : null,
  };
}

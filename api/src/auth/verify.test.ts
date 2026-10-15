import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { verifyAccessToken } from "./verify.js";

const secret = new TextEncoder().encode("test-secret-that-is-at-least-32-characters-long");
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function hsToken(claims: Record<string, unknown>, key = secret, expires = "1h") {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(USER_ID)
    .setAudience("authenticated")
    .setExpirationTime(expires)
    .sign(key);
}

describe("verifyAccessToken with the shared secret", () => {
  it("returns the user from a valid token", async () => {
    const user = await verifyAccessToken(
      await hsToken({ email: "ana@example.com", user_metadata: { display_name: "Ana" } }),
    );
    expect(user).toEqual({ id: USER_ID, email: "ana@example.com", displayName: "Ana" });
  });

  it("leaves email and display name null when the token has none", async () => {
    expect(await verifyAccessToken(await hsToken({}))).toEqual({
      id: USER_ID,
      email: null,
      displayName: null,
    });
  });

  it("rejects a token signed with another secret", async () => {
    const other = new TextEncoder().encode("another-secret-that-is-also-32-characters-long");
    await expect(verifyAccessToken(await hsToken({}, other))).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    await expect(verifyAccessToken(await hsToken({}, secret, "-1m"))).rejects.toThrow(/exp/);
  });

  it("rejects a token for a different audience", async () => {
    const t = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(USER_ID)
      .setAudience("anon")
      .setExpirationTime("1h")
      .sign(secret);
    await expect(verifyAccessToken(t)).rejects.toThrow(/aud/);
  });

  it("rejects garbage", async () => {
    await expect(verifyAccessToken("not.a.token")).rejects.toThrow();
  });
});

// The local Supabase stack and hosted projects on signing keys use this path. The JWKS
// endpoint is served by a stubbed fetch so no network is involved.
describe("verifyAccessToken with the project's signing keys", () => {
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;

  beforeAll(async () => {
    const pair = await generateKeyPair("ES256");
    privateKey = pair.privateKey;
    otherKey = (await generateKeyPair("ES256")).privateKey;
    const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "ES256", use: "sig" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ keys: [jwk] })),
    );
  });

  afterEach(() => vi.unstubAllGlobals);

  function esToken(key: CryptoKey) {
    return new SignJWT({ email: "ben@example.com" })
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setSubject(USER_ID)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(key);
  }

  it("accepts a token signed with the published key", async () => {
    const user = await verifyAccessToken(await esToken(privateKey));
    expect(user).toEqual({ id: USER_ID, email: "ben@example.com", displayName: null });
  });

  it("rejects a token signed with some other key", async () => {
    await expect(verifyAccessToken(await esToken(otherKey))).rejects.toThrow();
  });
});

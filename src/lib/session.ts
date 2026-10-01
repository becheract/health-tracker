import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "ht_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;
const ISSUER = "health-tracker";
// A short secret could be guessed offline from any session cookie.
const MIN_SECRET_LENGTH = 32;

function key() {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) throw new Error(`SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  return new TextEncoder().encode(secret);
}

export async function createSession(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key());
}

export async function readSession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token) return null;
  try {
    // Only HS256 is accepted, so a token can't pick a weaker algorithm (or "none").
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer: ISSUER, audience: ISSUER });
    return typeof payload.email === "string" ? { email: payload.email } : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_S,
};

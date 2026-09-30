import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "ht_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

function key() {
  return new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
}

export async function createSession(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key());
}

export async function readSession(token: string | undefined): Promise<{ email: string } | null> {
  if (!token || !process.env.SESSION_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, key());
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

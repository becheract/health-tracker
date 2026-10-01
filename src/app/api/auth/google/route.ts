import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authUrl } from "@/lib/google";

const cookie = { httpOnly: true, sameSite: "lax", path: "/api/auth/google", maxAge: 600, secure: process.env.NODE_ENV === "production" } as const;

export async function GET() {
  const state = randomBytes(16).toString("hex");
  // PKCE: the code Google returns is useless without this verifier, which never leaves the browser cookie.
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const res = NextResponse.redirect(authUrl(state, challenge));
  res.cookies.set("ht_oauth_state", state, cookie);
  res.cookies.set("ht_oauth_verifier", verifier, cookie);
  return res;
}

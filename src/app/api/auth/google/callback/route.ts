import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { emailFromIdToken, exchangeCode, startWatch } from "@/lib/google";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { syncFromGmail } from "@/lib/sync";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, env("APP_URL")));

  const state = req.cookies.get("ht_oauth_state")?.value;
  if (!state || state !== url.searchParams.get("state")) return fail("Sign-in expired, try again.");
  const code = url.searchParams.get("code");
  if (!code) return fail("Google sign-in was cancelled.");

  const tokens = await exchangeCode(code);
  const email = tokens.id_token ? emailFromIdToken(tokens.id_token) : null;
  if (!email || email !== env("ALLOWED_EMAIL").toLowerCase()) return fail("This Google account is not allowed.");

  if (tokens.refresh_token) {
    await setSetting("google_refresh_token", tokens.refresh_token);
    // First connection: start Gmail push and import past results. Failures here shouldn't block sign-in.
    await startWatch().catch((e) => console.error("gmail watch failed", e));
    await syncFromGmail({ full: true }).catch((e) => console.error("initial sync failed", e));
  }

  const res = NextResponse.redirect(new URL("/", env("APP_URL")));
  res.cookies.set(SESSION_COOKIE, await createSession(email), sessionCookieOptions);
  res.cookies.delete("ht_oauth_state");
  return res;
}

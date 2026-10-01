import { NextRequest, NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// These check their own secret (cron, Pub/Sub, phone uploads) or are part of signing in.
const PUBLIC = ["/login", "/privacy", "/terms", "/api/auth/google", "/api/gmail/push", "/api/cron/", "/api/ingest/"];
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Cross-site form posts and fetches (CSRF): browsers always send Origin on POST.
  if (!SAFE_METHODS.includes(req.method) && !sameOrigin(req)) {
    return NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
  }
  // Signing out needs no session (and must still work with an expired one).
  if (pathname === "/api/auth/logout") return NextResponse.next();

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  const allowed = process.env.ALLOWED_EMAIL?.toLowerCase();
  if (session && allowed && session.email === allowed) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.redirect(new URL("/login", req.url));
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const config = { matcher: ["/((?!_next/|favicon.ico|icon.svg).*)"] };

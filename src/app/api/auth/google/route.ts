import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { authUrl } from "@/lib/google";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set("ht_oauth_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return res;
}

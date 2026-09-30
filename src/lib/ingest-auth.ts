import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/** Phone uploads (Apple Shortcut, Health Auto Export) prove themselves with CALORIES_TOKEN. */
export function ingestAuthorized(req: NextRequest): boolean {
  const expected = process.env.CALORIES_TOKEN ?? "";
  const given =
    req.headers.get("api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    req.nextUrl.searchParams.get("token") ??
    "";
  return !!expected && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

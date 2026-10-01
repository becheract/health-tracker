import type { NextRequest } from "next/server";
import { safeEqual } from "./secure-compare";

/**
 * Phone uploads (Apple Shortcut, Health Auto Export) prove themselves with CALORIES_TOKEN.
 * Header only: a token in the URL would end up in request logs.
 */
export function ingestAuthorized(req: NextRequest): boolean {
  const given = req.headers.get("api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return safeEqual(given, process.env.CALORIES_TOKEN);
}

import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { caloriesFromPayload, type HaePayload } from "@/lib/calories";

// Health Auto Export (iPhone) posts Apple Health data here. The key can go in an "api-key" or
// "Authorization: Bearer" header, or as ?token= on the URL.
export async function POST(req: NextRequest) {
  const expected = process.env.HEALTH_EXPORT_TOKEN ?? "";
  const given =
    req.headers.get("api-key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("token") ??
    "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload: HaePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const days = caloriesFromPayload(payload);
  if (days.length) {
    // A later export of the same day carries the fuller total, so it replaces the earlier one.
    await db
      .insert(schema.calorieDays)
      .values(days)
      .onConflictDoUpdate({
        target: schema.calorieDays.day,
        set: { kcal: sql`excluded.kcal`, source: sql`excluded.source`, updatedAt: new Date() },
      });
  }
  return NextResponse.json({ calorieDays: days.length });
}

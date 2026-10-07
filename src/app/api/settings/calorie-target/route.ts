import { NextRequest, NextResponse } from "next/server";
import { MAX_DAILY_TARGET, MIN_DAILY_TARGET } from "@/lib/calorie-week";
import { setSetting } from "@/lib/settings";

// Daily calorie target behind the weekly budget bar, or (?kind=maintenance) the calories burned per day
// used for the weekly weight prediction. Session is checked by middleware.
export async function POST(req: NextRequest) {
  const maintenance = req.nextUrl.searchParams.get("kind") === "maintenance";
  const label = maintenance ? "maintenance" : "daily target";
  const body = await req.json().catch(() => null);
  const kcal = Math.round(Number(body?.kcal));
  if (!Number.isFinite(kcal) || kcal < MIN_DAILY_TARGET || kcal > MAX_DAILY_TARGET) {
    return NextResponse.json({ error: `Enter a ${label} between ${MIN_DAILY_TARGET} and ${MAX_DAILY_TARGET} kcal` }, { status: 400 });
  }
  await setSetting(maintenance ? "calorie_maintenance" : "calorie_daily_target", String(kcal));
  return NextResponse.json({ ok: true, kcal });
}

import { NextRequest, NextResponse } from "next/server";
import { MAX_DAILY_TARGET, MIN_DAILY_TARGET } from "@/lib/calorie-week";
import { setSetting } from "@/lib/settings";

// Daily calorie target behind the weekly budget bar. Session is checked by middleware.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const kcal = Math.round(Number(body?.kcal));
  if (!Number.isFinite(kcal) || kcal < MIN_DAILY_TARGET || kcal > MAX_DAILY_TARGET) {
    return NextResponse.json({ error: `Enter a daily target between ${MIN_DAILY_TARGET} and ${MAX_DAILY_TARGET} kcal` }, { status: 400 });
  }
  await setSetting("calorie_daily_target", String(kcal));
  return NextResponse.json({ ok: true, kcal });
}

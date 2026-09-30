import { NextRequest, NextResponse } from "next/server";
import { saveCalorieDays } from "@/lib/calorie-store";
import { calorieDayFromShortcut } from "@/lib/calories";
import { ingestAuthorized } from "@/lib/ingest-auth";

// Apple Shortcut on the iPhone posts today's Dietary Energy total: { "date": "2026-09-30", "calories": 1850 }
export async function POST(req: NextRequest) {
  if (!ingestAuthorized(req)) return NextResponse.json({ ok: false, error: "Wrong or missing token" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.READINGS_TIME_ZONE || "America/Toronto" });
  const parsed = calorieDayFromShortcut(body, today);
  if (typeof parsed === "string") return NextResponse.json({ ok: false, error: parsed }, { status: 400 });

  await saveCalorieDays([parsed]);
  return NextResponse.json({ ok: true, date: parsed.day, calories: parsed.kcal });
}

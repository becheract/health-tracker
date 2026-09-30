import { NextRequest, NextResponse } from "next/server";
import { saveCalorieDays } from "@/lib/calorie-store";
import { caloriesFromPayload, type HaePayload } from "@/lib/calories";
import { ingestAuthorized } from "@/lib/ingest-auth";

// Alternative to the Apple Shortcut: the Health Auto Export app's REST API automation.
export async function POST(req: NextRequest) {
  if (!ingestAuthorized(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let payload: HaePayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const days = caloriesFromPayload(payload);
  await saveCalorieDays(days);
  return NextResponse.json({ calorieDays: days.length });
}

import { NextRequest, NextResponse } from "next/server";
import { startWatch } from "@/lib/google";
import { safeEqual } from "@/lib/secure-compare";
import { syncFromGmail } from "@/lib/sync";

// Daily: Gmail watches expire after 7 days. Also a safety-net sync in case a push was missed.
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || !safeEqual(req.headers.get("authorization"), `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const watch = await startWatch();
  const sync = await syncFromGmail();
  return NextResponse.json({ watchExpires: new Date(Number(watch.expiration)).toISOString(), sync });
}

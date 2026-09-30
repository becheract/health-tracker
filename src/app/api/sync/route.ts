import { NextRequest, NextResponse } from "next/server";
import { syncFromGmail } from "@/lib/sync";

// Manual "Sync" button on the dashboard. Session is checked by middleware.
export async function POST(req: NextRequest) {
  const full = req.nextUrl.searchParams.get("full") === "1";
  try {
    return NextResponse.json(await syncFromGmail({ full }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed" }, { status: 500 });
  }
}

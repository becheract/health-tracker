import { NextRequest, NextResponse } from "next/server";
import { syncFromGmail } from "@/lib/sync";

// Manual "Sync" button on the dashboard. Session is checked by middleware.
export async function POST(req: NextRequest) {
  const full = req.nextUrl.searchParams.get("full") === "1";
  try {
    return NextResponse.json(await syncFromGmail({ full }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    if (message.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
      return NextResponse.json({ error: "Gmail access wasn't granted. Sign out, sign in again and tick the Gmail box." }, { status: 403 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

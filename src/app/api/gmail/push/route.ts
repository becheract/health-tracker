import { NextRequest, NextResponse } from "next/server";
import { safeEqual } from "@/lib/secure-compare";
import { syncFromGmail } from "@/lib/sync";

// Pub/Sub push endpoint. Gmail tells us "something changed"; we re-run the incremental sync.
export async function POST(req: NextRequest) {
  if (!safeEqual(req.nextUrl.searchParams.get("token"), process.env.PUBSUB_VERIFICATION_TOKEN)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const result = await syncFromGmail();
    return NextResponse.json(result);
  } catch (e) {
    console.error("push sync failed", e);
    // Non-2xx makes Pub/Sub retry with backoff.
    return NextResponse.json({ error: "sync failed" }, { status: 500 });
  }
}

import { loadReadings } from "@/lib/readings";
import { getSetting } from "@/lib/settings";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [readings, lastSync, connected] = await Promise.all([
    loadReadings(),
    getSetting("last_sync_at"),
    getSetting("google_refresh_token").then(Boolean),
  ]);
  return <Dashboard bp={readings.bp} weight={readings.weight} lastSync={lastSync} connected={connected} now={Date.now()} />;
}

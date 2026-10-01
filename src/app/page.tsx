import { loadReadings } from "@/lib/readings";
import { getSecretSetting, getSetting } from "@/lib/settings";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [readings, lastSync, connected] = await Promise.all([
    loadReadings(),
    getSetting("last_sync_at"),
    getSecretSetting("google_refresh_token").then(Boolean),
  ]);
  return <Dashboard bp={readings.bp} weight={readings.weight} calories={readings.calories} lastSync={lastSync} connected={connected} now={Date.now()} />;
}

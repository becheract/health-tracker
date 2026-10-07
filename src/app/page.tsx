import { loadReadings } from "@/lib/readings";
import { getSecretSetting, getSetting } from "@/lib/settings";
import { parseDailyTarget, parseMaintenance } from "@/lib/calorie-week";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [readings, lastSync, connected, target, maintenance] = await Promise.all([
    loadReadings(),
    getSetting("last_sync_at"),
    getSecretSetting("google_refresh_token").then(Boolean),
    getSetting("calorie_daily_target").then(parseDailyTarget),
    getSetting("calorie_maintenance").then(parseMaintenance),
  ]);
  return (
    <Dashboard
      bp={readings.bp}
      weight={readings.weight}
      calories={readings.calories}
      dailyTarget={target}
      maintenance={maintenance}
      lastSync={lastSync}
      connected={connected}
      now={Date.now()}
    />
  );
}

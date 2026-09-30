// Health Auto Export "REST API" automation payload: { data: { metrics: [{ name, units, data: [{ date, qty, source }] }] } }
type HaePoint = { date?: string; qty?: number; source?: string };
type HaeMetric = { name?: string; units?: string; data?: HaePoint[] };
export type HaePayload = { data?: { metrics?: HaeMetric[] } };

export type CalorieDay = { day: string; kcal: number; source: string };

const KJ_PER_KCAL = 4.184;

/**
 * Daily calorie totals from a Health Auto Export payload.
 * The day is the phone's local calendar date ("2026-09-30 00:00:00 -0400" -> 2026-09-30), and points
 * within one payload are summed, so hourly aggregation still gives a correct daily total.
 */
export function caloriesFromPayload(payload: HaePayload): CalorieDay[] {
  const metric = payload.data?.metrics?.find((m) => m.name === "dietary_energy");
  if (!metric?.data) return [];
  const toKcal = /kj/i.test(metric.units ?? "") ? 1 / KJ_PER_KCAL : 1;

  const days = new Map<string, { kcal: number; sources: Set<string> }>();
  for (const p of metric.data) {
    const day = p.date?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!day || typeof p.qty !== "number" || !Number.isFinite(p.qty)) continue;
    const entry = days.get(day) ?? { kcal: 0, sources: new Set<string>() };
    entry.kcal += p.qty * toKcal;
    if (p.source) p.source.split("|").forEach((s) => entry.sources.add(s.trim()));
    days.set(day, entry);
  }
  return [...days].map(([day, e]) => ({
    day,
    kcal: Math.round(e.kcal * 10) / 10,
    source: [...e.sources].join(", ") || "Apple Health",
  }));
}

/**
 * Body sent by the Apple Shortcut: { "date": "2026-09-30", "calories": 1850 }.
 * `calories` may arrive as text with a comma decimal (French iPhone). Returns an error message when invalid.
 */
export function calorieDayFromShortcut(body: unknown, today: string): CalorieDay | string {
  if (!body || typeof body !== "object") return "Body must be a JSON object";
  const { date, calories } = body as { date?: unknown; calories?: unknown };
  const day = date === undefined || date === "" ? today : String(date).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return `date must look like 2026-09-30, got "${String(date)}"`;
  const kcal = typeof calories === "number" ? calories : Number(String(calories ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 20000) return `calories must be a number, got "${String(calories)}"`;
  return { day, kcal: Math.round(kcal * 10) / 10, source: "Apple Health" };
}

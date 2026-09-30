import { asc } from "drizzle-orm";
import { db, schema } from "@/db";

export type BpPoint = { t: number; systolic: number; diastolic: number; pulse: number | null; category: string | null; source: string };
export type WeightPoint = { t: number; weightKg: number; bmi: number | null; category: string | null; source: string };
// `t` is local noon of the day, so the point sits mid-day on the time axis.
export type CaloriePoint = { t: number; day: string; kcal: number; source: string };

export async function loadReadings(): Promise<{ bp: BpPoint[]; weight: WeightPoint[]; calories: CaloriePoint[] }> {
  const [bp, weight, calories] = await Promise.all([
    db.select().from(schema.bpReadings).orderBy(asc(schema.bpReadings.measuredAt)),
    db.select().from(schema.weightReadings).orderBy(asc(schema.weightReadings.measuredAt)),
    db.select().from(schema.calorieDays).orderBy(asc(schema.calorieDays.day)),
  ]);
  return {
    bp: bp.map((r) => ({
      t: r.measuredAt.getTime(),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse,
      category: r.category,
      source: r.source,
    })),
    weight: weight.map((r) => ({ t: r.measuredAt.getTime(), weightKg: r.weightKg, bmi: r.bmi, category: r.category, source: r.source })),
    calories: calories.map((r) => ({ t: new Date(`${r.day}T12:00:00`).getTime(), day: r.day, kcal: r.kcal, source: r.source })),
  };
}

import { asc } from "drizzle-orm";
import { db, schema } from "@/db";

export type BpPoint = { t: number; systolic: number; diastolic: number; pulse: number | null; category: string | null; source: string };
export type WeightPoint = { t: number; weightKg: number; bmi: number | null; category: string | null; source: string };

export async function loadReadings(): Promise<{ bp: BpPoint[]; weight: WeightPoint[] }> {
  const [bp, weight] = await Promise.all([
    db.select().from(schema.bpReadings).orderBy(asc(schema.bpReadings.measuredAt)),
    db.select().from(schema.weightReadings).orderBy(asc(schema.weightReadings.measuredAt)),
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
  };
}

import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CalorieDay } from "./calories";

/** A later upload for the same day carries the fuller total, so it replaces the earlier one. */
export async function saveCalorieDays(days: CalorieDay[]) {
  if (!days.length) return;
  await db
    .insert(schema.calorieDays)
    .values(days)
    .onConflictDoUpdate({
      target: schema.calorieDays.day,
      set: { kcal: sql`excluded.kcal`, source: sql`excluded.source`, updatedAt: new Date() },
    });
}

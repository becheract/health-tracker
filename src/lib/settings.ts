import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } });
}

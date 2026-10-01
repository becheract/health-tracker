import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isSealed, open, seal } from "./secret-box";

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

/** Encrypted setting. Values saved before encryption existed are read as-is and re-saved encrypted. */
export async function getSecretSetting(key: string): Promise<string | null> {
  const value = await getSetting(key);
  if (!value) return null;
  if (isSealed(value)) return open(value);
  await setSecretSetting(key, value);
  return value;
}

export function setSecretSetting(key: string, value: string): Promise<void> {
  return setSetting(key, seal(value));
}

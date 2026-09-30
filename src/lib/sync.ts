import { and, gt, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_GMAIL_QUERY } from "./env";
import { getMessage, listMessageIds } from "./google";
import { parseResultEmail } from "./parse";
import { getSetting, setSetting } from "./settings";

export type SyncResult = { scanned: number; newMessages: number; bpAdded: number; weightAdded: number };

/**
 * Pull result emails from Gmail and store any readings in them.
 * Incremental by default (last two days before the previous sync); `full` rescans everything.
 * Safe to run repeatedly: messages are remembered and readings are unique by time.
 */
export async function syncFromGmail({ full = false } = {}): Promise<SyncResult> {
  const startedAt = new Date();
  let q = process.env.GMAIL_QUERY || DEFAULT_GMAIL_QUERY;
  const last = full ? null : await getSetting("last_sync_at");
  if (last) q = `(${q}) after:${Math.floor(new Date(last).getTime() / 1000) - 2 * 86400}`;

  const ids = await listMessageIds(q);
  const seen = ids.length
    ? new Set(
        (
          await db
            .select({ id: schema.processedMessages.id })
            .from(schema.processedMessages)
            // Emails that gave no readings are looked at again, so a parser fix picks them up.
            .where(and(inArray(schema.processedMessages.id, ids), gt(schema.processedMessages.readingsFound, 0)))
        ).map((r) => r.id),
      )
    : new Set<string>();
  const fresh = ids.filter((id) => !seen.has(id));

  const result: SyncResult = { scanned: ids.length, newMessages: fresh.length, bpAdded: 0, weightAdded: 0 };
  const timeZone = process.env.READINGS_TIME_ZONE || "America/Toronto";

  for (const id of fresh) {
    const email = await getMessage(id);
    const parsed = parseResultEmail(email, timeZone);
    const source = sourceLabel(email.from);

    if (parsed.bp.length) {
      const added = await db
        .insert(schema.bpReadings)
        .values(parsed.bp.map((r) => ({ ...r, source, gmailMessageId: id })))
        .onConflictDoNothing()
        .returning({ id: schema.bpReadings.id });
      result.bpAdded += added.length;
    }
    if (parsed.weight.length) {
      const added = await db
        .insert(schema.weightReadings)
        .values(parsed.weight.map((r) => ({ ...r, source, gmailMessageId: id })))
        .onConflictDoNothing()
        .returning({ id: schema.weightReadings.id });
      result.weightAdded += added.length;
    }
    await db
      .insert(schema.processedMessages)
      .values({ id, readingsFound: parsed.bp.length + parsed.weight.length })
      .onConflictDoUpdate({
        target: schema.processedMessages.id,
        set: { readingsFound: parsed.bp.length + parsed.weight.length, processedAt: new Date() },
      });
  }

  await setSetting("last_sync_at", startedAt.toISOString());
  return result;
}

export function sourceLabel(from: string): string {
  const f = from.toLowerCase();
  if (f.includes("pchealth") || f.includes("shoppers")) return "PC Health Station";
  if (f.includes("walmart")) return "Walmart";
  if (f.includes("goodlife")) return "GoodLife";
  const domain = f.match(/@([^>\s]+)/)?.[1];
  return domain ?? "Email";
}

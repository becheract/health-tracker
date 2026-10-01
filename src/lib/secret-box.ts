import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const PREFIX = "v1:";

/**
 * AES-256-GCM key for secrets stored in the database (the Google refresh token).
 * TOKEN_ENCRYPTION_KEY wins if set; otherwise it is derived from SESSION_SECRET,
 * so a database leak alone doesn't hand over Gmail access.
 */
function key(): Buffer {
  const material = process.env.TOKEN_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!material) throw new Error("Missing environment variable SESSION_SECRET");
  return Buffer.from(hkdfSync("sha256", material, "health-tracker", "db-secrets", 32));
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** Returns null if the value was sealed with a different key. */
export function open(sealed: string): string | null {
  const raw = Buffer.from(sealed.slice(PREFIX.length), "base64url");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function isSealed(value: string): boolean {
  return value.startsWith(PREFIX);
}

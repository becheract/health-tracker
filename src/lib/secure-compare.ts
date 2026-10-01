import { timingSafeEqual } from "node:crypto";

/** Constant-time string comparison for secrets. An empty expected value never matches. */
export function safeEqual(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

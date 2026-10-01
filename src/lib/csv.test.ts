import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseDateTime, parseReadingsCsv } from "./csv";
import { parseResultEmail } from "./parse";

// All fixture values are made up.
const fixture = (name: string) => readFileSync(path.join(__dirname, "__fixtures__", name), "utf8");
const tz = "America/Toronto";
const receivedAt = new Date("2026-09-30T12:00:00Z");

describe("Omron Connect CSV export", () => {
  const parsed = parseResultEmail({ subject: "BP data", attachments: [{ filename: "export.csv", content: fixture("omron-connect.csv") }], receivedAt }, tz);

  it("reads separate date and time columns in local time and skips implausible rows", () => {
    expect(parsed.bp).toEqual([
      { measuredAt: new Date("2026-09-28T11:45:00Z"), systolic: 121, diastolic: 79, pulse: 64, category: null },
      { measuredAt: new Date("2026-09-29T01:10:00Z"), systolic: 117, diastolic: 76, pulse: 70, category: null },
    ]);
  });

  it("is labelled Omron from its header", () => {
    expect(parsed.source).toBe("Omron");
  });
});

describe("Withings CSV export", () => {
  it("reads a combined date-time column and named heart rate", () => {
    const parsed = parseResultEmail({ attachments: [{ filename: "bp.csv", content: fixture("withings-bp.csv") }], subject: "Withings data", receivedAt }, tz);
    expect(parsed.source).toBe("Withings");
    expect(parsed.bp[0]).toEqual({ measuredAt: new Date("2026-09-29T12:03:11Z"), systolic: 123, diastolic: 81, pulse: 66, category: null });
    expect(parsed.bp).toHaveLength(2);
  });
});

describe("weight CSV", () => {
  it("handles semicolons, decimal commas, day-first dates and a pound unit in the header", () => {
    const r = parseReadingsCsv(fixture("weight-semicolon.csv"), tz);
    expect(r.bp).toEqual([]);
    expect(r.weight).toEqual([{ measuredAt: new Date("2026-09-30T11:30:00Z"), weightKg: 86.36, heightCm: null, bmi: null, category: null }]);
  });
});

describe("CSV that isn't readings", () => {
  it("gives nothing and lets the email body be parsed instead", () => {
    const parsed = parseResultEmail(
      { attachments: [{ filename: "invoice.csv", content: "Item,Price\nCuff,49.99\n" }], text: "Blood pressure 118/74, pulse 70", receivedAt },
      tz,
    );
    expect(parsed.bp[0]).toMatchObject({ systolic: 118, diastolic: 74, pulse: 70, measuredAt: receivedAt });
    expect(parsed.source).toBeUndefined();
  });
});

describe("parseDateTime", () => {
  it("reads the formats exports use", () => {
    expect(parseDateTime("09/30/2026 1:16 PM", undefined, tz)).toEqual(new Date("2026-09-30T17:16:00Z"));
    expect(parseDateTime("2026-09-30T17:16:00Z", undefined, tz)).toEqual(new Date("2026-09-30T17:16:00Z"));
    expect(parseDateTime("30 Sep 2026", "13:16", tz)).toEqual(new Date("2026-09-30T17:16:00Z"));
    expect(parseDateTime("2026/09/30", undefined, tz)).toEqual(new Date("2026-09-30T04:00:00Z"));
  });

  it("rejects things that aren't dates", () => {
    expect(parseDateTime("Average", undefined, tz)).toBeNull();
    expect(parseDateTime("13/13/2026", undefined, tz)).toBeNull();
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFreeText, parseLocalDateTime, parseResultEmail } from "./parse";

const fixture = readFileSync(path.join(__dirname, "__fixtures__/pchealth.html"), "utf8");
const receivedAt = new Date("2026-01-15T15:00:53Z");

describe("PC Health Station email", () => {
  const parsed = parseResultEmail({ html: fixture, receivedAt });

  it("reads the blood pressure row by column, not by concatenated text", () => {
    expect(parsed.bp).toEqual([
      {
        measuredAt: new Date("2026-01-15T15:00:00Z"),
        systolic: 120,
        diastolic: 80,
        pulse: 70,
        category: "optimal",
      },
    ]);
  });

  it("reads weight in kg with height and BMI", () => {
    expect(parsed.weight).toEqual([
      {
        measuredAt: new Date("2026-01-15T15:00:20Z"),
        weightKg: 68.04,
        heightCm: 170,
        bmi: 23.5,
        category: "normal",
      },
    ]);
  });
});

describe("parseLocalDateTime", () => {
  it("handles winter time and 12 AM/PM", () => {
    expect(parseLocalDateTime("January 5, 2026 12:05:00 AM", "America/Toronto")).toEqual(new Date("2026-01-05T05:05:00Z"));
    expect(parseLocalDateTime("January 5, 2026 12:05:00 PM", "America/Toronto")).toEqual(new Date("2026-01-05T17:05:00Z"));
  });

  it("rejects non-dates", () => {
    expect(parseLocalDateTime("Reading(s)", "America/Toronto")).toBeNull();
  });
});

describe("free-text fallback", () => {
  it("needs mmHg or systolic wording", () => {
    expect(parseFreeText("Call us 24/7 about heart month", receivedAt).bp).toEqual([]);
    const r = parseFreeText("Your blood pressure: 124/81 mmHg. Pulse: 66 bpm. Weight: 88.5 kg", receivedAt);
    expect(r.bp[0]).toMatchObject({ systolic: 124, diastolic: 81, pulse: 66 });
    expect(r.weight[0]).toMatchObject({ weightKg: 88.5 });
  });
});

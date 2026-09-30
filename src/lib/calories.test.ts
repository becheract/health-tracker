import { describe, expect, it } from "vitest";
import { calorieDayFromShortcut, caloriesFromPayload } from "./calories";

describe("caloriesFromPayload", () => {
  it("reads daily dietary energy and ignores other metrics", () => {
    const days = caloriesFromPayload({
      data: {
        metrics: [
          { name: "step_count", units: "count", data: [{ date: "2026-09-29 00:00:00 -0400", qty: 9000 }] },
          {
            name: "dietary_energy",
            units: "kcal",
            data: [
              { date: "2026-09-29 00:00:00 -0400", qty: 2143.6, source: "MyFitnessPal" },
              { date: "2026-09-30 00:00:00 -0400", qty: 812, source: "MyFitnessPal" },
            ],
          },
        ],
      },
    });
    expect(days).toEqual([
      { day: "2026-09-29", kcal: 2143.6, source: "MyFitnessPal" },
      { day: "2026-09-30", kcal: 812, source: "MyFitnessPal" },
    ]);
  });

  it("sums hourly points into one day and converts kJ", () => {
    const days = caloriesFromPayload({
      data: {
        metrics: [
          {
            name: "dietary_energy",
            units: "kJ",
            data: [
              { date: "2026-09-30 08:00:00 -0400", qty: 2092, source: "MyFitnessPal" },
              { date: "2026-09-30 12:00:00 -0400", qty: 2092, source: "MyFitnessPal" },
            ],
          },
        ],
      },
    });
    expect(days).toEqual([{ day: "2026-09-30", kcal: 1000, source: "MyFitnessPal" }]);
  });

  it("returns nothing for payloads without calories", () => {
    expect(caloriesFromPayload({})).toEqual([]);
    expect(caloriesFromPayload({ data: { metrics: [] } })).toEqual([]);
  });
});

describe("calorieDayFromShortcut", () => {
  it("accepts numbers and French-formatted text", () => {
    expect(calorieDayFromShortcut({ date: "2026-09-30", calories: 1850 }, "2026-10-01")).toEqual({ day: "2026-09-30", kcal: 1850, source: "Apple Health" });
    expect(calorieDayFromShortcut({ date: "2026-09-30", calories: "1 850,5" }, "2026-10-01")).toMatchObject({ kcal: 1850.5 });
  });

  it("defaults to today and rejects bad input", () => {
    expect(calorieDayFromShortcut({ calories: 900 }, "2026-10-01")).toMatchObject({ day: "2026-10-01" });
    expect(typeof calorieDayFromShortcut({ date: "30/09/2026", calories: 900 }, "2026-10-01")).toBe("string");
    expect(typeof calorieDayFromShortcut({ date: "2026-09-30", calories: "lots" }, "2026-10-01")).toBe("string");
  });
});

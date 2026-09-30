import { describe, expect, it } from "vitest";
import { caloriesFromPayload } from "./calories";

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

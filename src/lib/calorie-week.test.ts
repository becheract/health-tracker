import { describe, expect, it } from "vitest";
import { calorieWeek, parseDailyTarget, parseMaintenance, weekForecast } from "./calorie-week";

const days = [
  { day: "2026-10-04", kcal: 3000 }, // previous Sunday, not counted
  { day: "2026-10-05", kcal: 1800 },
  { day: "2026-10-06", kcal: 2100.4 },
  { day: "2026-10-07", kcal: 900 },
];

describe("calorieWeek", () => {
  it("counts Monday through today against target × 7", () => {
    const w = calorieWeek(days, "2026-10-07", 2000); // Wednesday
    expect(w).toMatchObject({ start: "2026-10-05", end: "2026-10-11", daysIn: 3, eaten: 4800, budget: 14000, pace: 6000, left: 9200 });
    expect(w.perDayLeft).toBe(1840); // 9,200 over Wed–Sun
  });

  it("treats Sunday as the last day of the week", () => {
    const w = calorieWeek(days, "2026-10-04", 2000);
    expect(w).toMatchObject({ start: "2026-09-28", end: "2026-10-04", daysIn: 7, eaten: 3000 });
  });

  it("starts fresh on Monday", () => {
    const w = calorieWeek(days, "2026-10-05", 1800);
    expect(w).toMatchObject({ daysIn: 1, eaten: 1800, budget: 12600, pace: 1800 });
  });

  it("goes negative when over budget", () => {
    const w = calorieWeek([{ day: "2026-10-11", kcal: 15000 }], "2026-10-11", 2000);
    expect(w.left).toBe(-1000);
  });
});

describe("parseDailyTarget", () => {
  it("defaults to 2,000 for missing or out-of-range values", () => {
    expect(parseDailyTarget(null)).toBe(2000);
    expect(parseDailyTarget("abc")).toBe(2000);
    expect(parseDailyTarget("100")).toBe(2000);
    expect(parseDailyTarget("2200")).toBe(2200);
  });
});

describe("weekForecast", () => {
  it("projects the week from finished days and converts the gap to pounds", () => {
    // Mon 1,800 + Tue 2,100.4 -> avg 1,950.2/day -> 13,651 for the week vs 14,000 maintenance -> 349 kcal deficit
    const f = weekForecast(days, "2026-10-07", 2000)!;
    expect(f.avgPerDay).toBe(1950);
    expect(f.projected).toBe(13651);
    expect(f.lb).toBe(-0.1);
  });

  it("measures against maintenance, so eating at a deficit target predicts a loss", () => {
    const f = weekForecast(days, "2026-10-07", 2500)!; // 13,651 vs 17,500
    expect(f.lb).toBe(-1.1);
  });

  it("predicts a gain when eating over maintenance", () => {
    const f = weekForecast([{ day: "2026-10-05", kcal: 3000 }], "2026-10-06", 2000)!;
    expect(f.lb).toBe(2); // 7,000 kcal over
  });

  it("has nothing to go on on Monday", () => {
    expect(weekForecast(days, "2026-10-05", 2000)).toBeNull();
  });
});

describe("parseMaintenance", () => {
  it("is null until set", () => {
    expect(parseMaintenance(null)).toBeNull();
    expect(parseMaintenance("")).toBeNull();
    expect(parseMaintenance("2400")).toBe(2400);
  });
});

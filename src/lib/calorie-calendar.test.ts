import { describe, expect, it } from "vitest";
import { monthGrid, shiftMonth } from "./calorie-calendar";

describe("monthGrid", () => {
  it("starts weeks on Monday and pads both ends", () => {
    const g = monthGrid(2026, 10); // Oct 1 2026 is a Thursday
    expect(g[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(g.at(-1)).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", null]);
    expect(g).toHaveLength(5);
  });

  it("handles a month starting on Monday", () => {
    expect(monthGrid(2026, 6)[0][0]).toBe("2026-06-01");
  });
});

describe("shiftMonth", () => {
  it("wraps across years", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual([2025, 12]);
    expect(shiftMonth(2026, 12, 1)).toEqual([2027, 1]);
  });
});

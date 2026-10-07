export const DEFAULT_DAILY_TARGET = 2000;
export const MIN_DAILY_TARGET = 800;
export const MAX_DAILY_TARGET = 6000;

export type CalorieWeek = {
  /** Monday and Sunday of the current week, YYYY-MM-DD. */
  start: string;
  end: string;
  /** Days of the week up to and including today (1 on Monday, 7 on Sunday). */
  daysIn: number;
  eaten: number;
  budget: number;
  /** What the budget allows up to the end of today: daily target × daysIn. */
  pace: number;
  /** Calories left for the rest of the week, today included; negative when over. */
  left: number;
  /** Per day for today and the remaining days, to finish exactly on budget. */
  perDayLeft: number;
};

/** Weekly calorie budget for the Monday–Sunday week containing `today` (YYYY-MM-DD, the phone's calendar day). */
export function calorieWeek(days: { day: string; kcal: number }[], today: string, dailyTarget: number): CalorieWeek {
  const d = parseDay(today);
  const daysIn = ((d.getUTCDay() + 6) % 7) + 1;
  const start = fmtDay(addDays(d, 1 - daysIn));
  const end = fmtDay(addDays(d, 7 - daysIn));
  const eaten = days.filter((c) => c.day >= start && c.day <= today).reduce((a, c) => a + c.kcal, 0);
  const budget = dailyTarget * 7;
  const left = budget - eaten;
  const daysLeft = 7 - daysIn + 1;
  return {
    start,
    end,
    daysIn,
    eaten: Math.round(eaten),
    budget,
    pace: dailyTarget * daysIn,
    left: Math.round(left),
    perDayLeft: Math.round(left / daysLeft),
  };
}

/** Saved setting or default; anything out of range falls back to the default. */
export function parseDailyTarget(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= MIN_DAILY_TARGET && n <= MAX_DAILY_TARGET ? n : DEFAULT_DAILY_TARGET;
}

const parseDay = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

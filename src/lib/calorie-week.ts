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

/** Saved maintenance calories, or null when unset or out of range. */
export function parseMaintenance(raw: string | null | undefined): number | null {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= MIN_DAILY_TARGET && n <= MAX_DAILY_TARGET ? n : null;
}

const parseDay = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

/** Rule of thumb: about 3,500 kcal of surplus or deficit per pound of body weight. */
export const KCAL_PER_LB = 3500;

export type WeekForecast = {
  /** Average kcal/day over the days of this week logged before today. */
  avgPerDay: number;
  /** This week's total if the rest of the week follows that average. */
  projected: number;
  /** Predicted weight change in lb for the week; negative is a loss. */
  lb: number;
};

/**
 * Predicted weight change for the Monday–Sunday week containing `today`, from calories eaten versus maintenance
 * (calories burned per day), not versus the target, which may already include a planned deficit.
 * Finished logged days count as eaten; today and the days ahead are assumed at the average of those days.
 * Null on Monday or when nothing was logged earlier in the week, since there is no pace to go on yet.
 */
export function weekForecast(days: { day: string; kcal: number }[], today: string, maintenance: number): WeekForecast | null {
  const { start } = calorieWeek(days, today, maintenance);
  const done = days.filter((c) => c.day >= start && c.day < today);
  if (!done.length) return null;
  const doneKcal = done.reduce((a, c) => a + c.kcal, 0);
  const avgPerDay = doneKcal / done.length;
  const projected = doneKcal + avgPerDay * (7 - done.length);
  return {
    avgPerDay: Math.round(avgPerDay),
    projected: Math.round(projected),
    lb: Math.round(((projected - maintenance * 7) / KCAL_PER_LB) * 10) / 10,
  };
}

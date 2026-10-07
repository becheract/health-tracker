/** Days of a month laid out in Monday-first weeks; null pads the first and last week. `month` is 1–12. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array((first.getUTCDay() + 6) % 7).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Year and month (1–12) shifted by `delta` months. */
export function shiftMonth(year: number, month: number, delta: number): [number, number] {
  const i = year * 12 + (month - 1) + delta;
  return [Math.floor(i / 12), (i % 12) + 1];
}

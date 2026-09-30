// Fills an empty database with ~14 months of made-up readings so the dashboard can be previewed.
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 1.5;
const sources = ["Walmart", "PC Health Station", "PC Health Station", "GoodLife"];

const end = Date.now();
const start = end - 420 * 864e5;
let t = start;
let lbs = 191.4;
let n = 0;
while (t <= end) {
  const p = (t - start) / (end - start);
  lbs += -0.35 + gauss() * 0.9;
  const source = sources[Math.floor(rnd() * sources.length)];
  const at = new Date(t);
  await sql`insert into bp_readings (measured_at, systolic, diastolic, pulse, source)
    values (${at}, ${Math.round(136 - p * 13 + gauss() * 5)}, ${Math.round(88 - p * 12 + gauss() * 3.5)}, ${Math.round(74 + gauss() * 6)}, ${source})
    on conflict do nothing`;
  await sql`insert into weight_readings (measured_at, weight_kg, height_cm, source)
    values (${new Date(t + 17_000)}, ${Math.round(lbs * 0.45359237 * 100) / 100}, 180, ${source})
    on conflict do nothing`;
  n++;
  t += (9 + Math.floor(rnd() * 8)) * 864e5;
}
console.log(`Inserted ${n} demo visits`);
await sql.end();

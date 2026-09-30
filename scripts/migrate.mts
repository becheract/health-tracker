// Applies SQL migrations in ./drizzle. Runs on every Vercel build; already-applied migrations are skipped.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL not set, skipping migrations");
  process.exit(0);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
console.log("Migrations applied");
await sql.end();

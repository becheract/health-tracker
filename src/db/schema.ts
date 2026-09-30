import { integer, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const bpReadings = pgTable(
  "bp_readings",
  {
    id: serial("id").primaryKey(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    systolic: integer("systolic").notNull(),
    diastolic: integer("diastolic").notNull(),
    pulse: integer("pulse"),
    category: text("category"),
    source: text("source").notNull(),
    gmailMessageId: text("gmail_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("bp_readings_measured_at_idx").on(t.measuredAt)],
);

export const weightReadings = pgTable(
  "weight_readings",
  {
    id: serial("id").primaryKey(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2, mode: "number" }).notNull(),
    heightCm: numeric("height_cm", { precision: 5, scale: 1, mode: "number" }),
    bmi: numeric("bmi", { precision: 4, scale: 1, mode: "number" }),
    category: text("category"),
    source: text("source").notNull(),
    gmailMessageId: text("gmail_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("weight_readings_measured_at_idx").on(t.measuredAt)],
);

// Gmail messages already looked at, so re-syncs and duplicate pushes are cheap.
export const processedMessages = pgTable("processed_messages", {
  id: text("id").primaryKey(),
  readingsFound: integer("readings_found").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

// Small key/value store: Google refresh token, last sync time, watch expiry.
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

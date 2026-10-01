import { parse as parseHtml } from "node-html-parser";
import { parseReadingsCsv } from "./csv";

export type BpReading = {
  measuredAt: Date;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  category: string | null;
};

export type WeightReading = {
  measuredAt: Date;
  weightKg: number;
  heightCm: number | null;
  bmi: number | null;
  category: string | null;
};

// `source` names the device or app when the email itself says (e.g. an Omron export).
export type ParsedEmail = { bp: BpReading[]; weight: WeightReading[]; source?: string };

export type Attachment = { filename: string; content: string };

export type EmailInput = {
  html?: string | null;
  text?: string | null;
  subject?: string;
  // CSV attachments, e.g. an export shared from the Omron Connect or Withings app.
  attachments?: Attachment[];
  // When the email arrived; used when the body carries no reading time of its own.
  receivedAt: Date;
};

const LB_TO_KG = 0.45359237;
const DEFAULT_TIME_ZONE = "America/Toronto";

/**
 * Extract blood pressure and weight readings from a result email.
 * CSV exports from home cuff apps are read by column header, table-based kiosk emails
 * (PC Health Station) cell by cell, and anything else falls back to a conservative text scan.
 */
export function parseResultEmail(input: EmailInput, timeZone = DEFAULT_TIME_ZONE): ParsedEmail {
  const fromCsv: ParsedEmail = { bp: [], weight: [] };
  for (const a of input.attachments ?? []) {
    const r = parseReadingsCsv(a.content, timeZone);
    if (!r.bp.length && !r.weight.length) continue;
    fromCsv.bp.push(...r.bp);
    fromCsv.weight.push(...r.weight);
    fromCsv.source ??= exportSource(`${a.filename} ${input.subject ?? ""} ${a.content.slice(0, 300)}`);
  }
  if (fromCsv.bp.length || fromCsv.weight.length) return fromCsv;

  if (input.html) {
    const fromTables = parseResultTables(input.html, timeZone);
    if (fromTables.bp.length || fromTables.weight.length) return fromTables;
  }
  const text = input.text ?? (input.html ? htmlToText(input.html) : "");
  return parseFreeText(text, input.receivedAt);
}

/** PC Health Station layout: header rows (Reading(s) | Pulse | SYS | DIA ...) then data rows. */
export function parseResultTables(html: string, timeZone = DEFAULT_TIME_ZONE): ParsedEmail {
  const root = parseHtml(html);
  const out: ParsedEmail = { bp: [], weight: [] };
  let header: string[] | null = null;

  for (const row of root.querySelectorAll("tr")) {
    const cells = row.childNodes
      .filter((n) => "tagName" in n && /^(TH|TD)$/i.test((n as { tagName: string }).tagName))
      .map((n) => clean(n.text));
    if (cells.length < 3) continue;

    const lower = cells.map((c) => c.toLowerCase());
    if (lower.some((c) => c.startsWith("reading"))) {
      header = lower;
      continue;
    }
    if (!header || cells.length !== header.length) continue;

    const measuredAt = parseLocalDateTime(cells[0], timeZone);
    if (!measuredAt) continue;
    const col = (name: string) => {
      const i = header!.findIndex((h) => h === name || h.startsWith(name));
      return i >= 0 ? cells[i] : undefined;
    };
    const category = guidelineCategory(col("guideline"));

    const sys = toInt(col("sys"));
    const dia = toInt(col("dia"));
    if (sys !== null && dia !== null) {
      out.bp.push({ measuredAt, systolic: sys, diastolic: dia, pulse: toInt(col("pulse")), category });
      continue;
    }

    const weight = parseWeight(col("weight"));
    if (weight !== null) {
      out.weight.push({
        measuredAt,
        weightKg: weight,
        heightCm: parseHeight(col("height")),
        bmi: toFloat(col("bmi")),
        category,
      });
    }
  }
  return out;
}

/** Brand behind a CSV export, from its file name, the email subject or its header row. */
export function exportSource(hint: string): string {
  const h = hint.toLowerCase();
  if (h.includes("omron") || h.includes("truread")) return "Omron";
  if (h.includes("withings")) return "Withings";
  if (h.includes("ihealth")) return "iHealth";
  if (h.includes("qardio")) return "Qardio";
  return "CSV import";
}

/**
 * Fallback for other kiosks and apps: needs explicit BP wording (mmHg, systolic/diastolic,
 * SYS/DIA labels, or "blood pressure"/"BP" right before the numbers) so newsletters don't produce readings.
 */
export function parseFreeText(text: string, receivedAt: Date): ParsedEmail {
  const out: ParsedEmail = { bp: [], weight: [] };
  const t = text.replace(/\s+/g, " ");

  const bp =
    t.match(/(\d{2,3})\s*\/\s*(\d{2,3})\s*mm\s?hg/i) ??
    t.match(/systolic\D{0,20}(\d{2,3})\D{0,40}diastolic\D{0,20}(\d{2,3})/i) ??
    t.match(/\bSYS\b\D{0,12}(\d{2,3})\D{0,30}\bDIA\b\D{0,12}(\d{2,3})/i) ??
    t.match(/(?:blood pressure|\bBP\b)[^0-9/]{0,25}(\d{2,3})\s*\/\s*(\d{2,3})\b/i);
  if (bp) {
    const systolic = Number(bp[1]);
    const diastolic = Number(bp[2]);
    if (plausibleBp(systolic, diastolic)) {
      const pulse = t.match(/(?:pulse|heart rate|\bPUL\b)\D{0,20}(\d{2,3})/i);
      out.bp.push({ measuredAt: receivedAt, systolic, diastolic, pulse: pulse ? Number(pulse[1]) : null, category: null });
    }
  }

  const w = t.match(/weight\D{0,20}(\d{2,3}(?:\.\d+)?)\s*(lbs?|kg)\b/i);
  if (w) {
    const kg = w[2].toLowerCase() === "kg" ? Number(w[1]) : Number(w[1]) * LB_TO_KG;
    out.weight.push({ measuredAt: receivedAt, weightKg: round2(kg), heightCm: null, bmi: null, category: null });
  }
  return out;
}

/** "September 30, 2026 1:16:24 PM" read as wall-clock time in `timeZone`. */
export function parseLocalDateTime(s: string, timeZone: string): Date | null {
  const m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?$/i);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
  if (month < 0) return null;
  let hour = Number(m[4]);
  const ampm = m[7]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return zonedTimeToUtc(Number(m[3]), month, Number(m[2]), hour, Number(m[5]), Number(m[6] ?? 0), timeZone);
}

export function zonedTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, timeZone: string): Date {
  const asUtc = Date.UTC(y, mo, d, h, mi, s);
  let guess = asUtc - tzOffsetMs(asUtc, timeZone);
  // Second pass settles times near a DST switch.
  guess = asUtc - tzOffsetMs(guess, timeZone);
  return new Date(guess);
}

function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(utcMs / 1000) * 1000;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function clean(s: string): string {
  return s
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToText(html: string): string {
  const root = parseHtml(html);
  root.querySelectorAll("style,script").forEach((n) => n.remove());
  return clean(root.structuredText);
}

function toInt(s: string | undefined): number | null {
  const m = s?.match(/\d+/);
  return m ? Number(m[0]) : null;
}

function toFloat(s: string | undefined): number | null {
  const m = s?.match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseWeight(s: string | undefined): number | null {
  const m = s?.match(/(\d+(?:\.\d+)?)\s*(lbs?|kg)?/i);
  if (!m) return null;
  const unit = (m[2] ?? "lb").toLowerCase();
  return round2(unit === "kg" ? Number(m[1]) : Number(m[1]) * LB_TO_KG);
}

function parseHeight(s: string | undefined): number | null {
  const cm = s?.match(/(\d+(?:\.\d+)?)\s*cm/i);
  if (cm) return Number(cm[1]);
  const ft = s?.match(/(\d)\s*(?:ft|')\s*(\d{1,2})?/i);
  return ft ? Math.round((Number(ft[1]) * 12 + Number(ft[2] ?? 0)) * 2.54) : null;
}

function guidelineCategory(s: string | undefined): string | null {
  const m = s?.match(/in the (.+?) guideline category/i);
  return m ? m[1].toLowerCase() : s || null;
}

function plausibleBp(sys: number, dia: number) {
  return sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

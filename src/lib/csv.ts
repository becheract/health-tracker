import type { BpReading, ParsedEmail, WeightReading } from "./parse";
import { zonedTimeToUtc } from "./parse";

const LB_TO_KG = 0.45359237;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Readings from a CSV export (Omron Connect, Withings, iHealth, Qardio and similar apps).
 * Columns are found by their header names, so any app that labels systolic/diastolic or
 * weight plus a date works without a brand-specific layout.
 */
export function parseReadingsCsv(csv: string, timeZone: string): ParsedEmail {
  const out: ParsedEmail = { bp: [], weight: [] };
  const rows = splitCsv(csv.replace(/^﻿/, ""));
  const headerAt = rows.findIndex((r) => findCol(r, SYS) >= 0 || findCol(r, WEIGHT) >= 0);
  if (headerAt < 0) return out;

  const header = rows[headerAt];
  const c = {
    date: findCol(header, DATE),
    time: findCol(header, TIME),
    sys: findCol(header, SYS),
    dia: findCol(header, DIA),
    pulse: findCol(header, PULSE),
    weight: findCol(header, WEIGHT),
  };
  if (c.date < 0) return out;
  const weightUnit = /\blbs?\b|pound/i.test(header[c.weight] ?? "") ? "lb" : /\bkg\b/i.test(header[c.weight] ?? "") ? "kg" : null;

  for (const row of rows.slice(headerAt + 1)) {
    const measuredAt = parseDateTime(row[c.date] ?? "", c.time >= 0 && c.time !== c.date ? row[c.time] : undefined, timeZone);
    if (!measuredAt) continue;

    const sys = num(row[c.sys]);
    const dia = num(row[c.dia]);
    if (sys !== null && dia !== null && plausibleBp(sys, dia)) {
      const pulse = num(row[c.pulse]);
      const bp: BpReading = { measuredAt, systolic: Math.round(sys), diastolic: Math.round(dia), pulse: pulse && Math.round(pulse), category: null };
      out.bp.push(bp);
    }

    const w = c.weight >= 0 ? parseWeightCell(row[c.weight], weightUnit) : null;
    if (w !== null) {
      const weight: WeightReading = { measuredAt, weightKg: w, heightCm: null, bmi: null, category: null };
      out.weight.push(weight);
    }
  }
  return out;
}

// Header matchers, most specific first. Each is tested against the lowercased header cell.
const DATE = [/^date\b/, /date|timestamp|measured|recorded/];
const TIME = [/^time\b/];
const SYS = [/^sys/, /systolic/];
const DIA = [/^dia/, /diastolic/];
const PULSE = [/^pul/, /pulse|heart ?rate|^hr\b|bpm/];
const WEIGHT = [/^weight\b/, /weight/];

function findCol(header: string[], patterns: RegExp[]): number {
  const lower = header.map((h) => h.trim().toLowerCase());
  for (const p of patterns) {
    const i = lower.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

/** Minimal RFC 4180 reader; also accepts `;` or tab separated files (European locales). */
export function splitCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = [",", ";", "\t"].reduce((best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((x) => x)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((x) => x)) rows.push(row);
  return rows;
}

/**
 * Dates as the common exports write them, read in `timeZone` unless they carry an offset:
 * "2026-09-30 13:16:24" (Withings), "Sep 30 2026" + "13:16" (Omron), "09/30/2026 1:16 PM".
 * Slash dates are month first, as in Canada and the US, unless the first number can't be a month.
 */
export function parseDateTime(dateCell: string, timeCell: string | undefined, timeZone: string): Date | null {
  const s = `${dateCell} ${timeCell ?? ""}`.trim().replace(/\s+/g, " ");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.test(s)) return new Date(s);

  let y: number, mo: number, d: number;
  let rest: string;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[T ]?(.*)$/))) {
    [y, mo, d, rest] = [Number(m[1]), Number(m[2]) - 1, Number(m[3]), m[4]];
  } else if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}),? ?(.*)$/))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    [mo, d] = a > 12 ? [b - 1, a] : [a - 1, b];
    [y, rest] = [Number(m[3]), m[4]];
  } else if ((m = s.match(/^([A-Za-z]{3,})\.? (\d{1,2}),? (\d{4}),? ?(.*)$/))) {
    [y, mo, d, rest] = [Number(m[3]), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()), Number(m[2]), m[4]];
  } else if ((m = s.match(/^(\d{1,2}) ([A-Za-z]{3,})\.?,? (\d{4}),? ?(.*)$/))) {
    [y, mo, d, rest] = [Number(m[3]), MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()), Number(m[1]), m[4]];
  } else return null;
  if (mo < 0 || mo > 11 || d < 1 || d > 31) return null;

  let h = 0, mi = 0, sec = 0;
  const t = rest.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?$/);
  if (t) {
    [h, mi, sec] = [Number(t[1]), Number(t[2]), Number(t[3] ?? 0)];
    const ampm = t[4]?.[0].toUpperCase();
    if (ampm === "P" && h < 12) h += 12;
    if (ampm === "A" && h === 12) h = 0;
  } else if (rest.trim()) return null;
  return zonedTimeToUtc(y, mo, d, h, mi, sec, timeZone);
}

function num(s: string | undefined): number | null {
  const m = s?.replace(",", ".").match(/^\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function parseWeightCell(s: string | undefined, headerUnit: "kg" | "lb" | null): number | null {
  const m = s?.replace(",", ".").match(/^\s*(\d+(?:\.\d+)?)\s*(kg|lbs?)?/i);
  if (!m) return null;
  const unit = (m[2]?.toLowerCase().startsWith("lb") ? "lb" : m[2] ? "kg" : headerUnit) ?? "kg";
  const kg = unit === "lb" ? Number(m[1]) * LB_TO_KG : Number(m[1]);
  return kg >= 20 && kg <= 350 ? Math.round(kg * 100) / 100 : null;
}

function plausibleBp(sys: number, dia: number) {
  return sys >= 70 && sys <= 250 && dia >= 40 && dia <= 150 && sys > dia;
}

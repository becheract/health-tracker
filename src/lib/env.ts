export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

// Kiosk result emails, plus CSV exports from home cuff apps (Omron Connect, Withings, iHealth, Qardio).
export const DEFAULT_GMAIL_QUERY =
  'from:(pchealth.ca OR pharmasmart OR lifeclinic OR higi OR pursuanthealth) OR subject:"blood pressure"' +
  ' OR (filename:csv (omron OR withings OR ihealth OR qardio OR "blood pressure" OR systolic))';

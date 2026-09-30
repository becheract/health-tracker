export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

export const DEFAULT_GMAIL_QUERY = 'from:(pchealth.ca OR pharmasmart OR lifeclinic OR higi) OR subject:"blood pressure"';

/**
 * Only kiosk companies may add readings. Anyone can send an email with "blood pressure"
 * in the subject, so a reading is stored only when the From domain is on the trusted
 * list AND Gmail's own Authentication-Results show that domain really sent it.
 */
export const DEFAULT_TRUSTED_SENDER_DOMAINS = ["pchealth.ca", "pharmasmart.com", "lifeclinic.com", "higi.com"];

export function trustedDomains(): string[] {
  const configured = process.env.TRUSTED_SENDER_DOMAINS;
  if (!configured) return DEFAULT_TRUSTED_SENDER_DOMAINS;
  return configured
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export type SenderCheck = { ok: true; domain: string } | { ok: false; reason: string };

export function checkSender(from: string, authResults: string, trusted = trustedDomains()): SenderCheck {
  const fromDomain = domainOf(from);
  if (!fromDomain) return { ok: false, reason: "no sender address" };
  const root = trusted.find((d) => under(fromDomain, d));
  if (!root) return { ok: false, reason: `${fromDomain} is not a trusted sender` };

  // Gmail prepends its own header, so the first one is Gmail's and later ones may be forged by the sender.
  if (!/^\s*mx\.google\.com\s*;/i.test(authResults)) return { ok: false, reason: "no Gmail authentication results" };

  for (const clause of authResults.split(";").slice(1)) {
    const c = clause.trim().toLowerCase();
    const method = c.match(/^(dmarc|dkim|spf)=(\w+)/);
    if (!method || method[2] !== "pass") continue;
    const signer =
      method[1] === "dmarc"
        ? c.match(/header\.from=([^\s;]+)/)?.[1]
        : method[1] === "dkim"
          ? c.match(/header\.(?:d=|i=@)([^\s;]+)/)?.[1]
          : domainOf(c.match(/smtp\.mailfrom=([^\s;]+)/)?.[1] ?? "");
    if (signer && under(signer, root)) return { ok: true, domain: fromDomain };
  }
  return { ok: false, reason: `${fromDomain} failed SPF, DKIM and DMARC` };
}

function domainOf(address: string): string | null {
  const m = address.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/);
  return m ? m[1] : null;
}

function under(domain: string, root: string): boolean {
  return domain === root || domain.endsWith(`.${root}`);
}

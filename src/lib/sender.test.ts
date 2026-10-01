import { describe, expect, it } from "vitest";
import { checkSender } from "./sender";

const trusted = ["pchealth.ca"];
const from = "PC Health <noreply@e.pchealth.ca>";
const gmail = (rest: string) => `mx.google.com; ${rest}`;

describe("checkSender", () => {
  it("accepts a trusted domain that passes DMARC", () => {
    const r = checkSender(from, gmail("dkim=pass header.i=@e.pchealth.ca header.s=s1; spf=pass smtp.mailfrom=bounce@e.pchealth.ca; dmarc=pass (p=NONE) header.from=e.pchealth.ca"), trusted);
    expect(r).toEqual({ ok: true, domain: "e.pchealth.ca" });
  });

  it("accepts DKIM or SPF alone when there is no DMARC record", () => {
    expect(checkSender(from, gmail("dkim=pass header.i=@pchealth.ca header.s=s1"), trusted).ok).toBe(true);
    expect(checkSender(from, gmail("spf=pass (google.com: domain of x@e.pchealth.ca) smtp.mailfrom=x@e.pchealth.ca"), trusted).ok).toBe(true);
  });

  it("rejects senders that aren't on the list", () => {
    const r = checkSender("Evil <bp@evil.example>", gmail("dkim=pass header.i=@evil.example; dmarc=pass header.from=evil.example"), trusted);
    expect(r.ok).toBe(false);
  });

  it("rejects look-alike domains", () => {
    expect(checkSender("x <a@notpchealth.ca>", gmail("dmarc=pass header.from=notpchealth.ca"), trusted).ok).toBe(false);
    expect(checkSender("x <a@pchealth.ca.evil.example>", gmail("dmarc=pass header.from=pchealth.ca.evil.example"), trusted).ok).toBe(false);
  });

  it("rejects a spoofed From that fails authentication", () => {
    const r = checkSender(from, gmail("dkim=none; spf=softfail smtp.mailfrom=x@evil.example; dmarc=fail header.from=e.pchealth.ca"), trusted);
    expect(r.ok).toBe(false);
  });

  it("rejects a pass signed by some other domain", () => {
    expect(checkSender(from, gmail("dkim=pass header.i=@evil.example; spf=pass smtp.mailfrom=x@evil.example"), trusted).ok).toBe(false);
  });

  it("ignores headers not written by Gmail", () => {
    expect(checkSender(from, "evil.example; dmarc=pass header.from=e.pchealth.ca", trusted).ok).toBe(false);
    expect(checkSender(from, "", trusted).ok).toBe(false);
  });
});

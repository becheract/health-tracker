import { env } from "./env";
import { getSecretSetting, setSetting } from "./settings";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const SCOPES = ["openid", "email", GMAIL_SCOPE];
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export function redirectUri() {
  return `${env("APP_URL").replace(/\/$/, "")}/api/auth/google/callback`;
}

export function authUrl(state: string, codeChallenge: string) {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; scope?: string; refresh_token?: string; id_token?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export function exchangeCode(code: string, codeVerifier: string) {
  return tokenRequest({ code, code_verifier: codeVerifier, grant_type: "authorization_code", redirect_uri: redirectUri() });
}

/** Email claim from the id_token Google just handed us over TLS. */
export function emailFromIdToken(idToken: string): string | null {
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
  return payload.email_verified ? String(payload.email).toLowerCase() : null;
}

// Keyed by refresh token so signing in again (e.g. with more permissions) takes effect immediately.
let cached: { refresh: string; token: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string> {
  const refresh = await getSecretSetting("google_refresh_token");
  if (!refresh) throw new Error("Gmail is not connected yet. Sign in once to connect it.");
  if (cached && cached.refresh === refresh && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  cached = { refresh, token: t.access_token, expiresAt: Date.now() + t.expires_in * 1000 };
  return cached.token;
}

async function gmail<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GMAIL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error(`Gmail ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listMessageIds(q: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmail<{ messages?: { id: string }[]; nextPageToken?: string }>(`/messages?${params}`);
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

type Part = { mimeType: string; filename?: string; body?: { data?: string; attachmentId?: string; size?: number }; parts?: Part[] };
type Message = { id: string; internalDate: string; labelIds?: string[]; payload: Part & { headers: { name: string; value: string }[] } };

export type FetchedEmail = {
  id: string;
  from: string;
  subject: string;
  // First Authentication-Results header, the one Gmail itself added on arrival.
  authResults: string;
  receivedAt: Date;
  html: string | null;
  text: string | null;
  // Gmail puts SENT only on mail this account sent itself, which outside senders can't fake.
  sentByOwner: boolean;
  attachments: { filename: string; content: string }[];
};

// Years of twice-daily home readings fit well under this.
const MAX_CSV_BYTES = 2_000_000;

export async function getMessage(id: string): Promise<FetchedEmail> {
  const m = await gmail<Message>(`/messages/${id}?format=full`);
  const header = (name: string) => m.payload.headers.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  return {
    id,
    from: header("from"),
    subject: header("subject"),
    authResults: header("authentication-results"),
    receivedAt: new Date(Number(m.internalDate)),
    html: findPart(m.payload, "text/html"),
    text: findPart(m.payload, "text/plain"),
    sentByOwner: m.labelIds?.includes("SENT") ?? false,
    attachments: await csvAttachments(id, m.payload),
  };
}

/** CSV files attached to the message (readings exported from a home cuff app). */
async function csvAttachments(messageId: string, payload: Part) {
  const found: Part[] = [];
  const walk = (p: Part) => {
    if (p.filename && (/\.csv$/i.test(p.filename) || p.mimeType === "text/csv") && (p.body?.size ?? 0) <= MAX_CSV_BYTES) found.push(p);
    p.parts?.forEach(walk);
  };
  walk(payload);
  return Promise.all(
    found.map(async (p) => {
      const data =
        p.body?.data ??
        (await gmail<{ data: string }>(`/messages/${messageId}/attachments/${p.body!.attachmentId}`)).data;
      return { filename: p.filename!, content: Buffer.from(data, "base64url").toString("utf8") };
    }),
  );
}

function findPart(part: Part, mimeType: string): string | null {
  if (part.mimeType === mimeType && part.body?.data) return Buffer.from(part.body.data, "base64url").toString("utf8");
  for (const p of part.parts ?? []) {
    const found = findPart(p, mimeType);
    if (found) return found;
  }
  return null;
}

/** Ask Gmail to publish INBOX changes to Pub/Sub. Expires after 7 days, so a daily cron renews it. */
export async function startWatch() {
  const res = await gmail<{ historyId: string; expiration: string }>("/watch", {
    method: "POST",
    body: JSON.stringify({ topicName: env("GMAIL_PUBSUB_TOPIC"), labelIds: ["INBOX"], labelFilterBehavior: "include" }),
  });
  await setSetting("gmail_watch_expiration", new Date(Number(res.expiration)).toISOString());
  return res;
}

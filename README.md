# Vitals

A private dashboard of blood pressure and weight readings, filled in automatically from the result emails that pharmacy and gym BP kiosks send to Gmail.

- **Ingest:** Gmail push notifications (Pub/Sub) call `/api/gmail/push`; the app searches Gmail for result emails, parses them and stores new readings. A daily cron renews the Gmail watch and re-syncs as a safety net. The "Sync" link on the dashboard does the same on demand.
- **Parse:** PC Health Station emails (Shoppers Drug Mart, `noreply@e.pchealth.ca`) are read from their HTML tables: pulse, systolic, diastolic, weight, height, BMI and the reading time. CSV attachments exported from home cuff apps (Omron Connect, Withings, iHealth, Qardio and similar) are read by column header, so emailing an export to yourself (from the Gmail account the app reads) imports every reading in it. CSVs from anyone else are ignored. Other senders fall back to a text scan that needs "mmHg", "systolic", SYS/DIA labels, or "blood pressure"/"BP" right before the numbers. See `src/lib/parse.ts` and `src/lib/csv.ts`.
- **Calories:** MyFitnessPal writes calories to Apple Health, and an Apple Shortcut posts the day's total to `/api/ingest/calories` as `{"date": "2026-09-30", "calories": 1850}` with `Authorization: Bearer <CALORIES_TOKEN>`. One row per day; a later upload of the same day replaces it. (`/api/ingest/health-auto-export` accepts the Health Auto Export app's format with the same key.)
- **Dashboard:** latest BP with AHA category, weight with 30-day change, 90-day average, one chart (blood pressure or weight; 1M / 3M / 6M / 1Y / All) and a readings log. Only `ALLOWED_EMAIL` can sign in.

Stack: Next.js 15 (App Router) · Postgres via Drizzle · Google OAuth + Gmail REST · hosted on Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local        # fill in DATABASE_URL at least
npm run db:migrate                # create tables
npm run db:seed-demo              # optional: fake readings to look at
npm run dev
```

`npm test` runs the email parser tests; `npm run typecheck` checks types.

## Deploy (one-time setup)

1. **Database.** In Vercel, add a Neon Postgres database from the project's Storage tab; it sets `DATABASE_URL`. Tables are created automatically on every deploy (`vercel-build` runs `scripts/migrate.mts`). After changing `src/db/schema.ts`, run `npm run db:generate` and commit the new file in `drizzle/`.
2. **Google Cloud project** (console.cloud.google.com):
   - Enable the **Gmail API** and **Cloud Pub/Sub API**.
   - **OAuth consent screen:** type External, add your Gmail as a test user, add scope `gmail.readonly`. Then press **Publish app**. You'll see a "Google hasn't verified this app" warning when signing in, which is expected for a personal app; staying in "Testing" makes Google expire the connection every 7 days.
   - **Credentials → Create OAuth client ID → Web application.** Authorized redirect URI: `https://<your-app>/api/auth/google/callback`. Copy the client ID and secret.
3. **Pub/Sub:**
   - Create a topic, e.g. `gmail-health`. Its full name (`projects/<project-id>/topics/gmail-health`) goes in `GMAIL_PUBSUB_TOPIC`.
   - On the topic, grant **Pub/Sub Publisher** to `gmail-api-push@system.gserviceaccount.com`.
   - Create a **push** subscription on the topic with endpoint `https://<your-app>/api/gmail/push?token=<PUBSUB_VERIFICATION_TOKEN>`.
4. **Vercel:** import this repo, add every variable from `.env.example` (generate `SESSION_SECRET`, `PUBSUB_VERIFICATION_TOKEN` and `CRON_SECRET` with `openssl rand -hex 32`), and deploy.
5. **Connect:** open the app and sign in with Google, and tick the Gmail permission box. The first sign-in stores the Gmail connection, starts the watch and imports past result emails.

6. **Calories (optional, iPhone):** in MyFitnessPal turn on writing Dietary Energy to Apple Health, add `CALORIES_TOKEN` in Vercel, and build the Shortcut: Find Health Samples (Dietary Energy, today) → Calculate Statistics (Sum) → Get Contents of URL (POST JSON `date`, `calories`, header `Authorization: Bearer <CALORIES_TOKEN>`), run by an automation when MyFitnessPal closes.

## Notes

- Kiosk timestamps carry no time zone; they're read as `READINGS_TIME_ZONE` (default `America/Toronto`).
- Duplicate "Reminder: Your results are ready" emails are harmless: readings are unique by measurement time.
- Which emails are considered is set by `GMAIL_QUERY` (default: PC Health, PharmaSmart, lifeclinic, higi and Pursuant kiosk senders, "blood pressure" in the subject, or a CSV attachment mentioning a cuff brand or blood pressure). When a Walmart or GoodLife kiosk email arrives in a new format, add its sender there and a parser case with a fixture in `src/lib/__fixtures__/`.

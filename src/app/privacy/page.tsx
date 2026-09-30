import type { Metadata } from "next";
import { contactEmail, LegalPage } from "../legal";

export const metadata: Metadata = { title: "Privacy policy · Vitals" };
export const dynamic = "force-dynamic";

export default function Privacy() {
  const email = contactEmail();
  return (
    <LegalPage title="Privacy policy">
      <p>
        Vitals is a personal dashboard with a single user. It shows the blood pressure and weight readings that pharmacy and
        gym health kiosks send by email. Only one Google account is allowed to sign in, and this policy covers that account.
      </p>

      <h2>What Vitals reads from Google</h2>
      <p>
        When you sign in with Google, Vitals asks for your email address and read-only access to Gmail (
        <code>gmail.readonly</code>). It uses that access for one thing: finding kiosk result emails, such as those from PC
        Health Station, and reading the measurements in them. It searches only for those senders and subjects. It does not
        read, store or show any other email. It never sends, deletes or changes email.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li>Readings taken from result emails: date and time, systolic and diastolic pressure, pulse, weight, height, BMI, the kiosk's category text, and which service sent the email.</li>
        <li>The Gmail ID of each result email that was checked, so the same email isn't processed twice.</li>
        <li>A Google refresh token, so new results can be imported without you signing in again.</li>
        <li>The time of the last sync and when the Gmail notification setup expires.</li>
      </ul>
      <p>
        Email bodies are not kept after the readings are taken out of them. The data sits in a Postgres database hosted by
        Neon, which encrypts it at rest. The app runs on Vercel, and every connection uses HTTPS or TLS.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        Vitals sets one cookie to keep you signed in and one short-lived cookie during Google sign-in. Your browser also
        remembers which chart and time range you last picked. There are no analytics, advertising or tracking cookies.
      </p>

      <h2>Sharing</h2>
      <p>
        Your data is not sold, shared or used for advertising, and it is not used to train AI models. The only services that
        handle it are those needed to run the app: Google (Gmail and Pub/Sub notifications), Vercel (hosting) and Neon
        (database).
      </p>

      <h2>Google API Services User Data Policy</h2>
      <p>
        Vitals&apos; use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>Removing access and deleting data</h2>
      <p>
        You can remove Vitals&apos; access to Gmail at any time from{" "}
        <a href="https://myaccount.google.com/permissions">your Google Account permissions</a>. To delete all stored
        readings and tokens, email {email} and they will be deleted from the database.
      </p>

      <h2>Contact</h2>
      <p>Questions about this policy: {email}.</p>
    </LegalPage>
  );
}

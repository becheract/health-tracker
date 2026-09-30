import type { Metadata } from "next";
import { contactEmail, LegalPage } from "../legal";

export const metadata: Metadata = { title: "Terms of service · Vitals" };
export const dynamic = "force-dynamic";

export default function Terms() {
  const email = contactEmail();
  return (
    <LegalPage title="Terms of service">
      <p>
        Vitals is a private, non-commercial dashboard built for one person. It shows blood pressure and weight readings
        taken from health kiosk result emails. Only the owner&apos;s Google account can sign in. By using it, you agree to
        these terms.
      </p>

      <h2>Not medical advice</h2>
      <p>
        Vitals displays numbers that kiosks report and labels them with the American Heart Association&apos;s adult blood
        pressure ranges. It does not diagnose, treat or give medical advice. Kiosk readings can be wrong, and an email can
        be read incorrectly. Talk to a healthcare professional about your results. If a reading is very high or you have
        symptoms, get medical help right away.
      </p>

      <h2>Your account and data</h2>
      <p>
        You sign in with your Google account and allow read-only Gmail access so Vitals can import results. You can
        remove that access at any time. How data is handled is described in the <a href="/privacy">privacy policy</a>.
      </p>

      <h2>No warranty</h2>
      <p>
        Vitals is provided as is, with no guarantee that it will be available, complete or error-free. To the extent the
        law allows, its author is not liable for any loss that comes from using it.
      </p>

      <h2>Changes</h2>
      <p>These terms may be updated, and the date at the top shows the latest version.</p>

      <h2>Contact</h2>
      <p>{email}</p>
    </LegalPage>
  );
}

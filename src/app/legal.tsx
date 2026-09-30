import Link from "next/link";

export const UPDATED = "September 30, 2026";

export function contactEmail() {
  return process.env.ALLOWED_EMAIL || "the owner of this site";
}

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="wrap doc">
      <header>
        <h1>{title}</h1>
        <nav className="sync">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/">Vitals</Link>
        </nav>
      </header>
      <article>
        <p className="muted">Last updated {UPDATED}</p>
        {children}
      </article>
    </main>
  );
}

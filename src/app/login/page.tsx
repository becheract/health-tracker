export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="box">
        <h1>Vitals</h1>
        <p>Sign in with the Google account that receives your kiosk results.</p>
        <a className="btn" href="/api/auth/google">
          Continue with Google
        </a>
        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}

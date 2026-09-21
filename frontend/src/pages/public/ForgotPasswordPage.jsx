import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStatus("sending");
    try {
      await forgotPassword({ email });
      // Same email is shown whether or not the account exists — telling
      // someone "no account with that email" is exactly the kind of thing
      // that lets an attacker discover which emails are registered.
      setStatus("sent");
    } catch {
      setStatus("idle");
      setError("Something went wrong. Try again.");
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-landing-bg-alt to-landing-card font-body">
      <header className="bg-landing-bg border-b border-landing-border-sub">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Link to="/" className="text-xl font-bold tracking-tight select-none">
            <span className="text-landing-text">skill</span>
            <span className="text-landing-accent">bridge</span>
          </Link>
          <Link to="/login" className="flex items-center gap-1.5 text-sm text-landing-muted hover:text-landing-text transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to login
          </Link>
        </div>
      </header>

      <main className="flex items-center justify-center px-4 py-16 lg:py-24">
        <div className="w-full max-w-110">
          <p className="flex items-center justify-center gap-2 text-sm font-medium mb-8 text-landing-accent">
            <span className="w-2 h-2 rounded-full inline-block bg-landing-accent" />
            Account recovery
          </p>

          <div className="rounded-3xl p-8 sm:p-10 bg-landing-bg border border-landing-border shadow-[0_4px_24px_rgba(26,26,46,0.06)]">
            {status !== "sent" ? (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-landing-accent-bg text-landing-accent">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <h1 className="font-landing-display text-3xl font-bold mb-2 text-landing-text">Forgot your password?</h1>
                <p className="text-sm mb-8 text-landing-muted leading-relaxed">
                  No problem. Enter your email address and we'll send you a link to reset it.
                </p>

                {error && (
                  <div className="bg-danger-bg text-danger text-xs rounded-xl px-3.5 py-2.5 mb-4">{error}</div>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  <div>
                    <label htmlFor="email" className="block text-xs font-semibold mb-2 text-landing-text tracking-wide">
                      EMAIL ADDRESS
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-landing-border rounded-xl px-3.5 py-3 text-sm bg-landing-bg text-landing-text focus:outline-none focus:border-landing-text transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full py-3.5 rounded-xl text-sm font-semibold bg-landing-text text-white hover:opacity-90 transition-opacity disabled:opacity-50 mt-1"
                  >
                    {status === "sending" ? "Sending..." : "Send reset link →"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-landing-accent-bg text-landing-accent">
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>

                <h1 className="font-landing-display text-3xl font-bold mb-2 text-landing-text">Check your inbox.</h1>
                <p className="text-sm mb-2 text-landing-muted leading-relaxed">
                  If an account exists, we've sent a password reset link to
                </p>
                <p className="text-sm font-semibold mb-8 text-landing-text">{email}</p>

                <div className="rounded-xl p-4 mb-6 text-sm bg-landing-bg-alt border border-landing-border text-landing-muted leading-relaxed">
                  Didn't receive it? Check your spam folder, or{" "}
                  <button type="button" className="font-semibold text-landing-accent" onClick={() => setStatus("idle")}>
                    try a different email address.
                  </button>
                </div>

                <Link
                  to="/login"
                  className="block text-center w-full py-3.5 rounded-xl text-sm font-semibold bg-landing-text text-white hover:opacity-90 transition-opacity"
                >
                  Back to login →
                </Link>
              </>
            )}
          </div>

          <p className="text-center text-sm mt-7 text-landing-muted">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-landing-text">
              Log in →
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

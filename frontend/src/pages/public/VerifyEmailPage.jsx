import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { verifyEmail, resendVerification } from "../../api/auth";
import { getErrorMessage } from "../../api/errors";

// Two ways to land here:
//  1. Right after signup, no ?token= yet — show "check your inbox" + resend.
//  2. User clicked the link in the email, ?token=xyz is present — verify
//     automatically on mount and show the result.
const STATUS = {
  PENDING: "pending",     // no token in URL, waiting on the user's inbox
  VERIFYING: "verifying", // token present, request in flight
  SUCCESS: "success",
  ERROR: "error",
};

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const emailFromQuery = searchParams.get("email"); // optional, for resend prefill

  const [status, setStatus] = useState(token ? STATUS.VERIFYING : STATUS.PENDING);
  const [error, setError] = useState("");
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent
  const navigate = useNavigate();

  const runVerification = useCallback(async (t) => {
    setStatus(STATUS.VERIFYING);
    setError("");
    try {
      // Per spec, /auth/verify-email returns {user, message} — no tokens.
      // Verifying doesn't log the user in; they still go through /login,
      // same as after a reset-password (deliberately no auto-session here).
      await verifyEmail({ token: t });
      setStatus(STATUS.SUCCESS);
    } catch (err) {
      setError(getErrorMessage(err, "This link is invalid or has expired."));
      setStatus(STATUS.ERROR);
    }
  }, []);

  useEffect(() => {
    if (token) runVerification(token);
  }, [token, runVerification]);

  async function handleResend() {
    if (!emailFromQuery) return;
    setResendState("sending");
    try {
      await resendVerification({ email: emailFromQuery });
      setResendState("sent");
    } catch {
      setResendState("idle");
    }
  }

  useEffect(() => {
    if (status === STATUS.SUCCESS) {
      const t = setTimeout(() => navigate("/login"), 2000);
      return () => clearTimeout(t);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-landing-bg-alt font-body">
      <header className="bg-landing-bg border-b border-landing-border-sub px-4 sm:px-6 py-4">
        <Link to="/" className="text-lg font-bold tracking-tight">
          <span className="text-landing-text">skill</span>
          <span className="text-landing-accent">bridge</span>
        </Link>
      </header>

      <main className="max-w-sm mx-auto px-6 py-16 text-center">
        {status === STATUS.PENDING && (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-landing-accent-bg flex items-center justify-center text-2xl">
              ✉️
            </div>
            <h1 className="font-landing-display text-xl font-semibold mb-2 text-landing-text">Check your inbox</h1>
            <p className="text-sm text-landing-muted mb-6">
              We sent a verification link to{" "}
              {emailFromQuery ? <span className="text-landing-text font-medium">{emailFromQuery}</span> : "your email"}.
              Click it to activate your account.
            </p>
            {emailFromQuery && (
              <button
                type="button"
                disabled={resendState !== "idle"}
                onClick={handleResend}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-landing-border text-landing-text hover:bg-landing-bg transition-colors disabled:opacity-50"
              >
                {resendState === "sending" && "Sending..."}
                {resendState === "sent" && "Email sent — check your inbox"}
                {resendState === "idle" && "Resend verification email"}
              </button>
            )}
          </>
        )}

        {status === STATUS.VERIFYING && (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-landing-border flex items-center justify-center text-2xl animate-pulse">
              ⏳
            </div>
            <h1 className="font-landing-display text-xl font-semibold mb-2 text-landing-text">Verifying your email...</h1>
            <p className="text-sm text-landing-muted">This will just take a moment.</p>
          </>
        )}

        {status === STATUS.SUCCESS && (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-success-bg flex items-center justify-center text-2xl">
              ✓
            </div>
            <h1 className="font-landing-display text-xl font-semibold mb-2 text-success">Email verified</h1>
            <p className="text-sm text-landing-muted">Taking you to login...</p>
          </>
        )}

        {status === STATUS.ERROR && (
          <>
            <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-danger-bg flex items-center justify-center text-2xl">
              ✕
            </div>
            <h1 className="font-landing-display text-xl font-semibold mb-2 text-danger">Verification failed</h1>
            <p className="text-sm text-landing-muted mb-6">{error}</p>
            {emailFromQuery && (
              <button
                type="button"
                disabled={resendState !== "idle"}
                onClick={handleResend}
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-landing-text text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {resendState === "sending" && "Sending..."}
                {resendState === "sent" && "New link sent — check your inbox"}
                {resendState === "idle" && "Send a new link"}
              </button>
            )}
            <Link to="/login" className="block mt-4 text-sm text-landing-muted hover:text-landing-text">
              Back to login
            </Link>
          </>
        )}
      </main>
    </div>
  );
}

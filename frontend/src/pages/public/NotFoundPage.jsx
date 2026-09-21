import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-landing-bg-alt flex flex-col items-center justify-center text-center px-6 font-body">
      <div className="font-landing-display text-5xl font-bold text-landing-text mb-2">404</div>
      <p className="text-sm text-landing-muted mb-6">That page doesn't exist.</p>
      <Link
        to="/"
        className="px-6 py-3 rounded-full text-sm font-semibold bg-landing-text text-white hover:opacity-90 transition-opacity"
      >
        Back to home
      </Link>
    </div>
  );
}

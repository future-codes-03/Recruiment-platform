import { Link } from "react-router-dom";
import Button from "../../components/shared/Button";

export default function LandingPage() {
  const steps = [
    { n: 1, label: "Assess your skill", active: false },
    { n: 2, label: "Clear the fixed bar", active: false },
    { n: 3, label: "Guaranteed interview", active: true },
  ];

  return (
    <div className="min-h-screen">
      <header className="bg-ink text-white flex justify-between items-center px-6 py-4">
        <div className="font-display font-bold text-lg">skillbridge</div>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/login" className="opacity-80 hover:opacity-100">Log in</Link>
          <Link to="/signup">
            <Button variant="primary">Sign up</Button>
          </Link>
        </div>
      </header>

      <main className="text-center px-6 py-16">
        <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight max-w-2xl mx-auto">
          Guaranteed interviews for skilled candidates.
        </h1>

        <div className="flex justify-center gap-3 mt-6">
          <Link to="/signup?as=candidate">
            <Button variant="primary">Find a guaranteed interview</Button>
          </Link>
          <Link to="/signup?as=employer">
            <Button>I'm hiring</Button>
          </Link>
        </div>

        <div className="flex justify-center items-center gap-4 mt-10">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    s.active ? "bg-brass text-ink" : "bg-ink text-white"
                  }`}
                >
                  {s.n}
                </div>
                <div className={`text-xs mt-1 ${s.active ? "text-brass-dark font-semibold" : "text-ink"}`}>
                  {s.label}
                </div>
              </div>
              {i < steps.length - 1 && <span className="text-slate">&rarr;</span>}
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-line text-center py-4 text-xs text-slate">
        About &middot; Pricing &middot; Contact
      </footer>
    </div>
  );
}

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
      <header className="bg-ink text-white flex justify-between items-center px-4 sm:px-6 py-4 gap-3">
        <div className="font-display font-bold text-lg shrink-0">skillbridge</div>
        <div className="flex items-center gap-3 sm:gap-4 text-sm">
          <Link to="/login" className="opacity-80 hover:opacity-100">Log in</Link>
          <Link to="/signup">
            <Button variant="primary">Sign up</Button>
          </Link>
        </div>
      </header>

      <main className="text-center px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-tight max-w-2xl mx-auto">
          Guaranteed interviews for skilled candidates.
        </h1>

        {/* Stacked full-width on mobile so long button labels never force
            horizontal scroll; side-by-side once there's room at sm:. */}
        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6 max-w-xs sm:max-w-none mx-auto">
          <Link to="/signup?as=candidate" className="w-full sm:w-auto">
            <Button variant="primary" className="w-full sm:w-auto">Find a guaranteed interview</Button>
          </Link>
          <Link to="/signup?as=employer" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">I'm hiring</Button>
          </Link>
        </div>

        {/* flex-wrap + centered so 3 steps + arrows reflow onto two lines on
            narrow screens instead of overflowing; each step is capped in
            width so its label wraps rather than stretching the row. */}
        <div className="flex flex-wrap justify-center items-start gap-x-4 gap-y-4 mt-10 px-2">
          {steps.map((s, i) => (
            <div key={s.n} className="flex items-center gap-4">
              <div className="flex flex-col items-center w-20">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    s.active ? "bg-brass text-ink" : "bg-ink text-white"
                  }`}
                >
                  {s.n}
                </div>
                <div className={`text-xs mt-1 text-center leading-tight ${s.active ? "text-brass-dark font-semibold" : "text-ink"}`}>
                  {s.label}
                </div>
              </div>
              {i < steps.length - 1 && <span className="text-slate hidden sm:inline">&rarr;</span>}
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

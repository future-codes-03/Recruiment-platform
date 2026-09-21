import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "../../components/shared/Button";
import { listPublicJobs } from "../../api/jobs";

function StatsBar() {
  const [stats, setStats] = useState(null); // null = loading/unavailable

  useEffect(() => {
    let cancelled = false;
    // Note: sums only the first page of /public/jobs (the API has no
    // aggregate endpoint yet). Accurate at current scale; if listings ever
    // exceed one page, this needs a real backend aggregate instead of a
    // client-side sum over a partial result set.
    listPublicJobs()
      .then((data) => {
        if (cancelled) return;
        const roles = data.results.length;
        const slots = data.results.reduce((sum, j) => sum + j.guaranteed_slots, 0);
        setStats({ roles, slots });
      })
      .catch(() => {
        // Silent — the stats bar just doesn't render rather than showing
        // an error on a marketing page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats || stats.roles === 0) return null;

  return (
    <div className="border-y border-line bg-card/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap justify-center gap-x-10 gap-y-3 text-center">
        <div>
          <div className="text-xl font-bold text-ink">{stats.roles}</div>
          <div className="text-xs text-slate">guaranteed-slot roles open now</div>
        </div>
        <div>
          <div className="text-xl font-bold text-ink">{stats.slots}</div>
          <div className="text-xs text-slate">guaranteed interview slots available</div>
        </div>
      </div>
    </div>
  );
}

const VALUE_PROPS = [
  {
    title: "A fixed skill bar, published upfront",
    desc: "Every role's minimum score is set before you start — no moving goalposts, no hidden rubric.",
  },
  {
    title: "No resume screening",
    desc: "Your assessment result decides whether you qualify — not who reviewed your resume, or when.",
  },
  {
    title: "First to qualify locks the slot",
    desc: "Guaranteed slots are limited and claimed in order — clear the bar and it's yours.",
  },
];

export default function LandingPage() {
  const steps = [
    { n: 1, label: "Assess your skill", desc: "Take the assessment for the role you want.", active: false },
    { n: 2, label: "Clear the fixed bar", desc: "Meet every published skill minimum.", active: false },
    { n: 3, label: "Guaranteed interview", desc: "First to qualify locks the slot.", active: true },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <header className="flex justify-between items-center px-4 sm:px-6 py-4 gap-3 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-display font-bold text-lg shrink-0 text-ink">
          <span className="w-6 h-6 rounded-md bg-brass inline-block" />
          skillbridge
        </div>
        <div className="flex items-center gap-3 sm:gap-5 text-sm">
          <Link to="/login" className="text-ink/70 hover:text-ink">Log in</Link>
          <Link to="/signup">
            <Button variant="primary" className="rounded-full">Sign up</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center">
          <div className="text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-ink bg-brass-light px-3 py-1.5 rounded-full mb-5">
              Guaranteed interview slots
            </div>
            <h1 className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-bold leading-tight max-w-xl mx-auto md:mx-0 text-ink">
              Guaranteed interviews for skilled candidates.
            </h1>
            <p className="text-slate text-sm sm:text-base mt-4 max-w-md mx-auto md:mx-0">
              Clear the published skill bar first, and the interview slot is
              locked in for you — no resume screening, no waiting.
            </p>

            <div className="flex flex-col sm:flex-row justify-center md:justify-start gap-3 mt-7 max-w-xs sm:max-w-none mx-auto md:mx-0">
              <Link to="/jobs" className="w-full sm:w-auto">
                <Button variant="primary" className="w-full sm:w-auto rounded-full">Browse guaranteed-slot roles</Button>
              </Link>
              <Link to="/signup?as=employer" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto rounded-full">I'm hiring</Button>
              </Link>
            </div>
          </div>

          <div className="bg-ink rounded-2xl p-6 sm:p-8">
            <div className="text-xs font-semibold text-white/50 uppercase tracking-widelabel mb-5">
              How it works
            </div>
            <div className="flex flex-col gap-5">
              {steps.map((s) => (
                <div key={s.n} className="flex items-start gap-4">
                  <div
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${
                      s.active ? "bg-brass text-ink" : "bg-white/10 text-white"
                    }`}
                  >
                    {s.n}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${s.active ? "text-brass" : "text-white"}`}>
                      {s.label}
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <StatsBar />

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink text-center mb-10">
          Why skillbridge
        </h2>
        <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
          {VALUE_PROPS.map((v) => (
            <div key={v.title}>
              <h3 className="text-sm font-bold text-ink mb-1.5">{v.title}</h3>
              <p className="text-sm text-slate">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line text-center py-5 text-xs text-slate">
        About &middot; Pricing &middot; Contact
      </footer>
    </div>
  );
}
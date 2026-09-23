import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listPublicJobs } from "../../api/jobs";

const NAV_LINKS = [
  { label: "Opportunities", to: "/jobs" },
  { label: "Our promise", to: "#how-it-works" },
  { label: "Employer space", to: "/signup?as=employer" },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Browse open roles",
    desc: "Explore opportunities from software houses and tech companies. Each listing shows you the exact skill bar you need to clear — no guessing.",
  },
  {
    step: "02",
    title: "Take the skill assessment",
    desc: "Complete a focused assessment tailored to the role. Finish in your own time, on your own schedule.",
  },
  {
    step: "03",
    title: "Earn your interview slot",
    desc: "Meet the bar and your interview is guaranteed. No ghosting, no subjective screening — just merit.",
  },
];

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    title: "Transparent skill bars",
    desc: "Every role publishes the exact skills and thresholds required. You always know what you're working towards.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Skill-based assessment",
    desc: "Our assessment evaluates technical depth, not presentation. Consistent, and built for modern tech roles.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
        <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Guaranteed interviews",
    desc: "Clear the bar once and you're in. Employers commit to interviewing every candidate who qualifies — no exceptions.",
  },
  {
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    title: "Built for software houses",
    desc: "Role templates and guaranteed-slot hiring purpose-built for agencies and product studios hiring at scale.",
  },
];

// Placeholder quotes matching the Figma reference layout — swap for real
// customer testimonials before this goes live publicly.
const TESTIMONIALS = [
  {
    quote: "We cut our time-to-interview dramatically. Candidates arrive already screened and motivated — the quality of our pipeline has never been better.",
    name: "[Name]",
    role: "Talent Lead, [Company]",
    avatar: "?",
  },
  {
    quote: "For the first time I knew exactly what I needed to do to get an interview. I practised, hit the bar, and had an offer within weeks.",
    name: "[Name]",
    role: "Candidate",
    avatar: "?",
  },
  {
    quote: "The transparency builds trust. Candidates respect the process and show up better prepared than anything we've seen with traditional CVs.",
    name: "[Name]",
    role: "CTO, [Company]",
    avatar: "?",
  },
];

// Illustrative sample roles matching the Figma reference — cards link to the
// real jobs browse page rather than fabricated job IDs.
const SAMPLE_ROLES = [
  { title: "Senior React Developer", company: "[Company]", skills: ["React ≥ 75%", "TypeScript ≥ 70%", "GraphQL ≥ 60%"], slots: "3 of 5 slots open" },
  { title: "Data Analyst Intern", company: "[Company]", skills: ["Excel ≥ 65%", "SQL ≥ 65%", "Data analysis ≥ 60%"], slots: "4 of 8 slots open" },
  { title: "Backend Engineer", company: "[Company]", skills: ["Node.js ≥ 70%", "PostgreSQL ≥ 65%", "API design ≥ 65%"], slots: "2 of 4 slots open" },
];

function Logo({ dark = false }) {
  return (
    <span className="text-xl font-bold tracking-tight select-none">
      <span className={dark ? "text-white" : "text-landing-text"}>skill</span>
      <span className="text-landing-accent">bridge</span>
    </span>
  );
}

// A link that resolves to a real route/section when one exists, and a
// visually-consistent but inert placeholder otherwise — avoids shipping
// dead `href="#"` links for pages that don't exist yet.
function FooterLink({ label, to }) {
  if (!to) {
    return <span className="text-sm text-landing-dark-muted/60 cursor-default">{label}</span>;
  }
  if (to.startsWith("/")) {
    return (
      <Link to={to} className="text-sm text-landing-dark-muted hover:text-white transition-colors">
        {label}
      </Link>
    );
  }
  return (
    <a href={to} className="text-sm text-landing-dark-muted hover:text-white transition-colors">
      {label}
    </a>
  );
}

function InterviewCard() {
  return (
    <div className="rounded-2xl p-8 shadow-lg bg-landing-hero-card border border-landing-border min-w-70 sm:min-w-80">
      <p className="text-sm text-landing-muted">Data Analyst Intern · [Company]</p>
      <h3 className="text-xl font-semibold mt-2 mb-1 text-landing-text">Your interview path</h3>
      <p className="text-sm mb-4 text-landing-muted">4 of 8 interview slots are available</p>
      <div className="relative h-2 rounded-full mb-3 bg-landing-hero-progress-track">
        <div className="absolute inset-y-0 left-0 rounded-full bg-landing-hero-progress" style={{ width: "60%" }} />
      </div>
      <p className="text-sm mb-5 text-landing-muted">The assessment checks 3 skills</p>
      <div className="flex flex-wrap gap-2">
        {["Excel ≥ 65%", "SQL ≥ 65%", "Data analysis ≥ 60%"].map((skill) => (
          <span
            key={skill}
            className="px-3 py-1 rounded-full text-sm font-medium bg-landing-hero-pill-bg text-landing-hero-pill-text"
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

function StatsStrip() {
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
        // Silent — the stats strip just doesn't render rather than showing
        // an error on a marketing page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats || stats.roles === 0) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
      <div className="grid grid-cols-2 border-t border-landing-border">
        <div className="py-8 pr-6">
          <p className="text-2xl font-bold mb-0.5 text-landing-text">{stats.roles}</p>
          <p className="text-sm text-landing-muted">guaranteed-slot roles open now</p>
        </div>
        <div className="py-8 pl-6 border-l border-landing-border">
          <p className="text-2xl font-bold mb-0.5 text-landing-text">{stats.slots}</p>
          <p className="text-sm text-landing-muted">guaranteed interview slots available</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="font-body text-landing-text bg-landing-bg">
      {/* ── Nav ── */}
      <header className="bg-landing-bg border-b border-landing-border-sub">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <Logo />
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) =>
              l.to.startsWith("/") ? (
                <Link key={l.label} to={l.to} className="text-sm text-landing-muted hover:text-landing-text transition-colors">
                  {l.label}
                </Link>
              ) : (
                <a key={l.label} href={l.to} className="text-sm text-landing-muted hover:text-landing-text transition-colors">
                  {l.label}
                </a>
              )
            )}
          </nav>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="hidden md:block text-sm font-medium px-5 py-2 rounded-lg border border-landing-border text-landing-text hover:bg-landing-bg-alt transition-colors focus-visible:outline-2 focus-visible:outline-landing-accent"
            >
              Log in
            </Link>
            <button
              className="md:hidden p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-landing-text">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden px-4 sm:px-6 pb-4 flex flex-col gap-4 border-t border-landing-border-sub">
            {NAV_LINKS.map((l) =>
              l.to.startsWith("/") ? (
                <Link key={l.label} to={l.to} className="text-sm text-landing-muted" onClick={() => setMobileOpen(false)}>
                  {l.label}
                </Link>
              ) : (
                <a key={l.label} href={l.to} className="text-sm text-landing-muted" onClick={() => setMobileOpen(false)}>
                  {l.label}
                </a>
              )
            )}
            <Link to="/login" className="text-sm font-medium text-landing-text" onClick={() => setMobileOpen(false)}>
              Log in
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="bg-linear-to-r from-landing-hero-from via-landing-hero-via to-landing-hero-to">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium mb-6 text-landing-accent">
              <span className="w-2 h-2 rounded-full inline-block bg-landing-accent" />
              Fair chances, clearly earned
            </p>
            <h1 className="font-landing-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 text-landing-text">
              Talent deserves a fair way into the room.
            </h1>
            <p className="text-lg mb-10 max-w-md text-landing-muted leading-relaxed">
              Explore roles with an open skill bar. When your work meets the standard, your interview is guaranteed.
            </p>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-xl text-base font-semibold text-white transition-colors hover:bg-landing-hero-cta-hover bg-landing-hero-cta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-accent"
            >
              Browse opportunities →
            </Link>
          </div>
          <div className="flex justify-center lg:justify-end">
            <InterviewCard />
          </div>
        </div>

        <StatsStrip />
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 sm:py-24 bg-landing-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-16">
            <p className="text-sm font-medium mb-3 text-landing-accent">How it works</p>
            <h2 className="font-landing-display text-3xl sm:text-4xl font-bold text-landing-text">
              Three steps.
              <br />
              No ambiguity.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {HOW_IT_WORKS.map(({ step, title, desc }) => (
              <div key={step}>
                <p className="text-4xl font-bold mb-4 text-landing-card">{step}</p>
                <h3 className="text-lg font-semibold mb-3 text-landing-text">{title}</h3>
                <p className="text-sm leading-relaxed text-landing-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live opportunities ── */}
      <section className="py-20 sm:py-24 bg-landing-bg-alt">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
            <div>
              <p className="text-sm font-medium mb-3 text-landing-accent">Open now</p>
              <h2 className="font-landing-display text-3xl sm:text-4xl font-bold text-landing-text">Live opportunities</h2>
            </div>
            <Link to="/jobs" className="text-sm font-medium underline underline-offset-4 text-landing-accent">
              View all roles →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {SAMPLE_ROLES.map(({ title, company, skills, slots }) => (
              <Link
                key={title}
                to="/jobs"
                className="group rounded-2xl p-7 flex flex-col gap-5 transition-shadow hover:shadow-xl bg-landing-card border border-landing-border"
              >
                <div>
                  <p className="text-xs font-medium mb-1 text-landing-accent">{company}</p>
                  <h3 className="text-base font-semibold text-landing-text">{title}</h3>
                </div>
                <div>
                  <p className="text-xs mb-2 text-landing-muted">{slots}</p>
                  <div className="h-1.5 rounded-full mb-4 bg-landing-border">
                    <div className="h-full rounded-full bg-landing-accent" style={{ width: "55%" }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-landing-hero-pill-bg text-landing-hero-pill-text"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="mt-auto text-sm font-semibold py-2.5 rounded-lg text-center text-white transition-colors bg-landing-hero-cta group-hover:bg-landing-hero-cta-hover">
                  View assessment →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 sm:py-24 bg-landing-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-16">
            <p className="text-sm font-medium mb-3 text-landing-accent">The platform</p>
            <h2 className="font-landing-display text-3xl sm:text-4xl font-bold max-w-md text-landing-text">
              Designed for merit. Built for scale.
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map(({ icon, title, desc }) => (
              <div key={title}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 bg-landing-accent-bg text-landing-accent">
                  {icon}
                </div>
                <h3 className="font-semibold mb-2 text-landing-text">{title}</h3>
                <p className="text-sm leading-relaxed text-landing-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 sm:py-24 bg-landing-bg-alt">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="mb-14">
            <p className="text-sm font-medium mb-3 text-landing-accent">What they say</p>
            <h2 className="font-landing-display text-3xl sm:text-4xl font-bold text-landing-text">Trust earned on both sides.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-7">
            {TESTIMONIALS.map(({ quote, name, role, avatar }) => (
              <div key={name + role} className="rounded-2xl p-8 flex flex-col gap-6 bg-landing-card border border-landing-border">
                <p className="text-sm leading-relaxed flex-1 text-landing-dim">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-landing-accent text-white">
                    {avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-landing-text">{name}</p>
                    <p className="text-xs text-landing-muted">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For Employers CTA ── */}
      <section className="py-20 sm:py-24 bg-landing-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl p-8 sm:p-12 lg:p-16 grid lg:grid-cols-2 gap-10 items-center bg-landing-text">
            <div>
              <p className="text-sm font-medium mb-4 text-landing-accent">For employers</p>
              <h2 className="font-landing-display text-3xl sm:text-4xl font-bold mb-5 text-white">
                Hire on evidence,
                <br />
                not first impressions.
              </h2>
              <p className="text-base leading-relaxed text-landing-dark-muted">
                Set the standard once. Skillbridge screens the field and delivers only qualified candidates. No
                manual review, no screening calls, no wasted slots.
              </p>
            </div>
            <div className="flex flex-col gap-4 lg:pl-10">
              {[
                "Define role-specific skill thresholds",
                "Assessment runs automatically",
                "Qualified candidates claim their slot first-come, first-served",
                "You pay nothing to post or hire",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-landing-accent">
                    <svg width="10" height="10" fill="none" viewBox="0 0 10 10">
                      <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-300">{item}</p>
                </div>
              ))}
              <Link
                to="/signup?as=employer"
                className="mt-4 inline-flex items-center gap-2 px-7 py-4 rounded-xl text-sm font-semibold self-start transition-opacity hover:opacity-90 bg-landing-accent text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Open employer space →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-16 sm:py-20 bg-landing-bg-alt border-t border-landing-border">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-landing-display text-3xl sm:text-4xl font-bold mb-5 text-landing-text">
            Your next role starts with a skill, not a referral.
          </h2>
          <p className="text-base mb-10 text-landing-muted">
            Browse open roles, clear the published bar, and lock in your interview.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/jobs"
              className="px-7 py-4 rounded-xl text-sm font-semibold text-white transition-colors hover:bg-landing-hero-cta-hover bg-landing-hero-cta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-landing-accent"
            >
              Browse opportunities →
            </Link>
            <Link
              to="/signup?as=employer"
              className="px-7 py-4 rounded-xl text-sm font-semibold transition-colors border border-landing-border text-landing-text hover:bg-landing-bg"
            >
              Post a role
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-landing-text">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <Logo dark />
            <p className="text-sm mt-4 max-w-xs text-landing-dark-muted">
              Fair recruitment for the modern tech industry. Skill-first, always.
            </p>
          </div>
          {[
            {
              heading: "Candidates",
              links: [
                { label: "Browse opportunities", to: "/jobs" },
                { label: "How it works", to: "#how-it-works" },
                { label: "Our promise", to: "#how-it-works" },
                { label: "FAQ", to: null },
              ],
            },
            {
              heading: "Employers",
              links: [
                { label: "Employer space", to: "/signup?as=employer" },
                { label: "Pricing", to: null },
                { label: "Integrations", to: null },
                { label: "Case studies", to: null },
              ],
            },
            {
              heading: "Company",
              links: [
                { label: "About", to: null },
                { label: "Blog", to: null },
                { label: "Careers", to: null },
                { label: "Contact", to: null },
              ],
            },
          ].map(({ heading, links }) => (
            <div key={heading}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4 text-landing-dark-muted">{heading}</p>
              <ul className="flex flex-col gap-3">
                {links.map((l) => (
                  <li key={l.label}>
                    <FooterLink {...l} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-landing-dim">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row justify-between gap-3">
            <p className="text-xs text-landing-dark-muted">© 2026 Skillbridge. All rights reserved.</p>
            <div className="flex gap-5">
              {["Privacy", "Terms", "Cookies"].map((l) => (
                <span key={l} className="text-xs text-landing-dark-muted cursor-default">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

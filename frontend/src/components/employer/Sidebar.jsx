import { Link } from 'react-router-dom'

const NAV_LINKS = [
  { label: 'Dashboard', to: '/employer/dashboard' },
  { label: 'Jobs', to: '/employer/dashboard' },
  { label: 'Candidates', to: null },
  { label: 'Settings', to: '/employer/settings' },
]

function Sidebar({ activeLink = 'Dashboard' }) {
  return (
    <aside className="bg-ink text-white w-56 min-h-screen flex flex-col px-4 py-6">
      <span className="text-lg font-bold tracking-tight px-2 mb-8">
        skill<span className="text-brass">bridge</span>
      </span>

      <nav className="flex flex-col gap-1">
        {NAV_LINKS.map((link) =>
          link.to ? (
            <Link
              key={link.label}
              to={link.to}
              className={`text-sm font-bold px-3 py-2 rounded-lg ${
                link.label === activeLink
                  ? 'bg-brass text-ink'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ) : (
            <span
              key={link.label}
              aria-disabled="true"
              title="Coming soon"
              className="text-sm font-bold px-3 py-2 rounded-lg text-white/30 cursor-not-allowed"
            >
              {link.label}
            </span>
          ),
        )}
      </nav>

      <div className="mt-auto flex items-center gap-2 px-2 pt-6">
        <div className="w-8 h-8 rounded-full bg-slate flex items-center justify-center text-xs font-bold">
          ZM
        </div>
        <span className="text-sm font-medium text-white/80">Zain</span>
      </div>
    </aside>
  )
}

export default Sidebar

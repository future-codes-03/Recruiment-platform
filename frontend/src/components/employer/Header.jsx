import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV_LINKS = [
  { label: 'Dashboard', to: '/employer/dashboard' },
  { label: 'Jobs', to: '/employer/dashboard' },
  { label: 'Candidates', to: null },
  { label: 'Settings', to: '/employer/settings' },
]

function NavLink({ link, activeLink, onClick }) {
  if (!link.to) {
    return (
      <span
        aria-disabled="true"
        title="Coming soon"
        className="text-sm font-bold text-white/30 cursor-not-allowed"
      >
        {link.label}
      </span>
    )
  }
  return (
    <Link
      to={link.to}
      onClick={onClick}
      className={`text-sm font-bold ${
        link.label === activeLink ? 'text-brass' : 'text-white/70 hover:text-white'
      }`}
    >
      {link.label}
    </Link>
  )
}

function Avatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-slate flex items-center justify-center text-xs font-bold shrink-0">
      ZM
    </div>
  )
}

function Header({ activeLink = 'Dashboard' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="bg-ink text-white px-4 sm:px-6 py-3 relative">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">
          skill<span className="text-brass">bridge</span>
        </span>

        {/* Full nav — only when there's room for it */}
        <nav className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.label} link={link} activeLink={activeLink} />
          ))}

          <button
            type="button"
            aria-label="Notifications"
            className="relative flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-5.5-6.84V3a1.5 1.5 0 0 0-3 0v1.16A7 7 0 0 0 5 11v5l-1.7 1.7a1 1 0 0 0 .7 1.7h16a1 1 0 0 0 .7-1.7L19 16Z" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brass" />
          </button>

          {/* Avatar doubles as the logout menu — the only account-level
              action that exists right now, so a full menu felt premature. */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-expanded={avatarMenuOpen}
            >
              <Avatar />
            </button>
            {avatarMenuOpen && (
              <div className="absolute right-0 mt-2 w-36 bg-white rounded-lg shadow-lg border border-slate/15 overflow-hidden z-10">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-ink hover:bg-paper"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Narrow screens: avatar stays visible, everything else collapses
            behind a menu button instead of trying to squeeze onto one row. */}
        <div className="flex items-center gap-3 md:hidden">
          <Avatar />
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden mt-3 pt-3 border-t border-white/10 flex flex-col gap-4 pb-1">
          {NAV_LINKS.map((link) => (
            <NavLink key={link.label} link={link} activeLink={activeLink} onClick={() => setMenuOpen(false)} />
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="text-left text-sm font-bold text-white/70 hover:text-white"
          >
            Log out
          </button>
        </nav>
      )}
    </header>
  )
}

export default Header

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Button from '../shared/Button'

// Mirrors components/employer/Header.jsx (same interaction patterns:
// collapsible mobile menu, avatar dropdown for logout) — candidate-facing
// links, plus a guest state since /jobs and /jobs/:id are public pages a
// logged-out visitor can land on directly. Settings isn't built yet, so
// it's disabled the same way employer Header disables "Candidates".
const NAV_LINKS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Jobs', to: '/jobs' },
  { label: 'Settings', to: '/profile' },
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

function Avatar({ initials }) {
  return (
    <div className="w-8 h-8 rounded-full bg-slate flex items-center justify-center text-xs font-bold shrink-0">
      {initials}
    </div>
  )
}

function getInitials(fullName) {
  if (!fullName) return '?'
  const parts = fullName.trim().split(/\s+/)
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function Header({ activeLink = 'Dashboard' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const initials = getInitials(user?.full_name)

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <header className="bg-ink text-white px-4 sm:px-6 py-3 relative">
      <div className="flex items-center justify-between">
        <Link to={user ? '/dashboard' : '/'} className="text-lg font-bold tracking-tight">
          skill<span className="text-brass">bridge</span>
        </Link>

        {/* Logged in: nav links + avatar/logout. Logged out (guest browsing
            /jobs or /jobs/:id): just Log in / Sign up — same as the
            LandingPage header. */}
        {user ? (
          <>
            <nav className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <NavLink key={link.label} link={link} activeLink={activeLink} />
              ))}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAvatarMenuOpen((v) => !v)}
                  aria-label="Account menu"
                  aria-expanded={avatarMenuOpen}
                >
                  <Avatar initials={initials} />
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

            <div className="flex items-center gap-3 md:hidden">
              <Avatar initials={initials} />
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
          </>
        ) : (
          <div className="flex items-center gap-3 sm:gap-5 text-sm">
            <Link to="/login" className="text-white/70 hover:text-white font-bold">Log in</Link>
            <Link to="/signup?as=candidate">
              <Button variant="primary" className="rounded-full">Sign up</Button>
            </Link>
          </div>
        )}
      </div>

      {user && menuOpen && (
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

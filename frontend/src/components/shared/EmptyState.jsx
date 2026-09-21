import { Link } from 'react-router-dom'
import Button from './Button'

function DefaultIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate/40 mb-4">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </svg>
  )
}

function EmptyState({ title, message, actionLabel, actionTo, icon, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {icon !== null && (icon || <DefaultIcon />)}
      <h2 className="text-lg font-bold text-ink mb-2">{title}</h2>
      {message && <p className="text-sm text-slate mb-6 max-w-sm">{message}</p>}
      {actionLabel && actionTo && (
        <Link to={actionTo}>
          <Button variant="primary">{actionLabel}</Button>
        </Link>
      )}
    </div>
  )
}

export default EmptyState
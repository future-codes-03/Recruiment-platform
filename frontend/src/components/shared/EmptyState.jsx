import { Link } from 'react-router-dom'
import Button from './Button'

function EmptyState({ title, message, actionLabel, actionTo, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
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

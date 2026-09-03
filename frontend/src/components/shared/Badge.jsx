import { useState } from 'react'

const VARIANT_CLASSES = {
  brass: 'bg-brass text-ink font-bold px-3 py-1 rounded-full text-xs',
  success: 'text-success font-bold text-xs',
  slate: 'bg-slate/15 text-slate font-medium px-3 py-1 rounded-full text-xs',
}

function Badge({ variant = 'slate', children, tooltip, className = '' }) {
  const [showTooltip, setShowTooltip] = useState(false)

  if (variant === 'flag') {
    return (
      <span
        className={`relative inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold text-white bg-orange-500/90 cursor-default ${className}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2 1 21h22L12 2Zm0 5.5 7 12.5H5l7-12.5ZM11 10v5h2v-5h-2Zm0 6.5V19h2v-2.5h-2Z" />
        </svg>
        {children}
        {tooltip && showTooltip && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] whitespace-normal rounded-lg bg-ink text-white text-xs font-normal px-3 py-2 shadow-lg z-10">
            {tooltip}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </span>
  )
}

export default Badge

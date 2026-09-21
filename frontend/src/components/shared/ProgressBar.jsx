function ProgressBar({ value = 0, max = 100, label, showValue = false, className = '' }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100))

  // Every current usage tracks guaranteed-slot claims — a fuller bar means
  // fewer spots left for a candidate still deciding whether to apply.
  // Green/amber/red maps directly to "plenty of room" / "filling up" /
  // "almost gone".
  const barColor =
    percent >= 90 ? 'bg-danger' : percent >= 60 ? 'bg-amber-500' : 'bg-success'

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-[10px] uppercase tracking-widelabel text-slate font-bold">
              {label}
            </span>
          )}
          {showValue && (
            <span className="text-xs font-bold text-ink">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-slate/20 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-300`}
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  )
}

export default ProgressBar
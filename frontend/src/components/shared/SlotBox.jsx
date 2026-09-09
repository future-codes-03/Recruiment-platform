function SlotBox({ filled, total, label = 'Slots filled', className = '' }) {
  return (
    <div
      className={`inline-flex flex-col items-center gap-1 bg-ink rounded-xl px-5 py-3 ${className}`}
    >
      <span className="text-[10px] uppercase tracking-widelabel text-slate font-bold">
        {label}
      </span>
      <span className="text-2xl font-bold text-brass leading-none">
        {filled} <span className="text-slate font-normal text-base">of</span> {total}
      </span>
    </div>
  )
}

export default SlotBox

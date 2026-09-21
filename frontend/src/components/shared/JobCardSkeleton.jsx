function JobCardSkeleton() {
  return (
    <div className="bg-card rounded-xl shadow-[0_2px_10px_rgba(28,37,52,0.08)] p-6 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="h-4 w-48 bg-slate/20 rounded mb-2" />
          <div className="h-3 w-28 bg-slate/15 rounded mb-4" />
          <div className="flex gap-1.5 mb-4">
            <div className="h-5 w-16 bg-slate/15 rounded-full" />
            <div className="h-5 w-20 bg-slate/15 rounded-full" />
          </div>
          <div className="h-2 w-full bg-slate/15 rounded-full mb-2" />
          <div className="h-3 w-40 bg-slate/15 rounded" />
        </div>
        <div className="h-4 w-20 bg-slate/15 rounded shrink-0" />
      </div>
    </div>
  )
}

export default JobCardSkeleton
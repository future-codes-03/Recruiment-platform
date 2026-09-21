function JobCardSkeleton() {
  return (
    <div className="bg-landing-bg border border-landing-border rounded-2xl p-6 shadow-sm animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="h-4 w-48 bg-landing-border rounded mb-2" />
          <div className="h-3 w-28 bg-landing-border/70 rounded mb-4" />
          <div className="flex gap-1.5 mb-4">
            <div className="h-5 w-16 bg-landing-border/70 rounded-full" />
            <div className="h-5 w-20 bg-landing-border/70 rounded-full" />
          </div>
          <div className="h-2 w-full bg-landing-border/70 rounded-full mb-2" />
          <div className="h-3 w-40 bg-landing-border/70 rounded" />
        </div>
        <div className="h-4 w-20 bg-landing-border/70 rounded shrink-0" />
      </div>
    </div>
  )
}

export default JobCardSkeleton
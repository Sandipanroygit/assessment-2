export default function TeacherLoading() {
  return (
    <main className="section-padding space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded bg-white/15 animate-pulse" />
          <div className="h-9 w-56 rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-72 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-24 rounded-xl bg-white/10 animate-pulse" />
          <div className="h-10 w-36 rounded-xl bg-white/10 animate-pulse" />
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-3 items-center">
        <div className="h-4 w-24 rounded bg-white/15 animate-pulse" />
        <div className="h-10 w-56 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-10 w-36 rounded-lg bg-white/10 animate-pulse" />
      </div>

      <div className="glass-panel rounded-2xl p-4 overflow-auto">
        <div className="space-y-3 min-w-[720px]">
          <div className="grid grid-cols-6 gap-3">
            <div className="h-4 rounded bg-white/10 animate-pulse" />
            <div className="h-4 rounded bg-white/10 animate-pulse" />
            <div className="h-4 rounded bg-white/10 animate-pulse" />
            <div className="h-4 rounded bg-white/10 animate-pulse" />
            <div className="h-4 rounded bg-white/10 animate-pulse" />
            <div className="h-4 rounded bg-white/10 animate-pulse" />
          </div>
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={`teacher-loading-row-${index}`} className="grid grid-cols-6 gap-3">
              <div className="h-4 rounded bg-white/10 animate-pulse" />
              <div className="h-4 rounded bg-white/10 animate-pulse" />
              <div className="h-4 rounded bg-white/10 animate-pulse" />
              <div className="h-4 rounded bg-white/10 animate-pulse" />
              <div className="h-4 rounded bg-white/10 animate-pulse" />
              <div className="h-4 rounded bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

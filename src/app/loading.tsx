import { TableSkeleton, Skeleton } from "@/components/Skeleton";

export default function RootLoading() {
  return (
    <main className="section-padding space-y-8 min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 rounded bg-white/10" />
          <Skeleton className="h-10 w-64 rounded-xl bg-white/15" />
          <Skeleton className="h-5 w-80 rounded bg-white/5" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24 rounded-full bg-white/10" />
          <Skeleton className="h-10 w-24 rounded-full bg-white/10" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="h-32 rounded-2xl bg-white/10 animate-pulse border border-white/5" />
        <div className="h-32 rounded-2xl bg-white/10 animate-pulse border border-white/5" />
        <div className="h-32 rounded-2xl bg-white/10 animate-pulse border border-white/5" />
      </div>

      <TableSkeleton rows={8} cols={5} />
    </main>
  );
}

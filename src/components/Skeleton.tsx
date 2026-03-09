"use client";

import { type HTMLAttributes } from "react";

/**
 * Professional shimmering skeleton component.
 * Uses CSS mixins and an animated gradient to reduce "perceived wait time".
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/10 ${className}`}
      style={{
        backgroundImage: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s infinite linear",
      }}
      {...props}
    >
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-6 space-y-4">
      <Skeleton className="h-6 w-3/4 rounded-lg" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-panel rounded-2xl p-4 overflow-hidden">
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex gap-4 pb-2 border-b border-white/5">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={`th-${i}`} className="h-4 flex-1 rounded" />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: rows }).map((_, ri) => (
          <div key={`tr-${ri}`} className="flex gap-4">
            {Array.from({ length: cols }).map((_, ci) => (
              <Skeleton key={`td-${ri}-${ci}`} className="h-4 flex-1 rounded opacity-50" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

import { cn } from '../../utils/cn';

/**
 * Skeleton — flat shimmer block.
 * Uses a subtle gradient shimmer over surface-soft so it's visible on
 * dark canvas without being noisy.
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[6px]",
        "bg-[var(--surface-soft)]",
        "before:absolute before:inset-0",
        "before:bg-[linear-gradient(90deg,transparent_0%,color-mix(in_srgb,var(--text)_8%,transparent)_50%,transparent_100%)]",
        "before:animate-[shimmer_1.6s_infinite]",
        "before:bg-[length:200%_100%]",
        className
      )}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-[var(--surface)] border border-[color:var(--border)] rounded-[10px] p-5">
      <Skeleton className="h-5 w-3/4 mb-3" />
      <Skeleton className="h-3 w-full mb-1.5" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2.5 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

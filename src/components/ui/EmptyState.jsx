import { cn } from '../../utils/cn';

/**
 * EmptyState — quiet, deliberate, premium.
 * Sits flat on the canvas (no card), pairs an outlined icon mark with
 * a tight title and supporting sentence. Renders an optional action.
 */
export function EmptyState({ icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-14 px-6",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "flex items-center justify-center mb-4",
            compact ? "w-10 h-10" : "w-12 h-12",
            "rounded-[10px] border border-[color:var(--border)]",
            "bg-[var(--surface-soft)] text-[color:var(--text-muted)]"
          )}
        >
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-sm font-semibold text-[color:var(--text)] tracking-tight mb-1.5">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-xs text-[color:var(--text-muted)] max-w-sm leading-relaxed mb-5">
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

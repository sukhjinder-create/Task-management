import { cn } from '../../utils/cn';

/**
 * Badge — enterprise label/status chip
 * Compact, sharp, theme-aware. Subtle by default, solid only when
 * we genuinely need attention.
 */
const palette = {
  primary: {
    solid:   "bg-[var(--primary)] text-[color:var(--primary-contrast)] border-transparent",
    outline: "bg-transparent text-[color:var(--primary)] border-[color:var(--primary)]",
    subtle:  "bg-[var(--primary-soft)] text-[color:var(--primary)] border-[color:color-mix(in_srgb,var(--primary)_28%,var(--border))]",
  },
  success: {
    solid:   "bg-[var(--score-good)] text-white border-transparent",
    outline: "bg-transparent text-[color:var(--score-good)] border-[color:var(--score-good)]",
    subtle:  "bg-[color:var(--score-good-bg)] text-[color:var(--score-good)] border-[color:var(--score-good-border)]",
  },
  warning: {
    solid:   "bg-[var(--score-warning)] text-white border-transparent",
    outline: "bg-transparent text-[color:var(--score-warning)] border-[color:var(--score-warning)]",
    subtle:  "bg-[color:var(--score-warning-bg)] text-[color:var(--score-warning)] border-[color:var(--score-warning-border)]",
  },
  danger: {
    solid:   "bg-[var(--score-danger)] text-white border-transparent",
    outline: "bg-transparent text-[color:var(--score-danger)] border-[color:var(--score-danger)]",
    subtle:  "bg-[color:var(--score-danger-bg)] text-[color:var(--score-danger)] border-[color:var(--score-danger-border)]",
  },
  neutral: {
    solid:   "bg-[var(--surface-strong)] text-[color:var(--text)] border-transparent",
    outline: "bg-transparent text-[color:var(--text-muted)] border-[color:var(--border)]",
    subtle:  "bg-[var(--surface-soft)] text-[color:var(--text-muted)] border-[color:var(--border)]",
  },
};

const sizes = {
  sm: "text-2xs px-1.5 py-0.5",
  md: "text-xs  px-2   py-0.5",
  lg: "text-xs  px-2.5 py-1",
};

export function Badge({
  children,
  variant = "subtle",
  color = "neutral",
  size = "sm",
  className,
  ...props
}) {
  const colorSet = palette[color] || palette.neutral;
  const classes = colorSet[variant] || colorSet.subtle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] border font-medium leading-none tracking-tight",
        classes,
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

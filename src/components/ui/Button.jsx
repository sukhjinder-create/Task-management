import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

/**
 * Enterprise Button
 * Sharp, dense, deliberate. No gradients on default variants.
 * Variants kept name-compatible with existing callers:
 *   primary | secondary | ghost | danger | success | outline | premium | shimmer
 */
const variants = {
  primary:
    "bg-[var(--primary)] text-[color:var(--primary-contrast)] " +
    "hover:bg-[var(--primary-hover)] active:opacity-90 " +
    "border border-[color:var(--primary)]",
  secondary:
    "bg-[var(--surface-soft)] text-[color:var(--text)] " +
    "border border-[color:var(--border)] " +
    "hover:bg-[var(--surface-strong)] hover:border-[color:var(--border-strong)]",
  ghost:
    "bg-transparent text-[color:var(--text-muted)] " +
    "hover:bg-[var(--surface-soft)] hover:text-[color:var(--text)] " +
    "border border-transparent",
  outline:
    "bg-transparent text-[color:var(--primary)] " +
    "border border-[color:var(--primary)] " +
    "hover:bg-[var(--primary-soft)]",
  danger:
    "bg-[var(--score-danger)] text-white " +
    "border border-[color:var(--score-danger)] " +
    "hover:opacity-90 active:opacity-80",
  success:
    "bg-[var(--score-good)] text-white " +
    "border border-[color:var(--score-good)] " +
    "hover:opacity-90 active:opacity-80",
  // legacy aliases kept compatible
  premium:
    "bg-[var(--primary)] text-[color:var(--primary-contrast)] " +
    "border border-[color:var(--primary)] " +
    "hover:bg-[var(--primary-hover)]",
  shimmer:
    "bg-[var(--primary)] text-[color:var(--primary-contrast)] " +
    "border border-[color:var(--primary)] " +
    "hover:bg-[var(--primary-hover)] relative overflow-hidden",
};

const sizes = {
  xs: "h-7  px-2.5 text-2xs gap-1.5 rounded-[6px]",
  sm: "h-8  px-3   text-xs  gap-1.5 rounded-[6px]",
  md: "h-9  px-3.5 text-sm  gap-2   rounded-[8px]",
  lg: "h-10 px-4   text-sm  gap-2   rounded-[8px]",
};

export const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    children,
    className,
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium select-none",
        "transition-[background-color,border-color,opacity,color] duration-150",
        "focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "whitespace-nowrap",
        sizes[size],
        variants[variant] || variants.primary,
        className
      )}
      {...props}
    >
      {loading ? (
        <Spinner size={size === "xs" || size === "sm" ? "xs" : "sm"} />
      ) : (
        leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>
      )}
      {children != null && <span className="truncate">{children}</span>}
      {!loading && rightIcon && (
        <span className="shrink-0 inline-flex">{rightIcon}</span>
      )}
    </button>
  );
});

Button.displayName = "Button";

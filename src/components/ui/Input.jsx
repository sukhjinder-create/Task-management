import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

const inputBase =
  "w-full text-sm bg-[var(--surface)] text-[color:var(--text)] " +
  "border border-[color:var(--border)] rounded-[8px] " +
  "transition-[border-color,box-shadow] duration-150 " +
  "placeholder:text-[color:var(--text-soft)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed " +
  "focus:outline-none focus:border-[color:var(--primary)] " +
  "focus:shadow-[0_0_0_3px_var(--ring)]";

export const Input = forwardRef(function Input(
  {
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    className,
    containerClassName,
    size = "md",
    ...props
  },
  ref
) {
  const inputId = props.id || props.name;

  const sizeClasses =
    size === "sm" ? "h-8 px-2.5" : size === "lg" ? "h-11 px-3.5" : "h-9 px-3";

  return (
    <div className={cn("w-full", containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leftIcon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-soft)] pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            inputBase,
            sizeClasses,
            leftIcon && "pl-9",
            rightIcon && "pr-9",
            error &&
              "border-[color:var(--score-danger)] focus:border-[color:var(--score-danger)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--score-danger)_25%,transparent)]",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--text-soft)]">
            {rightIcon}
          </div>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-[color:var(--score-danger)]">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">{helperText}</p>
      )}
    </div>
  );
});
Input.displayName = "Input";

export const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    helperText,
    className,
    containerClassName,
    rows = 4,
    ...props
  },
  ref
) {
  const inputId = props.id || props.name;
  return (
    <div className={cn("w-full", containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[color:var(--text-muted)] mb-1.5 tracking-tight"
        >
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        className={cn(
          inputBase,
          "px-3 py-2 resize-y leading-relaxed",
          error &&
            "border-[color:var(--score-danger)] focus:border-[color:var(--score-danger)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--score-danger)_25%,transparent)]",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs text-[color:var(--score-danger)]">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">{helperText}</p>
      )}
    </div>
  );
});
Textarea.displayName = "Textarea";

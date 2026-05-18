import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export const Select = forwardRef(function Select(
  {
    label,
    error,
    helperText,
    options = [],
    className,
    containerClassName,
    placeholder = "Select an option",
    size = "md",
    ...props
  },
  ref
) {
  const inputId = props.id || props.name;
  const sizeClasses =
    size === "sm" ? "h-8 pl-2.5 pr-8 text-xs" : size === "lg" ? "h-11 pl-3.5 pr-10 text-sm" : "h-9 pl-3 pr-9 text-sm";

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
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "w-full bg-[var(--surface)] text-[color:var(--text)]",
            "border border-[color:var(--border)] rounded-[8px]",
            "appearance-none cursor-pointer",
            "transition-[border-color,box-shadow] duration-150",
            "focus:outline-none focus:border-[color:var(--primary)] focus:shadow-[0_0_0_3px_var(--ring)]",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            sizeClasses,
            error &&
              "border-[color:var(--score-danger)] focus:border-[color:var(--score-danger)]",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <svg
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--text-soft)]"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {error && (
        <p className="mt-1.5 text-xs text-[color:var(--score-danger)]">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs text-[color:var(--text-muted)]">
          {helperText}
        </p>
      )}
    </div>
  );
});

Select.displayName = "Select";

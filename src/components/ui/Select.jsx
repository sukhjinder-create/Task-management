import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export const Select = forwardRef(
  (
    {
      label,
      error,
      helperText,
      options = [],
      className,
      containerClassName,
      placeholder = 'Select an option',
      ...props
    },
    ref
  ) => {
    const inputId = props.id || props.name;

    return (
      <div className={cn('w-full', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium theme-text-muted mb-1.5"
          >
            {label}
          </label>
        )}

        <select
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 text-sm',
            'theme-input border rounded-lg',
            'transition-colors duration-200',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            'appearance-none bg-no-repeat',
            'bg-[url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%236b7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")]',
            'bg-[position:right_0.5rem_center] bg-[size:1.5em_1.5em] pr-10',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
              : 'theme-border focus:border-[var(--primary)] focus:ring-[var(--ring)]',
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

        {error && (
          <p className="mt-1.5 text-xs text-danger-600">{error}</p>
        )}

        {helperText && !error && (
          <p className="mt-1.5 text-xs theme-text-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

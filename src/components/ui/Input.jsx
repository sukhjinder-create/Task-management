import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className,
      containerClassName,
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

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full px-3 py-2 text-sm',
              'theme-input border rounded-lg',
              'transition-colors duration-200',
              'placeholder:text-[var(--text-soft)] disabled:opacity-70 disabled:cursor-not-allowed',
              error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
                : 'theme-border focus:border-[var(--primary)] focus:ring-[var(--ring)]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-soft)]">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1.5 text-xs text-danger-600">{error}</p>
        )}

        {helperText && !error && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Textarea variant
export const Textarea = forwardRef(
  (
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

        <textarea
          ref={ref}
          id={inputId}
          rows={rows}
          className={cn(
            'w-full px-3 py-2 text-sm',
            'theme-input border rounded-lg',
            'transition-colors duration-200',
            'placeholder:text-[var(--text-soft)] disabled:opacity-70 disabled:cursor-not-allowed',
            'resize-y',
            error
              ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
              : 'theme-border focus:border-[var(--primary)] focus:ring-[var(--ring)]',
            className
          )}
          {...props}
        />

        {error && (
          <p className="mt-1.5 text-xs text-danger-600">{error}</p>
        )}

        {helperText && !error && (
          <p className="mt-1.5 text-xs text-[var(--text-muted)]">{helperText}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from './Spinner';

const buttonVariants = {
  variant: {
    primary: 'theme-primary shadow-sm',
    secondary: 'theme-surface-soft theme-text hover:opacity-90 border theme-border',
    ghost: 'bg-transparent hover:bg-[var(--surface-soft)] theme-text-muted',
    danger: 'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800 shadow-sm',
    success: 'bg-success-600 text-white hover:bg-success-700 active:bg-success-800 shadow-sm',
    outline: 'bg-transparent border-2 theme-primary-outline hover:bg-[var(--surface-soft)]',
  },
  size: {
    xs: 'px-2.5 py-1.5 text-xs rounded-md',
    sm: 'px-3 py-2 text-sm rounded-md',
    md: 'px-4 py-2.5 text-sm rounded-lg',
    lg: 'px-5 py-3 text-base rounded-lg',
  },
};

export const Button = forwardRef(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className
        )}
        {...props}
      >
        {loading && <Spinner size={size === 'xs' ? 'xs' : size === 'sm' ? 'sm' : 'sm'} />}
        {!loading && leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {!loading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

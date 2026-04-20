import { cn } from '../../utils/cn';

const badgeVariants = {
  variant: {
    solid: '',
    outline: 'bg-transparent border-2',
    subtle: '',
  },
  color: {
    primary: {
      solid: 'gradient-primary text-white',
      outline: 'border-primary-600 text-primary-600',
      subtle: 'gradient-subtle text-primary-700 border border-primary-200',
    },
    success: {
      solid: 'gradient-success text-white',
      outline: 'border-[color:var(--score-good)] text-[color:var(--score-good)]',
      subtle: 'bg-[color:var(--score-good-bg)] text-[color:var(--score-good)] border border-[color:var(--score-good-border)]',
    },
    warning: {
      solid: 'bg-[color:var(--score-warning)] text-white',
      outline: 'border-[color:var(--score-warning)] text-[color:var(--score-warning)]',
      subtle: 'bg-[color:var(--score-warning-bg)] text-[color:var(--score-warning)] border border-[color:var(--score-warning-border)]',
    },
    danger: {
      solid: 'gradient-danger text-white',
      outline: 'border-[color:var(--score-danger)] text-[color:var(--score-danger)]',
      subtle: 'bg-[color:var(--score-danger-bg)] text-[color:var(--score-danger)] border border-[color:var(--score-danger-border)]',
    },
    neutral: {
      solid: 'bg-gradient-to-r from-gray-600 to-gray-700 text-white',
      outline: 'border-gray-600 text-gray-600',
      subtle: 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border border-gray-200',
    },
  },
  size: {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm',
  },
};

export function Badge({
  children,
  variant = 'subtle',
  color = 'neutral',
  size = 'sm',
  className,
  ...props
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        badgeVariants.color[color][variant],
        badgeVariants.size[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

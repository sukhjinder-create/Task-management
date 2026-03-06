import { cn } from '../../utils/cn';

const badgeVariants = {
  variant: {
    solid: '',
    outline: 'bg-transparent border-2',
    subtle: '',
  },
  color: {
    primary: {
      solid: 'bg-primary-600 text-white',
      outline: 'border-primary-600 text-primary-600',
      subtle: 'bg-primary-50 text-primary-700 border border-primary-200',
    },
    success: {
      solid: 'bg-success-600 text-white',
      outline: 'border-success-600 text-success-600',
      subtle: 'bg-success-50 text-success-700 border border-success-200',
    },
    warning: {
      solid: 'bg-warning-600 text-white',
      outline: 'border-warning-600 text-warning-600',
      subtle: 'bg-warning-50 text-warning-700 border border-warning-200',
    },
    danger: {
      solid: 'bg-danger-600 text-white',
      outline: 'border-danger-600 text-danger-600',
      subtle: 'bg-danger-50 text-danger-700 border border-danger-200',
    },
    neutral: {
      solid: 'bg-gray-600 text-white',
      outline: 'border-gray-600 text-gray-600',
      subtle: 'bg-gray-50 text-gray-700 border border-gray-200',
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

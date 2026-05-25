import { cn } from '../../utils/cn';

const sizes = {
  xs: 'w-3 h-3 border',
  sm: 'w-4 h-4 border-2',
  md: 'w-5 h-5 border-2',
  lg: 'w-6 h-6 border-2',
  xl: 'w-8 h-8 border-[3px]',
};

export function Spinner({ size = 'md', className }) {
  return (
    <div
      className={cn(
        "inline-block animate-spin rounded-full",
        "border-current border-t-transparent border-l-transparent",
        sizes[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading…</span>
    </div>
  );
}

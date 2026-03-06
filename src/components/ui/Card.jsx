import { cn } from '../../utils/cn';

export function Card({ children, className, hover = false, clickable = false, ...props }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow border border-gray-200',
        'transition-all duration-200',
        hover && 'hover:shadow-md hover:-translate-y-0.5',
        clickable && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('px-6 py-4 border-b border-gray-200', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }) {
  return (
    <p className={cn('text-sm text-gray-500 mt-1', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('px-6 py-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div className={cn('px-6 py-4 border-t border-gray-200 bg-gray-50/50', className)} {...props}>
      {children}
    </div>
  );
}

// Add subcomponents to Card for easy access
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

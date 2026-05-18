import { cn } from '../../utils/cn';

/**
 * Card — a real raised surface for modals, popovers, login form, etc.
 * Dashboard "panels" that should sit flat on the canvas should NOT use
 * this component; they should render directly with typography and
 * spacing for hierarchy.
 */
export function Card({ children, className, hover = false, clickable = false, flat = false, ...props }) {
  return (
    <div
      className={cn(
        flat
          ? "bg-transparent border-0"
          : "bg-[var(--surface)] border border-[color:var(--border)] rounded-[10px]",
        "transition-colors duration-150",
        (hover || clickable) && !flat &&
          "hover:border-[color:var(--border-strong)] hover:bg-[var(--surface-soft)]",
        clickable && "cursor-pointer",
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
    <div
      className={cn(
        "px-5 py-3.5 border-b border-[color:var(--border)] flex items-center justify-between gap-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }) {
  return (
    <h3
      className={cn(
        "text-sm font-semibold text-[color:var(--text)] tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className, ...props }) {
  return (
    <p
      className={cn("text-xs text-[color:var(--text-muted)] mt-0.5", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn("px-5 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-[color:var(--border)] bg-[var(--surface-soft)] flex items-center justify-end gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Description = CardDescription;
Card.Content = CardContent;
Card.Footer = CardFooter;

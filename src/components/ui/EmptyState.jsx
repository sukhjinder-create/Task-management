import { cn } from '../../utils/cn';

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      {icon && (
        <div className="w-16 h-16 rounded-full theme-surface-soft flex items-center justify-center theme-text-soft mb-4">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold theme-text mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-sm theme-text-muted max-w-sm mb-6">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

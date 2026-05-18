import { useState, useRef, useEffect } from 'react';
import { cn } from '../../utils/cn';

export function Dropdown({ children, className }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={cn('relative inline-block', className)}>
      {children({ isOpen, setIsOpen })}
    </div>
  );
}

export function DropdownTrigger({ children, onClick, ...props }) {
  return (
    <div onClick={onClick} {...props}>
      {children}
    </div>
  );
}

export function DropdownMenu({
  isOpen,
  children,
  className,
  align = 'left',
  ...props
}) {
  if (!isOpen) return null;
  return (
    <div
      role="menu"
      className={cn(
        // Real raised surface, full theme awareness
        "absolute z-50 mt-1.5 min-w-[12rem] max-w-[22rem]",
        "bg-[var(--surface)] text-[color:var(--text)]",
        "border border-[color:var(--border)] rounded-[10px]",
        "shadow-[var(--shadow-lg)] overflow-hidden",
        align === 'left' && 'left-0',
        align === 'right' && 'right-0',
        className
      )}
      {...props}
    >
      <div className="py-1">{children}</div>
    </div>
  );
}

export function DropdownItem({
  children,
  onClick,
  className,
  danger = false,
  selected = false,
  leftIcon,
  rightIcon,
  ...props
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-sm",
        "transition-colors duration-100",
        "focus:outline-none",
        danger
          ? "text-[color:var(--score-danger)] hover:bg-[color:var(--score-danger-bg)] focus:bg-[color:var(--score-danger-bg)]"
          : "text-[color:var(--text)] hover:bg-[var(--surface-soft)] focus:bg-[var(--surface-soft)]",
        selected && "bg-[var(--primary-soft)] text-[color:var(--primary)]",
        className
      )}
      {...props}
    >
      {leftIcon && (
        <span className="shrink-0 inline-flex text-[color:var(--text-muted)]">
          {leftIcon}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {rightIcon && (
        <span className="shrink-0 inline-flex text-[color:var(--text-soft)]">
          {rightIcon}
        </span>
      )}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 h-px bg-[color:var(--border)]" />;
}

Dropdown.Trigger = DropdownTrigger;
Dropdown.Menu = DropdownMenu;
Dropdown.Item = DropdownItem;
Dropdown.Divider = DropdownDivider;

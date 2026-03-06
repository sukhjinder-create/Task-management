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
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
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

export function DropdownMenu({ isOpen, children, className, align = 'left', ...props }) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 min-w-[12rem] rounded-lg bg-white shadow-lg border border-gray-200',
        'animate-in fade-in-0 zoom-in-95 duration-100',
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

export function DropdownItem({ children, onClick, className, danger = false, ...props }) {
  return (
    <button
      className={cn(
        'w-full px-4 py-2 text-left text-sm transition-colors',
        danger
          ? 'text-danger-700 hover:bg-danger-50'
          : 'text-gray-700 hover:bg-gray-100',
        className
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownDivider() {
  return <div className="my-1 border-t border-gray-200" />;
}

// Add subcomponents to Dropdown
Dropdown.Trigger = DropdownTrigger;
Dropdown.Menu = DropdownMenu;
Dropdown.Item = DropdownItem;
Dropdown.Divider = DropdownDivider;

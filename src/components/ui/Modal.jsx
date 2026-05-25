import { useEffect } from 'react';
import { cn } from '../../utils/cn';

export function Modal({
  isOpen,
  onClose,
  children,
  className,
  size = 'md',
  ...props
}) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[calc(100vw-2rem)]',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" />
      <div
        className={cn(
          "relative w-full bg-[var(--surface)] text-[color:var(--text)]",
          "border border-[color:var(--border)] rounded-[12px]",
          "shadow-[var(--shadow-lg)] overflow-hidden isolate",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ children, className, ...props }) {
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

export function ModalTitle({ children, className, ...props }) {
  return (
    <h2
      className={cn(
        "text-base font-semibold text-[color:var(--text)] tracking-tight",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

export function ModalBody({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "px-5 py-4 max-h-[calc(100vh-200px)] overflow-y-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ModalFooter({ children, className, ...props }) {
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

Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

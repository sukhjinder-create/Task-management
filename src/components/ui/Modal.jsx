import { useEffect } from 'react';
import { cn } from '../../utils/cn';

export function Modal({ isOpen, onClose, children, className, size = 'md', ...props }) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
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
    full: 'max-w-full mx-4',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className={cn(
          'relative w-full theme-surface theme-text rounded-xl shadow-xl border theme-border',
          'animate-in fade-in-0 zoom-in-95 duration-200',
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
    <div className={cn('px-6 py-4 border-b theme-border', className)} {...props}>
      {children}
    </div>
  );
}

export function ModalTitle({ children, className, ...props }) {
  return (
    <h2 className={cn('text-xl font-semibold theme-text', className)} {...props}>
      {children}
    </h2>
  );
}

export function ModalBody({ children, className, ...props }) {
  return (
    <div className={cn('px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto', className)} {...props}>
      {children}
    </div>
  );
}

export function ModalFooter({ children, className, ...props }) {
  return (
    <div className={cn('px-6 py-4 border-t theme-border theme-surface-soft flex items-center justify-end gap-3', className)} {...props}>
      {children}
    </div>
  );
}

// Add subcomponents to Modal
Modal.Header = ModalHeader;
Modal.Title = ModalTitle;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

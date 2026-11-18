import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const modalStack: HTMLDivElement[] = [];
let originalBodyOverflow = '';
const syncModalStack = () => {
  modalStack.forEach((dialog, index) => {
    const isTop = index === modalStack.length - 1;
    dialog.inert = !isTop;
    if (isTop) dialog.removeAttribute('aria-hidden');
    else dialog.setAttribute('aria-hidden', 'true');
  });
};

interface ModalShellProps {
  ariaLabel?: string;
  labelledBy?: string;
  className?: string;
  overlayClassName?: string;
  surfaceClassName?: string;
  children: ReactNode;
  onClose: () => void;
}

const focusableSelector = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function ModalShell({
  ariaLabel,
  labelledBy,
  className = '',
  overlayClassName = 'admin-modal-overlay',
  surfaceClassName,
  children,
  onClose,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!modalStack.length) originalBodyOverflow = document.body.style.overflow;
    modalStack.push(dialog);
    syncModalStack();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => !element.hasAttribute('disabled') && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      if (modalStack.at(-1) !== dialog) return;
      const firstFocusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
        .find(element => element.getClientRects().length > 0);
      (firstFocusable || dialog).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      const index = modalStack.indexOf(dialog);
      if (index !== -1) modalStack.splice(index, 1);
      syncModalStack();
      if (!modalStack.length) document.body.style.overflow = originalBodyOverflow;
      if (previouslyFocused?.isConnected && !previouslyFocused.closest('[inert]')) previouslyFocused.focus();
    };
  }, []);

  return createPortal(
    <div
      className={overlayClassName}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className={surfaceClassName || `premium-card admin-user-modal ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

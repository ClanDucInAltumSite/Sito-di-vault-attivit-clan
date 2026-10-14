import { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Icon } from './Icon';
import { I18N } from '../lib/i18n';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ComponentChildren;
  footer?: ComponentChildren;
  className?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  className = '',
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      // Imposta focus sul contenitore o primo elemento
      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0]?.focus();
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };

      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
        if (previousFocus.current) {
          previousFocus.current.focus();
        }
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="ios-sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ios-sheet-title"
        className={`ios-sheet-container ${className}`.trim()}
      >
        <div className="ios-sheet-handle-container" aria-hidden="true">
          <div className="ios-sheet-handle" />
        </div>

        <header className="ios-sheet-header">
          <div className="ios-sheet-header-titles">
            <h2 id="ios-sheet-title" className="ios-sheet-title">
              {title}
            </h2>
            {subtitle ? (
              <p className="ios-sheet-subtitle">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="ios-sheet-close-btn"
            onClick={onClose}
            aria-label={I18N.dialogs.chiudi}
          >
            <Icon name="clear" size={18} />
          </button>
        </header>

        <div className="ios-sheet-body">
          {children}
        </div>

        {footer ? (
          <footer className="ios-sheet-footer">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

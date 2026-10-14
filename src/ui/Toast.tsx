import { Icon } from './Icon';

export interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}

export function Toast({
  message,
  type = 'info',
  actionLabel,
  onAction,
  onClose,
}: ToastProps) {
  return (
    <div
      className={`ios-toast-capsule ios-toast-${type}`}
      role="status"
      aria-live="polite"
    >
      <span className="ios-toast-dot" aria-hidden="true" />
      <span className="ios-toast-message">{message}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="ios-toast-action"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
      {onClose ? (
        <button
          type="button"
          className="ios-toast-close"
          onClick={onClose}
          aria-label="Chiudi notifica"
        >
          <Icon name="clear" size={14} />
        </button>
      ) : null}
    </div>
  );
}

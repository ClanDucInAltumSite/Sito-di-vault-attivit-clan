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
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <span className="toast-message">{message}</span>
      {actionLabel && onAction ? (
        <button type="button" className="toast-action-btn" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      {onClose ? (
        <button
          type="button"
          className="toast-close-btn"
          onClick={onClose}
          aria-label="Chiudi notifica"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

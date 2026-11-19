// src/ui/NotificationBell.tsx
// Pulsante icona campanella per il Centro Notifiche con badge non lette
// Vault Scout - Duc In Altum

import { Icon } from './Icon';

export interface NotificationBellProps {
  unreadCount: number;
  hasAdminAlert?: boolean;
  onClick: () => void;
  className?: string;
}

export function NotificationBell({
  unreadCount,
  hasAdminAlert = false,
  onClick,
  className = '',
}: NotificationBellProps) {
  const label = unreadCount > 0
    ? `${unreadCount} nuove notifiche`
    : 'Centro Notifiche';

  return (
    <button
      type="button"
      className={`ios-btn ios-btn-ghost ios-btn-sm notification-bell-btn ${className}`.trim()}
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        padding: '0 8px',
        minWidth: '38px',
        height: '36px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="bell" size={20} />
      {unreadCount > 0 && (
        <span
          className="notification-bell-badge"
          style={{
            position: 'absolute',
            top: '3px',
            right: '3px',
            minWidth: '18px',
            height: '18px',
            padding: '0 4px',
            borderRadius: '10px',
            backgroundColor: hasAdminAlert ? 'var(--color-rosso, #E53935)' : 'var(--color-primary, #462679)',
            color: '#FFFFFF',
            fontSize: '11px',
            fontWeight: 700,
            lineHeight: '18px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            border: '2px solid var(--color-surface, #FFFFFF)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: hasAdminAlert ? 'pulseNotice 2s infinite' : undefined,
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}

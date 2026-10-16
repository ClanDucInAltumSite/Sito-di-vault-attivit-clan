import { useState, useEffect } from 'preact/hooks';
import { Ban } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { requestWakeLock, releaseWakeLock, isWakeLockSupported } from '../../lib/wakelock';

export interface BanReadingModeProps {
  ban: Ban | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BanReadingMode({ ban, isOpen, onClose }: BanReadingModeProps) {
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('ban_reading_font_size');
      if (saved) return parseInt(saved, 10) || 22;
    }
    return 22;
  });

  const [wakeLockActive, setWakeLockActive] = useState(false);

  useEffect(() => {
    if (!isOpen || !ban) return;

    let active = true;
    requestWakeLock().then((acquired) => {
      if (active) {
        setWakeLockActive(acquired);
      }
    });

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      active = false;
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      releaseWakeLock();
    };
  }, [isOpen, ban, onClose]);

  if (!isOpen || !ban) return null;

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(36, Math.max(16, prev + delta));
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('ban_reading_font_size', String(next));
      }
      return next;
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${I18N.bans.modalitaLettura} - ${ban.nome}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar ad alto contrasto */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          flexShrink: 0,
          gap: 'var(--space-2)',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          className="ios-btn ios-btn-ghost"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            minHeight: 'var(--touch-target)',
            padding: '0 var(--space-2)',
            color: 'var(--color-interactive)',
            fontWeight: 600,
          }}
          aria-label={I18N.bans.esciModalitaLettura}
        >
          <Icon name="chevron-left" size={20} />
          <span>{I18N.dialogs.chiudi}</span>
        </button>

        <div
          style={{
            fontWeight: 700,
            fontSize: 'var(--font-size-base)',
            color: 'var(--color-ink)',
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            padding: '0 var(--space-2)',
          }}
        >
          {ban.nome}
        </div>

        {/* Controlli font e indicatore wake lock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {isWakeLockSupported() && wakeLockActive ? (
            <Badge variant="azzurro" size="sm">
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Icon name="sun" size={14} />
                <span>Attivo</span>
              </span>
            </Badge>
          ) : null}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-border-subtle)',
              borderRadius: 'var(--radius-full)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => changeFontSize(-2)}
              disabled={fontSize <= 16}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '36px',
                minHeight: '36px',
                padding: '0 8px',
                fontSize: 'var(--font-size-sm)',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
              }}
              aria-label="Riduci dimensione carattere"
            >
              A-
            </button>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                padding: '0 4px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {fontSize}px
            </span>
            <button
              type="button"
              onClick={() => changeFontSize(2)}
              disabled={fontSize >= 36}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '36px',
                minHeight: '36px',
                padding: '0 8px',
                fontSize: 'var(--font-size-base)',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
              }}
              aria-label="Aumenta dimensione carattere"
            >
              A+
            </button>
          </div>
        </div>
      </header>

      {/* Contenuto scorrevole per la lettura */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6) var(--space-4)',
          maxWidth: '800px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <h1
          style={{
            fontSize: `calc(${fontSize}px * 1.35)`,
            lineHeight: 1.25,
            fontWeight: 800,
            color: 'var(--color-ink)',
            letterSpacing: '-0.02em',
            marginTop: 0,
            marginBottom: 'var(--space-6)',
          }}
        >
          {ban.nome}
        </h1>

        {/* Note sui gesti distinte e prominenti */}
        {ban.note_gesti ? (
          <aside
            style={{
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bans-subtle)',
              borderLeft: '4px solid var(--color-bans)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-6)',
            }}
            aria-label="Note sui gesti"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                color: 'var(--color-bans)',
                fontWeight: 700,
                fontSize: 'var(--font-size-sm)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 'var(--space-2)',
              }}
            >
              <Icon name="bans" size={16} />
              <span>{I18N.bans.noteGesti}</span>
            </div>
            <div
              style={{
                fontSize: `calc(${fontSize}px * 0.85)`,
                lineHeight: 1.5,
                color: 'var(--color-ink)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {ban.note_gesti}
            </div>
          </aside>
        ) : null}

        {/* Testo del ban ad altissimo contrasto */}
        <section
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.6,
            fontWeight: 500,
            color: 'var(--color-text)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
          }}
        >
          {ban.testo}
        </section>
      </main>
    </div>
  );
}

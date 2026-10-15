import { useState, useEffect } from 'preact/hooks';
import { Canto } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { requestWakeLock, releaseWakeLock, isWakeLockSupported } from '../../lib/wakelock';
import { ChordProRenderer, transposeChord } from '../../lib/chordpro';

export interface CantoReadingModeProps {
  canto: Canto | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CantoReadingMode({ canto, isOpen, onClose }: CantoReadingModeProps) {
  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('canto_reading_font_size');
      if (saved) return parseInt(saved, 10) || 18;
    }
    return 18;
  });

  const [showChords, setShowChords] = useState<boolean>(true);
  const [transposeDelta, setTransposeDelta] = useState<number>(0);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  useEffect(() => {
    if (!isOpen || !canto) return;

    // Reset trasposizione all'apertura del canto
    setTransposeDelta(0);

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
  }, [isOpen, canto, onClose]);

  if (!isOpen || !canto) return null;

  const changeFontSize = (delta: number) => {
    setFontSize((prev) => {
      const next = Math.min(32, Math.max(14, prev + delta));
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('canto_reading_font_size', String(next));
      }
      return next;
    });
  };

  const handleTranspose = (delta: number) => {
    setTransposeDelta((prev) => {
      const next = prev + delta;
      // Mantieni intervallo ragionevole tra -11 e +11
      return next > 11 ? next - 12 : next < -11 ? next + 12 : next;
    });
  };

  const currentKeyDisplay = canto.tonalita
    ? transposeDelta !== 0
      ? `${transposeChord(canto.tonalita, transposeDelta)} (${transposeDelta > 0 ? `+${transposeDelta}` : transposeDelta})`
      : canto.tonalita
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${I18N.bans.modalitaLettura} — ${canto.titolo}`}
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
      {/* Top Bar ad alto contrasto con strumenti per la musica */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderBottom: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          flexShrink: 0,
        }}
      >
        {/* Prima riga: pulsante chiudi, titolo, wake lock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-4)',
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
            {canto.titolo}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {isWakeLockSupported() && wakeLockActive ? (
              <Badge variant="azzurro" size="sm">
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="sun" size={14} />
                  <span>Attivo</span>
                </span>
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Seconda riga: Toolbar controlli per accordi, trasposizione e zoom */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-4)',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-surface-hover)',
            overflowX: 'auto',
            gap: 'var(--space-3)',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Toggle Accordi On/Off */}
          <button
            type="button"
            onClick={() => setShowChords(!showChords)}
            className={`ios-btn ${showChords ? 'ios-btn-secondary' : 'ios-btn-ghost'}`}
            style={{
              minHeight: '36px',
              padding: '0 var(--space-3)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name="canti" size={16} />
            <span>{showChords ? I18N.canti.mostraAccordi : I18N.canti.nascondiAccordi}</span>
          </button>

          {/* Controlli Trasposizione Semitonale */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => handleTranspose(-1)}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '32px',
                minHeight: '32px',
                padding: '0 6px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
              }}
              aria-label="Abbassa di un semitono (-1)"
              title="Abbassa di un semitono"
            >
              -1
            </button>
            <button
              type="button"
              onClick={() => setTransposeDelta(0)}
              className="ios-btn ios-btn-ghost"
              style={{
                minHeight: '32px',
                padding: '0 8px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: transposeDelta === 0 ? 'var(--color-text-secondary)' : 'var(--color-interactive)',
              }}
              title="Reimposta tonalità originale"
            >
              {transposeDelta === 0 ? 'Orig' : `${transposeDelta > 0 ? `+${transposeDelta}` : transposeDelta}`}
            </button>
            <button
              type="button"
              onClick={() => handleTranspose(1)}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '32px',
                minHeight: '32px',
                padding: '0 6px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
              }}
              aria-label="Alza di un semitono (+1)"
              title="Alza di un semitono"
            >
              +1
            </button>
          </div>

          {/* Regolazione Dimensione Carattere */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => changeFontSize(-2)}
              disabled={fontSize <= 14}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '32px',
                minHeight: '32px',
                padding: '0 6px',
                fontSize: 'var(--font-size-xs)',
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
              disabled={fontSize >= 32}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '32px',
                minHeight: '32px',
                padding: '0 6px',
                fontSize: 'var(--font-size-sm)',
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

      {/* Contenuto scorrevole per la lettura del canto */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-6) var(--space-4)',
          maxWidth: '850px',
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <h1
            className="song-title-display"
            style={{
              fontSize: `calc(${fontSize}px * 1.4)`,
              lineHeight: 1.2,
              marginTop: 0,
              marginBottom: 'var(--space-2)',
            }}
          >
            {canto.titolo}
          </h1>

          {canto.autore ? (
            <div
              style={{
                fontSize: `calc(${fontSize}px * 0.85)`,
                color: 'var(--color-text-secondary)',
                marginBottom: 'var(--space-3)',
                fontWeight: 500,
              }}
            >
              {canto.autore}
            </div>
          ) : null}

          {/* Chips informativi su tonalità, BPM, capotasto */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
            {currentKeyDisplay ? (
              <Badge variant="azzurro" size="sm">
                Tonalità: {currentKeyDisplay}
              </Badge>
            ) : null}

            {canto.tempo_bpm ? (
              <Badge variant="neutral" size="sm">
                {canto.tempo_bpm} BPM
              </Badge>
            ) : null}

            {canto.misura ? (
              <Badge variant="neutral" size="sm">
                Misura: {canto.misura}
              </Badge>
            ) : null}

            {canto.ritmo ? (
              <Badge variant="neutral" size="sm">
                Ritmo: {canto.ritmo}
              </Badge>
            ) : null}

            {canto.capotasto ? (
              <Badge variant="giallo" size="sm">
                Capotasto al {canto.capotasto}° tasto
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Renderer ChordPro Preact con nodi DOM sicuri */}
        <ChordProRenderer
          chordproText={canto.testo_chordpro}
          transposeDelta={transposeDelta}
          showChords={showChords}
          fontSizeRem={fontSize / 16}
        />
      </main>
    </div>
  );
}

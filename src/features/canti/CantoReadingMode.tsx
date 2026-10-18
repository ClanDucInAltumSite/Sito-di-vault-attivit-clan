import { useState, useEffect, useRef } from 'preact/hooks';
import { Canto } from '../../lib/db';
import { I18N } from '../../lib/i18n';
import { Icon } from '../../ui/Icon';
import { Badge } from '../../ui/Badge';
import { useAdmin } from '../../lib/auth';
import { requestWakeLock, releaseWakeLock, isWakeLockSupported } from '../../lib/wakelock';
import { ChordProRenderer, transposeChord } from '../../lib/chordpro';
import { AttachmentGallery } from '../allegati/AttachmentGallery';
import { AttachmentUploadManager } from '../allegati/AttachmentUploadManager';

export interface CantoReadingModeProps {
  canto: Canto | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (canto: Canto) => void;
  onDelete?: (canto: Canto) => void;
  onUpdated?: () => void;
}

export function CantoReadingMode({
  canto,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onUpdated,
}: CantoReadingModeProps) {
  const { isAdmin } = useAdmin();
  const [attachmentKey, setAttachmentKey] = useState(0);

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

  // --- STATO METRONOMO ---
  const [bpm, setBpm] = useState<number>(100);
  const [isMetronomePlaying, setIsMetronomePlaying] = useState<boolean>(false);
  const [pulse, setPulse] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeTimerRef = useRef<any>(null);
  const beatCountRef = useRef<number>(0);

  // Inizializza o aggiorna BPM quando cambia il canto
  useEffect(() => {
    if (canto?.tempo_bpm) {
      setBpm(canto.tempo_bpm);
    } else {
      setBpm(100);
    }
    // Arresta metronomo al cambio del canto
    setIsMetronomePlaying(false);
  }, [canto?.id, canto?.tempo_bpm]);

  // Gestione WakeLock, overflow del body ed Escape
  useEffect(() => {
    if (!isOpen || !canto) return;

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

  // Gestione esecuzione metronomo
  useEffect(() => {
    if (!isMetronomePlaying || !isOpen) {
      if (metronomeTimerRef.current) {
        clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
      setPulse(false);
      return;
    }

    // Inizializza AudioContext al click dell'utente
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const beatsPerBar = canto?.misura?.startsWith('3') ? 3 : canto?.misura?.startsWith('6') ? 6 : 4;
    const intervalMs = Math.round((60 / Math.max(30, Math.min(260, bpm))) * 1000);
    beatCountRef.current = 0;

    const tick = () => {
      const isDownbeat = beatCountRef.current % beatsPerBar === 0;
      beatCountRef.current++;

      // Emetti suono acustico con AudioContext
      if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
        try {
          const now = audioCtxRef.current.currentTime;
          const osc = audioCtxRef.current.createOscillator();
          const gain = audioCtxRef.current.createGain();
          osc.connect(gain);
          gain.connect(audioCtxRef.current.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(isDownbeat ? 1000 : 750, now);

          gain.gain.setValueAtTime(0.7, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

          osc.start(now);
          osc.stop(now + 0.045);
        } catch {
          // Ignora errori audio contestuali
        }
      }

      // Impulso visivo a tempo
      setPulse(true);
      setTimeout(() => setPulse(false), Math.min(130, Math.floor(intervalMs / 2)));
    };

    tick();
    metronomeTimerRef.current = setInterval(tick, intervalMs);

    return () => {
      if (metronomeTimerRef.current) {
        clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
    };
  }, [isMetronomePlaying, bpm, isOpen, canto?.misura]);

  // Pulizia generale alla distruzione
  useEffect(() => {
    return () => {
      if (metronomeTimerRef.current) {
        clearInterval(metronomeTimerRef.current);
        metronomeTimerRef.current = null;
      }
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch {}
        audioCtxRef.current = null;
      }
    };
  }, []);

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
      return next > 11 ? next - 12 : next < -11 ? next + 12 : next;
    });
  };

  const toggleMetronome = () => {
    setIsMetronomePlaying((prev) => !prev);
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
      aria-label={`${I18N.bans.modalitaLettura} - ${canto.titolo}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-sticky, 100)',
        backgroundColor: 'var(--color-bg)',
        color: 'var(--color-text)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        isolation: 'isolate',
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
          zIndex: 10,
        }}
      >
        {/* Prima riga: pulsante indietro, titolo, controlli admin e wake lock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-2) var(--space-4)',
            gap: 'var(--space-2)',
            minHeight: '52px',
          }}
        >
          {/* Tasto INDIETRO con indicazione chiara e freccia */}
          <button
            type="button"
            onClick={onClose}
            className="ios-btn ios-btn-secondary ios-sheet-close-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: '38px',
              padding: '0 var(--space-3)',
              color: 'var(--color-interactive)',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
              borderRadius: 'var(--radius-full)',
              flexShrink: 0,
            }}
            aria-label="Torna all'elenco dei canti"
          >
            <Icon name="chevron-left" size={18} />
            <span>Indietro</span>
          </button>

          {/* Titolo del Canto */}
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

          {/* Azioni destra: Badge Schermo sempre attivo + Tasti Admin */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
            {isWakeLockSupported() && wakeLockActive ? (
              <Badge variant="azzurro" size="sm">
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="sun" size={14} />
                  <span>Schermo attivo</span>
                </span>
              </Badge>
            ) : null}

            {isAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <button
                  type="button"
                  onClick={() => onEdit?.(canto)}
                  className="ios-btn ios-btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    minHeight: '34px',
                    padding: '0 var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                  }}
                  aria-label="Modifica canto"
                >
                  <Icon name="edit" size={14} />
                  <span>Modifica</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete?.(canto)}
                  className="ios-btn ios-btn-danger"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    minHeight: '34px',
                    padding: '0 var(--space-3)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-full)',
                  }}
                  aria-label="Elimina canto"
                >
                  <Icon name="trash" size={14} />
                  <span>Elimina</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Seconda riga: Toolbar controlli per accordi, trasposizione, zoom e metronomo */}
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
              minHeight: '34px',
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
                minHeight: '30px',
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
                minHeight: '30px',
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
                minHeight: '30px',
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

          {/* METRONOMO AUDIO-VISIVO ("quel coso che si usa per prendere il tempo") */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-full)',
              border: isMetronomePlaying ? '1.5px solid var(--color-interactive)' : '1px solid var(--color-border)',
              padding: '2px 4px',
            }}
          >
            <button
              type="button"
              onClick={toggleMetronome}
              className={`ios-btn ${isMetronomePlaying ? 'ios-btn-primary' : 'ios-btn-ghost'}`}
              style={{
                minHeight: '30px',
                padding: '0 8px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                borderRadius: 'var(--radius-full)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              aria-label={isMetronomePlaying ? 'Ferma ritmo metronomo' : 'Avvia ritmo metronomo'}
              title={isMetronomePlaying ? 'Ferma metronomo' : 'Avvia metronomo a tempo'}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: pulse ? 'var(--color-bans)' : isMetronomePlaying ? 'var(--color-canti)' : 'var(--color-text-secondary)',
                  display: 'inline-block',
                  transition: 'transform 80ms ease',
                  transform: pulse ? 'scale(1.6)' : 'scale(1)',
                }}
                className={pulse ? 'metronome-pulse' : ''}
              />
              <span>{isMetronomePlaying ? 'Stop' : 'Ritmo'}</span>
            </button>

            <button
              type="button"
              onClick={() => setBpm((b) => Math.max(40, b - 5))}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '24px',
                minHeight: '30px',
                padding: '0 4px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
              }}
              title="-5 BPM"
              aria-label="Rallenta ritmo di 5 BPM"
            >
              -
            </button>
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
                minWidth: '56px',
                textAlign: 'center',
                color: isMetronomePlaying ? 'var(--color-interactive)' : 'var(--color-text)',
              }}
            >
              {bpm} BPM
            </span>
            <button
              type="button"
              onClick={() => setBpm((b) => Math.min(240, b + 5))}
              className="ios-btn ios-btn-ghost"
              style={{
                minWidth: '24px',
                minHeight: '30px',
                padding: '0 4px',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 700,
              }}
              title="+5 BPM"
              aria-label="Accelera ritmo di 5 BPM"
            >
              +
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
                minHeight: '30px',
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
                minHeight: '30px',
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
        className="canto-reading-scrollable"
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

            {(canto.bpm_testo || canto.tempo_bpm) ? (
              <Badge variant="neutral" size="sm">
                {canto.bpm_testo ? `${canto.bpm_testo} BPM` : `${canto.tempo_bpm} BPM`}
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

        {/* Sezione Allegati e Spartiti (Fase 5) */}
        <div
          style={{
            marginTop: 'var(--space-8)',
            borderTop: '1px solid var(--color-border)',
            paddingTop: 'var(--space-6)',
          }}
        >
          <h3
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 700,
              color: 'var(--color-ink)',
              margin: '0 0 var(--space-3)',
            }}
          >
            Allegati e spartiti
          </h3>

          <AttachmentGallery
            key={attachmentKey}
            parentType="canto"
            parentId={canto.id}
            isAdmin={isAdmin}
            onChanged={() => {
              setAttachmentKey((k) => k + 1);
              onUpdated?.();
            }}
          />

          {isAdmin && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <AttachmentUploadManager
                parent={{ type: 'canto', id: canto.id }}
                onUploaded={() => {
                  setAttachmentKey((k) => k + 1);
                  onUpdated?.();
                }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

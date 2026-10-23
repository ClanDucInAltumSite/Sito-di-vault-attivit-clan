import { useRef, useLayoutEffect } from 'preact/hooks';
import { transposeChord } from '../../lib/chord_theory';

export interface CantoLineData {
  lyrics: string;
  chords: { chord: string; charIndex: number }[];
  isRitLabel?: boolean;
  isChordOnly?: boolean;
  isComment?: boolean;
  hasChords: boolean;
}

export interface CantoLineRendererProps {
  line: CantoLineData | string;
  showChords?: boolean;
  transposeDelta?: number;
  fontSize?: string;
  className?: string;
  isPrint?: boolean;
}

/**
 * Parsea una riga ChordPro grezza in CantoLineData.
 */
export function parseCantoLine(lineStr: string): CantoLineData | null {
  const trimmed = lineStr.trim();

  // Direttive commento {comment:...} o {c:...}
  if (/^\{(?:comment|c):\s*(.*?)\}$/i.test(trimmed)) {
    const match = trimmed.match(/^\{(?:comment|c):\s*(.*?)\}$/i);
    const commentText = match && match[1] ? match[1].trim() : '';
    if (!commentText) return null;
    return {
      lyrics: commentText,
      chords: [],
      isComment: true,
      hasChords: false,
    };
  }

  // Riconosci ed elimina direttive {...} (invisibili in lettura, anteprima e stampa)
  if (/^\{[^}]*\}$/.test(trimmed)) {
    return null;
  }

  if (/^RIT[.:]?$/i.test(trimmed)) {
    return {
      lyrics: trimmed.toUpperCase(),
      chords: [],
      isRitLabel: true,
      hasChords: false,
    };
  }

  const chords: { chord: string; charIndex: number }[] = [];
  let lyrics = '';
  let i = 0;

  while (i < lineStr.length) {
    if (lineStr[i] === '[') {
      const closeIdx = lineStr.indexOf(']', i);
      if (closeIdx !== -1) {
        const chord = lineStr.slice(i + 1, closeIdx);
        const charIndex = lyrics.length;
        chords.push({ chord, charIndex });
        i = closeIdx + 1;
        continue;
      }
    }
    lyrics += lineStr[i];
    i++;
  }

  const hasChords = chords.length > 0;
  const isChordOnly = hasChords && !lyrics.trim();

  return {
    lyrics,
    chords,
    isRitLabel: false,
    isChordOnly,
    hasChords,
  };
}

/**
 * Componente universale per la resa visiva delle righe di un canto con accordi.
 * Utilizzato identicamente in Stampa A4, Modalità Lettura e Anteprima Editor.
 * 
 * Regole tipografiche:
 * - Accordi posizionati sopra il testo con ancore a larghezza zero (inline-block, width: 0).
 * - Il testo scorre in modo 100% naturale con kerning reale senza alcuno spostamento.
 * - Le righe senza accordi non riservano spazio sopra (line-height 1.5 normale).
 * - Le righe con accordi hanno margin-top: 1.5em (= 16.5 pt su font 11 pt).
 * - Risoluzione collisioni orizzontali: se due accordi distano < 0.4 em, sposta il successivo
 *   a destra del minimo necessario senza superare il successivo ancoraggio.
 */
export function CantoLineRenderer({
  line,
  showChords = true,
  transposeDelta = 0,
  fontSize,
  className = '',
  isPrint = false,
}: CantoLineRendererProps) {
  const lineRef = useRef<HTMLDivElement>(null);

  const data: CantoLineData | null = typeof line === 'string' ? parseCantoLine(line) : line;

  if (!data) return null;

  const { lyrics, chords, isRitLabel, isChordOnly, hasChords } = data;
  const displayChords = showChords && hasChords;

  // Collision detection e prevenzione sovrapposizione accordi (< 0.4 em)
  useLayoutEffect(() => {
    if (!displayChords || chords.length <= 1 || !lineRef.current) return;

    const badges = lineRef.current.querySelectorAll<HTMLElement>('.canzoniere-chord-badge');
    if (badges.length <= 1) return;

    const firstBadge = badges[0];
    if (!firstBadge) return;
    const computedFontSize = parseFloat(window.getComputedStyle(firstBadge).fontSize) || 14;
    const minGapPx = 0.4 * computedFontSize;

    // Resetta prima eventuali trasformazioni precedenti
    for (let i = 0; i < badges.length; i++) {
      badges[i]!.style.transform = '';
    }

    let currentRightEdge = badges[0]!.getBoundingClientRect().right;

    for (let i = 1; i < badges.length; i++) {
      const b = badges[i]!;
      const r = b.getBoundingClientRect();
      const requiredLeft = currentRightEdge + minGapPx;

      if (r.left < requiredLeft) {
        const shift = requiredLeft - r.left;
        b.style.transform = `translateX(${shift}px)`;
        currentRightEdge = r.left + shift + r.width;
      } else {
        currentRightEdge = r.right;
      }
    }
  }, [data, showChords, transposeDelta]);

  // 1. Etichetta ritornello (RIT.)
  if (isRitLabel) {
    return (
      <div
        className={`canzoniere-rit-label ${className}`.trim()}
        style={{ fontSize: fontSize || undefined }}
      >
        {lyrics}
      </div>
    );
  }

  // 1b. Commento (es. intro: Do Fa Do Fa)
  if (data.isComment) {
    return (
      <div
        className={`canzoniere-comment-item ${className}`.trim()}
        style={{
          fontSize: fontSize || undefined,
          fontStyle: 'italic',
          color: 'var(--color-text-secondary)',
          margin: '0.35rem 0',
        }}
      >
        {lyrics}
      </div>
    );
  }

  // 2. Riga vuota di separazione
  if (!lyrics.trim() && !hasChords) {
    return (
      <div
        className={`canzoniere-line-empty ${className}`.trim()}
        aria-hidden="true"
        style={{ fontSize: fontSize || undefined }}
      >
        &nbsp;
      </div>
    );
  }

  // 3. Riga di soli accordi (senza testo sottostante, es. intro o stacco strumentale)
  if (isChordOnly && displayChords) {
    return (
      <div
        ref={lineRef}
        className={`canzoniere-line-item is-chord-only has-chords ${className}`.trim()}
        style={{ fontSize: fontSize || undefined }}
      >
        {chords.map((ch, idx) => (
          <span key={idx} className="canzoniere-chord-only-item" style={{ marginRight: '1rem', display: 'inline-block' }}>
            <strong className="song-chord">
              {transposeChord(ch.chord, transposeDelta)}
            </strong>
          </span>
        ))}
      </div>
    );
  }

  // 4. Riga di solo testo (SENZA accordi): non riserva spazio sopra!
  if (!displayChords) {
    return (
      <div
        className={`canzoniere-line-item ${className}`.trim()}
        style={{ fontSize: fontSize || undefined }}
      >
        {lyrics || '\u00A0'}
      </div>
    );
  }

  // 5. Riga con accordi ancorati a zero-width sopra le sillabe
  const segments: any[] = [];
  let lastChar = 0;

  for (let cIdx = 0; cIdx < chords.length; cIdx++) {
    const ch = chords[cIdx];
    if (!ch) continue;
    const charPos = Math.min(ch.charIndex, lyrics.length);

    // Segmento di testo precedente all'accordo
    if (charPos > lastChar) {
      segments.push(lyrics.slice(lastChar, charPos));
    }

    // Ancora a larghezza zero con accordo in posizione assoluta sopra
    const transposed = transposeChord(ch.chord, transposeDelta);
    segments.push(
      <span
        key={`anchor-${cIdx}`}
        className="canzoniere-chord-anchor"
        data-chord={transposed}
      >
        <span className="canzoniere-chord-badge song-chord">
          {transposed}
        </span>
      </span>
    );

    lastChar = charPos;
  }

  // Testo rimanente della riga
  if (lastChar < lyrics.length) {
    segments.push(lyrics.slice(lastChar));
  }

  return (
    <div
      ref={lineRef}
      className={`canzoniere-line-item has-chords ${isPrint ? 'is-print' : ''} ${className}`.trim()}
      style={{ fontSize: fontSize || undefined }}
    >
      {segments}
    </div>
  );
}

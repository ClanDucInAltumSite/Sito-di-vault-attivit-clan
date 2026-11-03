import { useRef } from 'preact/hooks';
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

  if (/^RIT[.:]?(\s*\(x\d+\))?$/i.test(trimmed)) {
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

export interface ScreenUnit {
  chord?: string;
  lyric: string;
}

export interface ScreenWord {
  units: ScreenUnit[];
}

/**
 * Converte riga con accordi in parole atomiche (.canto-word) composte da sillabe (.canto-unit).
 * Ogni parola si sposta a capo come blocco unico, con accordi disposti stabilmente sopra le sillabe.
 * Questo elimina qualsiasi possibilità di sovrapposizione tra accordi e testo su schermi stretti/mobile.
 */
export function parseLineToScreenWords(
  lyrics: string,
  chords: { chord: string; charIndex: number }[],
  transposeDelta = 0
): ScreenWord[] {
  if (!lyrics && chords.length === 0) {
    return [];
  }

  // Se non ci sono testi ma solo accordi
  if (!lyrics.trim() && chords.length > 0) {
    return chords.map((ch) => ({
      units: [{ chord: transposeChord(ch.chord, transposeDelta), lyric: '\u00A0' }],
    }));
  }

  // Mappa gli accordi per charIndex
  const chordMap = new Map<number, string[]>();
  for (const c of chords) {
    const list = chordMap.get(c.charIndex) || [];
    list.push(transposeChord(c.chord, transposeDelta));
    chordMap.set(c.charIndex, list);
  }

  const isChordAt = (idx: number) => chordMap.has(idx) && (chordMap.get(idx)?.length || 0) > 0;

  const words: ScreenWord[] = [];
  let i = 0;

  while (i < lyrics.length) {
    // Gestione spazi tra parole
    if (lyrics[i] === ' ') {
      // Se c'è un accordo ancorato sullo spazio stesso
      if (isChordAt(i)) {
        const chordsHere = chordMap.get(i)!;
        for (const ch of chordsHere) {
          words.push({ units: [{ chord: ch, lyric: '\u00A0' }] });
        }
      }
      i++;
      continue;
    }

    // Inizio di una parola (fino al prossimo spazio o fine riga)
    const wordStart = i;
    while (i < lyrics.length && lyrics[i] !== ' ') {
      i++;
    }
    const wordEnd = i;

    // Accordi che cadono all'interno della parola
    const wordChordIndices: number[] = [];
    for (let pos = wordStart; pos < wordEnd; pos++) {
      if (isChordAt(pos)) {
        wordChordIndices.push(pos);
      }
    }

    if (wordChordIndices.length === 0) {
      // Parola priva di accordi interni
      words.push({
        units: [{ lyric: lyrics.slice(wordStart, wordEnd) }],
      });
    } else {
      // Suddivisione della parola in sillabe in corrispondenza degli accordi
      const cutPoints = Array.from(new Set([wordStart, ...wordChordIndices, wordEnd])).sort((a, b) => a - b);
      const wordUnits: ScreenUnit[] = [];

      for (let p = 0; p < cutPoints.length - 1; p++) {
        const pStart = cutPoints[p]!;
        const pEnd = cutPoints[p + 1]!;
        const sylText = lyrics.slice(pStart, pEnd);
        const chordsHere = chordMap.get(pStart);

        if (chordsHere && chordsHere.length > 0) {
          for (let c = 0; c < chordsHere.length - 1; c++) {
            wordUnits.push({ chord: chordsHere[c], lyric: '' });
          }
          wordUnits.push({ chord: chordsHere[chordsHere.length - 1], lyric: sylText });
        } else {
          wordUnits.push({ lyric: sylText });
        }
      }

      words.push({ units: wordUnits });
    }
  }

  // Accordi alla fine esatta della riga
  if (isChordAt(lyrics.length)) {
    const endChords = chordMap.get(lyrics.length)!;
    for (const ch of endChords) {
      words.push({ units: [{ chord: ch, lyric: '\u00A0' }] });
    }
  }

  return words;
}

/**
 * Componente universale per la resa visiva delle righe di un canto con accordi.
 * Utilizzato identicamente in Stampa A4, Modalità Lettura e Anteprima Editor.
 * 
 * Regole tipografiche:
 * - Lettura a schermo / Mobile: modello flex-wrap con parole atomiche (.canto-word) e sillabe (.canto-unit).
 *   Gli accordi risiedono nel flusso naturale sopra le sillabe e non collidono MAI col testo quando la riga va a capo.
 * - Stampa A4: modello con ancore a larghezza zero per garantire larghezze millimetriche fisse nelle 2 colonne.
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

  // 1. Etichetta ritornello (RIT.)
  if (isRitLabel) {
    if (showChords && !hasChords) {
      // In modalità con accordi (suona) non mostrare etichette RIT isolate o mute
      return null;
    }
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

  // 5. Riga con accordi: Modello ad Unità Atomiche (.canto-word e .canto-unit)
  // Utilizzato universalmente per schermo e stampa per impedire qualsiasi collisione tra accordi e parole.
  const words = parseLineToScreenWords(lyrics, chords, transposeDelta);
  return (
    <div
      ref={lineRef}
      className={`canzoniere-line-item canto-screen-line has-chords ${isPrint ? 'is-print' : ''} ${className}`.trim()}
      style={{ fontSize: fontSize || undefined }}
    >
      {words.map((w, wIdx) => (
        <span key={wIdx} className="canto-word">
          {w.units.map((u, uIdx) => (
            <span key={uIdx} className="canto-unit">
              <span
                className={`canto-unit-chord song-chord ${u.chord ? 'canzoniere-chord-badge' : ''}`.trim()}
                aria-hidden={!u.chord}
              >
                {u.chord || '\u00A0'}
              </span>
              <span className="canto-unit-lyric">
                {u.lyric || '\u00A0'}
              </span>
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

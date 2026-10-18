import { h, JSX } from 'preact';
import { transposeChord } from './chord_theory';
import { CantoLineRenderer, CantoLineData } from '../features/canti/CantoLineRenderer';

export * from './chord_theory';

/* ==============================================================================
   TIPI E INTERFACCE CHORDPRO
   ============================================================================== */

export interface ChordUnit {
  chord?: string;
  lyric: string;
}

export interface SongLine {
  units: ChordUnit[];
}

export type SectionType = 'verse' | 'chorus' | 'bridge' | 'comment' | 'page_break';

export interface SongSection {
  type: SectionType;
  label?: string;
  lines: SongLine[];
}

export interface ChordProAST {
  sections: SongSection[];
  pageCount: number;
}

/**
 * Converte una SongLine AST in CantoLineData strutturato per CantoLineRenderer.
 */
export function songLineToCantoLineData(line: SongLine): CantoLineData {
  let lyrics = '';
  const chords: { chord: string; charIndex: number }[] = [];

  for (const u of line.units) {
    if (u.chord) {
      chords.push({ chord: u.chord, charIndex: lyrics.length });
    }
    lyrics += u.lyric;
  }

  const hasChords = chords.length > 0;
  const isChordOnly = hasChords && !lyrics.trim();
  const isRitLabel = !hasChords && /^RIT[.:]?$/i.test(lyrics.trim());

  return {
    lyrics,
    chords,
    isRitLabel,
    isChordOnly,
    hasChords,
  };
}

/* ==============================================================================
   CONTEGGIO PAGINE E VALIDAZIONE SOFT CHORDPRO
   ============================================================================== */

/**
 * Calcola il numero di pagine stimate per la stampa in base alle direttive {nuova_pagina}.
 */
export function calculatePageCount(chordproText: string): number {
  if (!chordproText) return 1;
  const matches = chordproText.match(/\{(nuova_pagina|np|new_page)\}/gi);
  return (matches?.length || 0) + 1;
}

export interface ChordValidationResult {
  isValid: boolean;
  warnings: string[];
}

export function validateChordPro(chordproText: string): ChordValidationResult {
  const warnings: string[] = [];

  if (!chordproText || !chordproText.trim()) {
    return { isValid: true, warnings: [] };
  }

  // Controllo parentesi quadre aperte e non chiuse
  let openSquare = 0;
  for (let i = 0; i < chordproText.length; i++) {
    const char = chordproText[i];
    if (char === '[') {
      openSquare++;
      if (openSquare > 1) {
        warnings.push(`Parentesi quadra aperta annidata non valida alla posizione ${i + 1}.`);
      }
    } else if (char === ']') {
      openSquare--;
      if (openSquare < 0) {
        warnings.push(`Parentesi quadra chiusa senza apertura corrispondente alla posizione ${i + 1}.`);
        openSquare = 0;
      }
    }
  }

  if (openSquare > 0) {
    warnings.push(`Ci sono ${openSquare} parentesi quadre aperte «[» non chiuse con «]».`);
  }

  // Controllo direttive ritornello {soc} e {eoc}
  const socMatches = (chordproText.match(/\{(soc|start_of_chorus)\}/gi) || []).length;
  const eocMatches = (chordproText.match(/\{(eoc|end_of_chorus)\}/gi) || []).length;
  if (socMatches !== eocMatches) {
    warnings.push(`Attenzione: numero sbilanciato di blocchi ritornello ({soc}: ${socMatches}, {eoc}: ${eocMatches}).`);
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/* ==============================================================================
   PARSER E AST GENERATOR (PREACT VDOM)
   ============================================================================== */

/**
 * Parsea una singola riga di testo ChordPro in un array di ChordUnit.
 * Rimuove preventivamente tutte le direttive {...} inline affinché non appaiano mai nel testo.
 */
export function parseLine(line: string, delta = 0): SongLine {
  const cleanLine = line.replace(/\{[^}]*\}/g, '');
  const units: ChordUnit[] = [];
  const regex = /\[([^\]]*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleanLine)) !== null) {
    const chordIndex = match.index;
    const rawChord = match[1] || '';

    if (chordIndex > lastIndex) {
      const textBefore = cleanLine.slice(lastIndex, chordIndex);
      if (units.length === 0) {
        units.push({ lyric: textBefore });
      } else {
        const last = units[units.length - 1];
        if (last) last.lyric += textBefore;
      }
    }

    const chord = delta !== 0 ? transposeChord(rawChord, delta) : rawChord;
    units.push({ chord, lyric: '' });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < cleanLine.length) {
    const remainingText = cleanLine.slice(lastIndex);
    if (units.length === 0) {
      units.push({ lyric: remainingText });
    } else {
      const last = units[units.length - 1];
      if (last) last.lyric += remainingText;
    }
  }

  if (units.length === 0) {
    units.push({ lyric: '' });
  }

  return { units };
}

/**
 * Parsea l'intero testo ChordPro generando un AST strutturato in sezioni.
 * Tutte le direttive invisibili ({nuova_colonna}, {nc}, metadati, ecc.) vengono filtrate
 * e non finiscono mai nel testo né generano righe vuote o artefatti visivi.
 */
export function parseChordProAST(chordproText: string, delta = 0): ChordProAST {
  const sections: SongSection[] = [];
  let currentSection: SongSection = { type: 'verse', lines: [] };
  const rawLines = chordproText.replace(/\r\n/g, '\n').split('\n');

  let pageCount = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // Riconoscimento direttive ChordPro
    const directiveMatch = trimmed.match(/^\{([^}:]+)(?::\s*([^}]+))?\}$/i);

    if (directiveMatch) {
      const name = (directiveMatch[1] || '').toLowerCase().trim();
      const arg = directiveMatch[2]?.trim();

      if (name === 'soc' || name === 'start_of_chorus' || name === 'ritornello' || name === 'rit') {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { type: 'chorus', label: arg || 'RITORNELLO', lines: [] };
        continue;
      } else if (name === 'eoc' || name === 'end_of_chorus') {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { type: 'verse', lines: [] };
        continue;
      } else if (name === 'strofa' || name === 'verse') {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { type: 'verse', label: arg, lines: [] };
        continue;
      } else if (name === 'ponte' || name === 'bridge') {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        currentSection = { type: 'bridge', label: arg || 'PONTE', lines: [] };
        continue;
      } else if (name === 'nuova_pagina' || name === 'np' || name === 'new_page') {
        pageCount++;
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        sections.push({ type: 'page_break', lines: [] });
        currentSection = { type: 'verse', lines: [] };
        continue;
      } else if (name === 'nuova_colonna' || name === 'nc' || name === 'column_break' || name === 'colb') {
        // Direttiva di colonna per la stampa: invisibile nella lettura lineare
        continue;
      } else if (name === 'c' || name === 'comment') {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        sections.push({ type: 'comment', label: arg, lines: [] });
        currentSection = { type: 'verse', lines: [] };
        continue;
      } else {
        // QUALSIASI ALTRA DIRETTIVA {...} (es. title, artist, key, tempo, ecc.)
        // NON deve MAI finire nel testo o produrre righe!
        continue;
      }
    }

    // Se incontra una riga vuota, separa le sezioni verse se non siamo in un ritornello esplicito
    if (trimmed === '') {
      if (currentSection.type === 'verse' && currentSection.lines.length > 0) {
        sections.push(currentSection);
        currentSection = { type: 'verse', lines: [] };
      } else if (currentSection.lines.length > 0) {
        // Riga vuota dentro chorus o bridge: aggiunge linea vuota
        currentSection.lines.push({ units: [{ lyric: '' }] });
      }
      continue;
    }

    // Riga normale di testo e accordi
    const parsedLine = parseLine(line, delta);
    currentSection.lines.push(parsedLine);
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return { sections, pageCount };
}

/* ==============================================================================
   RENDERER PREACT VIRTUAL DOM (NODI DOM SICURI)
   ============================================================================== */

export interface RenderChordProProps {
  chordproText: string;
  transposeDelta?: number;
  showChords?: boolean;
  fontSizeRem?: number;
}

/**
 * Componente Preact per il rendering reattivo di ChordPro.
 * Utilizza CantoLineRenderer per renderizzare ogni riga con:
 * - accordi posizionati verticalmente sopra le sillabe esatte a zero-width
 * - testo fluido a interlinea 1.5 naturale (nessuno spazio forzato a 2.4 su righe senza accordi)
 * - nessuna linea tratteggiata di salto pagina su schermo (lettura continua)
 */
export function ChordProRenderer({
  chordproText,
  transposeDelta = 0,
  showChords = true,
  fontSizeRem = 1,
}: RenderChordProProps): JSX.Element {
  const ast = parseChordProAST(chordproText, transposeDelta);

  return h(
    'div',
    {
      className: 'song-sheet-content',
      style: {
        fontSize: `${fontSizeRem}rem`,
        lineHeight: 1.5,
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-text)',
        wordBreak: 'break-word',
      },
    },
    ast.sections.map((section, sIdx) => {
      // Nessun riquadro tratteggiato per {nuova_pagina} nella lettura (la lettura su schermo è continua)
      if (section.type === 'page_break') {
        return null;
      }

      if (section.type === 'comment') {
        return h(
          'div',
          {
            key: `com-${sIdx}`,
            style: {
              fontStyle: 'italic',
              color: 'var(--color-text-secondary)',
              margin: '8px 0',
              fontSize: '0.9em',
            },
          },
          section.label || ''
        );
      }

      const isChorus = section.type === 'chorus';
      const isBridge = section.type === 'bridge';

      const sectionWrapperClass = isChorus
        ? 'song-chorus-block'
        : isBridge
        ? 'song-bridge-block'
        : 'song-verse-block';

      return h(
        'div',
        {
          key: `sec-${sIdx}`,
          className: sectionWrapperClass,
          style: {
            marginBottom: 'var(--space-4)',
          },
        },
        [
          section.label
            ? h(
                'span',
                {
                  className: isChorus ? 'song-chorus-label' : 'song-section-label',
                  style: {
                    display: 'block',
                    fontSize: '0.75em',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: isChorus ? 'var(--color-giochi-text)' : 'var(--color-text-secondary)',
                    marginBottom: 'var(--space-2)',
                    letterSpacing: '0.05em',
                  },
                },
                section.label
              )
            : null,
          ...section.lines.map((line, lIdx) => {
            return h(CantoLineRenderer, {
              key: `l-${lIdx}`,
              line: songLineToCantoLineData(line),
              showChords,
              transposeDelta,
            });
          }),
        ]
      );
    })
  );
}

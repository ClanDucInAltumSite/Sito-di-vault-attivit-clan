import { h, JSX } from 'preact';

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

/* ==============================================================================
   TEORIA MUSICALE E TRASPOSIZIONE (ITALIANO E AMERICANO)
   ============================================================================== */

const ITALIAN_NOTES_SHARP = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const ITALIAN_NOTES_FLAT = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

const AMERICAN_NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const AMERICAN_NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_TO_SEMITONE: Record<string, number> = {
  // Italiano
  'do': 0, 'do#': 1, 'reb': 1,
  're': 2, 're#': 3, 'mib': 3,
  'mi': 4, 'fab': 4, 'mi#': 5,
  'fa': 5, 'fa#': 6, 'solb': 6,
  'sol': 7, 'sol#': 8, 'lab': 8,
  'la': 9, 'la#': 10, 'sib': 10,
  'si': 11, 'dob': 11, 'si#': 0,

  // Americano
  'c': 0, 'c#': 1, 'db': 1,
  'd': 2, 'd#': 3, 'eb': 3,
  'e': 4, 'fb': 4, 'e#': 5,
  'f': 5, 'f#': 6, 'gb': 6,
  'g': 7, 'g#': 8, 'ab': 8,
  'a': 9, 'a#': 10, 'bb': 10,
  'b': 11, 'cb': 11, 'b#': 0,
};

// Regex per individuare la radice della nota (Italiana o Americana)
const ROOT_NOTE_REGEX = /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b\u266F\u266D]?)/i;

/**
 * Trasone una singola nota radice (es. "Do", "Fa#", "Bb", "Sol") di delta semitoni.
 */
function transposeNote(noteName: string, delta: number, preferFlat = false): string {
  const clean = noteName.replace('\u266F', '#').replace('\u266D', 'b');
  const lower = clean.toLowerCase();
  const originalSemitone = NOTE_TO_SEMITONE[lower];

  if (originalSemitone === undefined) {
    return noteName; // Non riconosciuta come nota, ritorna intatta
  }

  // Calcola nuovo semitono normalizzato 0..11
  const newSemitone = (((originalSemitone + delta) % 12) + 12) % 12;

  const isItalian = /^(do|re|mi|fa|sol|la|si)/i.test(noteName);
  const useFlat = preferFlat || clean.includes('b');

  if (isItalian) {
    const list = useFlat ? ITALIAN_NOTES_FLAT : ITALIAN_NOTES_SHARP;
    return list[newSemitone] ?? noteName;
  } else {
    const list = useFlat ? AMERICAN_NOTES_FLAT : AMERICAN_NOTES_SHARP;
    return list[newSemitone] ?? noteName;
  }
}

/**
 * Traspone un accordo completo (es. "Dom7", "Fa#maj7", "Re/Fa#", "Cadd9/G", "Sol4").
 */
export function transposeChord(chord: string, delta: number): string {
  if (delta === 0) return chord;

  const trimmed = chord.trim();
  if (!trimmed) return chord;

  // Gestione slash chords tipo "Do/Mi" o "C/E"
  const slashParts = trimmed.split('/');
  const mainPart = slashParts[0] || '';
  const bassPart = slashParts[1];

  const match = mainPart.match(ROOT_NOTE_REGEX);
  if (!match || !match[0]) return chord;

  const root = match[0];
  const suffix = mainPart.slice(root.length);
  const preferFlat = Boolean(root.includes('b') || (bassPart && bassPart.includes('b')));

  const transposedRoot = transposeNote(root, delta, preferFlat);
  let result = `${transposedRoot}${suffix}`;

  if (bassPart) {
    const bassMatch = bassPart.match(ROOT_NOTE_REGEX);
    if (bassMatch && bassMatch[0]) {
      const bassRoot = bassMatch[0];
      const bassSuffix = bassPart.slice(bassRoot.length);
      const transposedBass = transposeNote(bassRoot, delta, preferFlat);
      result += `/${transposedBass}${bassSuffix}`;
    } else {
      result += `/${bassPart}`;
    }
  }

  return result;
}

/**
 * Traspone l'intero testo ChordPro di delta semitoni.
 */
export function transposeChordPro(chordproText: string, delta: number): string {
  if (delta === 0) return chordproText;
  return chordproText.replace(/\[([^\]]+)\]/g, (_, chordInside) => {
    return `[${transposeChord(chordInside, delta)}]`;
  });
}

/* ==============================================================================
   PULIZIA PER RICERCA E CONTEGGIO PAGINE
   ============================================================================== */

/**
 * Rimuove tutti gli accordi [...] e le direttive {...} dal testo ChordPro,
 * restituendo il testo pulito per l'indicizzazione di ricerca.
 * In questo modo cercare "Do" non troverà tutti i canti con l'accordo di Do.
 */
export function stripChords(chordproText: string): string {
  if (!chordproText) return '';
  return chordproText
    .replace(/\{[^}]*\}/g, ' ') // Rimuove direttive ChordPro
    .replace(/\[[^\]]*\]/g, '')  // Rimuove gli accordi
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calcola il numero di pagine stimate per la stampa in base alle direttive {nuova_pagina}.
 */
export function calculatePageCount(chordproText: string): number {
  if (!chordproText) return 1;
  const matches = chordproText.match(/\{(nuova_pagina|np|new_page)\}/gi);
  return (matches?.length || 0) + 1;
}

/* ==============================================================================
   VALIDAZIONE SOFT DEGLI ACCORDI PER L'EDITOR ADMIN
   ============================================================================== */

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
 * Esempio: "[Do]Nel mezzo del [Sol]cammin" ->
 * [
 *   { chord: "Do", lyric: "Nel mezzo del " },
 *   { chord: "Sol", lyric: "cammin" }
 * ]
 */
export function parseLine(line: string, delta = 0): SongLine {
  const units: ChordUnit[] = [];
  const regex = /\[([^\]]*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Se la riga non inizia con un accordo, il testo iniziale ha chord undefined
  while ((match = regex.exec(line)) !== null) {
    const chordIndex = match.index;
    const rawChord = match[1] || '';

    if (chordIndex > lastIndex) {
      // C'è del testo prima dell'accordo corrente
      const textBefore = line.slice(lastIndex, chordIndex);
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

  if (lastIndex < line.length) {
    const remainingText = line.slice(lastIndex);
    if (units.length === 0) {
      units.push({ lyric: remainingText });
    } else {
      const last = units[units.length - 1];
      if (last) last.lyric += remainingText;
    }
  }

  // Se la riga è completamente vuota
  if (units.length === 0) {
    units.push({ lyric: '' });
  }

  return { units };
}

/**
 * Parsea l'intero testo ChordPro generando un AST strutturato in sezioni.
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
      } else if (name === 'c' || name === 'comment') {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
        }
        sections.push({ type: 'comment', label: arg, lines: [] });
        currentSection = { type: 'verse', lines: [] };
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
 * Gli accordi sono posizionati verticalmente sopra le rispettive sillabe tramite
 * contenitori inline-flex ('song-unit'). Se la riga va a capo sullo schermo mobile,
 * l'accordo resta ancorato esattamente sopra la sua sillaba.
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
        lineHeight: showChords ? 2.4 : 1.7,
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-text)',
        wordBreak: 'break-word',
      },
    },
    ast.sections.map((section, sIdx) => {
      if (section.type === 'page_break') {
        return h(
          'div',
          {
            key: `pb-${sIdx}`,
            className: 'song-page-break-indicator',
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 0',
              margin: '16px 0',
              borderTop: '1px dashed var(--color-border)',
              borderBottom: '1px dashed var(--color-border)',
              color: 'var(--color-text-secondary)',
              fontSize: '0.85em',
              fontWeight: 600,
            },
          },
          [h('span', null, '[Interruzione pagina per la stampa]')]
        );
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
            return h(
              'div',
              {
                key: `l-${lIdx}`,
                className: 'song-line',
                style: {
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'flex-end',
                  minHeight: showChords ? '2.4em' : '1.4em',
                },
              },
              line.units.map((unit, uIdx) => {
                if (!showChords) {
                  return h(
                    'span',
                    { key: `u-${uIdx}`, style: { whiteSpace: 'pre-wrap' } },
                    unit.lyric
                  );
                }

                // Quando showChords è attivo, l'accordo sta in colonna sopra la sillaba
                const chordContent = unit.chord ? unit.chord : '\u00A0';
                const isOnlyChord = unit.chord && (!unit.lyric || unit.lyric.trim() === '');

                return h(
                  'span',
                  {
                    key: `u-${uIdx}`,
                    className: 'song-unit',
                    style: {
                      display: 'inline-flex',
                      flexDirection: 'column',
                      verticalAlign: 'bottom',
                      marginRight: isOnlyChord ? '8px' : '0',
                    },
                  },
                  [
                    h(
                      'span',
                      {
                        className: 'song-chord',
                        style: {
                          color: 'var(--color-calendario)',
                          fontWeight: 700,
                          fontSize: '0.85em',
                          lineHeight: '1.2',
                          userSelect: 'none',
                          minHeight: '1.2em',
                        },
                      },
                      chordContent
                    ),
                    h(
                      'span',
                      {
                        className: 'song-lyric',
                        style: {
                          whiteSpace: 'pre',
                          lineHeight: '1.4',
                        },
                      },
                      unit.lyric || (isOnlyChord ? '\u00A0' : '')
                    ),
                  ]
                );
              })
            );
          }),
        ]
      );
    })
  );
}

/**
 * ==============================================================================
 * TEORIA MUSICALE E TRASPOSIZIONE ACCORDI (ITALIANO E AMERICANO)
 * ==============================================================================
 */

export const ITALIAN_NOTES_SHARP = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
export const ITALIAN_NOTES_FLAT = ['Do', 'Reb', 'Re', 'Mib', 'Mi', 'Fa', 'Solb', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

export const AMERICAN_NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const AMERICAN_NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const NOTE_TO_SEMITONE: Record<string, number> = {
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

export const ROOT_NOTE_REGEX = /^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b\u266F\u266D]?)/i;

/**
 * Traspone una singola nota radice (es. "Do", "Fa#", "Bb", "Sol") di delta semitoni.
 */
export function transposeNote(noteName: string, delta: number, preferFlat = false): string {
  const clean = noteName.replace('\u266F', '#').replace('\u266D', 'b');
  const lower = clean.toLowerCase();
  const originalSemitone = NOTE_TO_SEMITONE[lower];

  if (originalSemitone === undefined) {
    return noteName;
  }

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

/**
 * Rimuove tutti gli accordi [...] e le direttive {...} dal testo ChordPro,
 * restituendo il testo pulito per l'indicizzazione di ricerca.
 */
export function stripChords(chordproText: string): string {
  if (!chordproText) return '';
  return chordproText
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

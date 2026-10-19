/**
 * Modulo di Riconoscimento e Normalizzazione Accordi (Fase 10A / 10B)
 *
 * Riconosce notazioni italiane e anglosassoni, gestisce slash chord (Re/Fa#),
 * converte il trattino minore '-' in 'm' (La- -> Lam, SI- -> SIm, Re- -> Rem),
 * accetta maiuscole e minuscole (RE, Sol, LAm),
 * e previene rigorosamente le trappole linguistiche italiane (Do, Re, Mi, Fa, Sol, La, Si).
 */

export interface ChordLineOptions {
  isBold?: boolean;
  nextLineIsText?: boolean;
  warnings?: string[];
}

export const ITALIAN_ROOTS = [
  'DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI',
  'Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si',
  'do', 're', 'mi', 'fa', 'sol', 'la', 'si',
];

export const ANGLO_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'c', 'd', 'e', 'f', 'g', 'a', 'b'];
export const ALL_ROOTS = [...ITALIAN_ROOTS, ...ANGLO_ROOTS];

export const ITALIAN_ROOT_MAP: Record<string, string> = {
  do: 'Do', re: 'Re', mi: 'Mi', fa: 'Fa', sol: 'Sol', la: 'La', si: 'Si',
};

export const ANGLO_ROOT_MAP: Record<string, string> = {
  c: 'C', d: 'D', e: 'E', f: 'F', g: 'G', a: 'A', b: 'B',
};

const ACCIDENTALS = '[#\\u266Fb\\u266D]?';
// Supporta '-' per minore (es. La-, SI-, Re-), min, m, 7, maj7, sus4, add9, dim, ecc.
const DASH_OR_MODIFIERS = '(?:-(?:maj7|maj9|maj|m7b5|m7|min7|min|m|7sus4|sus4|sus2|sus|add9|add2|add4|add11|dim7|dim|aug|6|7|9|11|13|5|2|\\+)?|-|maj7|maj9|maj|m7b5|m7|min7|min|m|7sus4|sus4|sus2|sus|add9|add2|add4|add11|dim7|dim|aug|6|7|9|11|13|5|2|\\+)?';
const BASS = '(?:[\\/\\\\](?:[A-Ga-g]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI|do|re|mi|fa|sol|la|si)[#\\u266Fb\\u266D]?-?)?';

export const SINGLE_CHORD_REGEX = new RegExp(
  `^(?:${ALL_ROOTS.join('|')})${ACCIDENTALS}${DASH_OR_MODIFIERS}${BASS}$`
);

/**
 * Normalizza un singolo accordo (senza slash bass).
 * Converte esplicitamente il trattino indicatore di minore '-' in 'm' (La- -> Lam, SI- -> SIm, Re- -> Rem).
 * Preserva il casing originale dell'accordo (RE, Sol, LAm) e capitalizza radici interamente minuscole (do -> Do).
 */
export function normalizeSingleChordPart(token: string): string {
  const match = token.match(
    /^([A-Ga-g]|(?:DO|RE|MI|FA|SOL|LA|SI|Do|Re|Mi|Fa|Sol|La|Si|do|re|mi|fa|sol|la|si))([#\u266Fb\u266D]?)(-?)(maj7|maj9|maj|m7b5|m7|min7|min|m|7sus4|sus4|sus2|sus|add9|add2|add4|add11|dim7|dim|aug|6|7|9|11|13|5|2|\+)?$/
  );
  if (!match) return token;

  const [, rawRoot, rawAccidental, dashMinor, rawModifier] = match;
  if (!rawRoot) return token;

  let root = rawRoot;
  const lowerRoot = rawRoot.toLowerCase();
  if (rawRoot === lowerRoot) {
    if (ITALIAN_ROOT_MAP[lowerRoot]) {
      root = ITALIAN_ROOT_MAP[lowerRoot];
    } else if (ANGLO_ROOT_MAP[lowerRoot]) {
      root = ANGLO_ROOT_MAP[lowerRoot];
    }
  }

  let accidental = rawAccidental || '';
  if (accidental === '\u266F') accidental = '#';
  if (accidental === '\u266D') accidental = 'b';

  const isMinor = dashMinor === '-';
  let modifier = rawModifier || '';

  if (isMinor) {
    if (!modifier.startsWith('m') && !modifier.startsWith('min')) {
      modifier = 'm' + modifier;
    }
  }

  // Normalizza 'min' in 'm' per compattezza canzoniere
  if (modifier === 'min') modifier = 'm';
  else if (modifier.startsWith('min')) modifier = 'm' + modifier.slice(3);

  return `${root}${accidental}${modifier}`;
}

/**
 * Normalizza un token di accordo completo (anche con basso slash, es. Re/Fa#, Sol/Si, La-/Do#).
 */
export function normalizeChord(token: string): string {
  const clean = token.trim();
  if (!clean) return '';

  if (clean.includes('/')) {
    const parts = clean.split('/');
    const main = parts[0] ? normalizeSingleChordPart(parts[0]) : '';
    const bass = parts[1] ? normalizeSingleChordPart(parts[1]) : '';
    return `${main}/${bass}`;
  }
  return normalizeSingleChordPart(clean);
}

/**
 * Verifica se un token isolato è sintatticamente un accordo musicale.
 */
export function isChordToken(token: string): boolean {
  const clean = token.trim().replace(/[(),;.]/g, '');
  if (!clean) return false;
  return SINGLE_CHORD_REGEX.test(clean);
}

/**
 * Disambiguazione rigorosa per parole italiane (Do, Re, Mi, Fa, Sol, La, Si).
 * Protezione contro trappole linguistiche:
 * - Frasi contenenti parole ordinarie non vengono mai scambiate per accordi
 *   (es. "Do una cosa a te", "Re della terra", "Mi sento bene", "Fa caldo", "Sol levante", "La strada", "Si dice che").
 * - Righe di sole note omonime a parole (es. "Fa la la", "Si fa", "Do re mi fa sol la si")
 *   sono considerate testo a meno che non siano esplicitamente in grassetto (DOCX)
 *   o abbiano spaziature ampie da spartito o siano tutte maiuscole.
 */
export function isChordLine(
  line: string,
  options?: ChordLineOptions
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Se contiene già parentesi quadre tipo ChordPro [Do], non è riga di soli accordi
  if (trimmed.includes('[') && trimmed.includes(']')) return false;

  // Etichette RIT. non sono accordi
  if (/^RIT[.:]?$/i.test(trimmed)) return false;

  // Direttive commento non sono accordi
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return false;

  // Rimuovi eventuali separatori tra accordi: trattini '-', barre '/', pipe '|', trattini lunghi '–'
  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  const chordTokens = rawTokens.filter((t) => !/^[-|/–—]+$/.test(t));
  if (chordTokens.length === 0) return false;

  // Tutti i token devono essere accordi validi
  const allAreChords = chordTokens.every((t) => isChordToken(t));
  if (!allAreChords) return false;

  // Controllo trappola parole italiane comuni:
  // Note pure senza alterazioni o modificatori: Do, Re, Mi, Fa, Sol, La, Si
  const isAllSimpleItalianWordNotes = chordTokens.every((t) =>
    /^(?:do|re|mi|fa|sol|la|si)$/i.test(t)
  );

  if (isAllSimpleItalianWordNotes) {
    // Se la riga è in grassetto (es. dal DOCX), è accordi
    if (options?.isBold) return true;

    // Se sono parole minuscole o sentence-case con spazio singolo (es. "Fa la la la", "Si fa la la", "Do re mi fa sol la si")
    const hasWideSpacing = /\s{2,}|\t/.test(line);
    const isAllUpper = chordTokens.every((t) => t === t.toUpperCase());

    const hasSeparators = rawTokens.some((t) => /^[-|/–—]+$/.test(t));
    if (hasSeparators) return true;

    // Se non ha spaziatura ampia tipica degli accordi allineati sopra le parole, è testo ordinario
    if (!hasWideSpacing && !isAllUpper) {
      return false;
    }

    // Se sono parole ripetitive tipiche di ritornelli o canti ("la la", "fa la la")
    const lowerTokens = chordTokens.map((t) => t.toLowerCase());
    const hasRepetitions = lowerTokens.filter((t) => t === 'la' || t === 'fa').length >= 2;
    if (hasRepetitions && !options?.isBold) {
      return false;
    }

    // Se è tutta in MAIUSCOLO (es. "DO   FA   DO   SOL" o "DO FA DO SOL")
    if (isAllUpper) {
      return true;
    }

    // Se ha spaziatura ampia (spartito, es. "Do   Fa   Do   Sol")
    if (hasWideSpacing) {
      return true;
    }

    // Se la riga successiva è testo
    if (options?.nextLineIsText) {
      return true;
    }

    return false;
  }

  // (a) Scritta tutta in MAIUSCOLO (es. "DO FA DO SOL" o "C G AM F")
  const isAllUpper = chordTokens.every((t) => t === t.toUpperCase());
  if (isAllUpper) return true;

  // (b) Accordi internazionali anglosassoni (es. C, G, Am, F, Dm, Bb, F#m)
  const isAllAngloSaxon = chordTokens.every((t) => /^[A-G]/i.test(t) && isChordToken(t));
  if (isAllAngloSaxon) return true;

  // (c) Contiene alterazioni, modificatori o trattino minore (es. "Lam", "Fa#", "Sol7", "Re-", "SI-", "Re/Fa#")
  const hasModifiersOrAccidentals = chordTokens.some((t) =>
    /[#\u266Fb\u266D79\-]|maj|min|sus|add|dim|aug|\/|m$/i.test(t)
  );
  if (hasModifiersOrAccidentals) return true;

  // (d) Grassetto esplicito (dal docx)
  if (options?.isBold) return true;

  // (e) Ha almeno due token diversi e la riga successiva è testo
  if (chordTokens.length >= 2 && options?.nextLineIsText) {
    const uniqueTokens = new Set(chordTokens.map((t) => t.toLowerCase()));
    if (uniqueTokens.size >= 2) {
      return true;
    }
  }

  // Nel dubbio: segnala riga ambigua e NON considerarla riga di accordi
  if (options?.warnings && chordTokens.length > 0) {
    options.warnings.push(
      `Riga ambigua interpretata come testo: "${trimmed}" (usa maiuscole o accordi tra [parentesi] per forzarla)`
    );
  }

  return false;
}

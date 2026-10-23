/**
 * src/features/canti/pdf_importer.ts
 *
 * Importatore geometrico PDF ad alta fedeltà per il Canzoniere (Fase 11C).
 * Implementazione ufficiale in TypeScript con pdf.js dinamico, coordinate,
 * rilevamento colonne, allineamento sillabico degli accordi, gestione rumore e accenti U+FFFD.
 */

import { matchNoiseLine } from './rumore.config';

export interface PdfImportWarning {
  tipo: 'accordo_ambiguo' | 'accento_corretto' | 'parentesi_aperta' | 'riga_rumore_tolta';
  riga: number;
  testo: string;
  messaggio: string;
  dettagli?: {
    prima?: string;
    dopo?: string;
    motivo?: string;
  };
}

export interface RemovedNoiseItem {
  id: string;
  rigaOriginale: string;
  motivo: string;
  numeroPagina: number;
  indiceOriginale: number;
}

export interface AccentoCorrettoItem {
  riga: number;
  prima: string;
  dopo: string;
}

export interface ParsedPdfCantoResult {
  titolo: string;
  sottotitolo?: string | null;
  autore: string | null;
  categoria?: 'scout' | 'chiesa' | 'esterni' | null;
  tonalita: string | null;
  misura: string | null;
  tempo_bpm: number | null;
  bpm_testo: string | null;
  ritmo: string | null;
  capotasto: number | null;
  origine?: string | null;
  nota_fonte?: string | null;
  testo_chordpro: string;
  warnings: PdfImportWarning[];
  removedNoise: RemovedNoiseItem[];
  accentiCorretti: AccentoCorrettoItem[];
  hasColumns: boolean;
  pageCount: number;
  rawPageTexts: string[];
}

interface RawTextItem {
  str: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
  pageNum: number;
}

interface ClusteredLine {
  y: number;
  fontSize: number;
  items: RawTextItem[];
  text: string;
  isBold: boolean;
  isItalic: boolean;
  pageNum: number;
}

// Regex per il riconoscimento dei token di accordi musicali (estesa per qualità 7ª, 9ª, sus, add, alterazioni)
export const CHORD_TOKEN_REGEX = /^[(\[]?(?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)(?:[#b])?(?:m|min|maj|dim|aug|-|\+|Δ|°)?(?:maj7|maj9|m7b5|m7|m9|m6|dim7|sus4|sus2|sus|add9|add2|add4|6\/9|7\+|7sus4|7sus2|7b5|7#5|7b9|7#9|7|9|11|13|6|2|4|\+|-)?(?:[\/](?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)(?:[#b])?)?(?:_\||_|\|)?[)\].,]?$/i;

// Regex canoniche per sezioni e intestazioni musicali (Livello 1 - Invarianti strutturali universali)
export const SECTION_HEADER_REGEX = /^(?:\[|\{)?\s*(?:intro(?:duzione)?|strum(?:entale)?|stacco|outro|ponte|bridge|coda|finale|rit(?:ornello)?|chorus|refrain|strofa\s*\d*|verse\s*\d*)\s*[.:]?\s*(?:\]|\})?$/i;
export const CHORUS_HEADER_REGEX = /^(?:\[|\{)?\s*(?:rit(?:ornello)?|chorus|refrain)\s*[.:]?\s*(?:\]|\})?$/i;
export const VERSE_HEADER_REGEX = /^(?:\[|\{)?\s*(?:strofa|verse)\s*\d*\s*[.:]?\s*(?:\]|\})?$/i;
export const BRIDGE_HEADER_REGEX = /^(?:\[|\{)?\s*(?:bridge|ponte)\s*[.:]?\s*(?:\]|\})?$/i;
export const CODA_HEADER_REGEX = /^(?:\[|\{)?\s*(?:coda|finale|ripresa)\s*[.:]?\s*(?:\]|\})?$/i;
export const INSTRUMENTAL_HEADER_REGEX = /^(?:\[|\{)?\s*(?:intro(?:duzione)?|strum(?:entale)?|stacco|outro|coda|finale)\s*[.:]?\s*(?:\]|\})?$/i;

// Parole comuni / stop-words per il calcolo di similarità testuale tra sezioni
const COMMON_STOP_WORDS = new Set([
  'the', 'and', 'that', 'you', 'your', 'with', 'from', 'this', 'for', 'about', 'have',
  'che', 'non', 'per', 'con', 'del', 'della', 'dei', 'delle', 'gli', 'una', 'uno', 'nel', 'nella', 'nei', 'nelle', 'sul', 'sulla', 'questo', 'questa', 'sono'
]);

/**
 * Estrae parole significative (lowercase, senza accordi né caratteri speciali né stop-words)
 */
export function extractMeaningfulWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\{[^}]+\}/g, ' ')
    .replace(/[^a-z0-9àèéìòùáéíóú]/gi, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !COMMON_STOP_WORDS.has(w));
  return new Set(words);
}

// Parole italiane che potrebbero essere ambigue (note isolate o brevi)
const AMBIGUOUS_ITALIAN_WORDS = new Set([
  'la', 'si', 'fa', 're', 'mi', 'do', 'sol',
  'a', 'e', 'in', 'di', 'da', 'su', 'per', 'tra', 'fra', 'ma', 'se', 'no'
]);

/**
 * Normalizza il testo di un accordo (es. LA- -> Lam, DO#- -> Do#m, SI- -> Sim).
 */
export function normalizeChordName(token: string): string {
  let c = token.trim().replace(/\u200b/g, '');
  c = c.replace(/[.,]$/, '');
  c = c.replace(/(_\||_|\|)$/, '');

  const hasParen = c.startsWith('(') && c.endsWith(')');
  if (hasParen) {
    c = c.slice(1, -1);
  }

  // Converti trattino '-' che denota il minore in 'm', es. La- -> Lam, Do#- -> Do#m, La-7 -> Lam7
  c = c.replace(/-/g, 'm');

  // Gestione slash chord (es. Re/Fa#, Do/Sol)
  const normalizePart = (part: string) => {
    const match = part.match(/^(Do|Re|Mi|Fa|Sol|La|Si|[A-G])([#b]?)(.*)$/i);
    if (match && match[1]) {
      const root = match[1].toUpperCase();
      const accidental = match[2] || '';
      let rest = match[3] || '';
      if (rest.toLowerCase() === 'maj7') {
        rest = 'maj7';
      } else if (rest.toLowerCase() === 'maj') {
        rest = 'maj';
      } else if (rest.startsWith('M') && !rest.startsWith('Maj') && !rest.startsWith('maj')) {
        rest = 'm' + rest.slice(1);
      }
      return root + accidental + rest;
    }
    return part;
  };

  if (c.includes('/')) {
    const parts = c.split('/');
    const res = parts.map(normalizePart).join('/');
    return hasParen ? `(${res})` : res;
  }

  const res = normalizePart(c);
  return hasParen ? `(${res})` : res;
}

/**
 * Verifica se un token isolato è un accordo valido.
 */
export function isChordToken(token: string): boolean {
  const cleaned = token.trim().replace(/\u200b/g, '').replace(/[.,]$/, '');
  if (!cleaned) return false;
  if (/^(ed|od|da|in|su|di|ma|se|non)$/i.test(cleaned)) return false;
  return CHORD_TOKEN_REGEX.test(cleaned);
}

/**
 * Verifica se una riga di parole è una riga di accordi.
 * Regola 11C.3: tutti i token sono accordi e almeno uno tra:
 * - carattere in grassetto
 * - maiuscolo
 * - alterazioni o modificatori (#, b, -, m, 7, ecc.)
 * - almeno due token
 */
export function isChordLine(
  words: { text: string; isBold?: boolean }[]
): { isChord: boolean; isAmbiguous: boolean } {
  if (!words || words.length === 0) return { isChord: false, isAmbiguous: false };

  // Filtra stanghette di battuta (|), ripetizioni (x2, 2v) che non inficiano la riga di accordi
  const tokens = words
    .map((w) => w.text.trim().replace(/\u200b/g, '').replace(/[.,]$/, ''))
    .filter((t) => t.length > 0 && !/^[|:–—\-/]+$/.test(t) && !/^\(?[xX]?\d+[vV]?\)?$/.test(t));

  if (tokens.length === 0) return { isChord: false, isAmbiguous: false };

  // Tutti i token devono essere accordi
  const allAreChords = tokens.every((t) => isChordToken(t));
  if (!allAreChords) return { isChord: false, isAmbiguous: false };

  const hasBold = words.some((w) => w.isBold);
  const hasUppercase = tokens.some((t) => (t.length >= 2 && t === t.toUpperCase()) || (t.length === 1 && /[A-G]/.test(t)));
  const hasModifiers = tokens.some((t) => {
    const withoutRoot = t.replace(/^[(\[]?(?:Do|Re|Mi|Fa|Sol|La|Si|[A-G])/i, '');
    return /[#b\-m7+]/i.test(withoutRoot);
  });
  const hasMultipleTokens = tokens.length >= 2;

  const meetsCriteria = hasBold || hasUppercase || hasModifiers || hasMultipleTokens;
  if (!meetsCriteria) return { isChord: false, isAmbiguous: false };

  // Rileva se la riga è ambigua (es. "La la la", "Si fa", "Re mi fa" senza alterazioni né grassetto)
  const isAmbiguous = !hasBold && !hasModifiers && tokens.every((t) => AMBIGUOUS_ITALIAN_WORDS.has(t.toLowerCase()));

  return { isChord: true, isAmbiguous };
}

/**
 * Correzione accenti rovinati con carattere di sostituzione U+FFFD (11C.7).
 * NON tocca MAI il punto di domanda '?' (punteggiatura legittima).
 */
export function fixDamagedAccents(
  text: string,
  lineIndex: number,
  warnings: PdfImportWarning[],
  accentiCorretti: AccentoCorrettoItem[]
): string {
  if (!text.includes('\uFFFD')) {
    // Gestione standard E' -> È a inizio riga o parola
    const fixedE = text.replace(/^E'\s/g, 'È ');
    return fixedE;
  }

  let result = text;
  const original = text;

  const replacements: [RegExp, string][] = [
    [/pi\uFFFD/g, 'più'],
    [/l\uFFFD/g, 'là'],
    [/^\uFFFD$/g, 'è'],
    [/\b\uFFFD\b/g, 'è'],
    [/cambier\uFFFD/g, 'cambierà'],
    [/sar\uFFFD/g, 'sarà'],
    [/far\uFFFD/g, 'farà'],
    [/andr\uFFFD/g, 'andrà'],
    [/c'\uFFFD/g, "c'è"],
    [/perch\uFFFD/g, 'perché'],
    [/poich\uFFFD/g, 'poiché'],
    [/affinch\uFFFD/g, 'affinché'],
    [/cos\uFFFD/g, 'così'],
    [/gi\uFFFD/g, 'già'],
    [/quaggi\uFFFD/g, 'quaggiù'],
    [/lass\uFFFD/g, 'lassù'],
    [/verit\uFFFD/g, 'verità'],
    [/libert\uFFFD/g, 'libertà'],
    [/fedelt\uFFFD/g, 'fedeltà'],
    [/volont\uFFFD/g, 'volontà'],
    [/bont\uFFFD/g, 'bontà'],
    [/citt\uFFFD/g, 'città'],
    [/unit\uFFFD/g, 'unità'],
    [/novit\uFFFD/g, 'novità'],
  ];

  for (const [regex, rep] of replacements) {
    if (regex.test(result)) {
      result = result.replace(regex, rep);
    }
  }

  // Qualsiasi U+FFFD rimanente isolato dopo consonante viene sostituito con accento comune
  if (result.includes('\uFFFD')) {
    result = result.replace(/\uFFFD/g, 'à');
  }

  if (result !== original) {
    warnings.push({
      tipo: 'accento_corretto',
      riga: lineIndex,
      testo: result,
      messaggio: `Carattere corrotto (U+FFFD) ripristinato: "${original}" → "${result}"`,
      dettagli: { prima: original, dopo: result },
    });
    accentiCorretti.push({
      riga: lineIndex,
      prima: original,
      dopo: result,
    });
  }

  return result;
}

/**
 * Estrae i parametri musicali da una riga di metadati (Tempo, BPM, Ritmo, Capotasto, Tonalità, Categoria).
 */
export function extractMetadataFromLine(text: string) {
  const meta: {
    misura?: string;
    bpm_testo?: string;
    tempo_bpm?: number;
    ritmo?: string;
    capotasto?: number;
    tonalita?: string;
    categoria?: 'scout' | 'chiesa' | 'esterni';
  } = {};

  const clean = text.trim();

  // Misura: Tempo: 4/4 o 3/4
  const misuraMatch = clean.match(/tempo:\s*(\d+\/\d+)/i);
  if (misuraMatch && misuraMatch[1]) meta.misura = misuraMatch[1];

  // BPM testuale: es. "circa 92-94 BPM" o "BPM: 100"
  const bpmMatch = clean.match(/;\s*([^;]+?)\s*BPM/i) || clean.match(/BPM[:\s]*([^,\t;]+)/i);
  if (bpmMatch && bpmMatch[1]) {
    meta.bpm_testo = bpmMatch[1].trim();
    const num = meta.bpm_testo.match(/\d+/);
    if (num && num[0]) {
      const parsed = parseInt(num[0], 10);
      if (parsed >= 30 && parsed <= 300) meta.tempo_bpm = parsed;
    }
  }

  // Ritmo pennata con frecce: Ritmo: Giù, Giù-Su (↓ ↑ ↓↑)
  const ritmoMatch = clean.match(/ritmo(?:\s+pennata)?:\s*([^\t\n]+)/i);
  if (ritmoMatch && ritmoMatch[1]) {
    meta.ritmo = ritmoMatch[1].trim();
  }

  // Capotasto: Capotasto: 2
  const capoMatch = clean.match(/capotasto:\s*(\d+)/i);
  if (capoMatch && capoMatch[1]) {
    meta.capotasto = parseInt(capoMatch[1], 10);
  }

  // Tonalità dichiarata
  const tonMatch = clean.match(/tonalit[àa]:\s*([^\t,;.\n]+)/i) || clean.match(/key:\s*([^\t,;.\n]+)/i);
  if (tonMatch && tonMatch[1]) {
    meta.tonalita = tonMatch[1].trim();
  }

  // Categoria (11E / 11F)
  const catMatch = clean.match(/categoria:\s*([^\t,;.\n]+)/i);
  if (catMatch && catMatch[1]) {
    const val = catMatch[1].trim().toLowerCase();
    if (val.includes('scout')) meta.categoria = 'scout';
    else if (val.includes('chiesa') || val.includes('liturgic')) meta.categoria = 'chiesa';
    else if (val.includes('estern') || val.includes('altr')) meta.categoria = 'esterni';
  }

  return meta;
}

/**
 * Unisce una riga di accordi con la riga di testo sottostante posizionando
 * ogni accordo sul carattere più vicino (11C.5).
 */
const ROBOTO_CHAR_WEIGHTS: Record<string, number> = {
  ' ': 0.28,
  'i': 0.23, 'l': 0.23, 'j': 0.23, 'I': 0.28, '!': 0.28, '.': 0.25, ',': 0.25, ':': 0.25, ';': 0.25,
  'f': 0.32, 't': 0.32, 'r': 0.34, '1': 0.50, "'": 0.22, '"': 0.38, '-': 0.33,
  'a': 0.52, 'b': 0.55, 'c': 0.50, 'd': 0.55, 'e': 0.52, 'g': 0.55, 'h': 0.55, 'k': 0.51, 'n': 0.55,
  'o': 0.55, 'p': 0.55, 'q': 0.55, 's': 0.47, 'u': 0.55, 'v': 0.50, 'x': 0.50, 'y': 0.50, 'z': 0.48,
  'A': 0.64, 'B': 0.60, 'C': 0.65, 'D': 0.65, 'E': 0.58, 'F': 0.55, 'G': 0.69, 'H': 0.67, 'J': 0.44,
  'K': 0.62, 'L': 0.53, 'M': 0.83, 'N': 0.68, 'O': 0.70, 'P': 0.59, 'Q': 0.70, 'R': 0.62, 'S': 0.59,
  'T': 0.57, 'U': 0.67, 'V': 0.63, 'W': 0.92, 'X': 0.62, 'Y': 0.58, 'Z': 0.57,
};

export function mergeChordsWithLyricsLine(
  chordWords: RawTextItem[],
  lyricWords: RawTextItem[],
  _lineIndex?: number,
  _warnings?: PdfImportWarning[],
  snapThresholdChars = 1.5
): string {
  // Filtra solo accordi validi
  const validChordItems = chordWords.filter((cw) => {
    const raw = cw.str.trim();
    return raw.length > 0 && isChordToken(raw);
  });

  if (!lyricWords || lyricWords.length === 0) {
    return validChordItems.map((c) => `[${normalizeChordName(c.str)}]`).join(' ');
  }

  // Costruisci le coordinate orizzontali di ciascun carattere della riga di testo
  interface CharCoord {
    char: string;
    x: number;
    charIndexInLine: number;
    wordIndex: number;
    charIndexInWord: number;
  }

  const charCoords: CharCoord[] = [];
  let fullLineText = '';
  let globalWordIdx = 0;

  for (let itemIdx = 0; itemIdx < lyricWords.length; itemIdx++) {
    const item = lyricWords[itemIdx]!;
    if (itemIdx > 0) {
      const prev = lyricWords[itemIdx - 1]!;
      if (item.x0 - prev.x1 > 3.0 && !fullLineText.endsWith(' ') && !item.str.startsWith(' ')) {
        const spaceX = (prev.x1 + item.x0) / 2;
        charCoords.push({
          char: ' ',
          x: spaceX,
          charIndexInLine: fullLineText.length,
          wordIndex: -1,
          charIndexInWord: -1,
        });
        fullLineText += ' ';
      }
    }

    const str = item.str;
    const itemWidth = Math.max(item.x1 - item.x0, 1.0);
    let totalWeight = 0;
    for (let c = 0; c < str.length; c++) {
      totalWeight += ROBOTO_CHAR_WEIGHTS[str[c]!] ?? 0.52;
    }
    const weightScale = itemWidth / Math.max(totalWeight, 0.001);

    let currX = item.x0;
    let inWord = false;
    let charInWord = 0;

    for (let c = 0; c < str.length; c++) {
      const ch = str[c]!;
      const chWeight = (ROBOTO_CHAR_WEIGHTS[ch] ?? 0.52) * weightScale;
      const charMidX = currX + chWeight * 0.5;
      currX += chWeight;

      const isSpace = /\s/.test(ch);
      if (isSpace) {
        inWord = false;
        charCoords.push({
          char: ch,
          x: charMidX,
          charIndexInLine: fullLineText.length,
          wordIndex: -1,
          charIndexInWord: -1,
        });
      } else {
        if (!inWord) {
          inWord = true;
          globalWordIdx++;
          charInWord = 0;
        } else {
          charInWord++;
        }

        charCoords.push({
          char: ch,
          x: charMidX,
          charIndexInLine: fullLineText.length,
          wordIndex: globalWordIdx,
          charIndexInWord: charInWord,
        });
      }
      fullLineText += ch;
    }
  }

  // Mappa di iniezioni: charIndexInLine -> array di accordi da inserire prima di quel carattere
  const injections: Map<number, string[]> = new Map();
  const trailingChords: string[] = [];

  const lastWord = lyricWords[lyricWords.length - 1]!;
  const lastLineX = lastWord ? lastWord.x1 : 0;

  for (const cw of validChordItems) {
    const rawChord = cw.str.trim();
    const chordName = normalizeChordName(rawChord);
    if (!chordName) continue;

    const cx = cw.x0;

    // Se l'accordo si trova oltre la fine dell'ultimo testo della riga
    if (cx > lastLineX + 8.0) {
      trailingChords.push(`[${chordName}]`);
      continue;
    }

    // Trova il carattere più vicino in base alla coordinata x
    let bestDist = Infinity;
    let bestCoord: CharCoord | null = null;

    for (const coord of charCoords) {
      const dist = Math.abs(coord.x - cx);
      if (dist < bestDist) {
        bestDist = dist;
        bestCoord = coord;
      }
    }

    if (!bestCoord) {
      trailingChords.push(`[${chordName}]`);
      continue;
    }

    let targetCharIndex = bestCoord.charIndexInLine;

    // Regola 11C.5: Un accordo vicino all'inizio parola (entro 1.5 caratteri) si sposta all'inizio;
    // altrimenti resta dov'è, anche a metà parola.
    if (bestCoord.wordIndex >= 0) {
      if (bestCoord.charIndexInWord <= snapThresholdChars) {
        // Sposta all'inizio della parola
        targetCharIndex = bestCoord.charIndexInLine - bestCoord.charIndexInWord;
      }
    } else {
      // Cade su uno spazio: aggancia alla parola successiva se presente
      if (targetCharIndex + 1 < charCoords.length) {
        targetCharIndex += 1;
      }
    }

    if (!injections.has(targetCharIndex)) {
      injections.set(targetCharIndex, []);
    }
    injections.get(targetCharIndex)!.push(chordName);
  }

  // Componi la stringa finale ChordPro inserendo gli accordi nei punti calcolati
  let result = '';
  for (let i = 0; i <= fullLineText.length; i++) {
    const chordsAtPos = injections.get(i);
    if (chordsAtPos && chordsAtPos.length > 0) {
      for (const chord of chordsAtPos) {
        result += `[${chord}]`;
      }
    }
    if (i < fullLineText.length) {
      result += fullLineText[i]!;
    }
  }

  if (trailingChords.length > 0) {
    result += (result.endsWith(' ') ? '' : ' ') + trailingChords.join(' ');
  }

  return result;
}

/**
 * Parser principale PDF Canzoniere (Fase 11C).
 */
export async function parsePdfCanto(
  data: ArrayBuffer | Uint8Array,
  options: {
    workerUrl?: string;
    snapThresholdChars?: number;
    compactScout?: boolean;
  } = {}
): Promise<ParsedPdfCantoResult> {
  // Import dinamico di pdf.js (solo nell'area admin, zero impatto sul bundle di avvio)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const workerPath = options.workerUrl || `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
  }

  const uint8 =
    data instanceof Uint8Array
      ? new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
      : new Uint8Array(data);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8,
    useSystemFonts: true,
    disableFontFace: false,
  });

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;

  let totalItemsCount = 0;
  const rawPageTexts: string[] = [];
  const allPageLines: ClusteredLine[] = [];

  let extractedTitle = '';
  let extractedSubtitle: string | null = null;
  let extractedAuthor: string | null = null;
  const extractedParams: ReturnType<typeof extractMetadataFromLine> = {};

  const warnings: PdfImportWarning[] = [];
  const removedNoise: RemovedNoiseItem[] = [];
  const accentiCorretti: AccentoCorrettoItem[] = [];
  let detectedColumnsAcrossPages = false;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    try {
      await page.getOperatorList();
    } catch {
      // Ignora se non disponibile
    }
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const items: RawTextItem[] = [];

    for (const rawItem of textContent.items) {
      if ('str' in rawItem) {
        const str = rawItem.str.replace(/\u200b/g, '');
        if (!str.trim()) continue;

        const tx = rawItem.transform[4] || 0;
        const ty = rawItem.transform[5] || 0;
        const w = rawItem.width || 0;
        const h = rawItem.height || Math.abs(rawItem.transform[0]) || 12;
        const fontSize = Math.hypot(rawItem.transform[0], rawItem.transform[1]) || h || 12;

        const fontName = rawItem.fontName || '';
        let isBold = /bold|black|heavy|w[7-9]00/i.test(fontName);
        let isItalic = /italic|oblique/i.test(fontName);

        if (page.commonObjs && page.commonObjs.has(fontName)) {
          const fontObj = page.commonObjs.get(fontName) as { bold?: boolean; italic?: boolean; name?: string; fallbackName?: string } | undefined;
          if (fontObj) {
            if (fontObj.bold !== undefined) isBold = isBold || !!fontObj.bold;
            if (fontObj.italic !== undefined) isItalic = isItalic || !!fontObj.italic;
            if (fontObj.name) {
              isBold = isBold || /bold|black|heavy|w[7-9]00/i.test(fontObj.name);
              isItalic = isItalic || /italic|oblique/i.test(fontObj.name);
            }
            if (fontObj.fallbackName) {
              isBold = isBold || /bold|black|heavy|w[7-9]00/i.test(fontObj.fallbackName);
              isItalic = isItalic || /italic|oblique/i.test(fontObj.fallbackName);
            }
          }
        }

        items.push({
          str,
          x0: tx,
          y0: ty,
          x1: tx + w,
          y1: ty + h,
          width: w,
          height: h,
          fontSize,
          fontName,
          isBold,
          isItalic,
          pageNum,
        });
      }
    }

    totalItemsCount += items.length;
    rawPageTexts.push(items.map((i) => i.str).join(' '));

    if (items.length === 0) continue;

    // 1. RILEVAMENTO DUE COLONNE (11C.1)
    // Fascia verticale vuota lungo la zona centrale (35%-65% della larghezza pagina)
    // con testo effettivo presente su entrambe le colonne (evita falsi positivi su pagine a 1 colonna)
    const pageWidth = viewport.width;
    const centerStart = pageWidth * 0.35;
    const centerEnd = pageWidth * 0.65;

    // Raccogli le linee preliminari per analizzare la fascia centrale
    const bodyItems = items.filter((it) => it.fontSize <= 15.0); // Escludi titoli grandi
    let isTwoColumns = false;
    let gutterMidX = pageWidth / 2;

    if (bodyItems.length >= 24) {
      // Cerca una colonna libera
      const STEP = 5;
      for (let testX = centerStart; testX <= centerEnd; testX += STEP) {
        const gutterLeft = testX - 10;
        const gutterRight = testX + 10;
        const itemsCrossing = bodyItems.filter((it) => it.x0 < gutterRight && it.x1 > gutterLeft);
        if (itemsCrossing.length === 0) {
          const leftItems = bodyItems.filter((it) => it.x1 <= gutterLeft);
          const rightItems = bodyItems.filter((it) => it.x0 >= gutterRight);

          // Affinché siano due colonne vere, entrambi i lati devono avere un numero congruo di parole
          // distribuite su una larghezza reale (evita che un margine vuoto a destra venga scambiato per colonna)
          if (leftItems.length >= 12 && rightItems.length >= 12) {
            const leftWidth = Math.max(...leftItems.map((i) => i.x1)) - Math.min(...leftItems.map((i) => i.x0));
            const rightWidth = Math.max(...rightItems.map((i) => i.x1)) - Math.min(...rightItems.map((i) => i.x0));

            if (leftWidth >= 70 && rightWidth >= 70) {
              isTwoColumns = true;
              gutterMidX = testX;
              detectedColumnsAcrossPages = true;
              break;
            }
          }
        }
      }
    }

    // Funzione interna di clustering delle righe per baseline
    const clusterItemsIntoLines = (itemList: RawTextItem[]): ClusteredLine[] => {
      const linesByY: { y: number; fontSize: number; items: RawTextItem[] }[] = [];

      // Ordina elementi per Y decrescente (dall'alto verso il basso della pagina)
      const sortedByY = [...itemList].sort((a, b) => b.y0 - a.y0);

      for (const item of sortedByY) {
        const itemY = item.y0;
        const tolerance = Math.max(item.fontSize * 0.35, 3.5);

        let targetLine = linesByY.find((l) => Math.abs(l.y - itemY) <= tolerance);
        if (!targetLine) {
          targetLine = { y: itemY, fontSize: item.fontSize, items: [] };
          linesByY.push(targetLine);
        }
        targetLine.items.push(item);
      }

      // Ordina le righe dall'alto verso il basso
      linesByY.sort((a, b) => b.y - a.y);

      return linesByY.map((l) => {
        // Ordina elementi della riga per coordinata X crescente
        const sortedItems = [...l.items].sort((a, b) => a.x0 - b.x0);

        // Fondi elementi adiacenti (distanza <= 2.5pt o frammenti di accordo es. FA# + m)
        const mergedItems: RawTextItem[] = [];
        for (const item of sortedItems) {
          if (!item.str.trim()) continue;
          const last = mergedItems[mergedItems.length - 1];
          if (last && (item.x0 - last.x1 <= 2.5)) {
            last.str += item.str;
            last.x1 = Math.max(last.x1, item.x1);
            last.width = last.x1 - last.x0;
            last.isBold = last.isBold || item.isBold;
            last.isItalic = last.isItalic || item.isItalic;
          } else {
            mergedItems.push({ ...item });
          }
        }

        const text = mergedItems.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
        const isBold = mergedItems.some((i) => i.isBold);
        const isItalic = mergedItems.some((i) => i.isItalic);
        return {
          y: l.y,
          fontSize: l.fontSize,
          items: mergedItems,
          text,
          isBold,
          isItalic,
          pageNum,
        };
      });
    };

    if (isTwoColumns) {
      // Separa flusso colonna sinistra e destra
      const headerItems = items.filter((it) => it.fontSize > 15.0 || (it.x0 < gutterMidX && it.x1 > gutterMidX));
      const leftItems = items.filter((it) => it.x1 <= gutterMidX && !headerItems.includes(it));
      const rightItems = items.filter((it) => it.x0 >= gutterMidX && !headerItems.includes(it));

      const headerLines = clusterItemsIntoLines(headerItems);
      const leftLines = clusterItemsIntoLines(leftItems);
      const rightLines = clusterItemsIntoLines(rightItems);

      allPageLines.push(...headerLines, ...leftLines, ...rightLines);
    } else {
      const pageLines = clusterItemsIntoLines(items);
      allPageLines.push(...pageLines);
    }
  }

  // Verifica scansioni / PDF senza testo (11C.10)
  if (totalItemsCount === 0 || allPageLines.length === 0) {
    throw new Error('PDF senza testo rilevabile (scansione o immagine). Questo strumento importa PDF digitali con testo vettoriale selezionabile.');
  }

  // 2. ESTRAZIONE METADATI DELLA PRIMA PAGINA (11C.9)
  // Trova il titolo: elemento con font size più grande sulla prima pagina
  const firstPageLines = allPageLines.filter((l) => l.pageNum === 1);
  let maxFontSize = 0;
  let titleCandidate = '';
  let titleLineIdx = -1;

  for (let idx = 0; idx < firstPageLines.length; idx++) {
    const l = firstPageLines[idx]!;
    if (l.fontSize > maxFontSize && l.text.length > 2) {
      // Ignora watermark noti
      if (!matchNoiseLine(l.text)) {
        maxFontSize = l.fontSize;
        titleCandidate = l.text;
        titleLineIdx = idx;
      }
    }
  }

  if (titleCandidate && (maxFontSize >= 14.0 || ((titleCandidate.includes('–') || titleCandidate.includes(' - ')) && maxFontSize >= 10.0 && titleLineIdx <= 2))) {
    extractedTitle = titleCandidate;

    // Se il titolo contiene trattino di separazione artista (es. Centopassi – Modena City Ramblers)
    if (titleCandidate.includes('–') || titleCandidate.includes(' - ')) {
      const parts = titleCandidate.split(/\s*[–-]\s*/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        extractedTitle = parts[0].trim();
        extractedAuthor = parts[1].trim();
      }
    }

    // Pulisci suffissi web frequenti da titolo e autore (es. "Accordi 100% Corretti", "Chords", "Spartito")
    const cleanWebSuffix = (str: string) =>
      str.replace(/\s*(?:accordi(?:\s+100%\s+corretti|\s+per\s+chitarra|\s+semplici)?|chords|testo\s+e\s+accordi|spartito|tabs?)\s*$/i, '').trim();

    extractedTitle = cleanWebSuffix(extractedTitle);
    if (extractedAuthor) {
      extractedAuthor = cleanWebSuffix(extractedAuthor);
    }

    // Sottotitolo o Autore: riga successiva in corsivo o tra parentesi o testo prima degli accordi
    if (titleLineIdx + 1 < firstPageLines.length) {
      const nextLine = firstPageLines[titleLineIdx + 1]!;
      if (nextLine.text.startsWith('(') && nextLine.text.endsWith(')')) {
        extractedSubtitle = nextLine.text;
        if (titleLineIdx + 2 < firstPageLines.length) {
          const authorLine = firstPageLines[titleLineIdx + 2]!;
          if (!extractedAuthor && authorLine.isItalic && !authorLine.text.toLowerCase().includes('tempo:')) {
            extractedAuthor = authorLine.text;
          }
        }
      } else if (!extractedAuthor && nextLine.isItalic && !nextLine.text.toLowerCase().includes('tempo:')) {
        extractedAuthor = nextLine.text;
      } else if (!extractedAuthor && !isChordLine(nextLine.items.map(it => ({ text: it.str, isBold: it.isBold }))).isChord) {
        const t = nextLine.text.trim();
        if (!matchNoiseLine(t) && !/^(intro|strum|tempo:|ritmo)/i.test(t) && t.length > 2) {
          extractedAuthor = t;
        }
      }
    }
  }

  // Rileva intestazioni e piè di pagina ripetuti su documenti a più pagine (11C.6)
  const repeatedHeaderFooterTexts = new Set<string>();
  if (numPages >= 2) {
    const pageHeaderMap: Map<number, Set<string>> = new Map();
    for (const line of allPageLines) {
      if (line.y >= 780 || line.y <= 50) {
        // MAI considerare accordi come header o footer!
        const isChord = isChordLine(line.items.map((it) => ({ text: it.str, isBold: it.isBold }))).isChord;
        if (isChord) continue;

        const t = line.text.trim().toLowerCase();
        if (t.length <= 4) continue;

        if (!pageHeaderMap.has(line.pageNum)) {
          pageHeaderMap.set(line.pageNum, new Set());
        }
        pageHeaderMap.get(line.pageNum)!.add(t);
      }
    }
    const textCounts: Map<string, number> = new Map();
    for (const [, texts] of pageHeaderMap) {
      for (const t of texts) {
        textCounts.set(t, (textCounts.get(t) || 0) + 1);
      }
    }
    for (const [t, count] of textCounts) {
      if (count >= 2) {
        repeatedHeaderFooterTexts.add(t);
      }
    }
  }

  // 3. FILTRO RUMORE (11C.6) E RICONOSCIMENTO RIGHE PARAMETRI (11C.9)
  const cleanedLines: ClusteredLine[] = [];

  for (let i = 0; i < allPageLines.length; i++) {
    const line = allPageLines[i]!;
    const trimmed = line.text.trim();

    if (!trimmed) continue;

    // Se la riga è una riga di accordi musicali, NON È MAI RUMORE NÉ HEADER/FOOTER
    const chordCheck = isChordLine(line.items.map((it) => ({ text: it.str, isBold: it.isBold })));
    if (chordCheck.isChord) {
      cleanedLines.push(line);
      continue;
    }

    // Escludi riga se corrisponde al titolo o sottotitolo o autore già estratto
    if (titleCandidate && trimmed.toUpperCase() === titleCandidate.toUpperCase()) {
      continue;
    }
    if (extractedTitle && trimmed.toUpperCase() === extractedTitle.toUpperCase()) {
      continue;
    }
    if (extractedSubtitle && trimmed === extractedSubtitle) {
      continue;
    }
    if (extractedAuthor && trimmed.toLowerCase() === extractedAuthor.toLowerCase()) {
      continue;
    }

    // Controllo dicitura autore esplicita (es. "AUTORE: NOEL GALLAGHER", "Autori: Vasco Rossi")
    const authorExplicitMatch = trimmed.match(/^(?:autori?|compositore|testo\s+di):\s*(.+)$/i);
    if (authorExplicitMatch && authorExplicitMatch[1]) {
      if (!extractedAuthor) {
        extractedAuthor = authorExplicitMatch[1].trim();
      }
      removedNoise.push({
        id: `noise-${i}-${Date.now()}`,
        rigaOriginale: trimmed,
        motivo: 'Dicitura autore o crediti',
        numeroPagina: line.pageNum,
        indiceOriginale: i,
      });
      continue;
    }

    // Escludi etichette di categoria o genere isolate in testata
    if (line.pageNum === 1 && cleanedLines.length <= 2) {
      if (/^(?:canti\s+(?:liturgici|scout|popolari|di\s+chiesa)|liturgico|canzoni\s+scout|musica\s+pop)$/i.test(trimmed)) {
        if (!extractedParams.categoria) {
          if (/liturgic|chiesa/i.test(trimmed)) extractedParams.categoria = 'chiesa';
          else if (/scout/i.test(trimmed)) extractedParams.categoria = 'scout';
        }
        continue;
      }
    }

    // Controllo intestazioni e piè di pagina ripetuti (11C.6): SOLO se la riga è effettivamente ai margini estremi!
    const isAtMargin = line.y >= 780 || line.y <= 50;
    if (isAtMargin && repeatedHeaderFooterTexts.has(trimmed.toLowerCase())) {
      removedNoise.push({
        id: `noise-${i}-${Date.now()}`,
        rigaOriginale: trimmed,
        motivo: 'Intestazione o piè di pagina ripetuto',
        numeroPagina: line.pageNum,
        indiceOriginale: i,
      });
      warnings.push({
        tipo: 'riga_rumore_tolta',
        riga: cleanedLines.length,
        testo: trimmed,
        messaggio: `Rimossa riga di rumore: "${trimmed}" (Intestazione o piè di pagina ripetuto)`,
        dettagli: { motivo: 'Intestazione o piè di pagina ripetuto' },
      });
      continue;
    }

    // Controllo riga parametri (Tempo, BPM, Ritmo, Capotasto)
    if (/tempo:/i.test(trimmed) || /ritmo/i.test(trimmed) || /capotasto:/i.test(trimmed) || /bpm/i.test(trimmed)) {
      const meta = extractMetadataFromLine(trimmed);
      Object.assign(extractedParams, meta);
      continue; // Non includere la riga parametri nel corpo della canzone
    }

    // Controllo rumore (watermark, URL, numeri di pagina)
    const noiseMatch = matchNoiseLine(trimmed);
    if (noiseMatch) {
      removedNoise.push({
        id: `noise-${i}-${Date.now()}`,
        rigaOriginale: trimmed,
        motivo: noiseMatch.description,
        numeroPagina: line.pageNum,
        indiceOriginale: i,
      });
      warnings.push({
        tipo: 'riga_rumore_tolta',
        riga: cleanedLines.length,
        testo: trimmed,
        messaggio: `Rimossa riga di rumore: "${trimmed}" (${noiseMatch.description})`,
        dettagli: { motivo: noiseMatch.description },
      });
      continue;
    }

    cleanedLines.push(line);
  }

  // 4. ASSEMBLAGGIO CORPO CANTO, ACCORDI E RITORNELLI (11C.3, 11C.4, 11C.5, 11C.8)
  const outputChordProLines: string[] = [];
  const intermediateLines: IntermediateSongLine[] = [];
  let currIdx = 0;

  // Calcola il passo righe medio per rilevare i salti di blocco (> 1.3 volte il passo riga)
  let lineStep = 18;
  const diffs: number[] = [];
  for (let i = 0; i < cleanedLines.length - 1; i++) {
    const d = Math.abs(cleanedLines[i]!.y - cleanedLines[i + 1]!.y);
    if (d > 5 && d < 40) diffs.push(d);
  }
  if (diffs.length > 0) {
    diffs.sort((a, b) => a - b);
    lineStep = diffs[Math.floor(diffs.length / 2)] || 18;
  }

  while (currIdx < cleanedLines.length) {
    const currentLine = cleanedLines[currIdx]!;
    let currentText = currentLine.text;

    // Correzione accenti rovinati U+FFFD (11C.7)
    currentText = fixDamagedAccents(currentText, outputChordProLines.length, warnings, accentiCorretti);

    // Controllo parentesi non chiuse (11D)
    const openParens = (currentText.match(/\(/g) || []).length;
    const closeParens = (currentText.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      warnings.push({
        tipo: 'parentesi_aperta',
        riga: outputChordProLines.length,
        testo: currentText,
        messaggio: `Parentesi non bilanciate: ${openParens} aperte, ${closeParens} chiuse`,
      });
    }

    // Regola 11C.8: "Intro:", "Strum:", "Outro:", "Stacco:" restano testo visibile
    // "RIT." e "RIT:" restano righe di testo come nel documento

    // Verifica se la riga corrente è una riga di accordi
    const chordAnalysis = isChordLine(currentLine.items.map((it) => ({ text: it.str, isBold: it.isBold })));

    if (chordAnalysis.isAmbiguous) {
      warnings.push({
        tipo: 'accordo_ambiguo',
        riga: outputChordProLines.length,
        testo: currentText,
        messaggio: `Riga ambigua con possibili parole italiane/accordi: "${currentText}"`,
      });
    }

    if (chordAnalysis.isChord) {
      // Controlla se la riga successiva è testo sotto cui allineare gli accordi
      if (currIdx + 1 < cleanedLines.length) {
        const nextLine = cleanedLines[currIdx + 1]!;
        const nextChordAnalysis = isChordLine(nextLine.items.map((it) => ({ text: it.str, isBold: it.isBold })));

        const verticalDist = Math.abs(currentLine.y - nextLine.y);
        const isRightAbove = verticalDist <= lineStep * 1.8;

        if (!nextChordAnalysis.isChord && !SECTION_HEADER_REGEX.test(nextLine.text.trim()) && isRightAbove) {
          // Unione accordi con testo
          let nextTextFixed = nextLine.text;
          nextTextFixed = fixDamagedAccents(nextTextFixed, outputChordProLines.length, warnings, accentiCorretti);

          // Allinea gli accordi sui caratteri della riga di testo
          const mergedLine = mergeChordsWithLyricsLine(
            currentLine.items,
            nextLine.items,
            outputChordProLines.length,
            warnings,
            options.snapThresholdChars ?? 1.5
          );

          outputChordProLines.push(mergedLine);
          currIdx += 2;

          let hasGapAfter = false;
          if (currIdx < cleanedLines.length) {
            const nextRemaining = cleanedLines[currIdx]!;
            const samePage = nextLine.pageNum === nextRemaining.pageNum;
            if (samePage) {
              const gap = Math.abs(nextLine.y - nextRemaining.y);
              if (gap > lineStep * 1.65) {
                outputChordProLines.push('');
                hasGapAfter = true;
              }
            } else {
              // Su pagina diversa: se la riga precedente era in fondo alla pagina (y < 120),
              // è un flusso continuo di testo tracimato tra pagine; altrimenti è un salto di blocco
              if (nextLine.y >= 120) {
                outputChordProLines.push('');
                hasGapAfter = true;
              }
            }
          }

          intermediateLines.push({
            text: mergedLine,
            rawLyrics: nextTextFixed,
            type: 'lyric_with_chord',
            hasGapAfter,
          });
          continue;
        }
      }

      // Riga di soli accordi senza testo subito sotto
      const chordTokens = currentLine.items
        .filter((it) => {
          const raw = it.str.trim();
          return raw.length > 0 && isChordToken(raw);
        })
        .map((it) => normalizeChordName(it.str));

      // Comprimi ripetizioni consecutive identiche (es. [Reb] [Reb] [Lab] [Mib] [Mib] -> [Reb] [Lab] [Mib])
      const deduplicatedChords: string[] = [];
      for (const ch of chordTokens) {
        if (deduplicatedChords.length === 0 || deduplicatedChords[deduplicatedChords.length - 1] !== ch) {
          deduplicatedChords.push(ch);
        }
      }

      const pureChords = deduplicatedChords.map((c) => `[${c}]`).join(' ');
      if (pureChords.trim().length > 0) {
        outputChordProLines.push(pureChords);
      }
      currIdx += 1;

      let hasGapAfter = false;
      if (currIdx < cleanedLines.length) {
        const nextRemaining = cleanedLines[currIdx]!;
        const samePage = currentLine.pageNum === nextRemaining.pageNum;
        if (samePage) {
          const gap = Math.abs(currentLine.y - nextRemaining.y);
          if (gap > lineStep * 1.65) {
            outputChordProLines.push('');
            hasGapAfter = true;
          }
        } else {
          if (currentLine.y >= 120) {
            outputChordProLines.push('');
            hasGapAfter = true;
          }
        }
      }

      if (pureChords.trim().length > 0) {
        intermediateLines.push({
          text: pureChords,
          rawLyrics: '',
          type: 'chords_only',
          hasGapAfter,
        });
      }
    } else {
      // Riga di puro testo
      outputChordProLines.push(currentText);
      currIdx += 1;

      let hasGapAfter = false;
      if (currIdx < cleanedLines.length) {
        const nextRemaining = cleanedLines[currIdx]!;
        const samePage = currentLine.pageNum === nextRemaining.pageNum;
        if (samePage) {
          const gap = Math.abs(currentLine.y - nextRemaining.y);
          if (gap > lineStep * 1.65) {
            outputChordProLines.push('');
            hasGapAfter = true;
          }
        } else {
          if (currentLine.y >= 120) {
            outputChordProLines.push('');
            hasGapAfter = true;
          }
        }
      }

      const isHdr = SECTION_HEADER_REGEX.test(currentText.trim());
      const hasInlineChords = /\[[A-Za-z0-9#b\-\+\/]+\]/.test(currentText);
      const rawText = isHdr ? '' : (hasInlineChords ? currentText.replace(/\[[^\]]+\]/g, '').trim() : currentText);
      intermediateLines.push({
        text: currentText,
        rawLyrics: rawText,
        type: isHdr ? 'header' : (hasInlineChords ? 'lyric_with_chord' : 'lyric_plain'),
        hasGapAfter,
      });
    }
  }

  const rawChordPro = outputChordProLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const finalChordPro = options.compactScout !== false
    ? compactScoutSong(intermediateLines)
    : rawChordPro;

  return {
    titolo: extractedTitle || 'Canto Senza Titolo',
    sottotitolo: extractedSubtitle,
    autore: extractedAuthor || null,
    categoria: extractedParams.categoria || null,
    tonalita: extractedParams.tonalita || null,
    misura: extractedParams.misura || null,
    tempo_bpm: extractedParams.tempo_bpm || null,
    bpm_testo: extractedParams.bpm_testo || null,
    ritmo: extractedParams.ritmo || null,
    capotasto: extractedParams.capotasto !== undefined ? extractedParams.capotasto : null,
    testo_chordpro: finalChordPro,
    warnings,
    removedNoise,
    accentiCorretti,
    hasColumns: detectedColumnsAcrossPages,
    pageCount: numPages,
    rawPageTexts,
  };
}

export interface IntermediateSongLine {
  text: string;
  rawLyrics: string;
  type: 'chords_only' | 'lyric_with_chord' | 'lyric_plain' | 'header';
  hasGapAfter: boolean;
}

/**
 * Algoritmo di Compattazione Canzoniere Scout:
 * 1. Strofa 1: accordi completi allineati sulle sillabe.
 * 2. Strofe successive (stessa melodia/giro): solo testo, senza accordi ripetuti.
 * 3. Primo Ritornello: etichettato con RIT: e accordi completi.
 * 4. Ritornelli successivi: collassati a singola riga RIT. isolata con riga vuota sopra e sotto.
 * 5. Eliminazione strofe duplicate verbatim.
 */
function extractChordsFromStanza(st: IntermediateSongLine[]): string[] {
  const chords: string[] = [];
  for (const l of st) {
    if (SECTION_HEADER_REGEX.test(l.text.trim())) continue;
    const matches = Array.from(l.text.matchAll(/\[([^\]]+)\]/g));
    for (const m of matches) {
      if (m[1]) {
        const norm = normalizeChordName(m[1].trim());
        if (isChordToken(norm)) chords.push(norm);
      }
    }
    if (matches.length === 0 && l.type === 'chords_only') {
      const parts = l.text.split(/\s+/).filter(Boolean);
      for (const p of parts) {
        const norm = normalizeChordName(p);
        if (isChordToken(norm)) chords.push(norm);
      }
    }
  }
  return chords;
}

/**
 * Algoritmo di Compattazione Canzoniere Scout:
 * 1. Strofa 1: accordi completi allineati sulle sillabe.
 * 2. Strofe successive con stesso giro: solo testo, senza accordi ripetuti.
 *    Se una strofa successiva cambia accordi (modulazione o variazione armonica), mantiene gli accordi.
 * 3. Primo Ritornello: etichettato con RIT: e accordi completi.
 * 4. Ritornelli successivi: collassati a singola riga RIT. isolata con riga vuota sopra e sotto.
 * 5. Giri strumentali / intro / strum / outro: convertiti in commenti {comment: prefix CHORDS}, un commento per riga.
 * 6. Eliminazione strofe duplicate verbatim ed eliminazione RIT. consecutivi.
 */
export function compactScoutSong(parsedSongLines: IntermediateSongLine[]): string {
  if (parsedSongLines.length === 0) return '';

  // 1. Costruzione preliminare delle stanze secondo i salti di riga e stacchi
  const rawStanzas: IntermediateSongLine[][] = [];
  let currentStanza: IntermediateSongLine[] = [];

  for (let idx = 0; idx < parsedSongLines.length; idx++) {
    const sl = parsedSongLines[idx]!;
    const t = sl.text.trim();
    if (!t) continue;

    const isHeader = sl.type === 'header' || SECTION_HEADER_REGEX.test(t) || /^\{(?:comment|c):/i.test(t);

    if (isHeader) {
      if (currentStanza.length > 0) {
        rawStanzas.push(currentStanza);
        currentStanza = [];
      }
      currentStanza.push(sl);
      continue;
    }

    currentStanza.push(sl);

    // Se la riga successiva è anch'essa solo accordi, mantienile insieme nella stessa stanza strumentale!
    const nextSl = idx + 1 < parsedSongLines.length ? parsedSongLines[idx + 1] : null;
    const isConsecutiveChords = sl.type === 'chords_only' && nextSl && nextSl.type === 'chords_only';

    // Se è una riga di soli accordi isolata tra due righe di testo (chord lick), non spezzare la stanza
    const isInlineChordLick = sl.type === 'chords_only' &&
      idx > 0 && (parsedSongLines[idx - 1]!.type === 'lyric_with_chord' || parsedSongLines[idx - 1]!.type === 'lyric_plain') &&
      idx + 1 < parsedSongLines.length && (parsedSongLines[idx + 1]!.type === 'lyric_with_chord' || parsedSongLines[idx + 1]!.type === 'lyric_plain') &&
      !sl.hasGapAfter;

    if (!isInlineChordLick && !isConsecutiveChords && (sl.hasGapAfter || sl.type === 'chords_only')) {
      if (currentStanza.length > 0) {
        rawStanzas.push(currentStanza);
        currentStanza = [];
      }
      continue;
    }

    if (nextSl) {
      if (nextSl.type === 'header' || SECTION_HEADER_REGEX.test(nextSl.text.trim()) || /^\{(?:comment|c):/i.test(nextSl.text.trim())) {
        rawStanzas.push(currentStanza);
        currentStanza = [];
      }
    }
  }
  if (currentStanza.length > 0) rawStanzas.push(currentStanza);

  const cleanStanzas = rawStanzas.filter((s) => s.length > 0);

  // 2. Se una stanza contiene un ritornello o refrain attaccato (a inizio o fine),
  // la divide ricorsivamente in unità canoniche (strofa, ritornello, refrain)
  function splitSingleStanza(st: IntermediateSongLine[], sIndex: number, stanzasList: IntermediateSongLine[][]): IntermediateSongLine[][] {
    const lyricLines = st.filter((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0);
    if (lyricLines.length < 2) return [st];

    let splitAt = -1;

    // 0. Controllo presenza header di sezione incorporato (es. [Chorus], RIT:, Strofa 2:, Bridge:)
    for (let k = 1; k < st.length; k++) {
      if (SECTION_HEADER_REGEX.test(st[k]!.text.trim())) {
        splitAt = k;
        break;
      }
    }

    // 1. Controllo inizio stanza: se una riga k >= 1 corrisponde all'inizio di un'altra stanza (es. Strofa 1)
    if (splitAt === -1) {
      for (let k = 1; k < st.length; k++) {
      const lK = st[k]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!lK || lK.length < 5) continue;
      for (let o = 0; o < stanzasList.length; o++) {
        if (o === sIndex) continue;
        const oFirst = stanzasList[o]![0]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (oFirst && oFirst.length >= 5 && oFirst === lK) {
          splitAt = k;
          break;
        }
      }
      if (splitAt !== -1) break;
      }
    }

    // 2. Controllo Suffix Refrain: se gli ultimi versi si ripetono come suffisso in altre stanze (Falco: "E allora eha...")
    if (splitAt === -1 && lyricLines.length >= 4) {
      for (let suffLen = Math.min(4, st.length - 2); suffLen >= 2; suffLen--) {
        const k = st.length - suffLen;
        if (k < 2) continue;
        const suffSig = st.slice(k)
          .map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, ''))
          .filter((str) => str.length > 3)
          .join('|');
        if (suffSig.length < 8) continue;

        let matchCount = 0;
        for (let o = 0; o < stanzasList.length; o++) {
          if (o === sIndex) continue;
          const other = stanzasList[o]!;
          if (other.length >= suffLen) {
            const otherSuffSig = other.slice(other.length - suffLen)
              .map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, ''))
              .filter((str) => str.length > 3)
              .join('|');
            if (otherSuffSig === suffSig) {
              matchCount++;
            }
          }
        }
        if (matchCount >= 2) {
          splitAt = k;
          break;
        }
      }
    }

    // 3. Controllo Triplet match per stanze lunghe
    if (splitAt === -1 && lyricLines.length > 6) {
      for (let k = 3; k <= st.length - 3; k++) {
        const l1 = st[k]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
        const l2 = st[k + 1]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
        const l3 = st[k + 2]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!l1 || !l2 || !l3 || l1.length < 5 || l2.length < 5) continue;
        const triplet = `${l1}|${l2}|${l3}`;

        let matchesOther = false;
        for (let o = 0; o < stanzasList.length; o++) {
          if (o === sIndex) continue;
          const other = stanzasList[o]!;
          const o1 = other[0]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
          const o2 = other[1]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
          const o3 = other[2]?.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (`${o1}|${o2}|${o3}` === triplet) {
            matchesOther = true;
            break;
          }
        }
        if (matchesOther) {
          splitAt = k;
          break;
        }
      }
    }

    if (splitAt !== -1 && splitAt > 0 && splitAt < st.length) {
      const partA = splitSingleStanza(st.slice(0, splitAt), sIndex, stanzasList);
      const partB = splitSingleStanza(st.slice(splitAt), sIndex, stanzasList);
      return [...partA, ...partB];
    }
    return [st];
  }

  const splitStanzas: IntermediateSongLine[][] = [];
  for (let s = 0; s < cleanStanzas.length; s++) {
    const pieces = splitSingleStanza(cleanStanzas[s]!, s, cleanStanzas);
    splitStanzas.push(...pieces);
  }

  // 3. Unisci parti consecutive dello stesso ritornello
  const mergedStanzas: IntermediateSongLine[][] = [];
  let sIdx = 0;
  while (sIdx < splitStanzas.length) {
    const stA = splitStanzas[sIdx]!;
    if (sIdx + 1 < splitStanzas.length) {
      const stB = splitStanzas[sIdx + 1]!;
      const hasLyricsA = stA.some((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0);
      const hasLyricsB = stB.some((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0);

      if (hasLyricsA && hasLyricsB) {
        const sigA = stA.map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((s) => s.length > 3).slice(0, 2).join('|');
        const sigB = stB.map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((s) => s.length > 3).slice(0, 2).join('|');

        if (sigA && sigB) {
          let seqCount = 0;
          for (let m = 0; m < splitStanzas.length - 1; m++) {
            const mA = splitStanzas[m]!.map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((s) => s.length > 3).slice(0, 2).join('|');
            const mB = splitStanzas[m + 1]!.map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, '')).filter((s) => s.length > 3).slice(0, 2).join('|');
            if (mA === sigA && mB === sigB) {
              seqCount++;
            }
          }

          // Controlla se [...stA, ...stB] corrisponde al testo di un'altra stanza singola (es. Riptide Chorus 2)
          let matchesSingleStanza = false;
          const combinedLyrics = [...stA, ...stB]
            .map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, ''))
            .filter((s) => s.length > 3)
            .join('|');

          for (let o = 0; o < splitStanzas.length; o++) {
            if (o === sIdx || o === sIdx + 1) continue;
            const otherLyrics = splitStanzas[o]!
              .map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, ''))
              .filter((s) => s.length > 3)
              .join('|');
            if (otherLyrics && otherLyrics === combinedLyrics) {
              matchesSingleStanza = true;
              break;
            }
          }

          if (seqCount >= 2 || matchesSingleStanza) {
            mergedStanzas.push([...stA, ...stB]);
            sIdx += 2;
            continue;
          }
        }
      }
    }
    mergedStanzas.push(stA);
    sIdx++;
  }

  // 4. Identificazione della prima strofa con testo e rilevamento del ritornello
  const stanzaLyricsSignatures = mergedStanzas.map((st) => {
    return st
      .map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter((s) => s.length > 3)
      .slice(0, 4)
      .join('|');
  });

  // Trova l'indice della PRIMA stanza contenente testo del brano (Strofa 1)
  const firstLyricalStanzaIdx = mergedStanzas.findIndex((st) =>
    st.some((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0)
  );
  const firstLyricalSig = firstLyricalStanzaIdx !== -1 ? stanzaLyricsSignatures[firstLyricalStanzaIdx] : null;

  // Trova l'indice dell'ultima stanza contenente testo
  let lastLyricalStanzaIdx = -1;
  for (let i = mergedStanzas.length - 1; i >= 0; i--) {
    if (mergedStanzas[i]!.some((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0)) {
      lastLyricalStanzaIdx = i;
      break;
    }
  }

  const repCounts: Record<string, number> = {};
  for (let i = 0; i < stanzaLyricsSignatures.length; i++) {
    const sig = stanzaLyricsSignatures[i];
    // La prima strofa del brano NON deve MAI essere considerata come ritornello automatico!
    if (sig && sig.length >= 8 && sig !== firstLyricalSig) {
      const st = mergedStanzas[i]!;
      const lyricsCount = st.filter((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0).length;
      // Un ritornello automatico deve avere almeno 2 righe di testo
      if (lyricsCount >= 2) {
        repCounts[sig] = (repCounts[sig] || 0) + 1;
      }
    }
  }

  let identifiedChorusSig: string | null = null;
  let maxCount = 1;
  for (const [sig, count] of Object.entries(repCounts)) {
    if (count > maxCount) {
      maxCount = count;
      identifiedChorusSig = sig;
    }
  }

  const finalOutput: string[] = [];
  let chorusSeen = false;
  let verseCount = 0;
  let verse1Chords: string[] = [];
  const seenVerses = new Set<string>();

  // Insieme delle parole del ritornello per il calcolo di similarità (Level 1 deterministico)
  const chorusWordsSet = new Set<string>();
  if (identifiedChorusSig) {
    for (let i = 0; i < mergedStanzas.length; i++) {
      if (stanzaLyricsSignatures[i] === identifiedChorusSig) {
        const text = mergedStanzas[i]!.map((l) => l.rawLyrics).join(' ');
        for (const w of extractMeaningfulWords(text)) {
          chorusWordsSet.add(w);
        }
        break;
      }
    }
  }

  for (let idx = 0; idx < mergedStanzas.length; idx++) {
    const st = mergedStanzas[idx]!;
    const firstLine = st[0]?.text.trim() || '';
    const sig = stanzaLyricsSignatures[idx] || '';

    const isExplicitChorus = CHORUS_HEADER_REGEX.test(firstLine);
    const isRepeatedChorus = !!identifiedChorusSig && sig === identifiedChorusSig;
    const isChorus = isExplicitChorus || isRepeatedChorus;

    if (isChorus) {
      if (!chorusSeen) {
        chorusSeen = true;
        if (chorusWordsSet.size === 0) {
          const text = st.map((l) => l.rawLyrics).join(' ');
          for (const w of extractMeaningfulWords(text)) {
            chorusWordsSet.add(w);
          }
        }
        finalOutput.push('RIT:');
        for (const l of st) {
          if (CHORUS_HEADER_REGEX.test(l.text.trim())) continue;
          finalOutput.push(l.text);
        }
        finalOutput.push('');
      } else {
        // Verifica se questa ripetizione del ritornello è seguita da una variazione o coda
        let isFollowedByCoda = false;
        let nextLyricalIdx = -1;
        for (let n = idx + 1; n < mergedStanzas.length; n++) {
          const candidate = mergedStanzas[n]!;
          if (candidate.some((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0)) {
            nextLyricalIdx = n;
            break;
          }
        }

        if (nextLyricalIdx !== -1) {
          const nextStanza = mergedStanzas[nextLyricalIdx]!;
          const nextSig = stanzaLyricsSignatures[nextLyricalIdx] || '';
          const isNextIdenticalChorus = !!identifiedChorusSig && nextSig === identifiedChorusSig;

          if (!isNextIdenticalChorus) {
            const nextText = nextStanza.map((l) => l.rawLyrics).join(' ');
            const nextWords = extractMeaningfulWords(nextText);
            const firstLineNext = nextStanza[0]?.text.trim() || '';
            const isExplicitCodaHeader = CODA_HEADER_REGEX.test(firstLineNext);

            if (chorusWordsSet.size > 0 && nextWords.size > 0) {
              let commonCount = 0;
              for (const w of nextWords) {
                if (chorusWordsSet.has(w)) commonCount++;
              }
              const overlap = commonCount / nextWords.size;
              if (overlap >= 0.35 || isExplicitCodaHeader) {
                isFollowedByCoda = true;
              }
            } else if (isExplicitCodaHeader) {
              isFollowedByCoda = true;
            }
          }
        }

        if (isFollowedByCoda) {
          // Non collassare a "RIT.": emetti l'intero testo del ritornello perché funge da testa della sequenza di finale/coda!
          for (const l of st) {
            if (CHORUS_HEADER_REGEX.test(l.text.trim())) continue;
            finalOutput.push(l.text);
          }
          finalOutput.push('');
        } else {
          // Evita duplicati consecutivi di RIT.
          const prev = finalOutput.filter(Boolean);
          if (prev.length > 0 && prev[prev.length - 1] === 'RIT.') {
            continue;
          }
          finalOutput.push('RIT.');
          finalOutput.push('');
        }
      }
      continue;
    }

    // Se è un commento esplicito ChordPro
    if (/^\{(?:comment|c):\s*(.*?)\}$/i.test(firstLine)) {
      for (const l of st) {
        finalOutput.push(l.text);
      }
      finalOutput.push('');
      continue;
    }

    const hasLyrics = st.some((l) => (l.type === 'lyric_with_chord' || l.type === 'lyric_plain') && l.rawLyrics.trim().length > 0);

    // Sezione Bridge / Ponte con testo
    const isBridge = hasLyrics && BRIDGE_HEADER_REGEX.test(firstLine);
    if (isBridge) {
      finalOutput.push(`{comment: ${/ponte/i.test(firstLine) ? 'ponte' : 'bridge'}}`);
      for (const l of st) {
        if (BRIDGE_HEADER_REGEX.test(l.text.trim())) continue;
        finalOutput.push(l.text);
      }
      finalOutput.push('');
      continue;
    }

    // Sezione Coda / Finale esplicita con testo
    const isExplicitCoda = hasLyrics && CODA_HEADER_REGEX.test(firstLine);
    if (isExplicitCoda) {
      finalOutput.push(`{comment: ${/finale/i.test(firstLine) ? 'finale' : 'coda'}}`);
      for (const l of st) {
        if (CODA_HEADER_REGEX.test(l.text.trim())) continue;
        finalOutput.push(l.text);
      }
      finalOutput.push('');
      continue;
    }

    // Sezione strumentale (Intro, Strum, Stacco, Outro o soli accordi)
    if (!hasLyrics || INSTRUMENTAL_HEADER_REGEX.test(firstLine)) {
      let defaultPrefix = 'strum:';
      if (firstLyricalStanzaIdx === -1 || idx < firstLyricalStanzaIdx) {
        defaultPrefix = 'intro:';
      } else if (lastLyricalStanzaIdx !== -1 && idx > lastLyricalStanzaIdx) {
        defaultPrefix = 'outro:';
      }

      if (/intro/i.test(firstLine)) defaultPrefix = 'intro:';
      else if (/strum/i.test(firstLine)) defaultPrefix = 'strum:';
      else if (/stacco/i.test(firstLine)) defaultPrefix = 'stacco:';
      else if (/outro/i.test(firstLine)) defaultPrefix = 'outro:';
      else if (/coda/i.test(firstLine)) defaultPrefix = 'coda:';
      else if (/finale/i.test(firstLine)) defaultPrefix = 'finale:';

      // "I giri di accordi strumentali vanno indicati però come detto sempre come comment, ogni riga un comment"
      for (const l of st) {
        if (INSTRUMENTAL_HEADER_REGEX.test(l.text.trim())) continue;
        if (/^\{(?:comment|c):/i.test(l.text.trim())) {
          finalOutput.push(l.text.trim());
          continue;
        }

        const chords: string[] = [];
        const matches = Array.from(l.text.matchAll(/\[([^\]]+)\]/g));
        for (const m of matches) {
          if (m[1]) {
            const norm = normalizeChordName(m[1].trim());
            if (isChordToken(norm)) chords.push(norm);
          }
        }
        if (matches.length === 0 && l.type === 'chords_only') {
          const parts = l.text.split(/\s+/).filter(Boolean);
          for (const p of parts) {
            const norm = normalizeChordName(p);
            if (isChordToken(norm)) chords.push(norm);
          }
        }

        if (chords.length > 0) {
          const commentText = `{comment: ${defaultPrefix} ${chords.join(' ')}}`;
          // Evita commenti identici consecutivi (es. intro duplicata)
          const lastOutput = finalOutput.filter(Boolean);
          if (lastOutput.length > 0 && lastOutput[lastOutput.length - 1] === commentText) {
            continue;
          }
          finalOutput.push(commentText);
        }
      }
      finalOutput.push('');
      continue;
    }

    // Strofa con testo (Verse)
    // Evita duplicati identici esatti dell'INTERA strofa già emessi (strofa ripetuta verbatim)
    const fullVerseSig = st
      .filter((l) => !SECTION_HEADER_REGEX.test(l.text.trim()))
      .map((l) => l.rawLyrics.toLowerCase().replace(/[^a-z0-9]/g, ''))
      .filter(Boolean)
      .join('|');
    if (fullVerseSig && seenVerses.has(fullVerseSig)) {
      continue;
    }
    if (fullVerseSig) seenVerses.add(fullVerseSig);

    verseCount++;
    const thisVerseChords = extractChordsFromStanza(st);

    if (verseCount === 1) {
      // Strofa 1: CON ACCORDI
      verse1Chords = thisVerseChords;
      for (const l of st) {
        if (VERSE_HEADER_REGEX.test(l.text.trim())) continue;
        finalOutput.push(l.text);
      }
      finalOutput.push('');
    } else {
      // Strofe successive:
      // "se una strofa cambia il giro di accordi vanno scritti quelli differenti, per tutta la strofa"
      let isDifferentProgression = false;

      // Se la strofa è una variazione del ritornello o una coda, mantiene sempre tutti gli accordi
      const stanzaText = st.map((l) => l.rawLyrics).join(' ');
      const stanzaWords = extractMeaningfulWords(stanzaText);
      let isChorusVariationOrCoda = false;
      if (chorusWordsSet.size > 0 && stanzaWords.size > 0) {
        let common = 0;
        for (const w of stanzaWords) {
          if (chorusWordsSet.has(w)) common++;
        }
        if (common / stanzaWords.size >= 0.35) {
          isChorusVariationOrCoda = true;
        }
      }

      if (isChorusVariationOrCoda) {
        isDifferentProgression = true;
      } else if (thisVerseChords.length > 0 && verse1Chords.length > 0) {
        if (thisVerseChords[0] !== verse1Chords[0]) {
          // Modulazione o tonalità diversa (es. Re dei re da MIm a FAm)
          isDifferentProgression = true;
        } else {
          let matchCount = 0;
          const minLen = Math.min(verse1Chords.length, thisVerseChords.length);
          for (let c = 0; c < minLen; c++) {
            if (verse1Chords[c] === thisVerseChords[c]) matchCount++;
          }
          const similarity = minLen > 0 ? matchCount / minLen : 0;
          if (similarity < 0.65) {
            isDifferentProgression = true;
          }
        }
      }

      if (isDifferentProgression) {
        // Mantiene TUTTI gli accordi differenti
        for (const l of st) {
          if (VERSE_HEADER_REGEX.test(l.text.trim())) continue;
          finalOutput.push(l.text);
        }
        finalOutput.push('');
      } else {
        // Stesso giro di accordi della Strofa 1: SOLO TESTO SENZA ACCORDI (compattazione scout)
        for (const l of st) {
          if (VERSE_HEADER_REGEX.test(l.text.trim())) continue;
          const plain = l.rawLyrics || l.text.replace(/\[[^\]]+\]/g, '').trim();
          if (plain) {
            finalOutput.push(plain);
          }
        }
        finalOutput.push('');
      }
    }
  }

  return finalOutput.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Compattatore universale per qualsiasi testo ChordPro (Word, Incolla, Scrittura libera)
 * per garantire sempre la conformità allo standard del Canzoniere Scout.
 */
export function compactChordProText(chordProText: string): string {
  const lines = chordProText.split(/\r?\n/);
  const intermediateLines: IntermediateSongLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const hasChords = /\[[^\]]+\]/.test(trimmed);
    const rawLyrics = trimmed.replace(/\[[^\]]+\]/g, '').trim();
    const isHdr = SECTION_HEADER_REGEX.test(trimmed) || /^\{(?:comment|c):/i.test(trimmed);

    let type: IntermediateSongLine['type'] = 'lyric_plain';
    if (isHdr) {
      type = 'header';
    } else if (hasChords && !rawLyrics) {
      type = 'chords_only';
    } else if (hasChords) {
      type = 'lyric_with_chord';
    }

    const hasGapAfter = (i + 1 < lines.length && !lines[i + 1]!.trim());

    intermediateLines.push({
      text: trimmed,
      rawLyrics: isHdr ? '' : rawLyrics,
      type,
      hasGapAfter,
    });
  }

  return compactScoutSong(intermediateLines);
}



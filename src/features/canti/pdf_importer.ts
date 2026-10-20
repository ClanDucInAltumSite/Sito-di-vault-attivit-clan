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

// Regex per il riconoscimento dei token di accordi musicali
export const CHORD_TOKEN_REGEX = /^[(\[]?(?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)(?:[#b])?(?:m|min|maj7|maj|7|sus4|sus2|add9|dim|-|\+)?(?:[\/](?:[A-G]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)(?:[#b])?)?(?:_\||_|\|)?[)\].,]?$/i;

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
      const root = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
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

  const tokens = words
    .map((w) => w.text.trim().replace(/\u200b/g, '').replace(/[.,]$/, ''))
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return { isChord: false, isAmbiguous: false };

  // Tutti i token devono essere accordi
  const allAreChords = tokens.every((t) => isChordToken(t));
  if (!allAreChords) return { isChord: false, isAmbiguous: false };

  const hasBold = words.some((w) => w.isBold);
  const hasUppercase = tokens.some((t) => t.length >= 2 && t === t.toUpperCase());
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
        if (!str.trim() && str.length === 0) continue;

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
    // Fascia verticale vuota lungo almeno il 70% delle righe nella zona centrale (35%-65% della larghezza pagina)
    const pageWidth = viewport.width;
    const centerStart = pageWidth * 0.35;
    const centerEnd = pageWidth * 0.65;

    // Raccogli le linee preliminari per analizzare la fascia centrale
    const bodyItems = items.filter((it) => it.fontSize <= 15.0); // Escludi titoli grandi
    let isTwoColumns = false;
    let gutterMidX = pageWidth / 2;

    if (bodyItems.length >= 10) {
      // Cerca una colonna libera
      const STEP = 5;
      for (let testX = centerStart; testX <= centerEnd; testX += STEP) {
        const gutterLeft = testX - 8;
        const gutterRight = testX + 8;
        const itemsCrossing = bodyItems.filter((it) => it.x0 < gutterRight && it.x1 > gutterLeft);
        if (itemsCrossing.length === 0) {
          isTwoColumns = true;
          gutterMidX = testX;
          detectedColumnsAcrossPages = true;
          break;
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
        const text = sortedItems.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim();
        const isBold = sortedItems.some((i) => i.isBold);
        const isItalic = sortedItems.some((i) => i.isItalic);
        return {
          y: l.y,
          fontSize: l.fontSize,
          items: sortedItems,
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

  if (titleCandidate && maxFontSize >= 14.0) {
    extractedTitle = titleCandidate;

    // Sottotitolo o Autore: riga successiva in corsivo o tra parentesi
    if (titleLineIdx + 1 < firstPageLines.length) {
      const nextLine = firstPageLines[titleLineIdx + 1]!;
      if (nextLine.text.startsWith('(') && nextLine.text.endsWith(')')) {
        extractedSubtitle = nextLine.text;
        if (titleLineIdx + 2 < firstPageLines.length) {
          const authorLine = firstPageLines[titleLineIdx + 2]!;
          if (authorLine.isItalic && !authorLine.text.toLowerCase().includes('tempo:')) {
            extractedAuthor = authorLine.text;
          }
        }
      } else if (nextLine.isItalic && !nextLine.text.toLowerCase().includes('tempo:')) {
        extractedAuthor = nextLine.text;
      }
    }
  }

  // Rileva intestazioni e piè di pagina ripetuti su documenti a più pagine (11C.6)
  const repeatedHeaderFooterTexts = new Set<string>();
  if (numPages >= 2) {
    const pageHeaderMap: Map<number, Set<string>> = new Map();
    for (const line of allPageLines) {
      if (line.y >= 750 || line.y <= 80) {
        if (!pageHeaderMap.has(line.pageNum)) {
          pageHeaderMap.set(line.pageNum, new Set());
        }
        pageHeaderMap.get(line.pageNum)!.add(line.text.trim().toLowerCase());
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

    // Escludi riga se corrisponde al titolo o sottotitolo o autore già estratto
    if (extractedTitle && trimmed.toUpperCase() === extractedTitle.toUpperCase()) {
      continue;
    }
    if (extractedSubtitle && trimmed === extractedSubtitle) {
      continue;
    }
    if (extractedAuthor && trimmed.toLowerCase() === extractedAuthor.toLowerCase()) {
      continue;
    }

    // Controllo intestazioni e piè di pagina ripetuti (11C.6)
    if (repeatedHeaderFooterTexts.has(trimmed.toLowerCase())) {
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
    // Una riga di accordi non è mai rumore
    const chordCheck = isChordLine(line.items.map((it) => ({ text: it.str, isBold: it.isBold })));
    if (!chordCheck.isChord) {
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
    }

    cleanedLines.push(line);
  }

  // 4. ASSEMBLAGGIO CORPO CANTO, ACCORDI E RITORNELLI (11C.3, 11C.4, 11C.5, 11C.8)
  const outputChordProLines: string[] = [];
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

        if (!nextChordAnalysis.isChord && isRightAbove) {
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

          // Se dopo la riga c'è un salto verticale > 1.3 volte il passo righe, aggiungi riga vuota
          if (currIdx < cleanedLines.length) {
            const afterNextDist = Math.abs(nextLine.y - cleanedLines[currIdx]!.y);
            if (afterNextDist > lineStep * 1.3) {
              outputChordProLines.push('');
            }
          }
          continue;
        }
      }

      // Riga di soli accordi senza testo subito sotto
      const pureChords = currentLine.items
        .filter((it) => {
          const raw = it.str.trim();
          return raw.length > 0 && isChordToken(raw);
        })
        .map((it) => `[${normalizeChordName(it.str)}]`)
        .join(' ');
      if (pureChords.trim().length > 0) {
        outputChordProLines.push(pureChords);
      }
      currIdx += 1;
    } else {
      // Riga di puro testo
      outputChordProLines.push(currentText);
      currIdx += 1;
    }

    // Controllo salto verticale tra blocchi per riga normale
    if (currIdx < cleanedLines.length) {
      const gap = Math.abs(currentLine.y - cleanedLines[currIdx]!.y);
      if (gap > lineStep * 1.3) {
        outputChordProLines.push('');
      }
    }
  }

  const finalChordPro = outputChordProLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

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

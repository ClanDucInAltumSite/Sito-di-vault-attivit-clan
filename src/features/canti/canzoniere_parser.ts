/**
 * ==============================================================================
 * CANZONIERE PARSER & CHORD RECOGNITION PIPELINE (FASE 9)
 * ==============================================================================
 * Pipeline unificata per l'inserimento canti:
 * 1. Caricamento Word (.docx) con jszip (import dinamico) e tabelle a 2 colonne
 * 2. Incolla o scrivi (incolla intelligente, normalizzazione caratteri e revisione)
 *
 * Allineamento proporzionale Roboto, notazioni accordi estese (es. La- per Lam, slash chords),
 * protezione rigorosa contro trappole parole italiane e raccolta diagnostica di avvisi.
 */

import { cleanPastedText, CleanTextResult, CleanerChange, reconstructWithActiveChanges } from './canzoniere_cleaner';
export { cleanPastedText, reconstructWithActiveChanges };
export type { CleanTextResult, CleanerChange };

export interface ParsedCantoResult {
  titolo: string;
  autore: string | null;
  misura: string | null; // es. "4/4"
  bpm_testo: string | null; // es. "circa 92-94"
  tempo_bpm: number | null; // es. 92
  ritmo: string | null; // es. "Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)"
  capotasto: number | null;
  tonalita: string | null;
  testo_chordpro: string;
  warnings: string[];
  cleanResult?: CleanTextResult;
  stats: {
    totalLines: number;
    chordsCount: number;
    blocksCount: number;
  };
}

export interface ParseOptions {
  isMonospace?: boolean;
  preserveColumnBreak?: boolean;
}

// ==============================================================================
// REGEX E RICONOSCIMENTO ACCORDI (Italiani e Anglo-Sassoni con Notazione Minore '-')
// ==============================================================================
export {
  ITALIAN_ROOTS,
  ANGLO_ROOTS,
  ALL_ROOTS,
  ITALIAN_ROOT_MAP,
  ANGLO_ROOT_MAP,
  SINGLE_CHORD_REGEX,
  normalizeSingleChordPart,
  normalizeChord,
  isChordToken,
  isChordLine,
} from './chord_detection';
export type { ChordLineOptions } from './chord_detection';

import {
  normalizeChord,
  isChordLine,
} from './chord_detection';

const CHORDPRO_TOKEN_REGEX = /\[([^\]]+)\]/g;

// ==============================================================================
// METRICHE TIPOGRAFICHE ROBOTO PER ALLINEAMENTO PROPORZIONALE
// ==============================================================================
// Mappa larghezze relative dei caratteri per Roboto Regular (400) e Bold (700)
// normalizzate per font-size 1.0 (calibrate sul rendering freetype/browser)
const ROBOTO_REGULAR_CHAR_WIDTHS: Record<string, number> = {
  ' ': 0.25,
  'i': 0.23, 'l': 0.23, 'j': 0.23, 'I': 0.28, '!': 0.28, '.': 0.25, ',': 0.25, ':': 0.25, ';': 0.25,
  'f': 0.32, 't': 0.32, 'r': 0.34, '1': 0.50, "'": 0.22, '"': 0.38, '-': 0.33,
  'a': 0.52, 'b': 0.55, 'c': 0.50, 'd': 0.55, 'e': 0.52, 'g': 0.55, 'h': 0.55, 'k': 0.51, 'n': 0.55,
  'o': 0.55, 'p': 0.55, 'q': 0.55, 's': 0.47, 'u': 0.55, 'v': 0.50, 'x': 0.50, 'y': 0.50, 'z': 0.48,
  'A': 0.64, 'B': 0.60, 'C': 0.65, 'D': 0.65, 'E': 0.58, 'F': 0.55, 'G': 0.69, 'H': 0.67, 'J': 0.44,
  'K': 0.62, 'L': 0.53, 'M': 0.83, 'N': 0.68, 'O': 0.70, 'P': 0.59, 'Q': 0.70, 'R': 0.62, 'S': 0.59,
  'T': 0.57, 'U': 0.67, 'V': 0.63, 'W': 0.92, 'X': 0.62, 'Y': 0.58, 'Z': 0.57,
};

function measureStringWidth(text: string, isBold = false): number {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `${isBold ? 'bold' : 'normal'} 11pt 'Roboto', sans-serif`;
        return ctx.measureText(text).width;
      }
    } catch {
      // Fallback a modello analitico
    }
  }

  // Calcolo analitico calibrato su 11pt (1pt = 1.333px)
  const basePx = 11 * 1.3333;
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (!char) continue;
    const rel = ROBOTO_REGULAR_CHAR_WIDTHS[char] ?? 0.52;
    width += rel * basePx * (isBold ? 1.08 : 1.0);
  }
  return width;
}

/**
 * Misura accuratamente il prefisso di una riga accordi:
 * i token di accordo possono essere in grassetto (DOCX), gli spazi/tabulazioni sono sempre a spaziatura normale.
 */
function measureChordLinePrefix(prefix: string, isChordBold = false): number {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let total = 0;
        const parts = prefix.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            ctx.font = "normal 11pt 'Roboto', sans-serif";
            total += ctx.measureText(part).width;
          } else {
            ctx.font = `${isChordBold ? 'bold' : 'normal'} 11pt 'Roboto', sans-serif`;
            total += ctx.measureText(part).width;
          }
        }
        if (total > 0) return total;
      }
    } catch {
      // Fallback analitico
    }
  }

  let total = 0;
  const parts = prefix.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    const isWhitespace = /^\s+$/.test(part);
    total += measureStringWidth(part, isWhitespace ? false : isChordBold);
  }
  return total;
}

/**
 * Individua le posizioni degli accordi su una riga di testo e li inietta in ChordPro.
 * Conserva la posizione reale sulla sillaba (closest character boundary), senza forzare
 * lo spostamento arbitrario a inizio parola.
 */
export function alignChordsOverLyrics(
  chordLine: string,
  lyricsLine: string,
  isMonospace = false,
  _warnings?: string[],
  isChordBold = false
): string {
  if (!lyricsLine.trim()) {
    // Riga di soli accordi senza testo (es. intro)
    const tokens = chordLine.trim().split(/\s+/).filter(Boolean);
    return tokens.map((t) => `[${normalizeChord(t)}]`).join(' ');
  }

  // Estrai ogni accordo con la sua posizione orizzontale
  interface ChordToken {
    chord: string;
    colIndex: number;
    pixelOffset: number;
  }

  const chords: ChordToken[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(chordLine)) !== null) {
    const chordText = match[0];
    const colIndex = match.index;
    const prefix = chordLine.slice(0, colIndex);
    const pixelOffset = measureChordLinePrefix(prefix, isChordBold);
    chords.push({ chord: chordText, colIndex, pixelOffset });
  }

  if (chords.length === 0) return lyricsLine;

  // Rileva spaziatura persa (accordi separati solo da 1 spazio mentre il testo è sensibilmente più lungo)
  if (_warnings && !isMonospace && chords.length >= 2) {
    const hasWideSpacing = /\s{2,}|\t/.test(chordLine);
    if (!hasWideSpacing && lyricsLine.trim().length > chordLine.trim().length * 1.5) {
      if (!_warnings.some((w) => w.includes("accordi senza posizione: usa l'editor accordi"))) {
        _warnings.push("accordi senza posizione: usa l'editor accordi");
      }
    }
  }

  if (isMonospace) {
    // Modalità a spaziatura fissa: allineamento 1:1 per colonna carattere
    let result = '';
    let lastLyricIdx = 0;

    for (let i = 0; i < chords.length; i++) {
      const ch = chords[i];
      if (!ch) continue;
      const targetIdx = Math.min(ch.colIndex, lyricsLine.length);
      result += lyricsLine.slice(lastLyricIdx, targetIdx);
      result += `[${normalizeChord(ch.chord)}]`;
      lastLyricIdx = targetIdx;
    }
    result += lyricsLine.slice(lastLyricIdx);
    return result;
  }

  // Modalità proporzionale Roboto: calcolo distanza visiva in pixel
  // Calcola il pixel offset cumulativo di ciascun carattere nella riga di testo
  const charOffsets: number[] = [0];
  let accWidth = 0;
  for (let i = 0; i < lyricsLine.length; i++) {
    accWidth = measureStringWidth(lyricsLine.slice(0, i + 1), false);
    charOffsets.push(accWidth);
  }

  // Assegna ogni accordo al carattere più vicino senza forzare lo spostamento a inizio parola
  const chordAssignments: { charIdx: number; chord: string }[] = [];

  for (const ch of chords) {
    let bestCharIdx = 0;
    let minDiff = Infinity;

    for (let c = 0; c < charOffsets.length; c++) {
      const offset = charOffsets[c];
      if (offset === undefined) continue;
      const diff = Math.abs(offset - ch.pixelOffset);
      if (diff < minDiff) {
        minDiff = diff;
        bestCharIdx = c;
      }
    }

    bestCharIdx = Math.min(bestCharIdx, lyricsLine.length);
    chordAssignments.push({ charIdx: bestCharIdx, chord: ch.chord });
  }

  // Se la riga di testo è vuota (solo accordi / intro / stacco), restituisci gli accordi spaziati
  if (!lyricsLine.trim()) {
    return chords.map((c) => `[${normalizeChord(c.chord)}]`).join('    ');
  }

  // Ordina le assegnazioni per indice carattere
  chordAssignments.sort((a, b) => a.charIdx - b.charIdx);

  // Inietta gli accordi nel testo
  let result = '';
  let lastChar = 0;

  for (let i = 0; i < chordAssignments.length; i++) {
    const item = chordAssignments[i];
    if (!item) continue;
    // Se due accordi consecutivi cadono sullo stesso identico punto, separali con uno spazio
    if (i > 0 && item.charIdx === lastChar) {
      result += ' ';
    }
    result += lyricsLine.slice(lastChar, item.charIdx);
    result += `[${normalizeChord(item.chord)}]`;
    lastChar = item.charIdx;
  }
  result += lyricsLine.slice(lastChar);

  return result;
}

// ==============================================================================
// PARSER 1: CARICA WORD (.docx)
// ==============================================================================

/**
 * Estrae il testo da un nodo XML Word (w:p, w:r, ecc.) gestendo correttamente
 * i tabulatori (<w:tab/> -> '    '), ritorni a capo (<w:br/> -> '\n') e trattini.
 * Previene che accordi o parole separate da tab vengano attaccati insieme (es. SOLLAm -> SOL    LAm).
 */
export function extractWordNodeText(node: Node): string {
  let result = '';
  const walk = (n: Node) => {
    if (n.nodeType === 3) {
      result += n.nodeValue || '';
    } else if (n.nodeType === 1) {
      const el = n as Element;
      const tag = (el.localName || el.nodeName).replace(/^.*:/, '').toLowerCase();
      if (tag === 't') {
        result += el.textContent || '';
      } else if (tag === 'tab') {
        result += '    '; // Word tab = 4 spazi
      } else if (tag === 'br' || tag === 'cr') {
        result += '\n';
      } else if (tag === 'nobreakhyphen') {
        result += '-';
      } else {
        for (let i = 0; i < el.childNodes.length; i++) {
          const child = el.childNodes[i];
          if (child) walk(child);
        }
      }
    }
  };
  walk(node);
  return result;
}

/**
 * Legge un documento Word .docx, estrae metadati, intestazione e corpo con tabella a 2 colonne.
 */
export async function parseDocx(
  fileOrBuffer: File | ArrayBuffer | Uint8Array,
  options: ParseOptions = {}
): Promise<ParsedCantoResult> {
  const warnings: string[] = [];
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default || JSZipModule;

  let buffer: ArrayBuffer | Uint8Array;
  if (typeof File !== 'undefined' && fileOrBuffer instanceof File) {
    buffer = await fileOrBuffer.arrayBuffer();
  } else {
    buffer = fileOrBuffer as ArrayBuffer | Uint8Array;
  }

  const zip = await JSZip.loadAsync(buffer);
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) {
    throw new Error('Il file caricato non sembra un documento Word valido (word/document.xml mancante).');
  }

  const docXml = await docXmlFile.async('text');

  // Parser DOM XML nativo
  let doc: Document;
  if (typeof DOMParser !== 'undefined') {
    doc = new DOMParser().parseFromString(docXml, 'application/xml');
  } else {
    // In ambiente test senza DOMParser
    throw new Error('DOMParser non disponibile nel runtime.');
  }

  let titolo = '';
  let autore: string | null = null;
  let bpm_testo: string | null = null;
  let ritmo: string | null = null;
  let capotasto: number | null = null;
  let misura: string | null = null;
  let tonalita: string | null = null;

  // 1. Estrazione metadati da paragrafi dell'intestazione (prima della tabella)
  const paragraphs = Array.from(doc.getElementsByTagName('w:p'));
  const headerParagraphs: Element[] = [];
  let tableFound = false;

  for (const p of paragraphs) {
    // Verifica se questo paragrafo è dentro una tabella w:tbl
    let parent: Node | null = p.parentNode;
    let isInsideTable = false;
    while (parent) {
      if (parent.nodeName === 'w:tbl' || parent.nodeName === 'w:tc') {
        isInsideTable = true;
        break;
      }
      parent = parent.parentNode;
    }

    if (!isInsideTable && !tableFound) {
      headerParagraphs.push(p);
    } else if (isInsideTable) {
      tableFound = true;
    }
  }

  // Estrai titolo
  for (const p of headerParagraphs) {
    const pStyle = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val');
    const text = extractWordNodeText(p).trim();

    if (!text) continue;

    if (pStyle === 'Title' || pStyle === 'Heading1' || (!titolo && text === text.toUpperCase() && text.length > 2)) {
      if (!titolo) {
        titolo = text;
        continue;
      }
    }

    // Autore o evento (italic o subtitle)
    const isItalic = p.getElementsByTagName('w:i').length > 0 || pStyle === 'Subtitle';
    if (isItalic && !autore && !text.toLowerCase().startsWith('tempo:')) {
      autore = text;
      continue;
    }

    // Riga parametri: "Tempo: 4/4 ; circa 92-94 BPM. Ritmo pennata: ..."
    if (/tempo:/i.test(text) || /ritmo/i.test(text) || /capotasto:/i.test(text) || /tonalit/i.test(text)) {
      // Estrai Misura (es. 4/4, 3/4, 6/8)
      const misuraMatch = text.match(/tempo:\s*(\d+\/\d+)/i);
      if (misuraMatch && misuraMatch[1]) misura = misuraMatch[1];

      // Estrai BPM testuale esatto (es. "circa 92-94" o "100")
      const bpmMatch = text.match(/;\s*([^;]+?)\s*BPM/i) || text.match(/BPM[:\s]*([^,\t;]+)/i);
      if (bpmMatch && bpmMatch[1]) {
        bpm_testo = bpmMatch[1].trim();
      }

      // Estrai Ritmo pennata con frecce
      const ritmoMatch = text.match(/ritmo(?:\s+pennata)?:\s*([^\t]+)/i);
      if (ritmoMatch && ritmoMatch[1]) {
        ritmo = ritmoMatch[1].trim();
      }

      // Estrai Capotasto
      const capoMatch = text.match(/capotasto:\s*(\d+)/i);
      if (capoMatch && capoMatch[1]) {
        capotasto = parseInt(capoMatch[1], 10);
      }

      // Estrai eventuale tonalità esplicita (es. "Tonalità: Do" o "Key: C")
      const tonMatch = text.match(/tonalit[àa]:\s*([^\t,;.]+)/i) || text.match(/key:\s*([^\t,;.]+)/i);
      if (tonMatch && tonMatch[1]) {
        tonalita = tonMatch[1].trim();
      }
    }
  }

  // 2. Estrazione corpo: colonne della tabella o paragrafi normali
  const tables = Array.from(doc.getElementsByTagName('w:tbl'));
  let bodyLinesLeft: string[] = [];
  let bodyLinesRight: string[] = [];

  if (tables.length > 0) {
    const table = tables[0];
    if (table) {
      const rows = Array.from(table.getElementsByTagName('w:tr'));

      // Estrai per ogni riga le celle
      for (const r of rows) {
        const cells = Array.from(r.getElementsByTagName('w:tc'));
        const cell0 = cells[0];
        if (cell0) {
          const leftColParagraphs = Array.from(cell0.getElementsByTagName('w:p'));
          extractParagraphsIntoLines(leftColParagraphs, bodyLinesLeft, options.isMonospace, warnings);
        }
        const cell1 = cells[1];
        if (cell1) {
          const rightColParagraphs = Array.from(cell1.getElementsByTagName('w:p'));
          extractParagraphsIntoLines(rightColParagraphs, bodyLinesRight, options.isMonospace, warnings);
        }
      }
    }
  } else {
    // Nessuna tabella: testo a flusso continuo
    const remainingParagraphs = paragraphs.slice(headerParagraphs.length);
    extractParagraphsIntoLines(remainingParagraphs, bodyLinesLeft, options.isMonospace, warnings);
  }

  // Ricomponi il corpo in ChordPro unendo colonna sinistra e destra con {nuova_colonna}
  let finalBody = '';
  const preserveCol = options.preserveColumnBreak !== false;

  if (bodyLinesRight.length > 0) {
    finalBody = bodyLinesLeft.join('\n');
    if (preserveCol) {
      finalBody += '\n\n{nuova_colonna}\n\n';
    } else {
      finalBody += '\n\n';
    }
    finalBody += bodyLinesRight.join('\n');
  } else {
    finalBody = bodyLinesLeft.join('\n');
  }

  // Estrai primo BPM numerico se disponibile
  let tempo_bpm: number | null = null;
  if (bpm_testo) {
    const n = bpm_testo.match(/\d+/);
    if (n && n[0]) {
      const parsed = parseInt(n[0], 10);
      if (parsed >= 30 && parsed <= 300) tempo_bpm = parsed;
    }
  }

  // Statistiche e conteggio accordi
  const chordsMatches = finalBody.match(CHORDPRO_TOKEN_REGEX) || [];
  const totalLines = finalBody.split('\n').length;
  const blocksCount = finalBody.split(/\n\s*\n/).filter((b) => b.trim()).length;

  return {
    titolo: titolo || 'Canto Senza Titolo',
    autore,
    misura,
    bpm_testo,
    tempo_bpm,
    ritmo,
    capotasto,
    tonalita, // Non deduce la tonalità dal primo accordo
    testo_chordpro: finalBody.trim(),
    warnings,
    stats: {
      totalLines,
      chordsCount: chordsMatches.length,
      blocksCount,
    },
  };
}

/**
 * Converte una serie di paragrafi Word in righe di testo / ChordPro.
 */
function extractParagraphsIntoLines(
  paragraphs: Element[],
  outputLines: string[],
  isMonospace = false,
  warnings: string[] = []
) {
  let pendingChordLine: { text: string; isBold: boolean } | null = null;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (!p) continue;
    const runs = Array.from(p.getElementsByTagName('w:r'));

    // Rileva se il paragrafo è interamente o prevalentemente in grassetto
    let isParagraphBold = false;
    if (runs.length > 0) {
      const boldRuns = runs.filter((r) => r.getElementsByTagName('w:b').length > 0);
      isParagraphBold = boldRuns.length >= runs.length / 2;
    }

    const text = extractWordNodeText(p);

    // Riga vuota
    if (!text.trim()) {
      if (pendingChordLine) {
        outputLines.push(pendingChordLine.text.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
        pendingChordLine = null;
      }
      outputLines.push('');
      continue;
    }

    // Controlla se la riga è una riga di accordi
    const isChords = isChordLine(text, {
      isBold: isParagraphBold,
      nextLineIsText: i < paragraphs.length - 1,
      warnings,
    });

    if (isChords) {
      if (pendingChordLine) {
        // Due righe consecutive di accordi: scarica la prima
        outputLines.push(pendingChordLine.text.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
      }
      pendingChordLine = { text, isBold: isParagraphBold };
    } else {
      if (pendingChordLine) {
        // Accoppia riga accordi con riga testo sottostante (usando isBold per calibrare larghezze)
        const merged = alignChordsOverLyrics(pendingChordLine.text, text, isMonospace, warnings, pendingChordLine.isBold);
        outputLines.push(merged);
        pendingChordLine = null;
      } else {
        // Riga di solo testo (senza accordi precedenti)
        outputLines.push(text);
      }
    }
  }

  if (pendingChordLine) {
    outputLines.push(pendingChordLine.text.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
  }
}

// ==============================================================================
// PARSER 2: INCOLLA TESTO (INCOLLA INTELLIGENTE CON PULIZIA E NORMALIZZAZIONE)
// ==============================================================================
/**
 * Parsea un testo incollato (formato intestazione ChordPro, accordi sopra testo o solo testo).
 * Include normalizzazione caratteri, rimozione rumore web, conversione etichette e unione righe spezzate.
 */
export function parsePastedText(rawText: string, options: ParseOptions = {}): ParsedCantoResult {
  const warnings: string[] = [];
  const lines = rawText.split(/\r?\n/);

  let titolo = '';
  let autore: string | null = null;
  let tempoParam: string | null = null;
  let bpm_testo: string | null = null;
  let ritmo: string | null = null;
  let capotasto: number | null = null;
  let misura: string | null = null;
  let tonalita: string | null = null;

  let bodyStartIndex = 0;
  const separatorIndex = lines.findIndex((l) => /^---+\s*$/.test(l.trim()));

  // 1. Rileva se è presente intestazione formattata
  if (separatorIndex !== -1) {
    const headerLines = lines.slice(0, separatorIndex);
    bodyStartIndex = separatorIndex + 1;

    for (const hLine of headerLines) {
      const trimmed = hLine.trim();
      const mTitolo = trimmed.match(/^TITOLO:\s*(.+)$/i);
      if (mTitolo && mTitolo[1]) titolo = mTitolo[1].trim();

      const mAutore = trimmed.match(/^AUTORE:\s*(.+)$/i);
      if (mAutore && mAutore[1]) autore = mAutore[1].trim();

      const mTempo = trimmed.match(/^TEMPO:\s*(.+)$/i);
      if (mTempo && mTempo[1]) {
        tempoParam = mTempo[1].trim();
        const mMis = tempoParam.match(/\d+\/\d+/);
        if (mMis && mMis[0]) misura = mMis[0];
      }

      const mBpm = trimmed.match(/^BPM:\s*(.+)$/i);
      if (mBpm && mBpm[1]) bpm_testo = mBpm[1].trim();

      const mRitmo = trimmed.match(/^RITMO:\s*(.+)$/i);
      if (mRitmo && mRitmo[1]) ritmo = mRitmo[1].trim();

      const mCapo = trimmed.match(/^CAPOTASTO:\s*(\d+)$/i);
      if (mCapo && mCapo[1]) capotasto = parseInt(mCapo[1], 10);

      const mTon = trimmed.match(/^TONALIT[ÀA]:\s*(.+)$/i) || trimmed.match(/^KEY:\s*(.+)$/i);
      if (mTon && mTon[1]) tonalita = mTon[1].trim();
    }
  }

  // 2. Pulizia intelligente del corpo (rumore web, normalizzazione caratteri, etichette e righe spezzate)
  const rawBodyText = lines.slice(bodyStartIndex).join('\n');
  const cleanRes = cleanPastedText(rawBodyText);
  warnings.push(...cleanRes.warnings);

  const bodyLines = cleanRes.cleanedLines;
  const processedLines: string[] = [];
  let pendingChordLine: string | null = null;

  for (let i = 0; i < bodyLines.length; i++) {
    let line = bodyLines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // Riconoscimento marcatore non leggibile [?]
    if (line.includes('[?]')) {
      warnings.push(`Riga ${i + 1}: presente marcatore non leggibile "[?]" da completare.`);
    }

    // Se è vuota
    if (!trimmed) {
      if (pendingChordLine) {
        processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${normalizeChord(c)}]`).join(' '));
        pendingChordLine = null;
      }
      processedLines.push('');
      continue;
    }

    // Se la riga ha già notazione ChordPro [Do]
    if (trimmed.includes('[') && trimmed.includes(']')) {
      // Verifica parentesi quadre non chiuse
      const openCount = (line.match(/\[/g) || []).length;
      const closeCount = (line.match(/\]/g) || []).length;
      if (openCount !== closeCount) {
        warnings.push(`Riga ${i + 1}: parentesi quadre sbilanciate (${openCount} '[' vs ${closeCount} ']').`);
      }

      // Normalizza accordi inline (es. [La-] -> [Lam], [SI-] -> [Sim], [RE] -> [Re])
      line = line.replace(/\[([^\]]+)\]/g, (_, c) => `[${normalizeChord(c)}]`);

      if (pendingChordLine) {
        processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${normalizeChord(c)}]`).join(' '));
        pendingChordLine = null;
      }
      processedLines.push(line);
      continue;
    }

    // Verifica se è riga di soli accordi sopra testo
    const nextLine = bodyLines[i + 1];
    const isChords = isChordLine(line, {
      isBold: false, // Incollato perde grassetti: assume accordi se sintassi valida
      nextLineIsText: i < bodyLines.length - 1 && !!nextLine && !!nextLine.trim(),
      warnings,
    });

    if (isChords) {
      if (pendingChordLine) {
        processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${normalizeChord(c)}]`).join(' '));
      }
      pendingChordLine = line;
    } else {
      if (pendingChordLine) {
        const merged = alignChordsOverLyrics(pendingChordLine, line, options.isMonospace, warnings);
        processedLines.push(merged);
        pendingChordLine = null;
      } else {
        processedLines.push(line);
      }
    }
  }

  if (pendingChordLine) {
    processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${normalizeChord(c)}]`).join(' '));
  }

  const finalBody = processedLines.join('\n').trim();

  // Se non c'era titolo nei metadati, prova a usare la prima riga se in maiuscolo
  if (!titolo && processedLines.length > 0) {
    const firstNonEmpty = processedLines.find((l) => l.trim() && !l.includes('[') && !/^---/.test(l));
    if (firstNonEmpty && firstNonEmpty === firstNonEmpty.toUpperCase() && firstNonEmpty.length < 50) {
      titolo = firstNonEmpty.trim();
    }
  }

  // Estrai tempo_bpm numerico
  let tempo_bpm: number | null = null;
  if (bpm_testo) {
    const n = bpm_testo.match(/\d+/);
    if (n && n[0]) {
      const parsed = parseInt(n[0], 10);
      if (parsed >= 30 && parsed <= 300) tempo_bpm = parsed;
    }
  }

  const chordsMatches = finalBody.match(CHORDPRO_TOKEN_REGEX) || [];
  const totalLines = finalBody.split('\n').length;
  const blocksCount = finalBody.split(/\n\s*\n/).filter((b) => b.trim()).length;

  return {
    titolo: titolo || 'Canto Incollato',
    autore,
    misura,
    bpm_testo,
    tempo_bpm,
    ritmo,
    capotasto,
    tonalita, // Non deduce la tonalità dal primo accordo
    testo_chordpro: finalBody,
    warnings,
    cleanResult: cleanRes,
    stats: {
      totalLines,
      chordsCount: chordsMatches.length,
      blocksCount,
    },
  };
}



/**
 * ==============================================================================
 * CANZONIERE PARSER & CHORD RECOGNITION PIPELINE (FASE 9)
 * ==============================================================================
 * Pipeline unificata per i tre ingressi:
 * 1. Caricamento Word (.docx) con jszip (import dinamico) e tabelle a 2 colonne
 * 2. Incolla testo (formato intestazione ChordPro, accordi sopra testo, solo testo)
 * 3. Da foto o PDF (copia prompt fisso per AI esterna)
 *
 * Allineamento proporzionale Roboto, disambiguazione parole italiane e
 * nessuna perdita di testo in silenzio con raccolta diagnostica di avvisi.
 */

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
// REGEX E RICONOSCIMENTO ACCORDI (Italiani e Anglo-Sassoni)
// ==============================================================================
const ITALIAN_ROOTS = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI', 'Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si'];
const ANGLO_ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const ALL_ROOTS = [...ITALIAN_ROOTS, ...ANGLO_ROOTS];

const ACCIDENTALS = '[#\\u266Fb\\u266D]?';
const MODIFIERS = '(?:maj7|maj9|maj|m7b5|m7|min7|min|m|7sus4|sus4|sus2|sus|add9|add2|add4|add11|dim7|dim|aug|6|7|9|11|13|5|2|\\+)?';
const BASS = '(?:[\\/\\\\](?:[A-Ga-g]|Do|Re|Mi|Fa|Sol|La|Si|DO|RE|MI|FA|SOL|LA|SI)[#\\u266Fb\\u266D]?)?';

const SINGLE_CHORD_REGEX = new RegExp(
  `^(?:${ALL_ROOTS.join('|')})${ACCIDENTALS}${MODIFIERS}${BASS}$`
);

const CHORDPRO_TOKEN_REGEX = /\[([^\]]+)\]/g;

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
 * Una riga è "di accordi" solo se tutti i token sono accordi E:
 * (a) è scritta in maiuscolo, oppure
 * (b) contiene alterazioni o modificatori, oppure
 * (c) è in grassetto (isBold = true), oppure
 * (d) ha almeno due token ed è seguita da una riga di testo.
 * Nel dubbio NON indovinare: "la la la" non è mai una riga di accordi.
 */
export function isChordLine(
  line: string,
  options?: { isBold?: boolean; nextLineIsText?: boolean; warnings?: string[] }
): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Se contiene già parentesi quadre tipo ChordPro [Do], non è riga di soli accordi
  if (trimmed.includes('[') && trimmed.includes(']')) return false;

  // Etichette RIT. non sono accordi
  if (/^RIT[.:]?$/i.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  // Tutti i token devono essere accordi validi
  const allAreChords = tokens.every((t) => isChordToken(t));
  if (!allAreChords) return false;

  // Trappola parole italiane comuni: "la la la", "si si", "fa", "do", "re"
  const isAllSimpleItalianWordNotes = tokens.every((t) =>
    /^(?:do|re|mi|fa|sol|la|si)$/i.test(t)
  );

  // Se è "la la la" o parole minuscole ripetute senza modificatori
  if (isAllSimpleItalianWordNotes && tokens.every((t) => t === t.toLowerCase())) {
    return false;
  }

  // (a) Scritta tutta in MAIUSCOLO (es. "DO FA DO SOL" o "C G AM F")
  const isAllUpper = tokens.every((t) => t === t.toUpperCase());
  if (isAllUpper) return true;

  // (b) Accordi internazionali anglosassoni (es. C, G, Am, F, Dm, Bb, F#m)
  const isAllAngloSaxon = tokens.every((t) => /^[A-G]/.test(t) && isChordToken(t));
  if (isAllAngloSaxon) return true;

  // (c) Contiene alterazioni o modificatori (es. "Lam", "Fa#", "Sol7", "C#m", "Re/Fa#")
  const hasModifiersOrAccidentals = tokens.some((t) =>
    /[#\u266Fb\u266D79]|maj|min|sus|add|dim|aug|\/|m$/i.test(t)
  );
  if (hasModifiersOrAccidentals) return true;

  // (d) Grassetto esplicito (dal docx)
  if (options?.isBold) return true;

  // (d) Ha almeno due token diversi e la riga successiva è testo
  if (tokens.length >= 2 && options?.nextLineIsText) {
    // Es. "Do    Fa    Do    Sol" con maiuscole/minuscole standard
    const uniqueTokens = new Set(tokens.map((t) => t.toLowerCase()));
    if (uniqueTokens.size >= 2) {
      return true;
    }
  }

  // Nel dubbio: segnala riga ambigua e NON considerarla riga di accordi
  if (options?.warnings && tokens.length > 0) {
    options.warnings.push(
      `Riga ambigua interpretata come testo: "${trimmed}" (usa maiuscole o accordi tra [parentesi] per forzarla)`
    );
  }

  return false;
}

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
 * Individua le posizioni degli accordi su una riga di testo e li inietta in ChordPro.
 * Esegue lo snapping a inizio sillaba/parola se cade a metà parola.
 */
export function alignChordsOverLyrics(
  chordLine: string,
  lyricsLine: string,
  isMonospace = false,
  _warnings?: string[]
): string {
  if (!lyricsLine.trim()) {
    // Riga di soli accordi senza testo (es. intro)
    const tokens = chordLine.trim().split(/\s+/).filter(Boolean);
    return tokens.map((t) => `[${t}]`).join(' ');
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
    const pixelOffset = measureStringWidth(prefix, true);
    chords.push({ chord: chordText, colIndex, pixelOffset });
  }

  if (chords.length === 0) return lyricsLine;

  if (isMonospace) {
    // Modalità a spaziatura fissa: allineamento 1:1 per colonna carattere
    let result = '';
    let lastLyricIdx = 0;

    for (let i = 0; i < chords.length; i++) {
      const ch = chords[i];
      if (!ch) continue;
      const targetIdx = Math.min(ch.colIndex, lyricsLine.length);
      result += lyricsLine.slice(lastLyricIdx, targetIdx);
      result += `[${ch.chord}]`;
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

  // Mappa sillabe / parole: individua gli indici di inizio parola
  const wordStartIndices = new Set<number>();
  let inWord = false;
  for (let i = 0; i < lyricsLine.length; i++) {
    const charAt = lyricsLine[i];
    if (!charAt) continue;
    const isLetter = /\S/.test(charAt);
    if (isLetter && !inWord) {
      wordStartIndices.add(i);
      inWord = true;
    } else if (!isLetter) {
      inWord = false;
    }
  }

  // Assegna ogni accordo al carattere più vicino
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

    // Se cade a metà di una parola, sposta all'inizio della parola
    if (bestCharIdx > 0 && bestCharIdx < lyricsLine.length) {
      const charAt = lyricsLine[bestCharIdx] || '';
      if (/\S/.test(charAt)) {
        // Cerca l'inizio della parola corrente
        let wordStart = bestCharIdx;
        while (wordStart > 0 && /\S/.test(lyricsLine[wordStart - 1] || '')) {
          wordStart--;
        }
        bestCharIdx = wordStart;
      } else if (charAt === ' ' && bestCharIdx + 1 < lyricsLine.length && /\S/.test(lyricsLine[bestCharIdx + 1] || '')) {
        // Se è sullo spazio prima della parola successiva, aggancia all'inizio della parola
        const nextWordStart = bestCharIdx + 1;
        const nextOffset = charOffsets[nextWordStart] ?? 0;
        const currOffset = charOffsets[bestCharIdx] ?? 0;
        if (Math.abs(nextOffset - ch.pixelOffset) <= Math.abs(currOffset - ch.pixelOffset) + 20) {
          bestCharIdx = nextWordStart;
        }
      }
    }

    chordAssignments.push({ charIdx: bestCharIdx, chord: ch.chord });
  }

  // Ordina le assegnazioni per indice carattere
  chordAssignments.sort((a, b) => a.charIdx - b.charIdx);

  // Inietta gli accordi nel testo
  let result = '';
  let lastChar = 0;

  for (let i = 0; i < chordAssignments.length; i++) {
    const item = chordAssignments[i];
    if (!item) continue;
    result += lyricsLine.slice(lastChar, item.charIdx);
    result += `[${item.chord}]`;
    lastChar = item.charIdx;
  }
  result += lyricsLine.slice(lastChar);

  return result;
}

// ==============================================================================
// PARSER 1: CARICA WORD (.docx)
// ==============================================================================
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
    const text = Array.from(p.getElementsByTagName('w:t'))
      .map((t) => t.textContent || '')
      .join('')
      .trim();

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
    if (/tempo:/i.test(text) || /ritmo/i.test(text) || /capotasto:/i.test(text)) {
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
    tonalita: chordsMatches.length > 0 && chordsMatches[0] ? chordsMatches[0].replace(/[[\]]/g, '') : null,
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

    const text = runs
      .map((r) => Array.from(r.getElementsByTagName('w:t')).map((t) => t.textContent || '').join(''))
      .join('');

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
        // Accoppia riga accordi con riga testo sottostante
        const merged = alignChordsOverLyrics(pendingChordLine.text, text, isMonospace, warnings);
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
// PARSER 2: INCOLLA TESTO
// ==============================================================================
/**
 * Parsea un testo incollato (formato intestazione ChordPro, accordi sopra testo o solo testo).
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
    }
  }

  // 2. Parsea il corpo riga per riga
  const bodyLines = lines.slice(bodyStartIndex);
  const processedLines: string[] = [];
  let pendingChordLine: string | null = null;

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();

    // Riconoscimento marcatore non leggibile [?]
    if (line.includes('[?]')) {
      warnings.push(`Riga ${i + 1}: presente marcatore non leggibile "[?]" da completare.`);
    }

    // Se è vuota
    if (!trimmed) {
      if (pendingChordLine) {
        processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
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

      if (pendingChordLine) {
        processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
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
        processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
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
    processedLines.push(pendingChordLine.trim().split(/\s+/).map((c) => `[${c}]`).join(' '));
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
    tonalita: chordsMatches.length > 0 && chordsMatches[0] ? chordsMatches[0].replace(/[[\]]/g, '') : null,
    testo_chordpro: finalBody,
    warnings,
    stats: {
      totalLines,
      chordsCount: chordsMatches.length,
      blocksCount,
    },
  };
}

// ==============================================================================
// PARSER 3: PROMPT FISSO PER AI ESTERNA (Sezione 6)
// ==============================================================================
export const AI_IMPORT_PROMPT = `Sto digitalizzando il canzoniere del mio gruppo scout a partire da materiale
che ho già (foto, PDF o testo incollato qui). Il tuo compito è SOLO di
formattazione: converti il materiale che ti fornisco nel formato indicato.
Non cercare, ricordare né completare testi o accordi da tua conoscenza.

REGOLE
1. Usa esclusivamente ciò che leggi nel materiale. Se una parola o un accordo
   non è leggibile, scrivi [?] al suo posto. Non inventare, non correggere
   e non completare.
2. Se non puoi trattare il materiale, dimmelo in una riga senza produrre
   testo alternativo.
3. Accordi tra parentesi quadre, subito prima della sillaba su cui cadono:
   [Do]Nel mezzo del [Sol]cammin. Notazione italiana (Do, Re, Mi, Fa, Sol,
   La, Si; m, 7, maj7, sus4, #, b).
4. Rispetta le ripetizioni: gli accordi compaiono solo dove compaiono nel
   materiale. Se una strofa è indicata come "RIT." o "RIT:" scrivi solo quella
   sigla, senza ripetere testo né accordi.
5. Struttura: blocchi separati da una riga vuota. Mantieni le righe come nel
   materiale. Non unire né spezzare righe.
6. Intestazione: copia i valori ESATTAMENTE come sono scritti (es. "circa
   92-94", "Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)"). Lascia vuoto ciò che non c'è.
7. Nessuna spiegazione musicale e nessun commento.

FORMATO DI USCITA (un unico blocco di codice):
TITOLO: ...
AUTORE: ... (autore o evento)
TEMPO: ... (es. 4/4)
BPM: ... (testo come scritto)
RITMO: ... (testo come scritto, con le frecce)
CAPOTASTO: ... (numero, vuoto se assente)
---
(corpo del canto)`;

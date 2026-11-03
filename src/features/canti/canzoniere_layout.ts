/**
 * ==============================================================================
 * MOTORE DI IMPAGINAZIONE A4 CANZONIERE ADATTIVO (1 o 2 COLONNE) (FASE 9 / 11)
 * ==============================================================================
 * Calcola l'impaginazione esatta su foglio A4 verticale (margini 12 mm, utile 186x273 mm).
 * Seleziona in modo adattivo la combinazione migliore di (colonne ∈ {1, 2}) × (font 9–28 pt)
 * per massimizzare il riempimento utile della pagina (fillRatio >= 0.90):
 * - Canzoni corte: 1 colonna a tutta larghezza (186 mm) con font grande (fino a 24pt suona / 28pt canta);
 * - Canzoni più lunghe: 2 colonne (89 mm ciascuna, gap 8 mm) con flusso sequenziale column-fill: auto;
 * - Prevenzione di parole orfane a fine riga (single-word wrap) e rispetto dei blocchi/strofe;
 * - Varianti "Chi suona" (con accordi proporzionali) e "Chi canta" (solo testo pulito).
 */

import { CANZONIERE_CONFIG, CanzoniereConfig } from './canzoniere_config';
import { Canto } from '../../lib/db';
import { joinContinuationLines } from './canzoniere_cleaner';

export interface ChordPlacement {
  chord: string;
  charIndex: number;
  offsetPx?: number;
}

export interface SongLine {
  raw: string;
  isRitLabel: boolean;
  isChordOnly: boolean;
  lyrics: string;
  chords: ChordPlacement[];
  hasChords: boolean;
  wrappedWordsCount?: number;
  hasSingleWordWrap?: boolean;
  isTooLong?: boolean;
}

export interface SongHeaderData {
  cantoId: string;
  title: string;
  author: string | null;
  params: {
    misura: string | null;
    bpm_testo: string | null;
    ritmo: string | null;
    capotasto: number | null;
  } | null;
  showDivider: boolean;
  mode: 'suona' | 'canta';
}

export interface SongBlock {
  id: string;
  type?: 'stanza' | 'header';
  isChorus?: boolean;
  cantoId?: string;
  header?: SongHeaderData;
  lines: SongLine[];
  heightMm: number;
  fontSizePt?: number;
}

export interface ColumnContent {
  blocks: SongBlock[];
  totalHeightMm: number;
  linesCount: number;
}

export type CanzoniereSectorKey = 'scout' | 'esterni' | 'chiesa' | 'altre';

export function getSectorKey(categoria?: string | null): CanzoniereSectorKey {
  if (categoria === 'scout') return 'scout';
  if (categoria === 'esterni') return 'esterni';
  if (categoria === 'chiesa') return 'chiesa';
  return 'altre';
}

export const SECTOR_LABELS: Record<CanzoniereSectorKey, string> = {
  scout: 'Canzoni scout',
  esterni: 'Canzoni esterne',
  chiesa: 'Canzoni di chiesa',
  altre: 'Altre canzoni',
};

export interface CanzonierePage {
  pageNumber: number;
  totalPages: number;
  bookPageNumber?: number;
  isFirstPage: boolean;
  columnsCount: 1 | 2;
  fillRatio: number;
  headerTitle: string;
  headerAuthor: string | null;
  headerParams: {
    misura: string | null;
    bpm_testo: string | null;
    ritmo: string | null;
    capotasto: number | null;
  } | null;
  fontSizePt: number;
  arrowSizePt: number;
  leftColumn: ColumnContent;
  rightColumn: ColumnContent;
  warnings: string[];
  sectionTitle?: string;
  isContinuousFlow?: boolean;
}

export interface LayoutSongResult {
  pages: CanzonierePage[];
  fontSizePt: number;
  columnsCount: 1 | 2;
  fillRatio: number;
  declaredPageCount: number;
  hasOverflow: boolean;
  hasTooLongLines: boolean;
  warnings: string[];
}

export interface LayoutSongOptions {
  config?: CanzoniereConfig;
  mode?: 'suona' | 'canta';
  layoutMode?: 'riempi_pagina' | 'compatta';
  targetPages?: number;
}

// ==============================================================================
// 1. DIVISIONE PAGINE ESPLICITE
// ==============================================================================

/**
 * Suddivide il testo ChordPro di un canto in pagine separate definite da {nuova_pagina} o {np}.
 */
export function splitSongIntoPages(chordproText: string): string[] {
  if (!chordproText) return [''];
  const lines = chordproText.split(/\r?\n/);
  const pages: string[] = [];
  let currentPageLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (
      trimmed === '{nuova_pagina}' ||
      trimmed === '{np}' ||
      trimmed === '{page_break}' ||
      trimmed === '{new_page}'
    ) {
      if (currentPageLines.length > 0) {
        pages.push(currentPageLines.join('\n'));
        currentPageLines = [];
      }
    } else {
      currentPageLines.push(line);
    }
  }

  if (currentPageLines.length > 0 || pages.length === 0) {
    pages.push(currentPageLines.join('\n'));
  }

  return pages;
}

// ==============================================================================
// 2. PARSING RIGHE CHORDPRO E MISURAZIONE LINEE
// ==============================================================================

/**
 * Parsea una riga ChordPro estraendo il testo nudo e gli accordi con i loro offset.
 * Calcola se la riga sfora la larghezza disponibile per colonna e se genera parole orfane a capo.
 */
export function parseChordProLine(
  line: string,
  fontSizePt: number,
  colWidthMm: number = 89.5
): SongLine {
  const trimmed = line.trim();

  // Verifica se è etichetta RIT. / RIT: (anche con moltiplicatore (x2), (x3), ecc.)
  if (/^RIT[.:]?(\s*\(x\d+\))?$/i.test(trimmed)) {
    return {
      raw: line,
      isRitLabel: true,
      isChordOnly: false,
      lyrics: trimmed.toUpperCase(),
      chords: [],
      hasChords: false,
      isTooLong: false,
      hasSingleWordWrap: false,
    };
  }

  // Rimuovi eventuali direttive inline {...} che non devono mai comparire nel testo
  const cleanLine = line.replace(/\{[^}]*\}/g, '');

  // Estrai accordi e testo ancorati a charIndex
  const chords: ChordPlacement[] = [];
  let lyrics = '';
  let i = 0;

  while (i < cleanLine.length) {
    if (cleanLine[i] === '[') {
      const closeIdx = cleanLine.indexOf(']', i);
      if (closeIdx !== -1) {
        const chord = cleanLine.slice(i + 1, closeIdx);
        const charIndex = lyrics.length;
        chords.push({ chord, charIndex });
        i = closeIdx + 1;
        continue;
      }
    }
    lyrics += cleanLine[i];
    i++;
  }

  const isChordOnly = chords.length > 0 && !lyrics.trim();

  // 1 pt = 0.352778 mm
  const ptToMm = 0.352778;
  const colWidthPt = colWidthMm / ptToMm;
  const effectiveColWidthPt = colWidthPt * 0.98; // 2% margine di sicurezza per subpixel del browser

  // Tipografia Roboto: larghezza media lettere ~ 0.46 * fontSizePt
  const charWidthPt = fontSizePt * 0.46;
  const charChordWidthPt = fontSizePt * 0.82 * 0.50;

  const words = lyrics.trim().split(/\s+/).filter(Boolean);
  const wordsCount = words.length;
  const nonSpaceChars = words.join('').length;

  let estimatedLineWidthPt = nonSpaceChars * charWidthPt;

  // In CantoLineRenderer, ogni parola (.canto-word) ha margin-right: 0.28em
  if (wordsCount > 1) {
    estimatedLineWidthPt += (wordsCount - 1) * (0.28 * fontSizePt);
  }

  // Se ci sono accordi, la sillaba (.canto-unit) si espande al massimo tra accordo e testo
  if (chords.length > 0) {
    for (let cIdx = 0; cIdx < chords.length; cIdx++) {
      const ch = chords[cIdx]!;
      const chordWidthPt = ch.chord.length * charChordWidthPt + 0.16 * fontSizePt;
      let sylLen = 0;
      let p = ch.charIndex;
      while (p < lyrics.length && lyrics[p] !== ' ') {
        if (cIdx + 1 < chords.length && chords[cIdx + 1]!.charIndex === p && p > ch.charIndex) {
          break;
        }
        sylLen++;
        p++;
      }
      const sylLyricWidthPt = sylLen * charWidthPt;
      if (chordWidthPt > sylLyricWidthPt) {
        estimatedLineWidthPt += chordWidthPt - sylLyricWidthPt;
      }
    }
  }

  const isTooLong = estimatedLineWidthPt > effectiveColWidthPt;

  // Rileva se va a capo lasciando una sola parola a fine riga (parola orfana: <= 4 caratteri)
  let hasSingleWordWrap = false;
  if (isTooLong) {
    const words = lyrics.trim().split(/\s+/);
    if (words.length > 1) {
      const lastWord = words[words.length - 1]!;
      const cleanLast = lastWord.replace(/[.,:;!?…\-()]/g, '');
      const prefixWithoutLast = words.slice(0, -1).join(' ');
      const prefixWidthPt = prefixWithoutLast.length * charWidthPt;
      if (
        prefixWidthPt <= effectiveColWidthPt &&
        estimatedLineWidthPt > effectiveColWidthPt &&
        (cleanLast.length <= 4 || prefixWithoutLast.length === 0)
      ) {
        hasSingleWordWrap = true;
      }
    }
  }

  return {
    raw: line,
    isRitLabel: false,
    isChordOnly,
    lyrics,
    chords,
    hasChords: chords.length > 0,
    isTooLong,
    hasSingleWordWrap,
  };
}

/**
 * Calcola l'altezza in millimetri di un blocco di righe a una data dimensione font.
 * Riflette fedelmente il modello DOM ad Unità Atomiche (.canto-word e .canto-unit)
 * garantendo precisione assoluta su foglio A4 con margini 12mm.
 */
export function calculateBlockHeightMm(
  lines: SongLine[],
  fontSizePt: number,
  config: CanzoniereConfig = CANZONIERE_CONFIG,
  mode: 'suona' | 'canta' = 'suona',
  colWidthMm: number = 89.5,
  packing: 'standard' | 'css_calibrated' = 'standard'
): number {
  const ptToMm = 0.352778;
  const colWidthPt = colWidthMm / ptToMm;
  const effectiveColWidthPt = colWidthPt * 0.98;

  const charLyricWidthPt = fontSizePt * 0.46;
  const charChordWidthPt = fontSizePt * 0.82 * 0.50;

  if (packing === 'standard') {
    const lineHeight = config.typography.lineHeight || 1.5;
    const lineStepMm = fontSizePt * lineHeight * ptToMm;
    const blockGapMm = lineStepMm;

    let totalMm = 0;
    for (const line of lines) {
      const words = line.lyrics.trim().split(/\s+/).filter(Boolean);
      const wordsCount = words.length;
      const nonSpaceChars = words.join('').length;

      let estWidthPt = nonSpaceChars * charLyricWidthPt;
      if (wordsCount > 1) {
        estWidthPt += (wordsCount - 1) * (0.28 * fontSizePt);
      }

      if (mode === 'suona' && line.chords && line.chords.length > 0) {
        for (let cIdx = 0; cIdx < line.chords.length; cIdx++) {
          const ch = line.chords[cIdx]!;
          const chordWidthPt = ch.chord.length * charChordWidthPt + 0.16 * fontSizePt;
          let sylLen = 0;
          let p = ch.charIndex;
          while (p < line.lyrics.length && line.lyrics[p] !== ' ') {
            if (cIdx + 1 < line.chords.length && line.chords[cIdx + 1]!.charIndex === p && p > ch.charIndex) {
              break;
            }
            sylLen++;
            p++;
          }
          const sylLyricWidthPt = sylLen * charLyricWidthPt;
          if (chordWidthPt > sylLyricWidthPt) {
            estWidthPt += chordWidthPt - sylLyricWidthPt;
          }
        }
      }

      const visualWraps =
        estWidthPt > effectiveColWidthPt
          ? Math.max(1, Math.ceil(estWidthPt / effectiveColWidthPt))
          : 1;

      if (mode === 'canta') {
        totalMm += visualWraps * lineStepMm;
      } else {
        if (line.isRitLabel) {
          totalMm += lineStepMm;
        } else if (line.hasChords && !line.isChordOnly) {
          totalMm += lineStepMm * (1 + visualWraps);
        } else {
          totalMm += lineStepMm * visualWraps;
        }
      }
    }

    totalMm += blockGapMm;
    return totalMm;
  }

  // Modalità css_calibrated: riflette fedelmente il modello DOM ad Unità Atomiche
  // (.canto-screen-line + .canto-unit + margine interblocco 8pt da print.css)
  let totalPt = 0;
  for (const line of lines) {
    const words = line.lyrics.trim().split(/\s+/).filter(Boolean);
    const wordsCount = words.length;
    const nonSpaceChars = words.join('').length;

    let estWidthPt = nonSpaceChars * charLyricWidthPt;
    if (wordsCount > 1) {
      estWidthPt += (wordsCount - 1) * (0.28 * fontSizePt);
    }

    if (mode === 'suona' && line.chords && line.chords.length > 0) {
      for (let cIdx = 0; cIdx < line.chords.length; cIdx++) {
        const ch = line.chords[cIdx]!;
        const chordWidthPt = ch.chord.length * charChordWidthPt + 0.16 * fontSizePt;
        let sylLen = 0;
        let p = ch.charIndex;
        while (p < line.lyrics.length && line.lyrics[p] !== ' ') {
          if (cIdx + 1 < line.chords.length && line.chords[cIdx + 1]!.charIndex === p && p > ch.charIndex) {
            break;
          }
          sylLen++;
          p++;
        }
        const sylLyricWidthPt = sylLen * charLyricWidthPt;
        if (chordWidthPt > sylLyricWidthPt) {
          estWidthPt += chordWidthPt - sylLyricWidthPt;
        }
      }
    }

    const visualWraps =
      estWidthPt > effectiveColWidthPt
        ? Math.max(1, Math.ceil(estWidthPt / effectiveColWidthPt))
        : 1;

    if (mode === 'canta') {
      totalPt += visualWraps * (fontSizePt * 1.25);
    } else {
      if (line.isRitLabel || !line.hasChords || line.isChordOnly) {
        totalPt += visualWraps * (fontSizePt * 1.25);
      } else {
        totalPt += visualWraps * (fontSizePt * 2.15);
      }
    }
  }

  totalPt += 8; // margin-bottom: 8pt
  return totalPt * ptToMm;
}

/**
 * Calcola l'altezza in millimetri dell'intestazione di un canto su singola colonna (89.5 mm).
 * Calibrata con precisione al pixel sul rendering reale Chromium in @media print:
 * - Divisorio superiore (se il canto inizia dopo un altro nella stessa colonna, netto ~3.5 mm)
 * - Autore 9.5pt posizionato alla sinistra del titolo 14pt sulla stessa riga (flex-start)
 * - Metadati di tempo/BPM, ritmo, capotasto
 * - Linea divisoria inferiore sottile verso le strofe
 */
export function calculateSongHeaderHeightMm(
  title: string,
  author: string | null,
  params: {
    misura: string | null;
    bpm_testo: string | null;
    ritmo: string | null;
    capotasto: number | null;
  } | null,
  mode: 'suona' | 'canta' = 'suona',
  hasTopDivider: boolean = false
): number {
  const ptToMm = 0.352778;
  let totalPt = 0;

  // 1. Divisorio superiore tra canti concatenati (hr.canzoniere-song-divider)
  // Il margine superiore (16pt) collassa con il margine inferiore del blocco precedente (8pt),
  // producendo un ingombro netto misurato in Chromium di ~10 pt (~3.5 mm).
  if (hasTopDivider) {
    totalPt += 10;
  }

  // 2. Titolo (14pt bold) e Autore (9.5pt italic) affiancati sulla stessa riga a sinistra
  // Larghezza colonna utile: ~245 pt
  const cleanTitle = (title || '').trim();
  const titleCharWidthPt = 14 * 0.52; // ~7.28 pt
  let estimatedTopWidthPt = cleanTitle.length * titleCharWidthPt;

  if (author && author.trim()) {
    const cleanAuthor = author.trim();
    const authorCharWidthPt = 9.5 * 0.48; // ~4.56 pt
    estimatedTopWidthPt += cleanAuthor.length * authorCharWidthPt + 6; // + 6pt gap
  }

  const topLines = Math.max(1, Math.ceil(estimatedTopWidthPt / 245));
  totalPt += topLines * (14 * 1.15) + 2; // + 2pt margin-bottom

  // 3. Metadati (Tempo/BPM, Ritmo, Capotasto)
  if (params) {
    if (mode === 'canta') {
      // Solo Tempo / BPM (es. "Tempo: 4/4 (105 BPM)") -> sempre 1 riga a 8.5pt
      if (params.misura || params.bpm_testo) {
        totalPt += 8.5 * 1.25 + 2;
      }
    } else {
      // "Chi suona": Tempo, Ritmo con frecce, Capotasto
      let paramsChars = 0;
      if (params.misura) paramsChars += 8 + params.misura.length;
      if (params.bpm_testo) paramsChars += 7 + params.bpm_testo.length;
      if (params.ritmo) paramsChars += 8 + params.ritmo.length;
      if (params.capotasto !== null) paramsChars += 14;

      if (paramsChars > 0) {
        const paramsLines = paramsChars > 36 ? 2 : 1;
        totalPt += paramsLines * (8.5 * 1.25) + 2;
      }
    }
  }

  // 4. Divisorio inferiore verso il testo (hr.canzoniere-header-divider): 2pt top + 5pt bottom + 0.5pt
  totalPt += 7.5;

  // 5. Margine di separazione finale del blocco header
  totalPt += 3;

  return totalPt * ptToMm;
}

/**
 * Raggruppa le righe ChordPro in blocchi (strofe separate da righe vuote o direttive).
 * Previene duplicazioni di etichette RIT (es. "RIT. RIT:").
 */
export function groupIntoBlocks(
  textChordpro: string,
  fontSizePt: number,
  config: CanzoniereConfig = CANZONIERE_CONFIG,
  colWidthMm: number = 89.5,
  mode: 'suona' | 'canta' = 'suona',
  packing: 'standard' | 'css_calibrated' = 'css_calibrated'
): {
  blocks: SongBlock[];
  explicitColumnBreak: boolean;
  explicitColumnBreakIndex: number | null;
  explicitPageBreak: boolean;
} {
  const rawLines = textChordpro.split(/\r?\n/);
  const blocks: SongBlock[] = [];
  let currentLines: SongLine[] = [];
  let blockId = 0;
  let explicitColumnBreak = false;
  let explicitColumnBreakIndex: number | null = null;
  let explicitPageBreak = false;

  let inSocDirective = false;
  let inChorus = false;

  const flushBlock = () => {
    if (currentLines.length > 0) {
      const isBlockChorus = inChorus || inSocDirective || currentLines.some((l) => l.isRitLabel);
      const heightMm = calculateBlockHeightMm(currentLines, fontSizePt, config, mode, colWidthMm, packing);
      blocks.push({
        id: `blk_${blockId++}`,
        isChorus: isBlockChorus,
        lines: [...currentLines],
        heightMm,
      });
      currentLines = [];
    }
  };

  let pendingChorusLabel: string | null = null;

  for (let i = 0; i < rawLines.length; i++) {
    const l = rawLines[i]!;
    const trimmed = l.trim();
    const lower = trimmed.toLowerCase();

    if (
      lower === '{nuova_colonna}' ||
      lower === '{column_break}' ||
      lower === '{new_column}' ||
      lower === '{nc}'
    ) {
      flushBlock();
      explicitColumnBreak = true;
      explicitColumnBreakIndex = blocks.length;
      continue;
    }

    if (
      lower === '{nuova_pagina}' ||
      lower === '{page_break}' ||
      lower === '{new_page}' ||
      lower === '{np}'
    ) {
      flushBlock();
      explicitPageBreak = true;
      continue;
    }

    if (lower === '{ritornello}' || lower === '{soc}' || lower === '{start_of_chorus}') {
      flushBlock();
      inSocDirective = true;
      inChorus = true;
      // Non iniettiamo etichette RIT fittizie che rubano spazio o creano falsi orfani
      pendingChorusLabel = null;
      continue;
    }

    if (lower === '{end_of_chorus}' || lower === '{eoc}') {
      flushBlock();
      inSocDirective = false;
      inChorus = false;
      pendingChorusLabel = null;
      continue;
    }

    // Ignora metadati ChordPro di intestazione
    if (
      lower.startsWith('{title:') ||
      lower.startsWith('{t:') ||
      lower.startsWith('{subtitle:') ||
      lower.startsWith('{st:') ||
      lower.startsWith('{artist:') ||
      lower.startsWith('{key:') ||
      lower.startsWith('{tempo:') ||
      lower.startsWith('{time:') ||
      lower.startsWith('{capo:')
    ) {
      continue;
    }

    if (lower.startsWith('{comment:') || lower.startsWith('{c:')) {
      if (mode === 'canta') {
        // In modalità canta escludiamo i commenti strumentali e modulazioni
        continue;
      }
      const match = trimmed.match(/^\{(?:comment|c):\s*(.*?)\}$/i);
      const commentText = match && match[1] ? match[1].trim() : '';
      if (commentText) {
        currentLines.push({
          raw: l,
          isRitLabel: false,
          isChordOnly: false,
          lyrics: `(${commentText})`,
          chords: [],
          hasChords: false,
          isTooLong: false,
          hasSingleWordWrap: false,
        });
      }
      continue;
    }

    // Ignora altre direttive invisibili
    if (/^\{[^}]*\}$/.test(trimmed)) {
      continue;
    }

    if (!trimmed) {
      flushBlock();
      if (!inSocDirective) {
        inChorus = false;
      }
      continue;
    }

    // Se c'è un'etichetta di ritornello pendente (solo in modalità canta)
    if (pendingChorusLabel && mode !== 'suona') {
      const isRitHeader = /^RIT[.:]?(\s*\(x\d+\))?$/i.test(trimmed);
      if (isRitHeader) {
        // La riga stessa è "RIT:" o "RIT.", usala direttamente senza duplicare
        currentLines.push({
          raw: trimmed,
          isRitLabel: true,
          isChordOnly: false,
          lyrics: trimmed.toUpperCase(),
          chords: [],
          hasChords: false,
          isTooLong: false,
          hasSingleWordWrap: false,
        });
        pendingChorusLabel = null;
        continue;
      } else {
        // La riga è già contenuto del ritornello: inserisci prima l'etichetta RIT:
        currentLines.push({
          raw: pendingChorusLabel,
          isRitLabel: true,
          isChordOnly: false,
          lyrics: pendingChorusLabel,
          chords: [],
          hasChords: false,
          isTooLong: false,
          hasSingleWordWrap: false,
        });
        pendingChorusLabel = null;
      }
    }

    // Se incontriamo un'etichetta RIT. o RIT: isolata:
    if (/^RIT[.:]?(\s*\(x\d+\))?$/i.test(trimmed)) {
      inChorus = true;
      if (mode === 'suona') {
        // In modalità suona scartiamo sempre le diciture RIT isolate
        continue;
      }
      const lastLine = currentLines[currentLines.length - 1];
      if (lastLine && (lastLine.isRitLabel || /^RIT[.:]?/i.test(lastLine.lyrics.trim()))) {
        // Se la riga precedente era già un'etichetta RIT, promuovila a (x2) se opportuno e scarta la duplicata
        if (/^RIT[.:]?$/i.test(lastLine.lyrics.trim())) {
          lastLine.lyrics = 'RIT. (x2)';
          lastLine.raw = 'RIT. (x2)';
        }
        continue;
      }
    }

    currentLines.push(parseChordProLine(l, fontSizePt, colWidthMm));
  }

  flushBlock();

  return { blocks, explicitColumnBreak, explicitColumnBreakIndex, explicitPageBreak };
}

// ==============================================================================
// 3. MOTORE DI TENTATIVO DI IMPAGINAZIONE (1 o 2 COLONNE)
// ==============================================================================

interface AttemptLayoutResult {
  pages: CanzonierePage[];
  fontSizePt: number;
  columnsCount: 1 | 2;
  fillRatio: number;
  hasOverflow: boolean;
  hasSingleWordWrap: boolean;
  hasTooLongLines: boolean;
  warnings: string[];
}

/**
 * Esegue il tentativo di impaginazione con un numero di colonne (1 o 2) e una dimensione font fissata.
 */
function attemptLayout(
  canto: Canto,
  fontSizePt: number,
  numCols: 1 | 2,
  page1MaxColHeightMm: number,
  page2PlusMaxColHeightMm: number,
  config: CanzoniereConfig,
  mode: 'suona' | 'canta' = 'suona',
  packing: 'standard' | 'css_calibrated' = 'css_calibrated'
): AttemptLayoutResult {
  const warnings: string[] = [];
  const colWidthMm =
    numCols === 1
      ? config.page.contentWidthMm // 186 mm
      : (config.page.contentWidthMm - config.columns.gapMm) / 2; // 89 mm

  const rawGroup = groupIntoBlocks(
    canto.testo_chordpro,
    fontSizePt,
    config,
    colWidthMm,
    mode,
    packing
  );

  const blocks = rawGroup.blocks.filter(
    (b) => b.lines.length > 0 && b.lines.some((l) => l.raw.trim().length > 0)
  );
  const explicitColumnBreak = rawGroup.explicitColumnBreak;
  const explicitColumnBreakIndex = rawGroup.explicitColumnBreakIndex;

  const buildHeaderParams = (isFirst: boolean) => {
    if (!isFirst) return null;
    if (!canto.misura && !canto.bpm_testo && !canto.ritmo && canto.capotasto === null) return null;
    return {
      misura: canto.misura || null,
      bpm_testo: canto.bpm_testo || null,
      ritmo: canto.ritmo || null,
      capotasto: mode === 'suona' && canto.capotasto !== null && canto.capotasto !== undefined ? canto.capotasto : null,
    };
  };

  let hasSingleWordWrap = false;
  let hasTooLongLines = false;

  for (const b of blocks) {
    for (const l of b.lines) {
      if (l.hasSingleWordWrap) hasSingleWordWrap = true;
      if (l.isTooLong) hasTooLongLines = true;
    }
  }

  const arrowSizePt =
    Math.round(
      config.typography.arrowBaseSizePt * (fontSizePt / config.typography.baseSizePt) * 10
    ) / 10;

  // CASO 0: Canto con interruzioni di pagina esplicite ({nuova_pagina} / {np})
  const pageChunks = splitSongIntoPages(canto.testo_chordpro);
  if (pageChunks.length > 1) {
    const pages: CanzonierePage[] = [];
    let anyOverflow = false;
    let sumFillRatio = 0;

    for (let pIdx = 0; pIdx < pageChunks.length; pIdx++) {
      const pageText = pageChunks[pIdx] || '';
      const isFirst = pIdx === 0;
      const maxColHeight = isFirst ? page1MaxColHeightMm : page2PlusMaxColHeightMm;
      const { blocks: pBlocks } = groupIntoBlocks(pageText, fontSizePt, config, colWidthMm, mode, packing);

      let leftCol: ColumnContent;
      let rightCol: ColumnContent;
      let pFillRatio = 0;

      if (numCols === 1) {
        const totalH = pBlocks.reduce((a, b) => a + b.heightMm, 0);
        leftCol = {
          blocks: pBlocks,
          totalHeightMm: totalH,
          linesCount: pBlocks.reduce((a, b) => a + b.lines.length, 0),
        };
        rightCol = { blocks: [], totalHeightMm: 0, linesCount: 0 };
        if (totalH > maxColHeight) anyOverflow = true;
        pFillRatio = Math.min(1.0, totalH / maxColHeight);
      } else {
        // 2 colonne bilanciate
        const packed = balanceIntoTwoColumns(pBlocks, maxColHeight);
        leftCol = packed.leftCol;
        rightCol = packed.rightCol;
        if (!packed.fits) anyOverflow = true;
        pFillRatio = Math.min(1.0, (leftCol.totalHeightMm + rightCol.totalHeightMm) / (maxColHeight * 2));
      }

      sumFillRatio += pFillRatio;

      pages.push({
        pageNumber: pIdx + 1,
        totalPages: pageChunks.length,
        isFirstPage: isFirst,
        columnsCount: numCols,
        fillRatio: pFillRatio,
        headerTitle: canto.titolo,
        headerAuthor: isFirst ? canto.autore : null,
        headerParams: buildHeaderParams(isFirst),
        fontSizePt,
        arrowSizePt,
        leftColumn: leftCol,
        rightColumn: rightCol,
        warnings: [],
      });
    }

    const avgFill = pages.length > 0 ? sumFillRatio / pages.length : 0;
    return {
      pages,
      fontSizePt,
      columnsCount: numCols,
      fillRatio: avgFill,
      hasOverflow: anyOverflow,
      hasSingleWordWrap,
      hasTooLongLines,
      warnings: anyOverflow ? ['Uno o più fogli superano la capienza verticale A4.'] : [],
    };
  }

  // CASO 1: Modalità a 1 colonna (larghezza piena 186 mm)
  if (numCols === 1) {
    const pages: CanzonierePage[] = [];
    let remainingBlocks = [...blocks];
    let pageIdx = 1;
    let anyOverflow = false;
    let sumFillRatio = 0;

    while (remainingBlocks.length > 0) {
      const isFirst = pageIdx === 1;
      const maxColH = isFirst ? page1MaxColHeightMm : page2PlusMaxColHeightMm;

      const pageBlocks: SongBlock[] = [];
      let pageH = 0;

      while (remainingBlocks.length > 0) {
        const b = remainingBlocks[0]!;
        if (pageH + b.heightMm <= maxColH || pageBlocks.length === 0) {
          pageBlocks.push(b);
          pageH += b.heightMm;
          remainingBlocks.shift();
        } else {
          break;
        }
      }

      if (pageH > maxColH) {
        anyOverflow = true;
      }

      const pFillRatio = Math.min(1.0, pageH / maxColH);
      sumFillRatio += pFillRatio;

      pages.push({
        pageNumber: pageIdx,
        totalPages: pageIdx,
        isFirstPage: isFirst,
        columnsCount: 1,
        fillRatio: pFillRatio,
        headerTitle: canto.titolo,
        headerAuthor: isFirst ? canto.autore : null,
        headerParams: buildHeaderParams(isFirst),
        fontSizePt,
        arrowSizePt,
        leftColumn: {
          blocks: pageBlocks,
          totalHeightMm: pageH,
          linesCount: pageBlocks.reduce((a, b) => a + b.lines.length, 0),
        },
        rightColumn: { blocks: [], totalHeightMm: 0, linesCount: 0 },
        warnings: [],
      });

      pageIdx++;
      if (pageIdx > 10) break;
    }

    pages.forEach((p) => {
      p.totalPages = pages.length;
    });

    const avgFill = pages.length > 0 ? sumFillRatio / pages.length : 0;
    return {
      pages,
      fontSizePt,
      columnsCount: 1,
      fillRatio: avgFill,
      hasOverflow: anyOverflow,
      hasSingleWordWrap,
      hasTooLongLines,
      warnings,
    };
  }

  // CASO 2: Modalità a 2 colonne con column-fill: auto (riempimento colonna 1 fino in fondo, poi colonna 2)
  if (explicitColumnBreak && blocks.length >= 2) {
    const splitIdx =
      explicitColumnBreakIndex !== null &&
      explicitColumnBreakIndex > 0 &&
      explicitColumnBreakIndex < blocks.length
        ? explicitColumnBreakIndex
        : Math.ceil(blocks.length / 2);
    const leftBlocks = blocks.slice(0, splitIdx);
    const rightBlocks = blocks.slice(splitIdx);

    const leftCol: ColumnContent = {
      blocks: leftBlocks,
      totalHeightMm: leftBlocks.reduce((a, b) => a + b.heightMm, 0),
      linesCount: leftBlocks.reduce((a, b) => a + b.lines.length, 0),
    };
    const rightCol: ColumnContent = {
      blocks: rightBlocks,
      totalHeightMm: rightBlocks.reduce((a, b) => a + b.heightMm, 0),
      linesCount: rightBlocks.reduce((a, b) => a + b.lines.length, 0),
    };

    const hasOverflow =
      leftCol.totalHeightMm > page1MaxColHeightMm || rightCol.totalHeightMm > page1MaxColHeightMm;

    const fillRatio = Math.min(
      1.0,
      (leftCol.totalHeightMm + rightCol.totalHeightMm) / (page1MaxColHeightMm * 2)
    );

    const page1: CanzonierePage = {
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      columnsCount: 2,
      fillRatio,
      headerTitle: canto.titolo,
      headerAuthor: canto.autore,
      headerParams: buildHeaderParams(true),
      fontSizePt,
      arrowSizePt,
      leftColumn: leftCol,
      rightColumn: rightCol,
      warnings: [],
    };

    return {
      pages: [page1],
      fontSizePt,
      columnsCount: 2,
      fillRatio,
      hasOverflow,
      hasSingleWordWrap,
      hasTooLongLines,
      warnings,
    };
  }

  // Flusso a 2 colonne:
  // 1. Se tutti i blocchi possono entrare bilanciati in 1 pagina
  const balanced1Page = balanceIntoTwoColumns(blocks, page1MaxColHeightMm);
  if (balanced1Page.fits) {
    const pFillRatio = Math.min(
      1.0,
      (balanced1Page.leftCol.totalHeightMm + balanced1Page.rightCol.totalHeightMm) / (page1MaxColHeightMm * 2)
    );
    const page1: CanzonierePage = {
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      columnsCount: 2,
      fillRatio: pFillRatio,
      headerTitle: canto.titolo,
      headerAuthor: canto.autore,
      headerParams: buildHeaderParams(true),
      fontSizePt,
      arrowSizePt,
      leftColumn: balanced1Page.leftCol,
      rightColumn: balanced1Page.rightCol,
      warnings: [],
    };
    return {
      pages: [page1],
      fontSizePt,
      columnsCount: 2,
      fillRatio: pFillRatio,
      hasOverflow: false,
      hasSingleWordWrap,
      hasTooLongLines,
      warnings,
    };
  }

  // 2. Se non entrano in 1 pagina, tenta una distribuzione bilanciata su 2 pagine
  // (evita di riempire al 100% pag 1 lasciando solo il 25-35% di continuazione a pag 2)
  if (blocks.length >= 2) {
    let bestTwoPageSplit: {
      splitIdx: number;
      p1Balanced: ReturnType<typeof balanceIntoTwoColumns>;
      p2Balanced: ReturnType<typeof balanceIntoTwoColumns>;
      score: number;
    } | null = null;

    for (let k = 1; k < blocks.length; k++) {
      const p1Blocks = blocks.slice(0, k);
      const p2Blocks = blocks.slice(k);

      const b1 = balanceIntoTwoColumns(p1Blocks, page1MaxColHeightMm);
      const b2 = balanceIntoTwoColumns(p2Blocks, page2PlusMaxColHeightMm);

      if (b1.fits && b2.fits) {
        const fill1 = (b1.leftCol.totalHeightMm + b1.rightCol.totalHeightMm) / (page1MaxColHeightMm * 2);
        const fill2 = (b2.leftCol.totalHeightMm + b2.rightCol.totalHeightMm) / (page2PlusMaxColHeightMm * 2);
        const minFill = Math.min(fill1, fill2);
        const colDiff = b1.diffMm + b2.diffMm;

        // Massimizza il riempimento di entrambe le pagine ed equilibra i carichi
        // Penalizza fortemente pagine con riempimento sotto il 60% ed evita colonna destra vuota
        let score = (fill1 + fill2) * 500 + minFill * 600 - colDiff * 1.5;
        if (fill1 < 0.60) score -= 2000;
        if (fill2 < 0.50) score -= 2000;
        if (b1.rightCol.totalHeightMm < 20 || b2.rightCol.totalHeightMm < 20) score -= 1500;
        if (!bestTwoPageSplit || score > bestTwoPageSplit.score) {
          bestTwoPageSplit = {
            splitIdx: k,
            p1Balanced: b1,
            p2Balanced: b2,
            score,
          };
        }
      }
    }

    if (bestTwoPageSplit) {
      const { p1Balanced, p2Balanced } = bestTwoPageSplit;
      const p1FillRatio = Math.min(
        1.0,
        (p1Balanced.leftCol.totalHeightMm + p1Balanced.rightCol.totalHeightMm) / (page1MaxColHeightMm * 2)
      );
      const p2FillRatio = Math.min(
        1.0,
        (p2Balanced.leftCol.totalHeightMm + p2Balanced.rightCol.totalHeightMm) / (page2PlusMaxColHeightMm * 2)
      );

      const page1: CanzonierePage = {
        pageNumber: 1,
        totalPages: 2,
        isFirstPage: true,
        columnsCount: 2,
        fillRatio: p1FillRatio,
        headerTitle: canto.titolo,
        headerAuthor: canto.autore,
        headerParams: buildHeaderParams(true),
        fontSizePt,
        arrowSizePt,
        leftColumn: p1Balanced.leftCol,
        rightColumn: p1Balanced.rightCol,
        warnings: [],
      };

      const page2: CanzonierePage = {
        pageNumber: 2,
        totalPages: 2,
        isFirstPage: false,
        columnsCount: 2,
        fillRatio: p2FillRatio,
        headerTitle: canto.titolo,
        headerAuthor: null,
        headerParams: buildHeaderParams(false),
        fontSizePt,
        arrowSizePt,
        leftColumn: p2Balanced.leftCol,
        rightColumn: p2Balanced.rightCol,
        warnings: [],
      };

      return {
        pages: [page1, page2],
        fontSizePt,
        columnsCount: 2,
        fillRatio: (p1FillRatio + p2FillRatio) / 2,
        hasOverflow: false,
        hasSingleWordWrap,
        hasTooLongLines,
        warnings,
      };
    }
  }

  // 3. Flusso sequenziale di fallback (se richiede 3+ pagine o se nessun taglio tra blocchi interi è fattibile)
  const pages: CanzonierePage[] = [];
  let remainingBlocks = [...blocks];
  let pageIdx = 1;
  let anyOverflow = false;
  let sumFillRatio = 0;

  while (remainingBlocks.length > 0) {
    const isFirst = pageIdx === 1;
    const maxColH = isFirst ? page1MaxColHeightMm : page2PlusMaxColHeightMm;

    // Se tutti i blocchi rimanenti possono entrare bilanciati in questa pagina (es. canto a pagina singola o ultima pagina)
    const balanced = balanceIntoTwoColumns(remainingBlocks, maxColH);
    if (balanced.fits) {
      const pFillRatio = Math.min(
        1.0,
        (balanced.leftCol.totalHeightMm + balanced.rightCol.totalHeightMm) / (maxColH * 2)
      );
      sumFillRatio += pFillRatio;

      pages.push({
        pageNumber: pageIdx,
        totalPages: pageIdx,
        isFirstPage: isFirst,
        columnsCount: 2,
        fillRatio: pFillRatio,
        headerTitle: canto.titolo,
        headerAuthor: isFirst ? canto.autore : null,
        headerParams: buildHeaderParams(isFirst),
        fontSizePt,
        arrowSizePt,
        leftColumn: balanced.leftCol,
        rightColumn: balanced.rightCol,
        warnings: [],
      });
      break;
    }

    // Riempi colonna sinistra fino in fondo (senza superare maxColH)
    const leftBlocks: SongBlock[] = [];
    let leftH = 0;

    while (remainingBlocks.length > 0) {
      const b = remainingBlocks[0]!;
      if (b.heightMm > maxColH) {
        // Se un blocco gigante supera l'intera colonna, spezzalo con almeno 3 righe per parte
        const split = splitLargeBlock(b, maxColH, fontSizePt, config, colWidthMm, mode, packing);
        leftBlocks.push(split.firstPart);
        remainingBlocks[0] = split.secondPart;
        leftH += split.firstPart.heightMm;
        break;
      }

      if (leftH + b.heightMm <= maxColH || leftBlocks.length === 0) {
        leftBlocks.push(b);
        leftH += b.heightMm;
        remainingBlocks.shift();
      } else {
        break;
      }
    }

    // Riempi colonna destra con i blocchi rimanenti
    const rightBlocks: SongBlock[] = [];
    let rightH = 0;

    while (remainingBlocks.length > 0) {
      const b = remainingBlocks[0]!;
      if (b.heightMm > maxColH) {
        const split = splitLargeBlock(b, maxColH, fontSizePt, config, colWidthMm, mode, packing);
        rightBlocks.push(split.firstPart);
        remainingBlocks[0] = split.secondPart;
        rightH += split.firstPart.heightMm;
        break;
      }

      if (rightH + b.heightMm <= maxColH || rightBlocks.length === 0) {
        rightBlocks.push(b);
        rightH += b.heightMm;
        remainingBlocks.shift();
      } else {
        break;
      }
    }

    if (leftH > maxColH || rightH > maxColH) {
      anyOverflow = true;
    }

    const pFillRatio = Math.min(1.0, (leftH + rightH) / (maxColH * 2));
    sumFillRatio += pFillRatio;

    pages.push({
      pageNumber: pageIdx,
      totalPages: pageIdx,
      isFirstPage: isFirst,
      columnsCount: 2,
      fillRatio: pFillRatio,
      headerTitle: canto.titolo,
      headerAuthor: isFirst ? canto.autore : null,
      headerParams: buildHeaderParams(isFirst),
      fontSizePt,
      arrowSizePt,
      leftColumn: {
        blocks: leftBlocks,
        totalHeightMm: leftH,
        linesCount: leftBlocks.reduce((a, b) => a + b.lines.length, 0),
      },
      rightColumn: {
        blocks: rightBlocks,
        totalHeightMm: rightH,
        linesCount: rightBlocks.reduce((a, b) => a + b.lines.length, 0),
      },
      warnings: [],
    });

    pageIdx++;
    if (pageIdx > 10) break;
  }

  pages.forEach((p) => {
    p.totalPages = pages.length;
  });

  const avgFill = pages.length > 0 ? sumFillRatio / pages.length : 0;
  return {
    pages,
    fontSizePt,
    columnsCount: 2,
    fillRatio: avgFill,
    hasOverflow: anyOverflow,
    hasSingleWordWrap,
    hasTooLongLines,
    warnings,
  };
}

/**
 * Bilancia i blocchi tra due colonne minimizzando il dislivello tra blocchi.
 */
function balanceIntoTwoColumns(
  blocks: SongBlock[],
  maxColHeightMm: number
): {
  fits: boolean;
  leftCol: ColumnContent;
  rightCol: ColumnContent;
  diffMm: number;
} {
  if (blocks.length === 0) {
    const emptyCol: ColumnContent = { blocks: [], totalHeightMm: 0, linesCount: 0 };
    return { fits: true, leftCol: emptyCol, rightCol: emptyCol, diffMm: 0 };
  }

  if (blocks.length === 1) {
    const b = blocks[0]!;
    const leftCol: ColumnContent = { blocks: [b], totalHeightMm: b.heightMm, linesCount: b.lines.length };
    const rightCol: ColumnContent = { blocks: [], totalHeightMm: 0, linesCount: 0 };
    return { fits: b.heightMm <= maxColHeightMm, leftCol, rightCol, diffMm: b.heightMm };
  }

  let bestSplitIdx = 1;
  let bestMaxHeight = Infinity;
  let bestDiff = Infinity;

  // Itera su tutti i possibili punti di taglio tra blocchi
  for (let splitIdx = 1; splitIdx < blocks.length; splitIdx++) {
    const left = blocks.slice(0, splitIdx);
    const right = blocks.slice(splitIdx);

    const leftH = left.reduce((acc, b) => acc + b.heightMm, 0);
    const rightH = right.reduce((acc, b) => acc + b.heightMm, 0);

    const maxH = Math.max(leftH, rightH);
    const diff = Math.abs(leftH - rightH);

    if (maxH < bestMaxHeight || (maxH === bestMaxHeight && diff < bestDiff)) {
      bestMaxHeight = maxH;
      bestDiff = diff;
      bestSplitIdx = splitIdx;
    }
  }

  const leftBlocks = blocks.slice(0, bestSplitIdx);
  const rightBlocks = blocks.slice(bestSplitIdx);

  const leftCol: ColumnContent = {
    blocks: leftBlocks,
    totalHeightMm: leftBlocks.reduce((acc, b) => acc + b.heightMm, 0),
    linesCount: leftBlocks.reduce((acc, b) => acc + b.lines.length, 0),
  };
  const rightCol: ColumnContent = {
    blocks: rightBlocks,
    totalHeightMm: rightBlocks.reduce((acc, b) => acc + b.heightMm, 0),
    linesCount: rightBlocks.reduce((acc, b) => acc + b.lines.length, 0),
  };

  const fits = leftCol.totalHeightMm <= maxColHeightMm && rightCol.totalHeightMm <= maxColHeightMm;

  return { fits, leftCol, rightCol, diffMm: bestDiff };
}

/**
 * Taglia un blocco tra due righe per rientrare in maxColHeightMm.
 */
export function splitLargeBlock(
  block: SongBlock,
  maxColHeightMm: number,
  fontSizePt: number,
  config: CanzoniereConfig,
  colWidthMm: number,
  mode: 'suona' | 'canta',
  packing: 'standard' | 'css_calibrated' = 'css_calibrated',
  toleranceMm: number = mode === 'suona' ? 3.5 : 3.0
): { firstPart: SongBlock; secondPart: SongBlock } {
  const lines = block.lines;

  if (lines.length <= 1) {
    return {
      firstPart: { ...block, id: `${block.id}_p1` },
      secondPart: {
        id: `${block.id}_p2`,
        type: block.type,
        isChorus: block.isChorus,
        cantoId: block.cantoId,
        lines: [],
        heightMm: 0,
        fontSizePt: block.fontSizePt,
      },
    };
  }

  const fullH = calculateBlockHeightMm(lines, fontSizePt, config, mode, colWidthMm, packing);

  // 1. Se l'intero blocco entra con una leggera tolleranza (+8.5mm canta / +9.5mm suona), assorbi tutto
  if (fullH <= maxColHeightMm + toleranceMm) {
    return {
      firstPart: { ...block, id: `${block.id}_p1`, heightMm: fullH },
      secondPart: {
        id: `${block.id}_p2`,
        type: block.type,
        isChorus: block.isChorus,
        cantoId: block.cantoId,
        lines: [],
        heightMm: 0,
        fontSizePt: block.fontSizePt,
      },
    };
  }

  // 2. Trova il massimo numero di righe che entrano (con tolleranza difensiva per evitare orfani e riempire la colonna)
  let splitIdx = 0;
  for (let i = 1; i < lines.length; i++) {
    const candidateLines = lines.slice(0, i);
    const h = calculateBlockHeightMm(candidateLines, fontSizePt, config, mode, colWidthMm, packing);
    if (h <= maxColHeightMm + toleranceMm) {
      splitIdx = i;
    } else {
      break;
    }
  }

  // 3. Regole anti-orfano e anti-vedova:
  // Se la seconda parte avrebbe solo 1 riga (o se assorbire l'intera strofa eccede di pochissimo):
  const remainingLines = lines.length - splitIdx;
  if (remainingLines === 1) {
    if (fullH <= maxColHeightMm + toleranceMm + 1.5) {
      // Assorbi l'ultima riga invece di lasciarla orfana nella colonna successiva!
      return {
        firstPart: { ...block, id: `${block.id}_p1`, heightMm: fullH },
        secondPart: {
          id: `${block.id}_p2`,
          type: block.type,
          isChorus: block.isChorus,
          cantoId: block.cantoId,
          lines: [],
          heightMm: 0,
          fontSizePt: block.fontSizePt,
        },
      };
    }
    // Altrimenti arretra splitIdx in modo che secondPart abbia almeno 2 o 3 righe
    const minPart2 = lines.length >= 6 ? 3 : 2;
    splitIdx = Math.max(0, lines.length - minPart2);
  }

  // Se firstPart ha meno di 2 righe, non spezzare affatto: sposta l'intero blocco alla colonna successiva
  if (splitIdx < 2) {
    return {
      firstPart: {
        id: `${block.id}_p1`,
        type: block.type,
        isChorus: block.isChorus,
        cantoId: block.cantoId,
        lines: [],
        heightMm: 0,
        fontSizePt: block.fontSizePt,
      },
      secondPart: { ...block, id: `${block.id}_p2` },
    };
  }

  const part1 = lines.slice(0, splitIdx);
  const part2 = lines.slice(splitIdx);

  return {
    firstPart: {
      id: `${block.id}_p1`,
      type: block.type,
      isChorus: block.isChorus,
      cantoId: block.cantoId,
      lines: part1,
      heightMm: calculateBlockHeightMm(part1, fontSizePt, config, mode, colWidthMm, packing),
      fontSizePt: block.fontSizePt,
    },
    secondPart: {
      id: `${block.id}_p2`,
      type: block.type,
      isChorus: block.isChorus,
      cantoId: block.cantoId,
      lines: part2,
      heightMm: calculateBlockHeightMm(part2, fontSizePt, config, mode, colWidthMm, packing),
      fontSizePt: block.fontSizePt,
    },
  };
}


// ==============================================================================
// 4. ALGORITMO DI OTTIMIZZAZIONE ADATTIVO: (COLONNE) × (DIMENSIONE FONT)
// ==============================================================================

/**
 * Impagina un canto con dimensioni A4 fisse cercando la combinazione migliore di:
 * (numero colonne ∈ {1, 2}) × (dimensione font ∈ [minSize, maxSize])
 * per massimizzare il riempimento utile della pagina (fillRatio >= 0.90):
 * - Canzoni corte usano 1 colonna a larghezza piena con font grande (fino a 24pt suona / 28pt canta);
 * - Canzoni più lunghe passano a 2 colonne con column-fill: auto;
 * - Previene parole orfane e linee spezzate.
 */
export function layoutCanzoniereSong(
  canto: Canto,
  options?: CanzoniereConfig | LayoutSongOptions
): LayoutSongResult {
  const config =
    (options && 'page' in options ? options : (options as LayoutSongOptions)?.config) ||
    CANZONIERE_CONFIG;
  const mode =
    options && 'mode' in options && (options as LayoutSongOptions).mode
      ? (options as LayoutSongOptions).mode!
      : 'suona';
  const layoutMode =
    options && 'layoutMode' in options && (options as LayoutSongOptions).layoutMode
      ? (options as LayoutSongOptions).layoutMode!
      : 'riempi_pagina';

  // 1. Unisci sempre preventivamente le righe a capo spezzate da importazione PDF
  const cleanedChordpro = joinContinuationLines(canto.testo_chordpro || '');
  const workingCanto: Canto = {
    ...canto,
    testo_chordpro: cleanedChordpro,
  };

  const baseSizePt = mode === 'canta' ? 11.5 : 11.0;
  const minSizePt = config.typography.minSizePt || 10.0;
  const stepPt = config.typography.stepPt || 0.5;
  const defaultMax =
    mode === 'canta'
      ? config.typography.maxSizePtCanta || 12.5
      : config.typography.maxSizePtSuona || 12.0;
  const maxSizePt = config.typography.maxSizePt
    ? Math.min(config.typography.maxSizePt, defaultMax)
    : defaultMax;

  // Altezze utili A4 (margini 12mm -> altezza totale foglio 297mm - 24mm = 273mm)
  // Con l'intestazione compatta ultra-salva-spazio (~12-14mm) e il footer (~8-10mm),
  // l'altezza colonna utile su Pagina 1 e Pagina 2+ è calibrata a 246–248mm
  const page1MaxColHeightMm = 246;
  const page2PlusMaxColHeightMm = 248;

  // Determina targetPages (minimo numero di pagine con font leggibile >= 10.0 pt)
  const pageChunks = splitSongIntoPages(workingCanto.testo_chordpro);
  let targetPages = 1;
  if (pageChunks.length > 1) {
    targetPages = pageChunks.length;
  } else {
    // Prova a minSizePt in 2 colonne per vedere se può stare comodamente in 1 pagina
    const test1Page = attemptLayout(
      workingCanto,
      minSizePt,
      2,
      page1MaxColHeightMm,
      page2PlusMaxColHeightMm,
      config,
      mode
    );
    if (test1Page.pages.length === 1 && !test1Page.hasOverflow) {
      targetPages = 1;
    } else {
      targetPages = Math.max(1, test1Page.pages.length);
    }
  }

  // Se la modalità è "compatta", mantieni font standard 11pt a 2 colonne
  if (layoutMode === 'compatta') {
    let result = attemptLayout(
      workingCanto,
      baseSizePt,
      2,
      page1MaxColHeightMm,
      page2PlusMaxColHeightMm,
      config,
      mode
    );
    if (result.pages.length > targetPages || result.hasOverflow || result.hasSingleWordWrap) {
      for (let testSize = baseSizePt - stepPt; testSize >= minSizePt; testSize -= stepPt) {
        const candidate = attemptLayout(
          workingCanto,
          testSize,
          2,
          page1MaxColHeightMm,
          page2PlusMaxColHeightMm,
          config,
          mode
        );
        if (candidate.pages.length <= targetPages && !candidate.hasOverflow) {
          result = candidate;
          if (!candidate.hasSingleWordWrap) break;
        }
      }
    }
    return {
      pages: result.pages,
      fontSizePt: result.fontSizePt,
      columnsCount: result.columnsCount,
      fillRatio: result.fillRatio,
      declaredPageCount: result.pages.length,
      hasOverflow: result.hasOverflow,
      hasTooLongLines: result.hasTooLongLines,
      warnings: result.warnings,
    };
  }

  // ============================================================================
  // MODALITÀ "RIEMPI PAGINA": OTTIMIZZAZIONE ADATTIVA (1 vs 2 COLONNE) × (FONT)
  // ============================================================================

  // Genera tutti i passi di font nell'intervallo armonico [minSizePt .. maxSizePt]
  const fontSizes: number[] = [];
  for (let s = minSizePt; s <= maxSizePt + 0.001; s += stepPt) {
    fontSizes.push(Math.round(s * 10) / 10);
  }

  // Raccogli tutti i candidati validi
  const validCandidates: AttemptLayoutResult[] = [];
  const relaxedCandidates: AttemptLayoutResult[] = [];
  let ultimateFallback: AttemptLayoutResult | null = null;
  const hasExplicitColumnBreak = /\{(?:nuova_colonna|column_break|new_column|nc)\}/i.test(
    workingCanto.testo_chordpro
  );
  const colsToTest: (1 | 2)[] = hasExplicitColumnBreak ? [2] : [1, 2];

  for (const cols of colsToTest) {
    for (const size of fontSizes) {
      const candidate = attemptLayout(
        workingCanto,
        size,
        cols,
        page1MaxColHeightMm,
        page2PlusMaxColHeightMm,
        config,
        mode
      );

      if (!ultimateFallback) {
        ultimateFallback = candidate;
      }

      const fitsTarget = candidate.pages.length === targetPages && !candidate.hasOverflow;
      if (!fitsTarget) continue;

      validCandidates.push(candidate);
    }
  }

  // Funzione di punteggio per identificare la migliore combinazione
  const scoreCandidate = (c: AttemptLayoutResult): number => {
    // Calcola il riempimento di ciascuna pagina
    const pageFills = c.pages.map((p) => p.fillRatio);
    const minPageFill = Math.min(...pageFills);
    const avgFill = c.fillRatio;

    // 1. Punteggio base: riempimento medio e leggibilità confortevole da leggio (10.0–12.5 pt)
    let score = avgFill * 800 + c.fontSizePt * 160;

    // 2. Obiettivo: buon riempimento
    if (c.pages.length === 1) {
      // Per canti a pagina singola, se fillRatio >= 0.70 diamo bonus, ma NON penalizziamo
      // brani compatti su 2 colonne che occupano comodamente 1 pagina
      if (minPageFill >= 0.70) {
        score += 400;
      }
    } else {
      // Per canti multi-pagina (2+ pagine), ogni pagina deve avere ottimo riempimento (>= 70%)
      if (minPageFill >= 0.70) {
        score += 600;
      } else {
        score -= (0.70 - minPageFill) * 3500;
        if (minPageFill < 0.45) {
          score -= 1500;
        }
      }
    }

    if (minPageFill >= 0.80) {
      score += 250;
    }

    // 3. Priorità a 1 pagina: se il brano può stare su 1 pagina senza overflow, premialo
    if (c.pages.length === 1 && !c.hasOverflow) {
      score += 600;
    }

    // 4. Penalità severa per parole orfane a fine riga (es. solo "me." o "te.")
    if (c.hasSingleWordWrap) {
      score -= 1200;
    }

    // Lievissima penalità per righe lunghe che vanno a capo fisiologicamente
    if (c.hasTooLongLines) {
      score -= 50;
    }

    // 5. Regola 2 colonne: controllo equilibrio su TUTTE le pagine
    if (c.columnsCount === 2) {
      if (mode === 'canta' && c.pages.length === 1) {
        // In "Chi canta", l'obiettivo primario è risparmiare il massimo spazio usando 2 colonne per tutti i canti con almeno 20 righe
        const nonBlankLines = workingCanto.testo_chordpro
          .split('\n')
          .filter((l) => l.trim() && !/^\{.*\}$/.test(l.trim())).length;
        if (nonBlankLines >= 20) {
          score += 1000;
        }
      } else if (mode === 'suona' && c.pages.length === 1) {
        const nonBlankLines = workingCanto.testo_chordpro
          .split('\n')
          .filter((l) => l.trim() && !/^\{.*\}$/.test(l.trim())).length;
        if (nonBlankLines >= 22) {
          score += 1500;
        }
      }
      for (const p of c.pages) {
        if (p.rightColumn.totalHeightMm < 20 && p.leftColumn.totalHeightMm > 60) {
          // Colonna destra quasi vuota: pessimo effetto visivo
          score -= 2500;
        }
      }
      if (!c.hasSingleWordWrap && minPageFill >= 0.60) {
        score += 250;
      }
    }

    // 6. Regola 1 colonna:
    if (c.columnsCount === 1) {
      if (mode === 'canta') {
        // In "Chi canta", l'obiettivo è risparmiare spazio evitando che le canzoni occupino quanto con accordi
        const nonBlankLines = workingCanto.testo_chordpro
          .split('\n')
          .filter((l) => l.trim() && !/^\{.*\}$/.test(l.trim())).length;
        if (nonBlankLines >= 20) {
          score -= 3500;
        }
      } else {
        if (c.fontSizePt < 11.0) {
          score -= 3000; // 1 colonna a font piccolo non ha senso
        } else if (c.fillRatio >= 0.70 && !c.hasSingleWordWrap) {
          score += 400; // Ottimo riempimento pulito a tutta larghezza
        }
      }
    }

    return score;
  };

  const pool = validCandidates.length > 0 ? validCandidates : relaxedCandidates;

  let bestResult: AttemptLayoutResult;
  if (pool.length > 0) {
    pool.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
    bestResult = pool[0]!;
  } else {
    // Fallback: prova a 9pt a 2 colonne
    bestResult =
      ultimateFallback ||
      attemptLayout(
        workingCanto,
        minSizePt,
        2,
        page1MaxColHeightMm,
        page2PlusMaxColHeightMm,
        config,
        mode
      );
  }

  return {
    pages: bestResult.pages,
    fontSizePt: bestResult.fontSizePt,
    columnsCount: bestResult.columnsCount,
    fillRatio: bestResult.fillRatio,
    declaredPageCount: bestResult.pages.length,
    hasOverflow: bestResult.hasOverflow,
    hasTooLongLines: bestResult.hasTooLongLines,
    warnings: bestResult.warnings,
  };
}

// ==============================================================================
// 5. MOTORE A FLUSSO CONTINUO SU 2 COLONNE (CANZONIERE A FLUSSO CONTINUO)
// ==============================================================================

export const MIN_REMAINING_HEIGHT_FOR_NEW_SONG_MM = 38;
export const MIN_PAGE_SPILL_LINES = 5;
export const CONTINUOUS_FLOW_COL_HEIGHT_MM = 252;

export interface CanzoniereBookResult {
  pages: CanzonierePage[];
  songPageMap: Map<string, number>;
  totalDeclaredPages: number;
  hasAnyOverflow: boolean;
  warnings: string[];
}

export interface LayoutFlowOptions {
  config?: CanzoniereConfig;
  mode?: 'suona' | 'canta';
  baseFontSizePt?: number;
  disableAutoCompact?: boolean;
}

/**
 * Impagina un insieme di canti concatenandoli in modo fluido e continuo attraverso
 * le due colonne di ciascun foglio A4 (89.5 mm per colonna):
 * - Quando un canto finisce, se lo spazio utile residuo nella colonna è sufficiente
 *   per l'intestazione e almeno 4 righe di testo (>= 38mm canta, >= 48mm suona),
 *   il canto successivo inizia subito sotto separato da una linea divisoria (hr.canzoniere-song-divider);
 * - Se lo spazio utile residuo è inferiore, il nuovo canto slitta alla colonna successiva
 *   (o alla nuova pagina);
 * - Ogni inizio canto ha il proprio blocco header incapsulato nella singola colonna (89.5 mm);
 * - Font stabile (11.0 pt per "suona", 11.5 pt per "canta") con compattazione a -0.5 pt
 *   solo per prevenire sbrodamenti di 2-4 righe su un foglio successivo (regola anti-orfano).
 */
export function layoutCanzoniereFlow(
  songs: Canto[],
  options?: LayoutFlowOptions
): CanzoniereBookResult {
  const config = options?.config || CANZONIERE_CONFIG;
  const mode = options?.mode || 'suona';
  const baseFontSizePt = options?.baseFontSizePt || (mode === 'canta' ? 11.5 : 11.0);
  const maxColHeightMm = mode === 'suona' ? 250 : 252;
  const toleranceMm = 3.0;

  const warnings: string[] = [];
  const songPageMap = new Map<string, number>();

  if (!songs || songs.length === 0) {
    return {
      pages: [],
      songPageMap,
      totalDeclaredPages: 0,
      hasAnyOverflow: false,
      warnings,
    };
  }

  interface FlowPage {
    pageNumber: number;
    leftColumn: ColumnContent;
    rightColumn: ColumnContent;
    sectionTitle?: string;
    fontSizePt: number;
  }

  const pages: FlowPage[] = [];
  let currentPageIndex = 0;
  let currentCol: 'left' | 'right' = 'left';

  const ensurePage = (idx: number, sectionTitle?: string) => {
    while (pages.length <= idx) {
      pages.push({
        pageNumber: pages.length + 1,
        leftColumn: { blocks: [], totalHeightMm: 0, linesCount: 0 },
        rightColumn: { blocks: [], totalHeightMm: 0, linesCount: 0 },
        sectionTitle,
        fontSizePt: baseFontSizePt,
      });
    }
    const page = pages[idx];
    if (page && sectionTitle && !page.sectionTitle) {
      page.sectionTitle = sectionTitle;
    }
  };

  const advanceColumn = (sectionTitle?: string) => {
    if (currentCol === 'left') {
      currentCol = 'right';
    } else {
      currentPageIndex++;
      currentCol = 'left';
      ensurePage(currentPageIndex, sectionTitle);
    }
  };

  const getCol = (): ColumnContent => {
    ensurePage(currentPageIndex);
    const cur = pages[currentPageIndex]!;
    return currentCol === 'left' ? cur.leftColumn : cur.rightColumn;
  };

  for (const rawSong of songs) {
    const cleanedText = joinContinuationLines(rawSong.testo_chordpro || '');
    const song: Canto = { ...rawSong, testo_chordpro: cleanedText };

    const sectorKey = getSectorKey(song.categoria);
    const sectionLabel = SECTOR_LABELS[sectorKey]?.toUpperCase() || 'CANZONI SCOUT';
    ensurePage(currentPageIndex, sectionLabel);

    const buildHeaderParams = () => {
      if (!song.misura && !song.bpm_testo && !song.ritmo && song.capotasto === null) return null;
      return {
        misura: song.misura || null,
        bpm_testo: song.bpm_testo || null,
        ritmo: song.ritmo || null,
        capotasto: mode === 'suona' && song.capotasto !== null && song.capotasto !== undefined ? song.capotasto : null,
      };
    };

    const headerParams = buildHeaderParams();

    // 1. Prova con font base
    let songFontSize = baseFontSizePt;
    const baseGroup = groupIntoBlocks(song.testo_chordpro, songFontSize, config, 89.5, mode, 'css_calibrated');
    let stanzaBlocks = baseGroup.blocks.filter((b) => b.lines.length > 0 && b.lines.some((l) => l.raw.trim().length > 0));

    // Se il canto non ha testo (es. solo titolo o vuoto), non impaginare blocchi orfani
    if (stanzaBlocks.length === 0) {
      songPageMap.set(song.id, currentPageIndex + 1);
      continue;
    }

    stanzaBlocks.forEach((b) => {
      b.cantoId = song.id;
      b.fontSizePt = songFontSize;
    });

    // 2. Verifica prerequisiti di ammissibilità per iniziare il canto nello spazio residuo della colonna
    let col = getCol();
    let availableInCol = maxColHeightMm - col.totalHeightMm;
    const toleranceMm = mode === 'suona' ? 3.5 : 3.0;
    const minHeightForNewSong = mode === 'suona' ? 50 : 38;

    if (col.totalHeightMm > 0) {
      // Se lo spazio residuo totale è inferiore alla soglia minima per titolo + 4 righe, forza il salto
      if (availableInCol < minHeightForNewSong) {
        advanceColumn(sectionLabel);
        col = getCol();
        availableInCol = maxColHeightMm - col.totalHeightMm;
      } else {
        // Calcola l'ingombro dell'header con divisorio
        const candidateHdrH = calculateSongHeaderHeightMm(song.titolo, song.autore, headerParams, mode, true);
        const spaceForStanzas = availableInCol - candidateHdrH;
        const totalSongH = candidateHdrH + stanzaBlocks.reduce((acc, b) => acc + b.heightMm, 0);

        // Se l'intero canto entra nello spazio residuo (con tolleranza), è ammesso
        if (totalSongH > availableInCol + toleranceMm) {
          // Altrimenti verifichiamo se c'è spazio per un inizio dignitoso:
          // Sotto il titolo per introdurre un nuovo canto servono MINIMO 4 RIGHE di testo reale
          // (per evitare spezzamenti precoci con solo 2 o 3 righe sotto il titolo).
          let canStart = false;

          if (spaceForStanzas + toleranceMm >= 10) {
            let accH = 0;
            let lyricLinesCount = 0;
            let totalLinesCount = 0;

            const hasAnyLyrics = stanzaBlocks.some((sb) =>
              sb.lines.some((l) => !l.isRitLabel && !/^\(.*\)$/.test(l.lyrics.trim()) && l.lyrics.trim().length > 0)
            );

            for (let i = 0; i < stanzaBlocks.length; i++) {
              const sb = stanzaBlocks[i]!;
              const isCommentOnly = sb.lines.every((l) => /^\(.*\)$/.test(l.lyrics.trim()) || l.isRitLabel);

              if (accH + sb.heightMm <= spaceForStanzas + toleranceMm) {
                accH += sb.heightMm;
                totalLinesCount += sb.lines.length;
                if (!isCommentOnly) {
                  lyricLinesCount += sb.lines.length;
                }
              } else {
                // Prova a spezzare questo blocco nello spazio residuo
                const rem = spaceForStanzas - accH;
                if (rem + toleranceMm >= 14 && sb.lines.length >= 4) {
                  const sp = splitLargeBlock(sb, rem, songFontSize, config, 89.5, mode, 'css_calibrated', toleranceMm);
                  const minIntroLines = accH === 0 ? 4 : 2;
                  const part1Ok = sp.firstPart.lines.length >= minIntroLines;
                  const part2Ok = sp.secondPart.lines.length === 0 || sp.secondPart.lines.length >= 2;
                  const heightOk = sp.firstPart.heightMm <= rem + toleranceMm + 1.5;
                  if (part1Ok && part2Ok && heightOk) {
                    totalLinesCount += sp.firstPart.lines.length;
                    if (!isCommentOnly) {
                      lyricLinesCount += sp.firstPart.lines.length;
                    }
                  }
                }
                break;
              }
            }

            // Per introdurre un nuovo canto a fondo colonna servono MINIMO 4 RIGHE di testo
            if (hasAnyLyrics ? lyricLinesCount >= 4 : totalLinesCount >= 4) {
              canStart = true;
            }
          }

          if (!canStart) {
            // Non c'è spazio per un inizio dignitoso (almeno 4 righe): salta alla colonna successiva
            advanceColumn(sectionLabel);
            col = getCol();
            availableInCol = maxColHeightMm - col.totalHeightMm;
          }
        }
      }
    }

    let hasTopDivider = col.totalHeightMm > 0;
    let headerH = calculateSongHeaderHeightMm(song.titolo, song.autore, headerParams, mode, hasTopDivider);
    let totalSongH = headerH + stanzaBlocks.reduce((acc, b) => acc + b.heightMm, 0);

    // 3. Regola Anti-Orfano e Anti-Cambio Pagina:
    let colSpaceNow = maxColHeightMm - col.totalHeightMm;
    let pageRemainingSpace = currentCol === 'left' ? colSpaceNow + maxColHeightMm : colSpaceNow;

    const canBlocksFitInRemainingPage = (blocks: SongBlock[], hdrHeight: number, cSpace: number, isLeft: boolean): boolean => {
      let space = cSpace - hdrHeight;
      let onLeft = isLeft;
      for (const blk of blocks) {
        if (blk.heightMm <= space) {
          space -= blk.heightMm;
        } else if (onLeft) {
          onLeft = false;
          space = maxColHeightMm;
          if (blk.heightMm <= space) {
            space -= blk.heightMm;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
      return true;
    };

    if (mode === 'suona') {
      const fitsPageNow = canBlocksFitInRemainingPage(stanzaBlocks, headerH, colSpaceNow, currentCol === 'left');
      if (!fitsPageNow) {
        // Tenta compattazione di 0.5 pt
        const compactFontSize = Math.round((songFontSize - 0.5) * 10) / 10;
        const compactGroup = groupIntoBlocks(song.testo_chordpro, compactFontSize, config, 89.5, mode, 'css_calibrated');
        const compactStanzaBlocks = compactGroup.blocks.filter((b) => b.lines.length > 0 && b.lines.some((l) => l.raw.trim().length > 0));
        const compactHeaderH = calculateSongHeaderHeightMm(song.titolo, song.autore, headerParams, mode, hasTopDivider);
        const compactFits = canBlocksFitInRemainingPage(compactStanzaBlocks, compactHeaderH, colSpaceNow, currentCol === 'left');

        if (compactFits) {
          songFontSize = compactFontSize;
          stanzaBlocks = compactStanzaBlocks;
          stanzaBlocks.forEach((b) => {
            b.cantoId = song.id;
            b.fontSizePt = songFontSize;
          });
          headerH = compactHeaderH;
          totalSongH = headerH + stanzaBlocks.reduce((acc, b) => acc + b.heightMm, 0);
          const curPage = pages[currentPageIndex];
          if (curPage) {
            curPage.fontSizePt = songFontSize;
          }
        }
      }
    } else {
      // In modalità canta: flusso continuo salvaspazio
      if (totalSongH > pageRemainingSpace) {
        const spillMm = totalSongH - pageRemainingSpace;
        if (spillMm <= 26) {
          // Tenta compattazione di 0.5 pt
          const compactFontSize = Math.round((songFontSize - 0.5) * 10) / 10;
          const compactGroup = groupIntoBlocks(song.testo_chordpro, compactFontSize, config, 89.5, mode, 'css_calibrated');
          const compactStanzaBlocks = compactGroup.blocks.filter((b) => b.lines.length > 0 && b.lines.some((l) => l.raw.trim().length > 0));
          const compactHeaderH = calculateSongHeaderHeightMm(song.titolo, song.autore, headerParams, mode, hasTopDivider);
          const compactTotalH = compactHeaderH + compactStanzaBlocks.reduce((acc, b) => acc + b.heightMm, 0);

          if (compactTotalH <= pageRemainingSpace + 5) {
            songFontSize = compactFontSize;
            stanzaBlocks = compactStanzaBlocks;
            stanzaBlocks.forEach((b) => {
              b.cantoId = song.id;
              b.fontSizePt = songFontSize;
            });
            headerH = compactHeaderH;
            totalSongH = headerH + stanzaBlocks.reduce((acc, b) => acc + b.heightMm, 0);
            const curPage = pages[currentPageIndex];
            if (curPage) {
              curPage.fontSizePt = songFontSize;
            }
          }
        }
      }
    }

    // 4. Registra la pagina di inizio reale per l'indice
    songPageMap.set(song.id, currentPageIndex + 1);

    // 5. Inserisci il blocco header
    const headerBlock: SongBlock = {
      id: `hdr_${song.id}_p${currentPageIndex}_${currentCol}`,
      cantoId: song.id,
      type: 'header',
      header: {
        cantoId: song.id,
        title: song.titolo,
        author: song.autore,
        params: headerParams,
        showDivider: hasTopDivider,
        mode,
      },
      lines: [],
      heightMm: headerH,
      fontSizePt: songFontSize,
    };

    col = getCol();
    col.blocks.push(headerBlock);
    col.totalHeightMm += headerH;

    // 6. Inserisci le strofe nel flusso continuo
    for (let sIdx = 0; sIdx < stanzaBlocks.length; sIdx++) {
      const b = stanzaBlocks[sIdx]!;
      col = getCol();
      availableInCol = maxColHeightMm - col.totalHeightMm;
      const toleranceMm = mode === 'suona' ? 3.5 : 3.0;

      // Invariante Difensiva Assoluta: se col contiene l'header a fondo colonna e la prima strofa non entra né può essere spezzata
      // con almeno 4 righe sotto il titolo, arretra e sposta header alla colonna successiva
      const canSplitB =
        availableInCol + toleranceMm >= 14 &&
        b.lines.length >= 4 &&
        (() => {
          const sp = splitLargeBlock(b, availableInCol, songFontSize, config, 89.5, mode, 'css_calibrated', toleranceMm);
          const minIntro = (sIdx === 0 && col.blocks[col.blocks.length - 1] === headerBlock) ? 4 : 2;
          const part1Ok = sp.firstPart.lines.length >= minIntro;
          const part2Ok = sp.secondPart.lines.length === 0 || sp.secondPart.lines.length >= 2;
          const heightOk = sp.firstPart.heightMm <= availableInCol + toleranceMm + 1.5;
          return part1Ok && part2Ok && heightOk;
        })();

      if (
        sIdx === 0 &&
        b.heightMm > availableInCol + toleranceMm &&
        !canSplitB &&
        col.blocks[col.blocks.length - 1] === headerBlock &&
        col.blocks.length > 1
      ) {
        col.blocks.pop();
        col.totalHeightMm -= headerH;
        advanceColumn(sectionLabel);
        col = getCol();
        headerBlock.header!.showDivider = false;
        headerBlock.id = `hdr_${song.id}_p${currentPageIndex}_${currentCol}`;
        headerH = calculateSongHeaderHeightMm(song.titolo, song.autore, headerParams, mode, false);
        headerBlock.heightMm = headerH;
        col.blocks.push(headerBlock);
        col.totalHeightMm += headerH;
        songPageMap.set(song.id, currentPageIndex + 1);
        availableInCol = maxColHeightMm - col.totalHeightMm;
      }

      let curBlock: SongBlock | null = b;
      while (curBlock) {
        col = getCol();
        availableInCol = maxColHeightMm - col.totalHeightMm;

        if (curBlock.heightMm <= availableInCol || (col.blocks.length === 0 && curBlock.heightMm <= maxColHeightMm)) {
          curBlock.cantoId = song.id;
          curBlock.fontSizePt = songFontSize;
          col.blocks.push(curBlock);
          col.totalHeightMm += curBlock.heightMm;
          col.linesCount += curBlock.lines.length;
          curBlock = null;
        } else if (curBlock.heightMm <= availableInCol + toleranceMm) {
          // Il blocco eccede lo spazio di pochissimo (entro tolleranza): assorbilo subito a fondo colonna!
          curBlock.cantoId = song.id;
          curBlock.fontSizePt = songFontSize;
          col.blocks.push(curBlock);
          col.totalHeightMm += curBlock.heightMm;
          col.linesCount += curBlock.lines.length;
          curBlock = null;
        } else if (curBlock.heightMm > maxColHeightMm) {
          // Blocco gigante (es. 40-80 righe continue)
          const targetH = availableInCol >= 20 ? availableInCol : maxColHeightMm;
          if (availableInCol < 20 && col.totalHeightMm > 0) {
            advanceColumn(sectionLabel);
            continue;
          }
          const split = splitLargeBlock(curBlock, targetH, songFontSize, config, 89.5, mode, 'css_calibrated', 0);
          split.firstPart.cantoId = song.id;
          split.firstPart.fontSizePt = songFontSize;
          split.secondPart.cantoId = song.id;
          split.secondPart.fontSizePt = songFontSize;

          col.blocks.push(split.firstPart);
          col.totalHeightMm += split.firstPart.heightMm;
          col.linesCount += split.firstPart.lines.length;
          advanceColumn(sectionLabel);
          curBlock = split.secondPart;
        } else if (availableInCol + toleranceMm >= 14 && curBlock.lines.length >= 4) {
          // Quando c'è spazio residuo sufficiente e il blocco ha >= 4 righe,
          // spezza la strofa in modo da riempire la colonna attuale senza lasciare righe orfane (minimo 2 righe per parte, minimo 4 sotto header)
          const split = splitLargeBlock(curBlock, availableInCol, songFontSize, config, 89.5, mode, 'css_calibrated', toleranceMm);
          const isImmediatelyAfterHeader = col.blocks.length > 0 && col.blocks[col.blocks.length - 1]?.type === 'header';
          const minPart1Lines = isImmediatelyAfterHeader ? 4 : 2;
          const part1Ok = split.firstPart.lines.length >= minPart1Lines;
          const part2Ok = split.secondPart.lines.length === 0 || split.secondPart.lines.length >= 2;
          const heightOk = split.firstPart.heightMm <= availableInCol + toleranceMm + 1.5;
          if (part1Ok && part2Ok && heightOk) {
            split.firstPart.cantoId = song.id;
            split.firstPart.fontSizePt = songFontSize;
            split.secondPart.cantoId = song.id;
            split.secondPart.fontSizePt = songFontSize;

            col.blocks.push(split.firstPart);
            col.totalHeightMm += split.firstPart.heightMm;
            col.linesCount += split.firstPart.lines.length;
            if (split.secondPart.lines.length > 0) {
              advanceColumn(sectionLabel);
              curBlock = split.secondPart;
            } else {
              curBlock = null;
            }
          } else {
            if (isImmediatelyAfterHeader && col.blocks.length > 1) {
              // Non entrano almeno 4 righe sotto l'header: sposta anche l'header alla colonna successiva
              col.blocks.pop();
              col.totalHeightMm -= headerH;
              advanceColumn(sectionLabel);
              col = getCol();
              headerBlock.header!.showDivider = false;
              headerBlock.id = `hdr_${song.id}_p${currentPageIndex}_${currentCol}`;
              headerH = calculateSongHeaderHeightMm(song.titolo, song.autore, headerParams, mode, false);
              headerBlock.heightMm = headerH;
              col.blocks.push(headerBlock);
              col.totalHeightMm += headerH;
              songPageMap.set(song.id, currentPageIndex + 1);
            } else {
              advanceColumn(sectionLabel);
            }
          }
        } else {
          // Il blocco sta in una colonna vuota ma non nello spazio residuo attuale
          // REGOLE ANTI-ORFANO SULLA CODA DEL CANTO:
          const remainingBlocks = [curBlock, ...stanzaBlocks.slice(sIdx + 1)];
          const remainingLines = remainingBlocks.reduce((acc, blk) => acc + blk.lines.length, 0);
          const remainingH = remainingBlocks.reduce((acc, blk) => acc + blk.heightMm, 0);
          const isPureRitTail = remainingBlocks.every((blk) =>
            blk.lines.every(
              (l) => l.isRitLabel || !l.lyrics.trim() || /^RIT[.:]?(\s*\(x\d+\))?$/i.test(l.raw.trim())
            )
          );

          if (isPureRitTail) {
            // Se la coda residua è unicamente un token RIT. o dicitura di ritornello:
            // 1. Se eccede di pochissimo lo spazio colonna (fino a 8 mm), assorbilo a fondo colonna
            if (remainingH <= availableInCol + 4) {
              for (const rem of remainingBlocks) {
                rem.cantoId = song.id;
                rem.fontSizePt = songFontSize;
                col.blocks.push(rem);
                col.totalHeightMm += rem.heightMm;
                col.linesCount += rem.lines.length;
              }
              curBlock = null;
              sIdx = stanzaBlocks.length;
              break;
            }
            // 2. Se eccede di più, NON creare una nuova colonna/pagina per una sola parola!
            // Il ritornello è già stato cantato precedentemente, scarta il RIT. residuo
            curBlock = null;
            sIdx = stanzaBlocks.length;
            break;
          }

          // Se la coda rimanente è composta da poche righe (<= 4 righe o <= 25 mm):
          if (remainingLines <= 4 || remainingH <= 25) {
            // Se eccede di poco (fino a toleranceMm + 2mm), assorbilo per completare la canzone qui
            if (remainingH <= availableInCol + (toleranceMm + 2)) {
              for (const rem of remainingBlocks) {
                rem.cantoId = song.id;
                rem.fontSizePt = songFontSize;
                col.blocks.push(rem);
                col.totalHeightMm += rem.heightMm;
                col.linesCount += rem.lines.length;
              }
              curBlock = null;
              sIdx = stanzaBlocks.length;
              break;
            }
          }

          advanceColumn(sectionLabel);
          col = getCol();

          // Guardia Esplicita Assoluta: una colonna o pagina nuova non deve MAI iniziare con un blocco RIT. orfano residuo di coda
          const isCurBlockRit = curBlock.lines.every(
            (l) => l.isRitLabel || !l.lyrics.trim() || /^RIT[.:]?(\s*\(x\d+\))?$/i.test(l.raw.trim())
          );
          const isRemainingPureRit = stanzaBlocks.slice(sIdx + 1).every((blk) =>
            blk.lines.every(
              (l) => l.isRitLabel || !l.lyrics.trim() || /^RIT[.:]?(\s*\(x\d+\))?$/i.test(l.raw.trim())
            )
          );
          if (col.blocks.length === 0 && isCurBlockRit && isRemainingPureRit) {
            curBlock = null;
            sIdx = stanzaBlocks.length;
            break;
          }

          curBlock.cantoId = song.id;
          curBlock.fontSizePt = songFontSize;
          col.blocks.push(curBlock);
          col.totalHeightMm += curBlock.heightMm;
          col.linesCount += curBlock.lines.length;
          curBlock = null;
        }
      }
    }
  }

  // 7. Finalizza le pagine generate
  const resultPages: CanzonierePage[] = pages
    .filter((p) => p.leftColumn.blocks.length > 0 || p.rightColumn.blocks.length > 0)
    .map((p, idx, arr) => {
      const leftH = p.leftColumn.totalHeightMm;
      const rightH = p.rightColumn.totalHeightMm;
      const fillRatio = Math.min(1.0, (leftH + rightH) / (maxColHeightMm * 2));
      const firstHeader =
        p.leftColumn.blocks.find((b) => b.type === 'header')?.header ||
        p.rightColumn.blocks.find((b) => b.type === 'header')?.header;

      return {
        pageNumber: p.pageNumber,
        totalPages: arr.length,
        isFirstPage: idx === 0,
        columnsCount: 2,
        fillRatio,
        headerTitle: firstHeader?.title || 'CANZONIERE',
        headerAuthor: firstHeader?.author || null,
        headerParams: firstHeader?.params || null,
        fontSizePt: p.fontSizePt,
        arrowSizePt: 13,
        leftColumn: p.leftColumn,
        rightColumn: p.rightColumn,
        warnings: [],
        sectionTitle: p.sectionTitle,
        isContinuousFlow: true,
      };
    });

  // 8. Ribilanciamento globale e Fill Ratio Ultima Pagina in "canta"
  if (mode === 'canta' && !options?.disableAutoCompact && resultPages.length > 1) {
    const lastPage = resultPages[resultPages.length - 1]!;
    const lastPageLines = lastPage.leftColumn.linesCount + lastPage.rightColumn.linesCount;
    if (lastPage.fillRatio < 0.45 || lastPageLines < 25) {
      for (const candidateFont of [11.2, 11.0, 10.8]) {
        if (candidateFont >= baseFontSizePt) continue;
        const retryResult = layoutCanzoniereFlow(songs, {
          ...options,
          baseFontSizePt: candidateFont,
          disableAutoCompact: true,
        });
        const retryLastPage = retryResult.pages[retryResult.pages.length - 1]!;
        const retryLastLines = retryLastPage.leftColumn.linesCount + retryLastPage.rightColumn.linesCount;
        if (
          retryResult.pages.length < resultPages.length &&
          (retryLastPage.fillRatio >= 0.45 || retryLastLines >= 25)
        ) {
          return retryResult;
        }
      }
    }
  }

  let hasAnyOverflow = false;
  for (const page of resultPages) {
    if (page.leftColumn.totalHeightMm > maxColHeightMm + toleranceMm || page.rightColumn.totalHeightMm > maxColHeightMm + toleranceMm) {
      hasAnyOverflow = true;
    }
  }

  return {
    pages: resultPages,
    songPageMap,
    totalDeclaredPages: resultPages.length,
    hasAnyOverflow,
    warnings,
  };
}

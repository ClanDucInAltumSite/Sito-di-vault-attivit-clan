/**
 * ==============================================================================
 * MOTORE DI IMPAGINAZIONE A4 CANZONIERE A DUE COLONNE (FASE 9)
 * ==============================================================================
 * Calcola l'impaginazione esatta a due colonne su foglio A4 verticale,
 * con bilanciamento delle colonne, riduzione tipografica a gradini (11 pt -> 9 pt),
 * prevenzione di parole singole a capo (vedove) e gestione canti multi-pagina.
 * Non usa CSS column-count né salti automatici del browser.
 */

import { CANZONIERE_CONFIG, CanzoniereConfig } from './canzoniere_config';
import { Canto } from '../../lib/db';

export interface ChordPlacement {
  chord: string;
  charIndex: number;
  offsetPx: number;
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

export interface SongBlock {
  id: string;
  lines: SongLine[];
  heightMm: number;
}

export interface ColumnContent {
  blocks: SongBlock[];
  totalHeightMm: number;
  linesCount: number;
}

export interface CanzonierePage {
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
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
}

export interface LayoutSongResult {
  pages: CanzonierePage[];
  fontSizePt: number;
  declaredPageCount: number;
  hasOverflow: boolean;
  hasTooLongLines: boolean;
  warnings: string[];
}

// ==============================================================================
// PARSING CHORDPRO IN RIGHE STRUTTURATE E BLOCCHI
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

/**
 * Parsea una riga ChordPro estraendo il testo nudo e gli accordi con i loro offset.
 */
export function parseChordProLine(line: string, fontSizePt: number): SongLine {
  const trimmed = line.trim();

  // Verifica se è etichetta RIT. / RIT:
  if (/^RIT[.:]?$/i.test(trimmed)) {
    return {
      raw: line,
      isRitLabel: true,
      isChordOnly: false,
      lyrics: trimmed.toUpperCase(),
      chords: [],
      hasChords: false,
    };
  }

  // Estrai accordi e testo
  const chords: ChordPlacement[] = [];
  let lyrics = '';
  let i = 0;

  // Calcolo approssimativo pixel per carattere a fontSizePt
  const pxPerChar = (fontSizePt * 1.3333) * 0.52;
  let minNextOffsetPx = 0;

  while (i < line.length) {
    if (line[i] === '[') {
      const closeIdx = line.indexOf(']', i);
      if (closeIdx !== -1) {
        const chord = line.slice(i + 1, closeIdx);
        const charIndex = lyrics.length;
        const naturalOffsetPx = Math.round(charIndex * pxPerChar);
        const offsetPx = Math.max(naturalOffsetPx, minNextOffsetPx);
        const chordWidthPx = Math.max(16, chord.length * pxPerChar * 1.15);
        minNextOffsetPx = offsetPx + chordWidthPx + 10;
        chords.push({ chord, charIndex, offsetPx });
        i = closeIdx + 1;
        continue;
      }
    }
    lyrics += line[i];
    i++;
  }

  const isChordOnly = chords.length > 0 && !lyrics.trim();

  // Stima se la riga sfora la larghezza colonna (81 mm ~ 306 px a 96dpi)
  // Larghezza disponibile colonna in px = 81 * 3.7795 ~ 306 px
  const colWidthPx = 81 * 3.7795;
  const estimatedLineWidthPx = lyrics.length * pxPerChar;
  const isTooLong = estimatedLineWidthPx > colWidthPx;

  // Rileva se va a capo lasciando una sola parola (difetto del riferimento)
  let hasSingleWordWrap = false;
  if (isTooLong) {
    const words = lyrics.trim().split(/\s+/);
    if (words.length > 1) {
      // Se l'ultima parola sfora da sola oltre colWidthPx
      const prefixWithoutLast = words.slice(0, -1).join(' ');
      const prefixWidth = prefixWithoutLast.length * pxPerChar;
      if (prefixWidth <= colWidthPx && estimatedLineWidthPx > colWidthPx) {
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
 * Raggruppa le righe in blocchi (strofe separate da righe vuote o direttive).
 */
export function groupIntoBlocks(
  textChordpro: string,
  fontSizePt: number,
  config: CanzoniereConfig = CANZONIERE_CONFIG
): { blocks: SongBlock[]; explicitColumnBreak: boolean; explicitColumnBreakIndex: number | null; explicitPageBreak: boolean } {
  const rawLines = textChordpro.split(/\r?\n/);
  const blocks: SongBlock[] = [];
  let currentLines: SongLine[] = [];
  let blockId = 0;
  let explicitColumnBreak = false;
  let explicitColumnBreakIndex: number | null = null;
  let explicitPageBreak = false;

  const flushBlock = () => {
    if (currentLines.length > 0) {
      const heightMm = calculateBlockHeightMm(currentLines, fontSizePt, config);
      blocks.push({
        id: `blk_${blockId++}`,
        lines: [...currentLines],
        heightMm,
      });
      currentLines = [];
    }
  };

  for (const l of rawLines) {
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
      currentLines.push({
        raw: l,
        isRitLabel: true,
        isChordOnly: false,
        lyrics: 'RIT.',
        chords: [],
        hasChords: false,
      });
      continue;
    }

    if (lower === '{end_of_chorus}' || lower === '{eoc}') {
      flushBlock();
      continue;
    }

    // Ignora metadati ChordPro che appartengono all'intestazione
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
        });
      }
      continue;
    }

    if (!trimmed) {
      flushBlock();
      continue;
    }

    currentLines.push(parseChordProLine(l, fontSizePt));
  }

  flushBlock();

  return { blocks, explicitColumnBreak, explicitColumnBreakIndex, explicitPageBreak };
}

/**
 * Calcola l'altezza in millimetri di un blocco di righe a una data dimensione font.
 */
export function calculateBlockHeightMm(
  lines: SongLine[],
  fontSizePt: number,
  config: CanzoniereConfig = CANZONIERE_CONFIG
): number {
  // 1 pt = 0.352778 mm
  const ptToMm = 0.352778;
  const lineHeightMm = fontSizePt * config.typography.lineHeight * ptToMm;
  const chordLineHeightMm = fontSizePt * 1.15 * ptToMm;
  const blockGapMm = lineHeightMm; // Riga vuota di separazione

  let totalMm = 0;

  for (const line of lines) {
    if (line.isRitLabel) {
      totalMm += lineHeightMm * 1.1;
    } else if (line.hasChords && !line.isChordOnly) {
      // Coppia: riga accordi sopra + riga testo
      totalMm += chordLineHeightMm + lineHeightMm;
    } else if (line.isChordOnly) {
      totalMm += chordLineHeightMm;
    } else {
      totalMm += lineHeightMm;
    }
  }

  totalMm += blockGapMm;
  return totalMm;
}

// ==============================================================================
// ALGORITMO DI IMPAGINAZIONE A DUE COLONNE CON BILANCIAMENTO
// ==============================================================================

/**
 * Impagina un canto con dimensioni A4 fisse, bilanciamento delle colonne
 * e calibrazione step-down da 11 pt a 9 pt.
 */
export function layoutCanzoniereSong(
  canto: Canto,
  config: CanzoniereConfig = CANZONIERE_CONFIG
): LayoutSongResult {
  const warnings: string[] = [];
  const baseSizePt = config.typography.baseSizePt; // 11 pt
  const minSizePt = config.typography.minSizePt; // 9 pt
  const stepPt = config.typography.stepPt; // 0.5 pt

  // Calcola altezze utili delle colonne
  // Pagina 1: 267 mm - altezza intestazione (titolo, autore, params, divider) ~ 35 mm = 232 mm
  const page1MaxColHeightMm = 232;
  // Pagina >= 2: 267 mm - altezza intestazione ridotta ~ 9 mm = 258 mm
  const page2PlusMaxColHeightMm = 258;

  // 1. Prova prima con la dimensione base (11 pt)
  let bestResult = attemptLayout(canto, baseSizePt, page1MaxColHeightMm, page2PlusMaxColHeightMm, config);

  // 2. Se a 11 pt il canto sfora di poco rispetto a 1 pagina,
  // oppure presenta righe con una sola parola a capo (vedove), prova i gradini inferiori (10.5 -> 9.0 pt)
  const shouldTryStepDown =
    (bestResult.pages.length === 2 && canFitWithStepDown(canto, baseSizePt, page1MaxColHeightMm, config)) ||
    bestResult.hasSingleWordWrap;

  if (shouldTryStepDown) {
    for (let testSize = baseSizePt - stepPt; testSize >= minSizePt; testSize -= stepPt) {
      const candidate = attemptLayout(canto, testSize, page1MaxColHeightMm, page2PlusMaxColHeightMm, config);

      // Se permette di far rientrare in 1 pagina
      if (candidate.pages.length === 1 && !candidate.hasOverflow) {
        bestResult = candidate;
        break;
      }

      // Se elimina la parola singola a capo mantenendo lo stesso numero di pagine
      if (!candidate.hasSingleWordWrap && candidate.pages.length <= bestResult.pages.length) {
        bestResult = candidate;
        if (!candidate.hasOverflow) break;
      }
    }
  } else if (bestResult.pages.length === 1 && !bestResult.hasOverflow) {
    // 3. STEP-UP: Se entra comodamente in 1 pagina ma lascia grandi vuoti ("voragini"),
    // prova i gradini superiori (11.5 -> 12.0 -> 12.5 -> 13.0 pt) per riempire lo spazio
    // e massimizzare leggibilità ed estetica professionale, purché rimanga in 1 pagina
    // e non generi overflow, parole orfane o righe che sforano.
    const p1 = bestResult.pages[0];
    if (p1) {
      const maxColHeightUsed = Math.max(p1.leftColumn.totalHeightMm, p1.rightColumn.totalHeightMm);
      const maxSizePt = config.typography.maxSizePt || 13;

      if (maxColHeightUsed < page1MaxColHeightMm * 0.80) {
        for (let testSize = baseSizePt + stepPt; testSize <= maxSizePt; testSize += stepPt) {
          const candidate = attemptLayout(canto, testSize, page1MaxColHeightMm, page2PlusMaxColHeightMm, config);
          if (
            candidate.pages.length === 1 &&
            !candidate.hasOverflow &&
            !candidate.hasSingleWordWrap &&
            !candidate.hasTooLongLines
          ) {
            bestResult = candidate;
          } else {
            break;
          }
        }
      }
    }
  }

  return {
    pages: bestResult.pages,
    fontSizePt: bestResult.fontSizePt,
    declaredPageCount: bestResult.pages.length,
    hasOverflow: bestResult.hasOverflow,
    hasTooLongLines: bestResult.hasTooLongLines,
    warnings: [...warnings, ...bestResult.warnings],
  };
}

/**
 * Verifica se lo sforamento rispetto a 1 pagina è "piccolo" (≤ 8 righe o ≤ 15% altezza colonna).
 */
function canFitWithStepDown(
  canto: Canto,
  baseSizePt: number,
  page1MaxColHeightMm: number,
  config: CanzoniereConfig
): boolean {
  const { blocks } = groupIntoBlocks(canto.testo_chordpro, baseSizePt, config);
  const totalBlocksHeight = blocks.reduce((acc, b) => acc + b.heightMm, 0);
  const twoColsCapacityMm = page1MaxColHeightMm * 2;
  const overflowMm = totalBlocksHeight - twoColsCapacityMm;

  if (overflowMm <= 0) return true;

  const maxAllowedOverflowMm = page1MaxColHeightMm * config.pagination.smallOverflowMaxPercent;
  return overflowMm <= maxAllowedOverflowMm;
}

/**
 * Tentativo di impaginazione a una determinata dimensione di font.
 */
function attemptLayout(
  canto: Canto,
  fontSizePt: number,
  page1MaxColHeightMm: number,
  page2PlusMaxColHeightMm: number,
  config: CanzoniereConfig
): {
  pages: CanzonierePage[];
  fontSizePt: number;
  hasOverflow: boolean;
  hasSingleWordWrap: boolean;
  hasTooLongLines: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const { blocks, explicitColumnBreak, explicitColumnBreakIndex } = groupIntoBlocks(
    canto.testo_chordpro,
    fontSizePt,
    config
  );

  let hasSingleWordWrap = false;
  let hasTooLongLines = false;

  // Verifica se ci sono righe troppo lunghe o con parole orfane
  for (const b of blocks) {
    for (const l of b.lines) {
      if (l.hasSingleWordWrap) hasSingleWordWrap = true;
      if (l.isTooLong) hasTooLongLines = true;
    }
  }

  // Calcola dimensione proporzionale frecce Nova Mono
  const arrowSizePt = Math.round((config.typography.arrowBaseSizePt * (fontSizePt / config.typography.baseSizePt)) * 10) / 10;

  // Caso 0: Canto con interruzioni di pagina esplicite ({nuova_pagina} / {np})
  const pageChunks = splitSongIntoPages(canto.testo_chordpro);
  if (pageChunks.length > 1) {
    const pages: CanzonierePage[] = [];
    let anyOverflow = false;

    for (let pIdx = 0; pIdx < pageChunks.length; pIdx++) {
      const pageText = pageChunks[pIdx];
      if (pageText === undefined) continue;
      const isFirst = pIdx === 0;
      const maxColHeight = isFirst ? page1MaxColHeightMm : page2PlusMaxColHeightMm;
      const { blocks: pageBlocks, explicitColumnBreak: pColBreak, explicitColumnBreakIndex: pColBreakIdx } = groupIntoBlocks(pageText, fontSizePt, config);

      let leftCol: ColumnContent;
      let rightCol: ColumnContent;

      if (pColBreak && pageBlocks.length >= 2) {
        const mid = (pColBreakIdx !== null && pColBreakIdx > 0 && pColBreakIdx < pageBlocks.length)
          ? pColBreakIdx
          : Math.ceil(pageBlocks.length / 2);
        const lB = pageBlocks.slice(0, mid);
        const rB = pageBlocks.slice(mid);
        leftCol = {
          blocks: lB,
          totalHeightMm: lB.reduce((a, b) => a + b.heightMm, 0),
          linesCount: lB.reduce((a, b) => a + b.lines.length, 0),
        };
        rightCol = {
          blocks: rB,
          totalHeightMm: rB.reduce((a, b) => a + b.heightMm, 0),
          linesCount: rB.reduce((a, b) => a + b.lines.length, 0),
        };
      } else {
        const balanced = balanceIntoTwoColumns(pageBlocks, maxColHeight);
        leftCol = balanced.leftCol;
        rightCol = balanced.rightCol;
        if (!balanced.fits) {
          anyOverflow = true;
        }
      }

      if (leftCol.totalHeightMm > maxColHeight || rightCol.totalHeightMm > maxColHeight) {
        anyOverflow = true;
      }

      pages.push({
        pageNumber: pIdx + 1,
        totalPages: pageChunks.length,
        isFirstPage: isFirst,
        headerTitle: canto.titolo,
        headerAuthor: isFirst ? canto.autore : null,
        headerParams: isFirst
          ? {
              misura: canto.misura,
              bpm_testo: canto.bpm_testo,
              ritmo: canto.ritmo,
              capotasto: canto.capotasto,
            }
          : null,
        fontSizePt,
        arrowSizePt,
        leftColumn: leftCol,
        rightColumn: rightCol,
        warnings: [],
      });
    }

    return {
      pages,
      fontSizePt,
      hasOverflow: anyOverflow,
      hasSingleWordWrap,
      hasTooLongLines,
      warnings: anyOverflow ? ["Uno o più fogli superano la capienza verticale A4."] : [],
    };
  }

  // Caso 1: Canto con direttiva esplicita di colonna
  if (explicitColumnBreak && blocks.length >= 2) {
    // Dividi a metà o al marcatore esplicito
    const splitIdx = (explicitColumnBreakIndex !== null && explicitColumnBreakIndex > 0 && explicitColumnBreakIndex < blocks.length)
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

    const page1: CanzonierePage = {
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      headerTitle: canto.titolo,
      headerAuthor: canto.autore,
      headerParams: {
        misura: canto.misura,
        bpm_testo: canto.bpm_testo,
        ritmo: canto.ritmo,
        capotasto: canto.capotasto,
      },
      fontSizePt,
      arrowSizePt,
      leftColumn: leftCol,
      rightColumn: rightCol,
      warnings: [],
    };

    return {
      pages: [page1],
      fontSizePt,
      hasOverflow,
      hasSingleWordWrap,
      hasTooLongLines,
      warnings,
    };
  }

  // Caso 2: Canto senza forzature, verifica se entra in 1 pagina bilanciando le due colonne
  const singlePageCandidate = balanceIntoTwoColumns(blocks, page1MaxColHeightMm);

  if (singlePageCandidate.fits) {
    const page1: CanzonierePage = {
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      headerTitle: canto.titolo,
      headerAuthor: canto.autore,
      headerParams: {
        misura: canto.misura,
        bpm_testo: canto.bpm_testo,
        ritmo: canto.ritmo,
        capotasto: canto.capotasto,
      },
      fontSizePt,
      arrowSizePt,
      leftColumn: singlePageCandidate.leftCol,
      rightColumn: singlePageCandidate.rightCol,
      warnings: [],
    };

    return {
      pages: [page1],
      fontSizePt,
      hasOverflow: false,
      hasSingleWordWrap,
      hasTooLongLines,
      warnings,
    };
  }

  // Caso 3: Canto lungo distribuito su più pagine A4 (riempimento progressivo tra blocchi)
  const pages: CanzonierePage[] = [];
  let remainingBlocks = [...blocks];
  let pageIndex = 1;

  while (remainingBlocks.length > 0) {
    const isFirst = pageIndex === 1;
    const maxColHeight = isFirst ? page1MaxColHeightMm : page2PlusMaxColHeightMm;

    // Se i blocchi rimanenti possono entrare bilanciati in quest'ultima pagina
    const lastPageCandidate = balanceIntoTwoColumns(remainingBlocks, maxColHeight);
    if (lastPageCandidate.fits) {
      // Regola: l'ultima pagina non deve avere meno di 6 righe se è pagina >= 2
      const totalLastLines =
        lastPageCandidate.leftCol.linesCount + lastPageCandidate.rightCol.linesCount;

      if (pageIndex > 1 && totalLastLines < config.pagination.minLinesLastPage && pages.length > 0) {
        // Sposta un blocco dalla pagina precedente per bilanciare ed evitare pagina vuota
        const prevPage = pages[pages.length - 1];
        if (prevPage) {
          rebalanceLastTwoPages(prevPage, lastPageCandidate);
        }
      }

      pages.push({
        pageNumber: pageIndex,
        totalPages: pageIndex, // aggiornato dopo
        isFirstPage: isFirst,
        headerTitle: canto.titolo,
        headerAuthor: isFirst ? canto.autore : null,
        headerParams: isFirst
          ? {
              misura: canto.misura,
              bpm_testo: canto.bpm_testo,
              ritmo: canto.ritmo,
              capotasto: canto.capotasto,
            }
          : null,
        fontSizePt,
        arrowSizePt,
        leftColumn: lastPageCandidate.leftCol,
        rightColumn: lastPageCandidate.rightCol,
        warnings: [],
      });
      break;
    }

    // Riempimento colonna sinistra poi destra per questa pagina
    const leftBlocks: SongBlock[] = [];
    let leftHeight = 0;

    while (remainingBlocks.length > 0) {
      const b = remainingBlocks[0];
      if (!b) break;
      // Se il singolo blocco è più alto dell'intera colonna, spezzalo con almeno 3 righe per parte
      if (b.heightMm > maxColHeight) {
        const split = splitLargeBlock(b, maxColHeight, fontSizePt, config);
        leftBlocks.push(split.firstPart);
        remainingBlocks[0] = split.secondPart;
        break;
      }

      if (leftHeight + b.heightMm <= maxColHeight || leftBlocks.length === 0) {
        leftBlocks.push(b);
        leftHeight += b.heightMm;
        remainingBlocks.shift();
      } else {
        break;
      }
    }

    const rightBlocks: SongBlock[] = [];
    let rightHeight = 0;

    while (remainingBlocks.length > 0) {
      const b = remainingBlocks[0];
      if (!b) break;
      if (b.heightMm > maxColHeight) {
        const split = splitLargeBlock(b, maxColHeight, fontSizePt, config);
        rightBlocks.push(split.firstPart);
        remainingBlocks[0] = split.secondPart;
        break;
      }

      if (rightHeight + b.heightMm <= maxColHeight || rightBlocks.length === 0) {
        rightBlocks.push(b);
        rightHeight += b.heightMm;
        remainingBlocks.shift();
      } else {
        break;
      }
    }

    const leftCol: ColumnContent = {
      blocks: leftBlocks,
      totalHeightMm: leftHeight,
      linesCount: leftBlocks.reduce((a, b) => a + b.lines.length, 0),
    };
    const rightCol: ColumnContent = {
      blocks: rightBlocks,
      totalHeightMm: rightHeight,
      linesCount: rightBlocks.reduce((a, b) => a + b.lines.length, 0),
    };

    pages.push({
      pageNumber: pageIndex,
      totalPages: pageIndex,
      isFirstPage: isFirst,
      headerTitle: canto.titolo,
      headerAuthor: isFirst ? canto.autore : null,
      headerParams: isFirst
        ? {
            misura: canto.misura,
            bpm_testo: canto.bpm_testo,
            ritmo: canto.ritmo,
            capotasto: canto.capotasto,
          }
        : null,
      fontSizePt,
      arrowSizePt,
      leftColumn: leftCol,
      rightColumn: rightCol,
      warnings: [],
    });

    pageIndex++;
    if (pageIndex > 10) {
      // Sicurezza contro loop infiniti su dati anomali
      warnings.push("Raggiunto limite massimo di 10 pagine per un singolo canto.");
      break;
    }
  }

  // Aggiorna totalPages su tutte le pagine generate
  pages.forEach((p) => {
    p.totalPages = pages.length;
  });

  return {
    pages,
    fontSizePt,
    hasOverflow: false,
    hasSingleWordWrap,
    hasTooLongLines,
    warnings,
  };
}

/**
 * Trova il punto di divisione tra blocchi che minimizza l'altezza della colonna più alta (bilanciamento).
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
    const b = blocks[0];
    if (!b) {
      const emptyCol: ColumnContent = { blocks: [], totalHeightMm: 0, linesCount: 0 };
      return { fits: true, leftCol: emptyCol, rightCol: emptyCol, diffMm: 0 };
    }
    if (b.lines.length >= 6) {
      const mid = Math.ceil(b.lines.length / 2);
      const p1Lines = b.lines.slice(0, mid);
      const p2Lines = b.lines.slice(mid);
      const p1H = calculateBlockHeightMm(p1Lines, 11, CANZONIERE_CONFIG);
      const p2H = calculateBlockHeightMm(p2Lines, 11, CANZONIERE_CONFIG);
      const lB: SongBlock = { id: `${b.id}_c1`, lines: p1Lines, heightMm: p1H };
      const rB: SongBlock = { id: `${b.id}_c2`, lines: p2Lines, heightMm: p2H };
      return {
        fits: p1H <= maxColHeightMm && p2H <= maxColHeightMm,
        leftCol: { blocks: [lB], totalHeightMm: p1H, linesCount: p1Lines.length },
        rightCol: { blocks: [rB], totalHeightMm: p2H, linesCount: p2Lines.length },
        diffMm: Math.abs(p1H - p2H),
      };
    }
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
    totalHeightMm: leftBlocks.reduce((a, b) => a + b.heightMm, 0),
    linesCount: leftBlocks.reduce((a, b) => a + b.lines.length, 0),
  };
  const rightCol: ColumnContent = {
    blocks: rightBlocks,
    totalHeightMm: rightBlocks.reduce((a, b) => a + b.heightMm, 0),
    linesCount: rightBlocks.reduce((a, b) => a + b.lines.length, 0),
  };

  const fits = leftCol.totalHeightMm <= maxColHeightMm && rightCol.totalHeightMm <= maxColHeightMm;

  return { fits, leftCol, rightCol, diffMm: bestDiff };
}

/**
 * Se un singolo blocco è più alto di un'intera colonna, taglialo tra due righe
 * garantendo almeno 3 righe per parte.
 */
function splitLargeBlock(
  block: SongBlock,
  maxColHeightMm: number,
  fontSizePt: number,
  config: CanzoniereConfig
): { firstPart: SongBlock; secondPart: SongBlock } {
  const minLines = config.pagination.minLinesPerBlockSplit; // 3 righe
  const lines = block.lines;

  if (lines.length <= minLines * 2) {
    // Non abbastanza righe per dividere rispettando il vincolo: taglia a metà
    const mid = Math.max(minLines, Math.floor(lines.length / 2));
    const p1 = lines.slice(0, mid);
    const p2 = lines.slice(mid);
    return {
      firstPart: { id: `${block.id}_p1`, lines: p1, heightMm: calculateBlockHeightMm(p1, fontSizePt, config) },
      secondPart: { id: `${block.id}_p2`, lines: p2, heightMm: calculateBlockHeightMm(p2, fontSizePt, config) },
    };
  }

  // Trova il massimo numero di righe che entrano in maxColHeightMm
  let splitIdx = minLines;
  for (let i = minLines; i <= lines.length - minLines; i++) {
    const candidateLines = lines.slice(0, i);
    const h = calculateBlockHeightMm(candidateLines, fontSizePt, config);
    if (h <= maxColHeightMm) {
      splitIdx = i;
    } else {
      break;
    }
  }

  const part1 = lines.slice(0, splitIdx);
  const part2 = lines.slice(splitIdx);

  return {
    firstPart: { id: `${block.id}_p1`, lines: part1, heightMm: calculateBlockHeightMm(part1, fontSizePt, config) },
    secondPart: { id: `${block.id}_p2`, lines: part2, heightMm: calculateBlockHeightMm(part2, fontSizePt, config) },
  };
}

/**
 * Bilancia le ultime due pagine quando l'ultima ha meno di 6 righe.
 */
function rebalanceLastTwoPages(
  prevPage: CanzonierePage,
  lastCandidate: { leftCol: ColumnContent; rightCol: ColumnContent }
) {
  // Sposta l'ultimo blocco della colonna destra della pagina precedente nella prima colonna dell'ultima
  if (prevPage.rightColumn.blocks.length > 1) {
    const moved = prevPage.rightColumn.blocks.pop()!;
    prevPage.rightColumn.totalHeightMm -= moved.heightMm;
    prevPage.rightColumn.linesCount -= moved.lines.length;

    lastCandidate.leftCol.blocks.unshift(moved);
    lastCandidate.leftCol.totalHeightMm += moved.heightMm;
    lastCandidate.leftCol.linesCount += moved.lines.length;
  }
}

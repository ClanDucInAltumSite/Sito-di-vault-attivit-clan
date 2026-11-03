// src/lib/stampa.ts
// Modulo unificato per il Centro Stampa del Vault Scout.
// Estrae e delega la logica nei moduli specializzati:
// - stampa_giochibans.ts (stampa A4 continua giochi e bans)
// - stampa_canzoni.ts (canzoniere A4 due colonne: Chi suona / Chi canta, indice per settori)
// - stampa_odg.ts (scheda A4 ordine del giorno, presenze e scadenze)
// - stampa_shared.ts (funzioni condivise, triggerPrint con data-print scoping)

export * from './stampa_shared';
export * from './stampa_giochibans';
export * from './stampa_canzoni';
export * from './stampa_odg';

// Riconferma e compatibilità per funzioni di utilità di pagina e overflow
import { Canto } from './db';
import { parseChordProAST, ChordProAST } from './chordpro';
import { LayoutSongResult } from '../features/canti/canzoniere_layout';
import {
  loadStampaGiochiBansConfig,
  saveStampaGiochiBansConfig,
  SESSION_STORAGE_GIOCHIBANS_KEY,
  loadPrintableGiochiBansData,
  PrintableGioco,
  PrintableBan,
} from './stampa_giochibans';
import {
  loadStampaCanzoniConfig,
  saveStampaCanzoniConfig,
  SESSION_STORAGE_CANZONI_KEY,
  loadPrintableCanzoniData,
} from './stampa_canzoni';

export const SESSION_STORAGE_SELECTION_KEY = 'stampa_selection';

export interface StampaConfig {
  selectedGiochiIds: string[];
  selectedBansIds: string[];
  selectedCantiIds: string[];
  includeImages: boolean;
  includeCoverAndIndex: boolean;
}

export const DEFAULT_STAMPA_CONFIG: StampaConfig = {
  selectedGiochiIds: [],
  selectedBansIds: [],
  selectedCantiIds: [],
  includeImages: false,
  includeCoverAndIndex: false,
};

/**
 * Carica la configurazione di stampa unificata legacy (per compatibilità).
 * Esegue la migrazione morbida verso le configurazioni separate.
 */
export function loadStampaConfig(): StampaConfig {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { ...DEFAULT_STAMPA_CONFIG };
  }
  try {
    const rawLegacy = window.sessionStorage.getItem(SESSION_STORAGE_SELECTION_KEY);
    if (rawLegacy) {
      const parsed = JSON.parse(rawLegacy);
      return {
        selectedGiochiIds: Array.isArray(parsed.selectedGiochiIds) ? parsed.selectedGiochiIds : [],
        selectedBansIds: Array.isArray(parsed.selectedBansIds) ? parsed.selectedBansIds : [],
        selectedCantiIds: Array.isArray(parsed.selectedCantiIds) ? parsed.selectedCantiIds : [],
        includeImages: Boolean(parsed.includeImages),
        includeCoverAndIndex: Boolean(parsed.includeCoverAndIndex),
      };
    }

    const hasGb = window.sessionStorage.getItem(SESSION_STORAGE_GIOCHIBANS_KEY) !== null;
    const hasCanz = window.sessionStorage.getItem(SESSION_STORAGE_CANZONI_KEY) !== null;
    if (!hasGb && !hasCanz) {
      return { ...DEFAULT_STAMPA_CONFIG };
    }

    const gb = loadStampaGiochiBansConfig();
    const canz = loadStampaCanzoniConfig();
    return {
      selectedGiochiIds: gb.selectedGiochiIds,
      selectedBansIds: gb.selectedBansIds,
      selectedCantiIds: canz.selectedCantiIds,
      includeImages: gb.includeImages,
      includeCoverAndIndex: canz.includeIndex,
    };
  } catch (_e) {
    return { ...DEFAULT_STAMPA_CONFIG };
  }
}

/**
 * Salva la configurazione legacy sincronizzandola con le configurazioni separate.
 */
export function saveStampaConfig(config: StampaConfig): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_SELECTION_KEY, JSON.stringify(config));
  } catch (_e) {
    // Ignore storage errors
  }
  saveStampaGiochiBansConfig({
    selectedGiochiIds: config.selectedGiochiIds,
    selectedBansIds: config.selectedBansIds,
    includeImages: config.includeImages,
  });
  const currentCanz = loadStampaCanzoniConfig();
  saveStampaCanzoniConfig({
    ...currentCanz,
    selectedCantiIds: config.selectedCantiIds,
    includeIndex: config.includeCoverAndIndex,
  });
}

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
 * Stima l'overflow A4 per una pagina di canto.
 */
export function estimatePageOverflow(
  chordproPageText: string,
  isFirstPage: boolean,
  initialFontSizePt = 12
): { fontSizePt: number; hasOverflow: boolean; estimatedHeightPt: number } {
  const lines = chordproPageText.split(/\r?\n/).filter((l) => l.trim() !== '');
  const MAX_PAGE_HEIGHT_PT = 750;
  const headerHeightPt = isFirstPage ? 90 : 35;

  let currentFontPt = initialFontSizePt;
  const FONT_STEPS = [12, 11.5, 11, 10.5, 10, 9.5];

  for (const stepPt of FONT_STEPS) {
    currentFontPt = stepPt;
    const lineHeightPt = currentFontPt * 2.2;
    const contentHeightPt = lines.length * lineHeightPt;
    const totalHeightPt = headerHeightPt + contentHeightPt;

    if (totalHeightPt <= MAX_PAGE_HEIGHT_PT) {
      return {
        fontSizePt: currentFontPt,
        hasOverflow: false,
        estimatedHeightPt: Math.round(totalHeightPt),
      };
    }
  }

  const minLineHeight = 9.5 * 2.2;
  const minTotal = headerHeightPt + lines.length * minLineHeight;
  return {
    fontSizePt: 9.5,
    hasOverflow: true,
    estimatedHeightPt: Math.round(minTotal),
  };
}

/**
 * Misura REALE dell'overflow A4 per una pagina di canto.
 */
export function measureSongPageOverflow(
  chordproPageText: string,
  isFirstPage: boolean,
  meta?: { titolo?: string; autore?: string | null; tonalita?: string | null }
): { fontSizePt: number; hasOverflow: boolean; measuredHeightPx: number } {
  if (typeof document === 'undefined') {
    const est = estimatePageOverflow(chordproPageText, isFirstPage);
    return {
      fontSizePt: est.fontSizePt,
      hasOverflow: est.hasOverflow,
      measuredHeightPx: est.estimatedHeightPt * 1.333,
    };
  }

  let host = document.getElementById('stampa-measure-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'stampa-measure-host';
    host.className = 'stampa-measure-host';
    host.style.cssText = [
      'position: fixed !important',
      'left: -9999px !important',
      'top: -9999px !important',
      'width: 186mm !important',
      'height: 267mm !important',
      'max-height: 267mm !important',
      'overflow: hidden !important',
      'visibility: hidden !important',
      'pointer-events: none !important',
      'box-sizing: border-box !important',
      'font-family: var(--font-sans, system-ui, -apple-system, sans-serif) !important',
      'line-height: 1.4 !important',
      'background: white !important',
      'color: black !important',
      'padding: 0 !important',
      'margin: 0 !important',
      'border: none !important',
    ].join(';');
    document.body.appendChild(host);
  }

  host.textContent = '';
  const pageContainer = document.createElement('div');
  pageContainer.className = 'print-song-page';
  pageContainer.style.width = '100%';
  pageContainer.style.boxSizing = 'border-box';

  if (isFirstPage) {
    const header = document.createElement('div');
    header.className = 'print-song-header';
    header.style.borderBottom = '1pt solid black';
    header.style.marginBottom = '10pt';
    header.style.paddingBottom = '4pt';
    const title = document.createElement('h3');
    title.className = 'print-song-title';
    title.style.fontSize = '16pt';
    title.style.fontWeight = '700';
    title.style.margin = '0 0 2pt';
    title.textContent = meta?.titolo || 'Canto';
    header.appendChild(title);
    if (meta?.autore || meta?.tonalita) {
      const sub = document.createElement('div');
      sub.className = 'print-song-meta';
      sub.style.fontSize = '9.5pt';
      sub.style.fontStyle = 'italic';
      sub.textContent = `${meta?.autore || ''} • Tonalità: ${meta?.tonalita || ''}`;
      header.appendChild(sub);
    }
    pageContainer.appendChild(header);
  } else {
    const reduced = document.createElement('div');
    reduced.className = 'print-song-reduced-header';
    reduced.style.borderBottom = '0.75pt solid #555';
    reduced.style.marginBottom = '8pt';
    reduced.style.paddingBottom = '3pt';
    reduced.style.display = 'flex';
    reduced.style.justifyContent = 'space-between';
    reduced.style.fontWeight = '600';
    reduced.style.fontSize = '10pt';
    const titleSpan = document.createElement('span');
    titleSpan.textContent = meta?.titolo || 'Canto';
    const pagSpan = document.createElement('span');
    pagSpan.textContent = '2/2';
    reduced.appendChild(titleSpan);
    reduced.appendChild(pagSpan);
    pageContainer.appendChild(reduced);
  }

  const ast = parseChordProAST(chordproPageText, 0);
  const body = document.createElement('div');
  body.className = 'print-song-body';

  for (const section of ast.sections) {
    const sectionEl = document.createElement('div');
    const isChorus = section.type === 'chorus';
    const displayLabel = isChorus && (section.label === 'RITORNELLO' || section.label === 'RIT.') ? 'RIT:' : section.label;

    if (isChorus) {
      sectionEl.className = 'song-chorus-block';
      sectionEl.style.borderLeft = '2pt solid black';
      sectionEl.style.paddingLeft = '8pt';
      sectionEl.style.margin = '8pt 0';
      const label = document.createElement('div');
      label.className = 'song-chorus-label';
      label.style.fontWeight = '700';
      label.style.fontSize = '0.85em';
      label.textContent = displayLabel || 'RIT:';
      sectionEl.appendChild(label);
    } else {
      sectionEl.style.margin = '6pt 0';
    }

    const linesToPrint = section.lines.filter((line, lIdx) => {
      if (isChorus && lIdx === 0 && displayLabel) {
        const textOnly = line.units.map((u) => u.lyric || '').join('').trim();
        if (/^RIT[.:]?$/i.test(textOnly)) {
          return false;
        }
      }
      return true;
    });

    for (const line of linesToPrint) {
      const lineEl = document.createElement('div');
      lineEl.className = 'song-line';
      lineEl.style.minHeight = '1.2em';
      lineEl.style.display = 'block';

      for (const unit of line.units) {
        const unitEl = document.createElement('span');
        unitEl.className = 'song-unit';
        unitEl.style.display = 'inline-flex';
        unitEl.style.flexDirection = 'column';
        unitEl.style.verticalAlign = 'bottom';

        if (unit.chord) {
          const chord = document.createElement('span');
          chord.className = 'song-chord print-chord';
          chord.style.fontWeight = '700';
          chord.style.fontSize = '0.82em';
          chord.style.lineHeight = '1.1';
          chord.textContent = unit.chord;
          unitEl.appendChild(chord);
        } else {
          const spacer = document.createElement('span');
          spacer.style.height = '0.82em';
          spacer.style.lineHeight = '1.1';
          spacer.textContent = '\u00A0';
          unitEl.appendChild(spacer);
        }

        const lyric = document.createElement('span');
        lyric.className = 'song-lyric';
        lyric.style.whiteSpace = 'pre';
        lyric.textContent = unit.lyric || ' ';
        unitEl.appendChild(lyric);
        lineEl.appendChild(unitEl);
      }
      sectionEl.appendChild(lineEl);
    }
    body.appendChild(sectionEl);
  }

  pageContainer.appendChild(body);
  host.appendChild(pageContainer);

  if (!host.scrollHeight || host.scrollHeight === 0) {
    if (pageContainer.parentNode === host) {
      host.removeChild(pageContainer);
    }
    const est = estimatePageOverflow(chordproPageText, isFirstPage);
    return {
      fontSizePt: est.fontSizePt,
      hasOverflow: est.hasOverflow,
      measuredHeightPx: est.estimatedHeightPt * 1.333,
    };
  }

  try {
    const targetHeight = host.clientHeight || 1009;
    const FONT_STEPS = [12, 11, 10.2, 9.5];

    for (const stepPt of FONT_STEPS) {
      pageContainer.style.fontSize = `${stepPt}pt`;
      const currentScrollH = host.scrollHeight;
      if (currentScrollH <= targetHeight + 2) {
        return {
          fontSizePt: stepPt,
          hasOverflow: false,
          measuredHeightPx: currentScrollH,
        };
      }
    }

    pageContainer.style.fontSize = '9.5pt';
    const finalScrollH = host.scrollHeight;
    return {
      fontSizePt: 9.5,
      hasOverflow: true,
      measuredHeightPx: finalScrollH,
    };
  } finally {
    if (pageContainer.parentNode === host) {
      host.removeChild(pageContainer);
    }
  }
}

// Compatibilità per vecchi tipi
export interface PrintableSongPage {
  pageIndex: number;
  totalPages: number;
  isFirstPage: boolean;
  rawChordpro: string;
  ast: ChordProAST;
  fontSizePt: number;
  hasOverflow: boolean;
}

export interface PrintableSong {
  canto: Canto;
  pages: PrintableSongPage[];
  pageCount: number;
  hasAnyOverflow: boolean;
  images: { name: string; src: string | null; isOffline: boolean }[];
  canzoniereResult?: LayoutSongResult;
}

export interface PrintableData {
  giochi: PrintableGioco[];
  bans: PrintableBan[];
  canti: PrintableSong[];
  totalSelected: number;
  hasAnyOverflow: boolean;
}

export async function loadPrintableData(config: StampaConfig): Promise<PrintableData> {
  const gbData = await loadPrintableGiochiBansData({
    selectedGiochiIds: config.selectedGiochiIds,
    selectedBansIds: config.selectedBansIds,
    includeImages: config.includeImages,
  });

  const canzData = await loadPrintableCanzoniData({
    selectedCantiIds: config.selectedCantiIds,
    mode: 'suona',
    layoutMode: 'riempi_pagina',
    includeIndex: config.includeCoverAndIndex,
    includeCover: false,
  });

  const cantiLegacy: PrintableSong[] = canzData.items.map((it) => ({
    canto: it.canto,
    pages: it.layoutResult.pages.map((p) => ({
      pageIndex: p.pageNumber,
      totalPages: p.totalPages,
      isFirstPage: p.isFirstPage,
      rawChordpro: it.appliedCanto.testo_chordpro,
      ast: parseChordProAST(it.appliedCanto.testo_chordpro, 0),
      fontSizePt: p.fontSizePt,
      hasOverflow: it.layoutResult.hasOverflow,
    })),
    pageCount: it.pageCount,
    hasAnyOverflow: it.layoutResult.hasOverflow,
    images: [],
    canzoniereResult: it.layoutResult,
  }));

  return {
    giochi: gbData.giochi,
    bans: gbData.bans,
    canti: cantiLegacy,
    totalSelected: gbData.totalSelected + cantiLegacy.length,
    hasAnyOverflow: canzData.hasAnyOverflow,
  };
}

export interface PrintableODG {
  titoloEvento: string;
  dataEvento: string;
  luogoEvento: string;
  punti: { id: string; testo: string; completato: boolean }[];
}

export interface PrintIndexEntry {
  id: string;
  title: string;
  section: 'giochi' | 'bans' | 'canti' | 'odg';
  startPage: number | null;
}

export interface PrintIndexResult {
  giochi: PrintIndexEntry[];
  bans: PrintIndexEntry[];
  canti: PrintIndexEntry[];
  odg: PrintIndexEntry | null;
  totalPages: number;
}

function estimateTextLines(text: string, charsPerLine: number): number {
  if (!text) return 0;
  return text.split('\n').reduce((acc, line) => {
    return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
}

export function computePrintIndex(
  printableData: PrintableData,
  config: StampaConfig,
  printableODG: PrintableODG | null = null
): PrintIndexResult {
  const PAGE_CAPACITY_PT = 800;
  const CHARS_PER_LINE = 100;
  const LINE_H = 13.5;
  const startOffset = config.includeCoverAndIndex ? 3 : 1;

  let curPage = startOffset;
  let curY = 0;

  const giochiEntries: PrintIndexEntry[] = [];
  const bansEntries: PrintIndexEntry[] = [];
  const cantiEntries: PrintIndexEntry[] = [];
  let odgEntry: PrintIndexEntry | null = null;

  // Giochi
  if (printableData.giochi.length > 0) {
    const headerH = 30;
    curY += headerH;

    for (const pg of printableData.giochi) {
      const regLines = estimateTextLines(pg.gioco.regole || '', CHARS_PER_LINE);
      const matLines = pg.gioco.materiali ? estimateTextLines(pg.gioco.materiali, CHARS_PER_LINE) : 0;
      const lines = Math.max(1, regLines + matLines);
      const hasMat = Boolean(pg.gioco.materiali);
      const imagesH = config.includeImages ? pg.images.length * 130 : 0;
      const itemH = 20 + (hasMat ? 14 : 0) + lines * LINE_H + 8 + imagesH;

      if (pg.isShort) {
        if (curY + itemH > PAGE_CAPACITY_PT && curY > headerH) {
          curPage += 1;
          curY = 0;
        }
        giochiEntries.push({
          id: pg.gioco.id,
          title: pg.gioco.nome,
          section: 'giochi',
          startPage: curPage,
        });
        curY += itemH;
      } else {
        giochiEntries.push({
          id: pg.gioco.id,
          title: pg.gioco.nome,
          section: 'giochi',
          startPage: curPage,
        });
        if (curY + itemH > PAGE_CAPACITY_PT) {
          const remainingH = itemH - (PAGE_CAPACITY_PT - curY);
          const extraPages = Math.floor(remainingH / PAGE_CAPACITY_PT);
          curPage += extraPages + 1;
          curY = remainingH % PAGE_CAPACITY_PT;
        } else {
          curY += itemH;
        }
      }
    }
  }

  // Bans
  if (printableData.bans.length > 0) {
    const headerH = 30;
    if (curY + headerH > PAGE_CAPACITY_PT) {
      curPage += 1;
      curY = 0;
    }
    curY += headerH;

    for (const pb of printableData.bans) {
      const testoLines = estimateTextLines(pb.ban.testo || '', CHARS_PER_LINE);
      const gestiLines = pb.ban.note_gesti ? estimateTextLines(pb.ban.note_gesti, CHARS_PER_LINE) : 0;
      const lines = Math.max(1, testoLines + gestiLines);
      const hasGesti = Boolean(pb.ban.note_gesti);
      const imagesH = config.includeImages ? pb.images.length * 130 : 0;
      const itemH = 20 + (hasGesti ? 14 : 0) + lines * LINE_H + 8 + imagesH;

      if (pb.isShort) {
        if (curY + itemH > PAGE_CAPACITY_PT && curY > headerH) {
          curPage += 1;
          curY = 0;
        }
        bansEntries.push({
          id: pb.ban.id,
          title: pb.ban.nome,
          section: 'bans',
          startPage: curPage,
        });
        curY += itemH;
      } else {
        bansEntries.push({
          id: pb.ban.id,
          title: pb.ban.nome,
          section: 'bans',
          startPage: curPage,
        });
        if (curY + itemH > PAGE_CAPACITY_PT) {
          const remainingH = itemH - (PAGE_CAPACITY_PT - curY);
          const extraPages = Math.floor(remainingH / PAGE_CAPACITY_PT);
          curPage += extraPages + 1;
          curY = remainingH % PAGE_CAPACITY_PT;
        } else {
          curY += itemH;
        }
      }
    }
  }

  // Canti
  if (printableData.canti.length > 0) {
    if (curY > 0) {
      curPage += 1;
      curY = 0;
    }

    for (const pc of printableData.canti) {
      const cantoStart = curPage;
      cantiEntries.push({
        id: pc.canto.id,
        title: pc.canto.titolo,
        section: 'canti',
        startPage: cantoStart,
      });
      const numPages = pc.canzoniereResult
        ? Math.max(1, pc.canzoniereResult.declaredPageCount)
        : Math.max(1, pc.pages.length);
      curPage += numPages;
    }
  }

  // ODG
  if (printableODG) {
    if (curY > 0 && printableData.canti.length === 0) {
      curPage += 1;
      curY = 0;
    }
    odgEntry = {
      id: 'odg',
      title: printableODG.titoloEvento,
      section: 'odg',
      startPage: curPage,
    };
    curPage += 1;
  }

  const totalPages = Math.max(1, curPage - 1);

  return {
    giochi: giochiEntries,
    bans: bansEntries,
    canti: cantiEntries,
    odg: odgEntry,
    totalPages,
  };
}

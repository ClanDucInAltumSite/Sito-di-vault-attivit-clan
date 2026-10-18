// src/lib/stampa.ts
// Modulo per la composizione, formattazione, calcolo overflow A4 e persistenza della stampa.
// Formato A4 continuo per Giochi e Bans, pagine separate con intestazione ridotta per Canti,
// supporto immagini allegate offline, copertina e indice opzionali, e modello ODG per Fase 7.

import { Gioco, Ban, Canto, Allegato, getDb } from './db';
import { parseChordProAST, ChordProAST } from './chordpro';
import { resolveAttachmentSource } from './storage-cache';
import { layoutCanzoniereSong, LayoutSongResult } from '../features/canti/canzoniere_layout';

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
 * Carica la configurazione di stampa memorizzata in sessionStorage (o default).
 */
export function loadStampaConfig(): StampaConfig {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { ...DEFAULT_STAMPA_CONFIG };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_SELECTION_KEY);
    if (!raw) return { ...DEFAULT_STAMPA_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      selectedGiochiIds: Array.isArray(parsed.selectedGiochiIds) ? parsed.selectedGiochiIds : [],
      selectedBansIds: Array.isArray(parsed.selectedBansIds) ? parsed.selectedBansIds : [],
      selectedCantiIds: Array.isArray(parsed.selectedCantiIds) ? parsed.selectedCantiIds : [],
      includeImages: Boolean(parsed.includeImages),
      includeCoverAndIndex: Boolean(parsed.includeCoverAndIndex),
    };
  } catch (_e) {
    return { ...DEFAULT_STAMPA_CONFIG };
  }
}

/**
 * Salva la configurazione di stampa in sessionStorage.
 */
export function saveStampaConfig(config: StampaConfig): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_SELECTION_KEY, JSON.stringify(config));
  } catch (_e) {}
}

export interface PrintableSongPage {
  pageIndex: number; // 1-based (es. 1, 2)
  totalPages: number; // Totale pagine del canto
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

export interface PrintableGioco {
  gioco: Gioco;
  isShort: boolean; // < 600 caratteri
  images: { name: string; src: string | null; isOffline: boolean }[];
}

export interface PrintableBan {
  ban: Ban;
  isShort: boolean; // < 600 caratteri
  images: { name: string; src: string | null; isOffline: boolean }[];
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
 * In un foglio A4 con margini di 15mm verticali, l'altezza utile è ~267mm (~756 pt o ~1010 px a 96 DPI).
 * Con font a 12pt e interlinea accordo-testo (2.2em), ogni riga con accordi occupa ~26.4pt.
 * L'intestazione della prima pagina (titolo, autore, metadati) occupa ~90pt.
 * L'intestazione ridotta delle pagine successive occupa ~35pt.
 */
export function estimatePageOverflow(
  chordproPageText: string,
  isFirstPage: boolean,
  initialFontSizePt = 12
): { fontSizePt: number; hasOverflow: boolean; estimatedHeightPt: number } {
  const lines = chordproPageText.split(/\r?\n/).filter((l) => l.trim() !== '');
  const MAX_PAGE_HEIGHT_PT = 750; // Margine di sicurezza A4 (267mm)
  const headerHeightPt = isFirstPage ? 90 : 35;

  let currentFontPt = initialFontSizePt;
  const FONT_STEPS = [12, 11.5, 11, 10.5, 10, 9.5];

  for (const stepPt of FONT_STEPS) {
    currentFontPt = stepPt;
    // Altezza stimata per riga: testo + accordo sovrastante = 2.2 * fontPt
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

  // Se supera anche a 9.5pt (dimensione minima), restituisce hasOverflow = true
  const minLineHeight = 9.5 * 2.2;
  const minTotal = headerHeightPt + lines.length * minLineHeight;
  return {
    fontSizePt: 9.5,
    hasOverflow: true,
    estimatedHeightPt: Math.round(minTotal),
  };
}

/**
 * Misura REALE dell'overflow A4 per una pagina di canto:
 * Crea (o riusa) un contenitore nascosto largo e alto quanto l'area utile di un A4 (186mm x 267mm),
 * con lo stesso CSS di stampa (@media print).
 * Confronta scrollHeight con clientHeight testando i 4 gradini tipografici (12pt, 11pt, 10.2pt, 9.5pt).
 * Se non entra neppure a 9.5pt, restituisce hasOverflow = true per l'avviso utente.
 * Se eseguito fuori dal browser (Node/SSR), ripiega automaticamente sulla stima veloce.
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
    if (section.type === 'chorus') {
      sectionEl.className = 'song-chorus-block';
      sectionEl.style.borderLeft = '2pt solid black';
      sectionEl.style.paddingLeft = '8pt';
      sectionEl.style.margin = '8pt 0';
      const label = document.createElement('div');
      label.className = 'song-chorus-label';
      label.style.fontWeight = '700';
      label.style.fontSize = '0.85em';
      label.textContent = section.label || 'RITORNELLO';
      sectionEl.appendChild(label);
    } else {
      sectionEl.style.margin = '6pt 0';
    }

    for (const line of section.lines) {
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

  // Se l'ambiente DOM non ha un motore di layout attivo (es. Happy-DOM in Vitest dove scrollHeight === 0),
  // ripiega sull'algoritmo di stima deterministico
  if (!host.scrollHeight || host.scrollHeight === 0) {
    const est = estimatePageOverflow(chordproPageText, isFirstPage);
    return {
      fontSizePt: est.fontSizePt,
      hasOverflow: est.hasOverflow,
      measuredHeightPx: est.estimatedHeightPt * 1.333,
    };
  }

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
}

/**
 * Carica gli allegati immagine di un elemento e risolve le sorgenti locali da Cache API.
 */
export async function loadItemPrintImages(
  parentType: 'gioco' | 'ban' | 'canto' | 'evento',
  parentId: string
): Promise<{ name: string; src: string | null; isOffline: boolean }[]> {
  try {
    const db = await getDb();
    const indexField =
      parentType === 'gioco'
        ? 'gioco_id'
        : parentType === 'ban'
        ? 'ban_id'
        : parentType === 'canto'
        ? 'canto_id'
        : 'evento_id';

    const allegati = (await db.getAllFromIndex('allegati', indexField, parentId)) as Allegato[];
    const activeImages = allegati.filter(
      (a) => a.deleted_at === null && a.mime.startsWith('image/') && a.storage_path
    );

    const results: { name: string; src: string | null; isOffline: boolean }[] = [];
    for (const img of activeImages) {
      const publicUrl = `https://lpeiyzwccedtqjbficjo.supabase.co/storage/v1/object/public/allegati/${img.storage_path}`;
      const resolved = await resolveAttachmentSource(publicUrl);
      results.push({
        name: img.nome_file,
        src: resolved.src,
        isOffline: resolved.isOfflineFallback,
      });
    }
    return results;
  } catch (_e) {
    return [];
  }
}

/**
 * Helper per riordinare elementi in un array.
 */
export function moveItemInArray<T>(array: T[], index: number, direction: 'up' | 'down'): T[] {
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= array.length) return array;
  const result = [...array];
  const [removed] = result.splice(index, 1);
  if (removed !== undefined) {
    result.splice(newIndex, 0, removed);
  }
  return result;
}

/**
 * Calcola la lunghezza totale dei caratteri di un elemento (regola < 600 caratteri).
 */
export function getItemCharLength(item: Gioco | Ban): number {
  if ('regole' in item) {
    // Gioco
    return (
      (item.nome?.length || 0) +
      (item.regole?.length || 0) +
      (item.materiali?.length || 0)
    );
  } else {
    // Ban
    return (
      (item.nome?.length || 0) +
      (item.testo?.length || 0) +
      (item.note_gesti?.length || 0)
    );
  }
}

export interface PrintableData {
  giochi: PrintableGioco[];
  bans: PrintableBan[];
  canti: PrintableSong[];
  totalSelected: number;
  hasAnyOverflow: boolean;
}

/**
 * Carica l'intero dataset per la stampa da IndexedDB in ordine di selezione.
 */
export async function loadPrintableData(config: StampaConfig): Promise<PrintableData> {
  const db = await getDb();

  // Giochi
  const allGiochi = (await db.getAll('giochi')) as Gioco[];
  const giochiMap = new Map(allGiochi.filter((g) => g.deleted_at === null).map((g) => [g.id, g]));
  const orderedGiochi: PrintableGioco[] = [];
  for (const id of config.selectedGiochiIds) {
    const g = giochiMap.get(id);
    if (g) {
      const len = getItemCharLength(g);
      const images = config.includeImages ? await loadItemPrintImages('gioco', g.id) : [];
      orderedGiochi.push({
        gioco: g,
        isShort: len < 600,
        images,
      });
    }
  }

  // Bans
  const allBans = (await db.getAll('bans')) as Ban[];
  const bansMap = new Map(allBans.filter((b) => b.deleted_at === null).map((b) => [b.id, b]));
  const orderedBans: PrintableBan[] = [];
  for (const id of config.selectedBansIds) {
    const b = bansMap.get(id);
    if (b) {
      const len = getItemCharLength(b);
      const images = config.includeImages ? await loadItemPrintImages('ban', b.id) : [];
      orderedBans.push({
        ban: b,
        isShort: len < 600,
        images,
      });
    }
  }

  // Canti
  const allCanti = (await db.getAll('canti')) as Canto[];
  const cantiMap = new Map(allCanti.filter((c) => c.deleted_at === null).map((c) => [c.id, c]));
  const orderedCanti: PrintableSong[] = [];
  let globalHasOverflow = false;

  for (const id of config.selectedCantiIds) {
    const c = cantiMap.get(id);
    if (c) {
      const canzoniereResult = layoutCanzoniereSong(c);
      const pageTexts = splitSongIntoPages(c.testo_chordpro);
      const totalPages = canzoniereResult ? canzoniereResult.declaredPageCount : pageTexts.length;
      let songHasOverflow = canzoniereResult.hasOverflow;
      const pages: PrintableSongPage[] = pageTexts.map((text, idx) => {
        const isFirst = idx === 0;
        const overflowResult = measureSongPageOverflow(text, isFirst, {
          titolo: c.titolo,
          autore: c.autore,
          tonalita: c.tonalita,
        });
        if (overflowResult.hasOverflow) {
          songHasOverflow = true;
          globalHasOverflow = true;
        }
        return {
          pageIndex: idx + 1,
          totalPages,
          isFirstPage: isFirst,
          rawChordpro: text,
          ast: parseChordProAST(text, 0),
          fontSizePt: overflowResult.fontSizePt,
          hasOverflow: overflowResult.hasOverflow,
        };
      });

      if (canzoniereResult.hasOverflow) {
        globalHasOverflow = true;
      }

      const images = config.includeImages ? await loadItemPrintImages('canto', c.id) : [];
      orderedCanti.push({
        canto: c,
        pages,
        pageCount: totalPages,
        hasAnyOverflow: songHasOverflow,
        images,
        canzoniereResult,
      });
    }
  }

  return {
    giochi: orderedGiochi,
    bans: orderedBans,
    canti: orderedCanti,
    totalSelected: orderedGiochi.length + orderedBans.length + orderedCanti.length,
    hasAnyOverflow: globalHasOverflow,
  };
}

/**
 * Modello ODG stampabile preparatorio per la Fase 7.
 */
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

/**
 * Calcola la numerazione reale delle pagine per l'Indice del fascicolo A4.
 * - Copertina = Pagina 1 (se attiva).
 * - Indice = Pagina 2 (se attivo).
 * - Giochi & Bans in flusso continuo (somma altezze, break-inside: avoid per elementi brevi, break-inside: auto per lunghi).
 * - Canti: ogni canto inizia su una nuova pagina (break-before: page).
 * - ODG: inizia su nuova pagina (break-before: page).
 * Se il numero non è determinabile, startPage vale null (così l'indice appare senza numeri).
 */
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
  let curY = 0; // vertical points consumed on curPage

  const giochiEntries: PrintIndexEntry[] = [];
  const bansEntries: PrintIndexEntry[] = [];
  const cantiEntries: PrintIndexEntry[] = [];
  let odgEntry: PrintIndexEntry | null = null;

  // 1. GIOCHI (flusso continuo)
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

  // 2. BANS (flusso continuo, segue giochi)
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

  // 3. CANTI (ogni canto inizia su nuova pagina: break-before: page)
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

  // 4. ODG (inizia su nuova pagina se presente)
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

// src/lib/stampa.ts
// Modulo per la composizione, formattazione, calcolo overflow A4 e persistenza della stampa.
// Formato A4 continuo per Giochi e Bans, pagine separate con intestazione ridotta per Canti,
// supporto immagini allegate offline, copertina e indice opzionali, e modello ODG per Fase 7.

import { Gioco, Ban, Canto, Allegato, getDb } from './db';
import { parseChordProAST, ChordProAST } from './chordpro';
import { resolveAttachmentSource } from './storage-cache';

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
      const pageTexts = splitSongIntoPages(c.testo_chordpro);
      const totalPages = pageTexts.length;
      let songHasOverflow = false;
      const pages: PrintableSongPage[] = pageTexts.map((text, idx) => {
        const isFirst = idx === 0;
        const overflowResult = estimatePageOverflow(text, isFirst);
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

      const images = config.includeImages ? await loadItemPrintImages('canto', c.id) : [];
      orderedCanti.push({
        canto: c,
        pages,
        pageCount: totalPages,
        hasAnyOverflow: songHasOverflow,
        images,
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

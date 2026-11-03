// src/lib/stampa_giochibans.ts
// Modulo per la Stampa A4 continua di Giochi e Bans:
// - Formato A4 continuo senza salti forzati
// - Regola elementi brevi (< 600 caratteri) con break-inside: avoid
// - Elementi lunghi (>= 600 caratteri) con break-inside: auto per evitare ampi spazi bianchi
// - Immagini allegate opzionali con risoluzione offline da Cache API
// - Persistenza dedicata in sessionStorage (chiave: stampa_giochibans)

import { Gioco, Ban, Allegato, getDb } from './db';
import { resolveAttachmentSource } from './storage-cache';

export const SESSION_STORAGE_GIOCHIBANS_KEY = 'stampa_giochibans';

export interface StampaGiochiBansConfig {
  selectedGiochiIds: string[];
  selectedBansIds: string[];
  includeImages: boolean;
}

export const DEFAULT_STAMPA_GIOCHIBANS_CONFIG: StampaGiochiBansConfig = {
  selectedGiochiIds: [],
  selectedBansIds: [],
  includeImages: false,
};

/**
 * Carica la configurazione di stampa giochi e bans da sessionStorage (o default).
 */
export function loadStampaGiochiBansConfig(): StampaGiochiBansConfig {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { ...DEFAULT_STAMPA_GIOCHIBANS_CONFIG };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_GIOCHIBANS_KEY);
    if (!raw) return { ...DEFAULT_STAMPA_GIOCHIBANS_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      selectedGiochiIds: Array.isArray(parsed.selectedGiochiIds) ? parsed.selectedGiochiIds : [],
      selectedBansIds: Array.isArray(parsed.selectedBansIds) ? parsed.selectedBansIds : [],
      includeImages: Boolean(parsed.includeImages),
    };
  } catch (_e) {
    return { ...DEFAULT_STAMPA_GIOCHIBANS_CONFIG };
  }
}

/**
 * Salva la configurazione di stampa giochi e bans in sessionStorage.
 */
export function saveStampaGiochiBansConfig(config: StampaGiochiBansConfig): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_GIOCHIBANS_KEY, JSON.stringify(config));
  } catch (_e) {}
}

export interface PrintableImage {
  name: string;
  src: string | null;
  isOffline: boolean;
}

export interface PrintableGioco {
  gioco: Gioco;
  isShort: boolean; // < 600 caratteri
  images: PrintableImage[];
}

export interface PrintableBan {
  ban: Ban;
  isShort: boolean; // < 600 caratteri
  images: PrintableImage[];
}

export interface PrintableGiochiBansData {
  giochi: PrintableGioco[];
  bans: PrintableBan[];
  totalSelected: number;
}

/**
 * Calcola la lunghezza totale dei caratteri di un elemento (regola < 600 caratteri).
 */
export function getItemCharLength(item: Gioco | Ban): number {
  if ('regole' in item) {
    return (
      (item.nome?.length || 0) +
      (item.regole?.length || 0) +
      (item.materiali?.length || 0)
    );
  } else {
    return (
      (item.nome?.length || 0) +
      (item.testo?.length || 0) +
      (item.note_gesti?.length || 0)
    );
  }
}

/**
 * Carica gli allegati immagine di un elemento e risolve le sorgenti locali da Cache API.
 */
export async function loadItemPrintImages(
  parentType: 'gioco' | 'ban',
  parentId: string
): Promise<PrintableImage[]> {
  try {
    const db = await getDb();
    const indexField = parentType === 'gioco' ? 'gioco_id' : 'ban_id';

    const allegati = (await db.getAllFromIndex('allegati', indexField, parentId)) as Allegato[];
    const activeImages = allegati.filter(
      (a) => a.deleted_at === null && a.mime.startsWith('image/') && a.storage_path
    );

    const results: PrintableImage[] = [];
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
 * Carica il dataset per la stampa di Giochi e Bans da IndexedDB in ordine di selezione.
 */
export async function loadPrintableGiochiBansData(
  config: StampaGiochiBansConfig
): Promise<PrintableGiochiBansData> {
  const db = await getDb();

  // 1. Giochi
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

  // 2. Bans
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

  return {
    giochi: orderedGiochi,
    bans: orderedBans,
    totalSelected: orderedGiochi.length + orderedBans.length,
  };
}

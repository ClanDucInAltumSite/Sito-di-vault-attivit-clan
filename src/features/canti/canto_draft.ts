/**
 * src/features/canti/canto_draft.ts
 *
 * Gestione Bozze Locali Automatiche per il Canzoniere (Fase 11D).
 * Salva ogni 2 secondi in IndexedDB (massimo 10 bozze per dispositivo).
 * Non sincronizzata su Supabase, solo locale.
 * Alla riapertura propone "riprendi / elimina".
 * Viene cancellata automaticamente al salvataggio definitivo.
 */

import { openDB, IDBPDatabase } from 'idb';
import { CategoriaCanto } from '../../lib/db';

export interface CantoDraft {
  id?: string; // e.g. "draft-new" or "draft-<cantoId>" or "draft-<timestamp>"
  titolo: string;
  categoria?: CategoriaCanto | null;
  autore: string;
  misura: string;
  bpm_testo: string;
  tempo_bpm?: number | null;
  ritmo: string;
  note?: string; // per retrocompatibilità
  settore?: string;
  capotasto: string;
  tonalita?: string;
  origine?: string | null;
  nota_fonte?: string | null;
  testo_chordpro: string;
  initialCantoId?: string | null;
  updatedAt: number; // timestamp ms
}

const DB_NAME = 'vault_scout_canti_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const MAX_DRAFTS = 10;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDraftsDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Salva o aggiorna una bozza in IndexedDB.
 * Se il numero totale di bozze supera MAX_DRAFTS (10), elimina le più vecchie.
 */
export async function saveCantoDraft(
  draft: Omit<CantoDraft, 'updatedAt'> & { id?: string }
): Promise<string> {
  const id = draft.id || (draft.initialCantoId ? `draft-edit-${draft.initialCantoId}` : 'draft-current');
  const fullDraft: CantoDraft = {
    ...draft,
    id,
    updatedAt: Date.now(),
  };

  // Salva sempre anche su localStorage per persistenza immediata e sincronismo
  try {
    localStorage.setItem('vault_scout_canto_form_draft', JSON.stringify(fullDraft));
  } catch {}

  if (typeof indexedDB === 'undefined') {
    return id;
  }

  try {
    const db = await getDraftsDB();
    await db.put(STORE_NAME, fullDraft);

    // Pruning: mantieni al massimo MAX_DRAFTS bozze
    const all = await db.getAllFromIndex(STORE_NAME, 'updatedAt');
    if (all.length > MAX_DRAFTS) {
      all.sort((a, b) => a.updatedAt - b.updatedAt);
      const toDeleteCount = all.length - MAX_DRAFTS;
      for (let i = 0; i < toDeleteCount; i++) {
        const item = all[i];
        if (item && item.id !== id) {
          await db.delete(STORE_NAME, item.id);
        }
      }
    }

    return id;
  } catch (err) {
    console.warn('[CantoDraft] Errore salvataggio bozza IndexedDB:', err);
    return id;
  }
}

/**
 * Carica l'ultima bozza pertinente salvata.
 */
export async function loadLatestCantoDraft(
  initialCantoId?: string | null
): Promise<CantoDraft | null> {
  try {
    const db = await getDraftsDB();
    if (initialCantoId) {
      const specific = await db.get(STORE_NAME, `draft-edit-${initialCantoId}`);
      if (specific && hasDraftContent(specific)) return specific;
    }

    // Altrimenti cerca la bozza non legata a canti esistenti più recente
    const all = await db.getAllFromIndex(STORE_NAME, 'updatedAt');
    if (!all || all.length === 0) {
      return loadLocalStorageFallback();
    }

    // Ordina per più recente
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    const candidate = initialCantoId
      ? all.find((d) => d.initialCantoId === initialCantoId)
      : all.find((d) => !d.initialCantoId || d.id === 'draft-current');

    if (candidate && hasDraftContent(candidate)) {
      return candidate;
    }

    return null;
  } catch (err) {
    console.warn('[CantoDraft] Errore lettura bozza IndexedDB, fallback localStorage:', err);
    return loadLocalStorageFallback();
  }
}

export function loadCantoDraft(): CantoDraft | null {
  return loadLocalStorageFallback();
}

/**
 * Restituisce l'elenco di tutte le bozze salvate (massimo 10).
 */
export async function listAllCantoDrafts(): Promise<CantoDraft[]> {
  try {
    const db = await getDraftsDB();
    const all = await db.getAll(STORE_NAME);
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    return all.filter(hasDraftContent).slice(0, MAX_DRAFTS);
  } catch (err) {
    console.warn('[CantoDraft] Errore elenco bozze IndexedDB:', err);
    const fallback = loadLocalStorageFallback();
    return fallback ? [fallback] : [];
  }
}

/**
 * Elimina una bozza specifica per ID.
 */
export async function deleteCantoDraft(id: string): Promise<void> {
  try {
    localStorage.removeItem('vault_scout_canto_form_draft');
  } catch {}
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await getDraftsDB();
    await db.delete(STORE_NAME, id);
  } catch (err) {
    console.warn('[CantoDraft] Errore eliminazione bozza IndexedDB:', err);
  }
}

/**
 * Elimina la bozza associata a un canto o la bozza corrente.
 */
export async function clearCantoDraft(initialCantoId?: string | null): Promise<void> {
  try {
    localStorage.removeItem('vault_scout_canto_form_draft');
  } catch {}
  const id = initialCantoId ? `draft-edit-${initialCantoId}` : 'draft-current';
  await deleteCantoDraft(id);
}

/**
 * Helper per verificare se una bozza contiene dati significativi.
 */
function hasDraftContent(draft: CantoDraft): boolean {
  return Boolean(
    (draft.titolo && draft.titolo.trim().length > 0) ||
    (draft.testo_chordpro && draft.testo_chordpro.trim().length > 0)
  );
}

function loadLocalStorageFallback(): CantoDraft | null {
  try {
    const raw = localStorage.getItem('vault_scout_canto_form_draft');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CantoDraft;
    return hasDraftContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Formatta l'orario della bozza in formato leggibile italiano (es. "10:45" o "19/10 alle 10:45").
 */
export function formatDraftTime(timestamp: number): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `oggi alle ${timeStr}`;
    }
    const dayStr = date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    return `il ${dayStr} alle ${timeStr}`;
  } catch {
    return 'in precedenza';
  }
}

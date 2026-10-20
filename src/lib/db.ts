import { openDB, IDBPDatabase } from 'idb';

export const CONTENT_TABLES = [
  'giochi',
  'bans',
  'canti',
  'eventi',
  'odg_punti',
  'allegati',
] as const;

export type ContentTableName = (typeof CONTENT_TABLES)[number];

export interface Gioco {
  id: string;
  nome: string;
  regole: string;
  materiali: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Ban {
  id: string;
  nome: string;
  testo: string;
  note_gesti: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type CategoriaCanto = 'scout' | 'chiesa' | 'esterni';

export interface Canto {
  id: string;
  titolo: string;
  autore: string | null;
  categoria?: CategoriaCanto | null;
  tonalita: string | null;
  ritmo: string | null;
  tempo_bpm: number | null;
  bpm_testo: string | null;
  misura: string | null;
  capotasto: number | null;
  origine?: 'import_pdf' | 'import_docx' | 'manuale' | null;
  nota_fonte?: string | null;
  testo_chordpro: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type TipoEvento = 'riunione' | 'uscita' | 'evento' | 'scadenza' | 'altro';

export interface Evento {
  id: string;
  titolo: string;
  tipo: TipoEvento;
  inizio: string;
  fine: string | null;
  tutto_il_giorno: boolean;
  luogo: string | null;
  descrizione: string | null;
  responsabile: string | null;
  cosa_portare: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OdgPunto {
  id: string;
  evento_id: string;
  testo: string;
  ordine: number;
  completato: boolean;
  riportato_da: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Allegato {
  id: string;
  gioco_id: string | null;
  ban_id: string | null;
  canto_id: string | null;
  evento_id: string | null;
  storage_path: string;
  nome_file: string;
  mime: string;
  dimensione: number;
  ordine: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SyncMeta {
  key: string;
  last_sync_server_time: string | null;
  last_sync_completed_at: string | null;
  table_cursors: Record<string, string>;
  status: 'idle' | 'syncing' | 'error';
  last_error: string | null;
  sync_epoch?: number;
}

export interface RecentItem {
  id: string;
  title: string;
  subtitle: string;
  section: 'giochi' | 'bans' | 'canti' | 'calendario';
  created_at: string;
  isNew: boolean;
  extraChip?: string;
}

const DB_NAME = 'vault_scout_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const table of CONTENT_TABLES) {
          if (!db.objectStoreNames.contains(table)) {
            const store = db.createObjectStore(table, { keyPath: 'id' });
            store.createIndex('updated_at', 'updated_at');
            store.createIndex('deleted_at', 'deleted_at');
            if (table === 'giochi' || table === 'bans') {
              store.createIndex('nome', 'nome');
            } else if (table === 'canti') {
              store.createIndex('titolo', 'titolo');
            } else if (table === 'eventi') {
              store.createIndex('inizio', 'inizio');
            } else if (table === 'odg_punti') {
              store.createIndex('evento_id', 'evento_id');
            } else if (table === 'allegati') {
              store.createIndex('gioco_id', 'gioco_id');
              store.createIndex('ban_id', 'ban_id');
              store.createIndex('canto_id', 'canto_id');
              store.createIndex('evento_id', 'evento_id');
            }
          }
        }

        if (!db.objectStoreNames.contains('sync_meta')) {
          db.createObjectStore('sync_meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Resetta l'istanza singleton del database (utile nei test di isolamento)
 */
export function resetDbInstanceForTesting(): void {
  dbPromise = null;
}

/**
 * Sostituzione Atomica Completa (Full Resync Atomico).
 * Esegue lo svuotamento e riempimento in una SINGOLA transazione readwrite.
 * Se una qualsiasi operazione fallisce, IndexedDB annulla l'intera transazione (rollback),
 * garantendo che nessun dato locale venga perso a metà download.
 */
export async function atomicFullReplace(
  tempData: Record<string, any[]>,
  meta: Partial<SyncMeta>
): Promise<void> {
  const db = await getDb();
  const storeNames = [...CONTENT_TABLES, 'sync_meta'];
  const tx = db.transaction(storeNames, 'readwrite');

  try {
    for (const table of CONTENT_TABLES) {
      const store = tx.objectStore(table);
      await store.clear();
      const records = tempData[table] || [];
      for (const record of records) {
        await store.put(record);
      }
    }

    const metaStore = tx.objectStore('sync_meta');
    const existing = (await metaStore.get('metadata')) as SyncMeta | undefined;
    const updatedMeta: SyncMeta = {
      key: 'metadata',
      last_sync_server_time: meta.last_sync_server_time ?? existing?.last_sync_server_time ?? null,
      last_sync_completed_at: meta.last_sync_completed_at ?? new Date().toISOString(),
      table_cursors: meta.table_cursors ?? existing?.table_cursors ?? {},
      status: meta.status ?? 'idle',
      last_error: meta.last_error ?? null,
      sync_epoch: meta.sync_epoch ?? existing?.sync_epoch ?? 1,
    };
    await metaStore.put(updatedMeta);

    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Ignora errore abort se già fallito
    }
    throw error;
  }
}

/**
 * Scrittura Idempotente per la Sincronizzazione Incrementale.
 * Utilizza store.put() con la chiave primaria 'id'.
 */
export async function upsertRecords(table: ContentTableName, records: any[]): Promise<void> {
  if (!records || records.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(table, 'readwrite');
  const store = tx.objectStore(table);

  for (const record of records) {
    await store.put(record);
  }
  await tx.done;
}

/**
 * Lettura e aggiornamento dei metadati di sincronizzazione.
 */
export async function getSyncMeta(): Promise<SyncMeta> {
  const db = await getDb();
  const meta = await db.get('sync_meta', 'metadata');
  if (!meta) {
    return {
      key: 'metadata',
      last_sync_server_time: null,
      last_sync_completed_at: null,
      table_cursors: {},
      status: 'idle',
      last_error: null,
      sync_epoch: 1,
    };
  }
  return meta;
}

export async function updateSyncMeta(partial: Partial<SyncMeta>): Promise<SyncMeta> {
  const db = await getDb();
  const current = await getSyncMeta();
  const updated: SyncMeta = {
    ...current,
    ...partial,
    key: 'metadata',
  };
  await db.put('sync_meta', updated);
  return updated;
}

/* ==============================================================================
   QUERY HELPERS CON SOFT-DELETE GERARCHICA E ACCESSO LOCALE ESCLUSIVO
   ============================================================================== */

export async function getGiochi(includeDeleted = false): Promise<Gioco[]> {
  const db = await getDb();
  const all = (await db.getAll('giochi')) as Gioco[];
  const filtered = includeDeleted ? all : all.filter((item) => item.deleted_at === null);
  return filtered.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

export async function getBans(includeDeleted = false): Promise<Ban[]> {
  const db = await getDb();
  const all = (await db.getAll('bans')) as Ban[];
  const filtered = includeDeleted ? all : all.filter((item) => item.deleted_at === null);
  return filtered.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

export async function getCanti(includeDeleted = false): Promise<Canto[]> {
  const db = await getDb();
  const all = (await db.getAll('canti')) as Canto[];
  const filtered = includeDeleted ? all : all.filter((item) => item.deleted_at === null);
  return filtered.sort((a, b) => a.titolo.localeCompare(b.titolo, 'it'));
}

export async function getEventi(includeDeleted = false): Promise<Evento[]> {
  const db = await getDb();
  const all = (await db.getAll('eventi')) as Evento[];
  const filtered = includeDeleted ? all : all.filter((item) => item.deleted_at === null);
  return filtered.sort((a, b) => new Date(a.inizio).getTime() - new Date(b.inizio).getTime());
}

/**
 * Soft Delete Gerarchica per ODG Punti:
 * Se il genitore (evento) è eliminato (deleted_at != null), i punti ODG figli
 * vengono AUTOMATICAMENTE nascosti dalla UI, anche se il punto non ha deleted_at.
 * In caso di ripristino del genitore, i figli ricompaiono.
 */
export async function getOdgPunti(eventoId?: string, includeDeleted = false): Promise<OdgPunto[]> {
  const db = await getDb();

  // Verifica stato di cancellazione del genitore se eventoId è specificato
  if (eventoId) {
    let isParentDeleted = false;
    try {
      const parent = (await db.get('eventi', eventoId)) as Evento | undefined;
      if (parent && parent.deleted_at !== null) {
        isParentDeleted = true;
      }
    } catch {
      // ignore
    }
    if (!includeDeleted && isParentDeleted) {
      return []; // Genitore eliminato -> figli nascosti
    }
    let all: OdgPunto[] = [];
    try {
      all = (await db.getAllFromIndex('odg_punti', 'evento_id', eventoId)) as OdgPunto[];
    } catch {
      all = [];
    }
    if (!all || all.length === 0) {
      const allRows = (await db.getAll('odg_punti')) as OdgPunto[];
      all = allRows.filter((p) => p.evento_id === eventoId);
    }
    const filtered = includeDeleted ? all : all.filter((p) => p.deleted_at === null);
    return filtered.sort((a, b) => a.ordine - b.ordine);
  }

  // Se nessun eventoId fornito, carica tutti i punti ma escludi quelli dei genitori eliminati
  const [allPoints, allEventi] = await Promise.all([
    db.getAll('odg_punti') as Promise<OdgPunto[]>,
    db.getAll('eventi') as Promise<Evento[]>,
  ]);

  const activeEventoIds = new Set(
    allEventi.filter((e) => includeDeleted || e.deleted_at === null).map((e) => e.id)
  );

  return allPoints
    .filter((p) => (includeDeleted || p.deleted_at === null) && activeEventoIds.has(p.evento_id))
    .sort((a, b) => a.ordine - b.ordine);
}

/**
 * Soft Delete Gerarchica per Allegati:
 * Se il rispettivo genitore (gioco, ban, canto o evento) è eliminato, l'allegato
 * viene nascosto dalla UI.
 */
export async function getAllegati(
  parentType?: 'gioco' | 'ban' | 'canto' | 'evento',
  parentId?: string,
  includeDeleted = false
): Promise<Allegato[]> {
  const db = await getDb();

  if (parentType && parentId) {
    const parentTable =
      parentType === 'gioco'
        ? 'giochi'
        : parentType === 'ban'
        ? 'bans'
        : parentType === 'canto'
        ? 'canti'
        : 'eventi';

    const parent = await db.get(parentTable, parentId);
    if (!parent || (!includeDeleted && parent.deleted_at !== null)) {
      return []; // Genitore eliminato -> allegati nascosti
    }

    const indexName = `${parentType}_id`;
    let all: Allegato[] = [];
    try {
      all = (await db.getAllFromIndex('allegati', indexName, parentId)) as Allegato[];
    } catch {
      all = [];
    }
    if (!all || all.length === 0) {
      const allRows = (await db.getAll('allegati')) as Allegato[];
      all = allRows.filter((a) => (a as any)[indexName] === parentId);
    }
    return includeDeleted ? all : all.filter((a) => a.deleted_at === null);
  }

  // Filtro globale
  const [allegati, giochi, bans, canti, eventi] = await Promise.all([
    db.getAll('allegati') as Promise<Allegato[]>,
    db.getAll('giochi') as Promise<Gioco[]>,
    db.getAll('bans') as Promise<Ban[]>,
    db.getAll('canti') as Promise<Canto[]>,
    db.getAll('eventi') as Promise<Evento[]>,
  ]);

  const activeGenitori = new Set<string>();
  for (const g of giochi) if (includeDeleted || g.deleted_at === null) activeGenitori.add(g.id);
  for (const b of bans) if (includeDeleted || b.deleted_at === null) activeGenitori.add(b.id);
  for (const c of canti) if (includeDeleted || c.deleted_at === null) activeGenitori.add(c.id);
  for (const e of eventi) if (includeDeleted || e.deleted_at === null) activeGenitori.add(e.id);

  return allegati.filter((a) => {
    if (!includeDeleted && a.deleted_at !== null) return false;
    const parentKey = a.gioco_id || a.ban_id || a.canto_id || a.evento_id;
    return parentKey ? activeGenitori.has(parentKey) : false;
  });
}

/**
 * Conteggio record attivi (non eliminati) per ciascuna sezione principale.
 */
export async function getSectionCounts(): Promise<{
  giochi: number;
  bans: number;
  canti: number;
  calendario: number;
}> {
  const [giochi, bans, canti, eventi] = await Promise.all([
    getGiochi(false),
    getBans(false),
    getCanti(false),
    getEventi(false),
  ]);

  return {
    giochi: giochi.length,
    bans: bans.length,
    canti: canti.length,
    calendario: eventi.length,
  };
}

/**
 * Conteggi grezzi completi (attivi e tombstones) per la vista di collaudo "Stato Dati".
 */
export async function getDetailedCounts(): Promise<
  Record<ContentTableName, { active: number; deleted: number; total: number }>
> {
  const db = await getDb();
  const result: any = {};

  for (const table of CONTENT_TABLES) {
    const all = (await db.getAll(table)) as { deleted_at: string | null }[];
    const active = all.filter((r) => r.deleted_at === null).length;
    const deleted = all.length - active;
    result[table] = { active, deleted, total: all.length };
  }

  return result;
}

/**
 * Elementi aggiunti o aggiornati di recente per la schermata Home.
 */
export async function getRecentItems(limit = 4): Promise<RecentItem[]> {
  const [giochi, bans, canti, eventi] = await Promise.all([
    getGiochi(false),
    getBans(false),
    getCanti(false),
    getEventi(false),
  ]);

  const items: RecentItem[] = [];
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const g of giochi) {
    const age = now - new Date(g.created_at).getTime();
    items.push({
      id: g.id,
      title: g.nome,
      subtitle: g.regole ? g.regole.slice(0, 45) + (g.regole.length > 45 ? '…' : '') : 'Regole e materiali',
      section: 'giochi',
      created_at: g.created_at,
      isNew: age < SEVEN_DAYS_MS,
    });
  }

  for (const b of bans) {
    const age = now - new Date(b.created_at).getTime();
    items.push({
      id: b.id,
      title: b.nome,
      subtitle: b.note_gesti || 'Fuoco di bivacco • Animazione',
      section: 'bans',
      created_at: b.created_at,
      isNew: age < SEVEN_DAYS_MS,
    });
  }

  for (const c of canti) {
    const age = now - new Date(c.created_at).getTime();
    items.push({
      id: c.id,
      title: c.titolo,
      subtitle: c.autore ? `Canzoniere • ${c.autore}` : 'Canzoniere • Con accordi',
      section: 'canti',
      created_at: c.created_at,
      isNew: age < SEVEN_DAYS_MS,
    });
  }

  for (const e of eventi) {
    const age = now - new Date(e.created_at).getTime();
    items.push({
      id: e.id,
      title: e.titolo,
      subtitle: e.luogo ? `${e.tipo} • ${e.luogo}` : `${e.tipo}`,
      section: 'calendario',
      created_at: e.created_at,
      isNew: age < SEVEN_DAYS_MS,
      extraChip: e.tipo,
    });
  }

  // Ordina per data di creazione più recente
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return items.slice(0, limit);
}

/**
 * Prossimo evento in programma (per la card in HomeView).
 */
export async function getNextUpcomingEvent(): Promise<{
  evento: Evento;
  odgCount: number;
  openOdgCount: number;
} | null> {
  const eventi = await getEventi(false);
  const now = new Date();
  // Considera eventi che finiscono nel futuro, oppure che iniziano da oggi in poi
  const upcoming = eventi.filter((e) => {
    const start = new Date(e.inizio);
    const end = e.fine ? new Date(e.fine) : null;
    return end ? end >= now : start >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  if (upcoming.length === 0) return null;

  // Il primo in ordine cronologico
  upcoming.sort((a, b) => new Date(a.inizio).getTime() - new Date(b.inizio).getTime());
  const next = upcoming[0];
  if (!next) return null;
  const odgPoints = await getOdgPunti(next.id, false);
  const openCount = odgPoints.filter((p) => !p.completato).length;

  return {
    evento: next,
    odgCount: odgPoints.length,
    openOdgCount: openCount,
  };
}

if (typeof window !== 'undefined') {
  (window as any).__dbPutRecords = async (tableName: ContentTableName, records: any[]) => {
    const db = await getDb();
    const tx = db.transaction(tableName, 'readwrite');
    for (const r of records) {
      await tx.store.put(r);
    }
    await tx.done;
  };
}

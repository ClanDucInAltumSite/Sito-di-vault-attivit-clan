import { supabase } from './supabase';
import {
  CONTENT_TABLES,
  atomicFullReplace,
  upsertRecords,
  getSyncMeta,
  updateSyncMeta,
  getDb,
} from './db';

export interface SyncState {
  status: 'idle' | 'syncing' | 'error';
  isOnline: boolean;
  lastSyncServerTime: string | null;
  lastSyncCompletedAt: string | null;
  lastError: string | null;
  activeTrigger: string | null;
}

export type SyncListener = (state: SyncState) => void;

const TIMEOUT_INCREMENTAL_MS = 4000; // 4 secondi per pull incrementali
const TIMEOUT_FULL_RESYNC_MS = 25000; // 25 secondi per full resync e primo download
const SAFETY_OVERLAP_MS = 10000; // 10 secondi di sovrapposizione di sicurezza
const TOMBSTONE_RETENTION_MS = 180 * 24 * 60 * 60 * 1000; // 180 giorni

let currentState: SyncState = {
  status: 'idle',
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastSyncServerTime: null,
  lastSyncCompletedAt: null,
  lastError: null,
  activeTrigger: null,
};

const listeners = new Set<SyncListener>();
let isSyncRunning = false;
let pendingSyncRequested = false;
let realtimeChannel: any = null;
let debounceTimer: any = null;

function notifyListeners(): void {
  for (const listener of listeners) {
    listener({ ...currentState });
  }
}

export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  listener({ ...currentState });
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncState(): SyncState {
  return { ...currentState };
}

/**
 * Esegue una Promise con timeout controllato via AbortController.
 */
async function withTimeout<T>(
  promiseFactory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const result = await promiseFactory(controller.signal);
    clearTimeout(timer);
    return result;
  } catch (err: any) {
    clearTimeout(timer);
    if (controller.signal.aborted || err?.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw err;
  }
}

/**
 * Estrae l'orario del server da una risposta Supabase o dall'header Date.
 */
function extractServerTime(data: any[], fallback = new Date().toISOString()): string {
  if (data && data.length > 0) {
    // Il massimo updated_at tra i record ricevuti riflette fedelmente il clock del server
    let maxTime = data[0].updated_at || fallback;
    for (const item of data) {
      if (item.updated_at && item.updated_at > maxTime) {
        maxTime = item.updated_at;
      }
    }
    return maxTime;
  }
  return fallback;
}

/**
 * FULL RESYNC ATOMICO:
 * 1. Scarica tutti i record di tutte le tabelle in un'area di memoria temporanea.
 * 2. Se una qualsiasi tabella fallisce o va in timeout (> 25s), l'intero processo abortisce.
 * 3. MAI svuotare IndexedDB prima del termine del download.
 * 4. Solo a download riuscito, scrive tutto in IndexedDB in una singola transazione atomica.
 */
export async function performFullResync(
  client = supabase,
  trigger = 'manual'
): Promise<void> {
  const tempData: Record<string, any[]> = {};
  const tableCursors: Record<string, string> = {};
  let serverTimeLatest = new Date().toISOString();

  // Scarica tabella per tabella nel buffer temporaneo
  for (const table of CONTENT_TABLES) {
    const records = await withTimeout(
      async (signal) => {
        let query = client.from(table).select('*');
        if ((query as any).abortSignal) {
          query = (query as any).abortSignal(signal);
        }
        const { data, error } = await query;
        if (error) {
          throw new Error(`Errore download tabella ${table}: ${error.message}`);
        }
        return data || [];
      },
      TIMEOUT_FULL_RESYNC_MS,
      `Timeout full resync (25s) sulla tabella ${table}`
    );

    tempData[table] = records;
    const maxT = extractServerTime(records, serverTimeLatest);
    tableCursors[table] = maxT;
    if (maxT > serverTimeLatest) {
      serverTimeLatest = maxT;
    }
  }

  // SCRITTURA ATOMICA IN UNA SOLA TRANSAZIONE (Se fallisce qui, fa rollback automatico)
  await atomicFullReplace(tempData, {
    last_sync_server_time: serverTimeLatest,
    last_sync_completed_at: new Date().toISOString(),
    table_cursors: tableCursors,
    status: 'idle',
    last_error: null,
  });

  currentState = {
    ...currentState,
    status: 'idle',
    lastSyncServerTime: serverTimeLatest,
    lastSyncCompletedAt: new Date().toISOString(),
    lastError: null,
    activeTrigger: trigger,
  };
  notifyListeners();
}

/**
 * SINCRONIZZAZIONE INCREMENTALE:
 * - Cursore per tabella basato su updated_at con sovrapposizione di sicurezza di 10s.
 * - Include tombstones (deleted_at != null).
 * - Scritture idempotenti con store.put().
 * - Timeout rigoroso a 4s per tabella: se fallisce, mantiene intatti i dati locali.
 */
export async function performIncrementalSync(
  client = supabase,
  trigger = 'incremental'
): Promise<void> {
  const meta = await getSyncMeta();
  const cursors = { ...meta.table_cursors };
  let maxServerTime = meta.last_sync_server_time || new Date().toISOString();

  for (const table of CONTENT_TABLES) {
    const rawCursor = cursors[table] || meta.last_sync_server_time;
    let queryCursor = rawCursor;

    // Sovrapposizione di sicurezza di 10s per compensare skew e transazioni concorrenti
    if (queryCursor) {
      const cursorMs = new Date(queryCursor).getTime();
      queryCursor = new Date(Math.max(0, cursorMs - SAFETY_OVERLAP_MS)).toISOString();
    }

    const newRecords = await withTimeout(
      async (signal) => {
        let query = client.from(table).select('*');
        if (queryCursor) {
          query = query.gte('updated_at', queryCursor);
        }
        if ((query as any).abortSignal) {
          query = (query as any).abortSignal(signal);
        }
        const { data, error } = await query;
        if (error) {
          throw new Error(`Errore pull incrementale ${table}: ${error.message}`);
        }
        return data || [];
      },
      TIMEOUT_INCREMENTAL_MS,
      `Timeout pull incrementale (4s) sulla tabella ${table}`
    );

    if (newRecords.length > 0) {
      // Scrittura idempotente in IndexedDB
      await upsertRecords(table, newRecords);
      const batchMaxTime = extractServerTime(newRecords, queryCursor || undefined);
      cursors[table] = batchMaxTime;
      if (batchMaxTime > maxServerTime) {
        maxServerTime = batchMaxTime;
      }
    }
  }

  const nowIso = new Date().toISOString();
  await updateSyncMeta({
    last_sync_server_time: maxServerTime,
    last_sync_completed_at: nowIso,
    table_cursors: cursors,
    status: 'idle',
    last_error: null,
  });

  currentState = {
    ...currentState,
    status: 'idle',
    lastSyncServerTime: maxServerTime,
    lastSyncCompletedAt: nowIso,
    lastError: null,
    activeTrigger: trigger,
  };
  notifyListeners();
}

/**
 * Controller Principale di Sincronizzazione:
 * Decide se eseguire Full Resync (primo avvio, >180gg, o forzato) o Incrementale.
 * Gestisce concorrenza ed evita lock simultanei.
 */
export async function syncNow(
  options: { forceFull?: boolean; trigger?: string; client?: any } = {}
): Promise<void> {
  const { forceFull = false, trigger = 'manual', client = supabase } = options;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    currentState = {
      ...currentState,
      isOnline: false,
      lastError: 'Dispositivo offline: sincronizzazione rimandata.',
    };
    notifyListeners();
    return;
  }

  if (isSyncRunning) {
    pendingSyncRequested = true;
    return;
  }

  isSyncRunning = true;
  currentState = {
    ...currentState,
    status: 'syncing',
    activeTrigger: trigger,
    lastError: null,
  };
  notifyListeners();

  try {
    const meta = await getSyncMeta();
    const isFirstSync = !meta.last_sync_server_time;

    // Controllo se i dati locali risultano persi/vuoti
    const db = await getDb();
    const countGiochi = await db.count('giochi');
    const isDbEmpty = countGiochi === 0 && !meta.last_sync_completed_at;

    // Se l'ultima sync è più vecchia della conservazione dei tombstone (180 giorni)
    const isExpired =
      meta.last_sync_server_time &&
      Date.now() - new Date(meta.last_sync_server_time).getTime() > TOMBSTONE_RETENTION_MS;

    const needsFullResync = forceFull || isFirstSync || isDbEmpty || isExpired;

    if (needsFullResync) {
      await performFullResync(client, trigger);
    } else {
      await performIncrementalSync(client, trigger);
    }
  } catch (error: any) {
    console.warn(`[SyncEngine] Errore sincronizzazione (${trigger}):`, error?.message || error);
    currentState = {
      ...currentState,
      status: 'error',
      lastError: error?.message || 'Errore di sincronizzazione sconosciuto',
    };
    await updateSyncMeta({
      status: 'error',
      last_error: currentState.lastError,
    });
    notifyListeners();
  } finally {
    isSyncRunning = false;
    if (pendingSyncRequested) {
      pendingSyncRequested = false;
      setTimeout(() => {
        syncNow({ trigger: 'queued_request', client });
      }, 500);
    }
  }
}

/**
 * Trigger con Debounce (per eventi Realtime o cambi di visibilità rapidi).
 */
export function debouncedSync(trigger: string, delayMs = 300, client = supabase): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    syncNow({ trigger, client });
  }, delayMs);
}

/**
 * Inizializzazione Triggers Globali e Realtime:
 * 1. Apertura app / Primo download
 * 2. Ritorno online (window.ononline)
 * 3. visibilitychange (ritorno in primo piano)
 * 4. Realtime come SOLO segnale (payload ignorato)
 */
export function initSyncEngine(client = supabase): () => void {
  // Carica stato iniziale salvato in IndexedDB
  getSyncMeta().then((meta) => {
    currentState = {
      ...currentState,
      lastSyncServerTime: meta.last_sync_server_time,
      lastSyncCompletedAt: meta.last_sync_completed_at,
      lastError: meta.last_error,
      status: meta.status,
    };
    notifyListeners();

    // Trigger iniziale all'avvio: eseguito in idle per dare precedenza assoluta al rendering UI e LCP
    if (typeof navigator === 'undefined' || navigator.onLine) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(
          () => {
            syncNow({ trigger: 'app_launch', client });
          },
          { timeout: 1500 }
        );
      } else {
        setTimeout(() => {
          syncNow({ trigger: 'app_launch', client });
        }, 600);
      }
    }
  });

  // Gestione connettività
  const handleOnline = () => {
    currentState.isOnline = true;
    notifyListeners();
    syncNow({ trigger: 'network_online', client });
  };

  const handleOffline = () => {
    currentState.isOnline = false;
    notifyListeners();
  };

  // Gestione visibilità scheda
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      debouncedSync('visibility_change', 400, client);
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // Sottoscrizione Realtime come SOLO SEGNALE
  try {
    realtimeChannel = client
      .channel('vault_scout_sync_trigger')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          // REGOLA FONDAMENTALE: Non fidarsi del payload e non scrivere a mano nel DB.
          // L'evento Realtime funge unicamente da campanello per scatenare una pull incrementale verificata.
          console.log(`[SyncEngine Realtime] Segnale di modifica ricevuto per tabella '${payload.table}'. Scateno pull.`);
          debouncedSync(`realtime_${payload.table}`, 300, client);
        }
      )
      .subscribe((status) => {
        console.log('[SyncEngine Realtime] Canale di ascolto status:', status);
      });
  } catch (err) {
    console.warn('[SyncEngine] Impossibile connettere Realtime channel:', err);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (realtimeChannel && client.removeChannel) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

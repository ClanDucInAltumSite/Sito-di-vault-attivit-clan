import 'fake-indexeddb/auto';

if (typeof WebSocket === 'undefined') {
  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = 1;
    onopen = null;
    onmessage = null;
    onerror = null;
    onclose = null;
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  (globalThis as any).WebSocket = MockWebSocket;
}

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDb,
  resetDbInstanceForTesting,
  getGiochi,
  getCanti,
  getEventi,
  getOdgPunti,
  getAllegati,
  getSectionCounts,
  getDetailedCounts,
  atomicFullReplace,
  upsertRecords,
  getSyncMeta,
  updateSyncMeta,
} from '../src/lib/db';
import {
  performFullResync,
  performIncrementalSync,
  syncNow,
  debouncedSync,
  getSyncState,
} from '../src/lib/sync';

function makeMockQuery(data: any[] = [], error: any = null) {
  const result = { data, error };
  const p: any = Promise.resolve(result);
  p.gte = () => Promise.resolve(result);
  p.order = () => p;
  p.abortSignal = () => p;
  return p;
}

describe('FASE 2 - Test di Sicurezza, Sincronizzazione e Offline (Sync Engine)', () => {
  beforeEach(async () => {
    // Pulisce e ricrea il database per ogni test
    resetDbInstanceForTesting();
    const db = await getDb();
    const stores = ['giochi', 'bans', 'canti', 'eventi', 'odg_punti', 'allegati', 'sync_meta'];
    const tx = db.transaction(stores, 'readwrite');
    for (const s of stores) {
      await tx.objectStore(s).clear();
    }
    await tx.done;
  });

  // TEST 1: Cancellazioni propagate (Tombstones)
  it('1. Cancellazioni propagate: i tombstone aggiornano IndexedDB e nascondono i record dalla UI', async () => {
    // Popolamento iniziale con un gioco attivo
    await upsertRecords('giochi', [
      {
        id: 'gioco-1',
        nome: 'Roverino Tradizionale',
        regole: 'Regole del roverino',
        materiali: 'Cerchio di corda',
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T08:00:00Z',
        deleted_at: null,
      },
    ]);
    await updateSyncMeta({
      last_sync_server_time: '2026-10-15T08:00:00Z',
      table_cursors: { giochi: '2026-10-15T08:00:00Z' },
    });

    let active = await getGiochi();
    expect(active.length).toBe(1);
    expect(active[0].nome).toBe('Roverino Tradizionale');

    // Ricezione di un tombstone tramite sync (deleted_at valorizzato)
    const mockClient = {
      from: (table: string) => ({
        select: () => {
          if (table === 'giochi') {
            return makeMockQuery([
              {
                id: 'gioco-1',
                nome: 'Roverino Tradizionale',
                regole: 'Regole del roverino',
                materiali: 'Cerchio di corda',
                created_at: '2026-10-15T08:00:00Z',
                updated_at: '2026-10-15T09:00:00Z',
                deleted_at: '2026-10-15T09:00:00Z',
              },
            ]);
          }
          return makeMockQuery([]);
        },
      }),
    };

    await performIncrementalSync(mockClient as any);

    // Il record è presente fisicamente in IndexedDB (come tombstone)...
    const counts = await getDetailedCounts();
    expect(counts.giochi.total).toBe(1);
    expect(counts.giochi.deleted).toBe(1);
    expect(counts.giochi.active).toBe(0);

    // ...ma viene filtrato ed escluso dalle query UI
    active = await getGiochi();
    expect(active.length).toBe(0);
  });

  // TEST 2: Ritorno online dopo giorni
  it('2. Ritorno online dopo giorni: il cursore guida la pull incrementale con sovrapposizione di 10s', async () => {
    // Simula ultima sync eseguita 10 giorni fa
    const oldServerTime = '2026-10-05T12:00:00.000Z';
    await updateSyncMeta({
      last_sync_server_time: oldServerTime,
      table_cursors: { giochi: oldServerTime },
    });

    let queriedCursor = '';
    const mockClient = {
      from: (table: string) => ({
        select: () => ({
          gte: (field: string, val: string) => {
            queriedCursor = val;
            return {
              data: [
                {
                  id: 'gioco-recente',
                  nome: 'Alce Rossa',
                  regole: 'In cerchio',
                  materiali: '',
                  created_at: '2026-10-14T10:00:00Z',
                  updated_at: '2026-10-14T10:00:00Z',
                  deleted_at: null,
                },
              ],
              error: null,
            };
          },
        }),
      }),
    };

    await performIncrementalSync(mockClient as any);

    // Verifica che sia stata applicata la sovrapposizione di sicurezza di 10 secondi (12:00:00 - 10s = 11:59:50)
    expect(queriedCursor).toBe('2026-10-05T11:59:50.000Z');

    // Il record è stato scaricato e archiviato
    const giochi = await getGiochi();
    expect(giochi.length).toBe(1);
    expect(giochi[0].nome).toBe('Alce Rossa');

    // Il cursore locale è avanzato al tempo del nuovo record
    const meta = await getSyncMeta();
    expect(meta.table_cursors.giochi).toBe('2026-10-14T10:00:00Z');
  });

  // TEST 3: Full resync che fallisce a metà SENZA perdere i dati locali
  it('3. Full resync atomico che fallisce a metà: i dati locali preesistenti rimangono integri al 100%', async () => {
    // Dati locali preesistenti
    await upsertRecords('giochi', [
      {
        id: 'g-sicuro-1',
        nome: 'Palla Scout',
        regole: 'Regola preesistente',
        materiali: 'Palla',
        created_at: '2026-10-15T00:00:00Z',
        updated_at: '2026-10-15T00:00:00Z',
        deleted_at: null,
      },
    ]);
    await upsertRecords('canti', [
      {
        id: 'c-sicuro-1',
        titolo: 'La Traccia',
        autore: 'Clan',
        tonalita: 'Re',
        ritmo: null,
        tempo_bpm: null,
        misura: null,
        capotasto: null,
        testo_chordpro: '[Re]La traccia...',
        created_at: '2026-10-15T00:00:00Z',
        updated_at: '2026-10-15T00:00:00Z',
        deleted_at: null,
      },
    ]);

    // Client mock dove la terza tabella (canti) fallisce con errore di rete
    const mockFailingClient = {
      from: (table: string) => ({
        select: () => {
          if (table === 'canti') {
            return Promise.resolve({ data: null, error: { message: 'Connessione interrotta durante download canti' } });
          }
          return Promise.resolve({ data: [{ id: 'record-nuovo', nome: 'Nuovo' }], error: null });
        },
      }),
    };

    // Il full resync deve fallire
    await expect(performFullResync(mockFailingClient as any)).rejects.toThrow(
      'Errore download tabella canti'
    );

    // GARANZIA ATOMICA: IndexedDB NON è stato toccato o svuotato!
    const giochiLocali = await getGiochi();
    const cantiLocali = await getCanti();
    expect(giochiLocali.length).toBe(1);
    expect(giochiLocali[0].id).toBe('g-sicuro-1');
    expect(cantiLocali.length).toBe(1);
    expect(cantiLocali[0].id).toBe('c-sicuro-1');
  });

  // TEST 4: Scritture ripetute senza effetti doppi (Idempotenza)
  it('4. Scritture ripetute senza effetti doppi: le pull duplicate non corrompono il database', async () => {
    const record = {
      id: 'ban-idempotente-1',
      nome: 'Il Grillo Parlante',
      testo: 'Testo del ban',
      note_gesti: 'Gesti di gruppo',
      created_at: '2026-10-15T08:00:00Z',
      updated_at: '2026-10-15T08:00:00Z',
      deleted_at: null,
    };

    // Scrive lo stesso record tre volte
    await upsertRecords('bans', [record]);
    await upsertRecords('bans', [record]);
    await upsertRecords('bans', [record]);

    const db = await getDb();
    const all = await db.getAll('bans');
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('ban-idempotente-1');
  });

  // TEST 5: Figli nascosti con genitore eliminato e ripristino (Soft Delete Gerarchica)
  it('5. Soft Delete Gerarchica: i punti ODG e gli allegati vengono nascosti se il genitore è eliminato e ricompaiono al ripristino', async () => {
    // 1. Creazione genitore evento
    await upsertRecords('eventi', [
      {
        id: 'ev-1',
        titolo: 'Uscita sul Monte Subasio',
        tipo: 'uscita',
        inizio: '2026-10-20T08:00:00Z',
        fine: '2026-10-21T18:00:00Z',
        tutto_il_giorno: false,
        luogo: 'Assisi',
        descrizione: '',
        responsabile: 'Capi Clan',
        cosa_portare: 'Zaino',
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T08:00:00Z',
        deleted_at: null,
      },
    ]);

    // 2. Creazione punti ODG figli
    await upsertRecords('odg_punti', [
      {
        id: 'p-1',
        evento_id: 'ev-1',
        testo: 'Organizzazione percorsi e cartografia',
        ordine: 1,
        completato: false,
        riportato_da: null,
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T08:00:00Z',
        deleted_at: null,
      },
      {
        id: 'p-2',
        evento_id: 'ev-1',
        testo: 'Menu della route',
        ordine: 2,
        completato: false,
        riportato_da: null,
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T08:00:00Z',
        deleted_at: null,
      },
    ]);

    // 3. Creazione allegato figlio
    await upsertRecords('allegati', [
      {
        id: 'all-1',
        gioco_id: null,
        ban_id: null,
        canto_id: null,
        evento_id: 'ev-1',
        storage_path: 'subasio_mappa.pdf',
        nome_file: 'subasio_mappa.pdf',
        mime: 'application/pdf',
        dimensione: 2048,
        ordine: 1,
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T08:00:00Z',
        deleted_at: null,
      },
    ]);

    // Genitore attivo -> I figli sono visibili
    let punti = await getOdgPunti('ev-1');
    let allegati = await getAllegati('evento', 'ev-1');
    expect(punti.length).toBe(2);
    expect(allegati.length).toBe(1);

    // Genitore eliminato con soft-delete (deleted_at != null)
    await upsertRecords('eventi', [
      {
        id: 'ev-1',
        titolo: 'Uscita sul Monte Subasio',
        tipo: 'uscita',
        inizio: '2026-10-20T08:00:00Z',
        fine: null,
        tutto_il_giorno: false,
        luogo: null,
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T09:00:00Z',
        deleted_at: '2026-10-15T09:00:00Z',
      },
    ]);

    // I figli sono AUTOMATICAMENTE nascosti, anche se i loro deleted_at sono null!
    punti = await getOdgPunti('ev-1');
    allegati = await getAllegati('evento', 'ev-1');
    expect(punti.length).toBe(0);
    expect(allegati.length).toBe(0);

    // Ripristino del genitore (deleted_at torna a null)
    await upsertRecords('eventi', [
      {
        id: 'ev-1',
        titolo: 'Uscita sul Monte Subasio',
        tipo: 'uscita',
        inizio: '2026-10-20T08:00:00Z',
        fine: null,
        tutto_il_giorno: false,
        luogo: null,
        descrizione: null,
        responsabile: null,
        cosa_portare: null,
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T10:00:00Z',
        deleted_at: null,
      },
    ]);

    // I figli ricompaiono istantaneamente
    punti = await getOdgPunti('ev-1');
    allegati = await getAllegati('evento', 'ev-1');
    expect(punti.length).toBe(2);
    expect(allegati.length).toBe(1);
  });

  // TEST 6: Realtime ignorato come payload
  it('6. Realtime come solo segnale: il payload viene ignorato e scatena una pull incrementale verificata', async () => {
    let pullTriggered = false;
    await updateSyncMeta({
      last_sync_server_time: '2026-10-15T08:00:00Z',
      table_cursors: { giochi: '2026-10-15T08:00:00Z' },
    });

    const mockClient = {
      from: (table: string) => ({
        select: () => {
          pullTriggered = true;
          if (table === 'giochi') {
            return makeMockQuery([
              {
                id: 'gioco-verificato',
                nome: 'Caccia al Tesoro Legittima',
                regole: 'Verificata da query',
                materiali: '',
                created_at: '2026-10-15T10:00:00Z',
                updated_at: '2026-10-15T10:00:00Z',
                deleted_at: null,
              },
            ]);
          }
          return makeMockQuery([]);
        },
      }),
    };

    // Esegue il trigger
    debouncedSync('realtime_giochi', 10, mockClient as any);

    // Attende l'esecuzione del debounce
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(pullTriggered).toBe(true);

    const giochi = await getGiochi();
    expect(giochi.length).toBe(1);
    expect(giochi[0].nome).toBe('Caccia al Tesoro Legittima');

    // Il payload diretto malevolo non è mai stato scritto
    const db = await getDb();
    const hacked = await db.get('giochi', 'hacked-id');
    expect(hacked).toBeUndefined();
  });

  // TEST 7: Timeout senza schermate vuote
  it('7. Timeout della pull incrementale: gestisce l\'errore senza corrompere i dati locali né causare schermate vuote', async () => {
    // Popola dati locali
    await upsertRecords('giochi', [
      {
        id: 'g-locale',
        nome: 'Alce Rossa',
        regole: 'Presente in cache',
        materiali: '',
        created_at: '2026-10-15T00:00:00Z',
        updated_at: '2026-10-15T00:00:00Z',
        deleted_at: null,
      },
    ]);
    await updateSyncMeta({ last_sync_server_time: '2026-10-15T00:00:00Z' });

    // Client mock che va in stallo/timeout simulato
    const mockHangingClient = {
      from: () => ({
        select: () => ({
          gte: () =>
            new Promise((_, reject) => {
              // Simula interruzione per timeout
              setTimeout(() => reject(new Error('Timeout pull incrementale (4s)')), 30);
            }),
        }),
      }),
    };

    await syncNow({ forceFull: false, trigger: 'test_timeout', client: mockHangingClient as any });

    // Lo stato passa a 'error', registrando l'anomalia
    const state = getSyncState();
    expect(state.status).toBe('error');
    expect(state.lastError).toContain('Timeout');

    // La UI NON è vuota: i dati locali preesistenti sono completamente intatti e servibili
    const giochi = await getGiochi();
    expect(giochi.length).toBe(1);
    expect(giochi[0].nome).toBe('Alce Rossa');

    const counts = await getSectionCounts();
    expect(counts.giochi).toBe(1);
  });

  // TEST 8: Sync Epoch mismatch e pulizia record fantasma
  it('8. Sync Epoch mismatch: un record eliminato fisicamente sul server mentre il client è offline viene rimosso al ritorno online grazie all\'epoca', async () => {
    // 1. Client possiede localmente un gioco sincronizzato in epoca 1
    await upsertRecords('giochi', [
      {
        id: 'g-fantasma',
        nome: 'Gioco da eliminare fisicamente',
        regole: 'Regola...',
        materiali: '',
        created_at: '2026-10-15T00:00:00Z',
        updated_at: '2026-10-15T00:00:00Z',
        deleted_at: null,
      },
    ]);
    await updateSyncMeta({
      last_sync_server_time: '2026-10-15T00:00:00Z',
      sync_epoch: 1,
      table_cursors: { giochi: '2026-10-15T00:00:00Z' },
    });

    let giochi = await getGiochi();
    expect(giochi.length).toBe(1);
    expect(giochi[0].id).toBe('g-fantasma');

    // 2. Mentre il client è offline, sul server g-fantasma viene eliminato fisicamente senza tombstone
    // e l'epoca viene incrementata a 2 tramite bump_sync_epoch().
    // Sul server la tabella giochi ora è vuota (o contiene altri record, ma non g-fantasma).
    const mockClientWithNewEpoch = {
      from: (table: string) => {
        if (table === 'system_meta') {
          return {
            select: () => ({
              eq: (field: string, val: string) => ({
                maybeSingle: () => Promise.resolve({ data: { key: 'sync_epoch', value: 2 }, error: null }),
              }),
            }),
          };
        }
        // Le altre tabelle sul server restituiscono array vuoti (il record è stato cancellato fisicamente)
        return {
          select: () => {
            const p: any = Promise.resolve({ data: [], error: null });
            p.gte = () => Promise.resolve({ data: [], error: null });
            p.abortSignal = () => p;
            return p;
          },
        };
      },
    };

    // 3. Il client torna online ed esegue syncNow()
    await syncNow({ forceFull: false, trigger: 'online_reconnect', client: mockClientWithNewEpoch as any });

    // 4. Il client deve aver rilevato che serverEpoch (2) !== localEpoch (1),
    // scatenando un Full Resync atomico che ha ripulito il record fantasma!
    giochi = await getGiochi();
    expect(giochi.length).toBe(0);

    const meta = await getSyncMeta();
    expect(meta.sync_epoch).toBe(2);
  });

  // TEST 9: Tabella system_meta mancante o con errore 404/non creata
  it('9. system_meta mancante o errore query: non forza Full Resync, non genera errori e prosegue con la sync incrementale', async () => {
    // 1. Client possiede già un record e un cursore
    await upsertRecords('giochi', [
      {
        id: 'g-stabile',
        nome: 'Gioco Stabile',
        regole: 'Regola...',
        materiali: '',
        created_at: '2026-10-15T00:00:00Z',
        updated_at: '2026-10-15T00:00:00Z',
        deleted_at: null,
      },
    ]);
    await updateSyncMeta({
      last_sync_server_time: '2026-10-15T00:00:00Z',
      sync_epoch: 1,
      table_cursors: { giochi: '2026-10-15T00:00:00Z' },
    });

    let fullResyncCalled = false;
    const mockClientWithMissingSystemMeta = {
      from: (table: string) => {
        if (table === 'system_meta') {
          return {
            select: () => ({
              eq: () => ({
                // Simula tabella non ancora creata (404 o 42P01)
                maybeSingle: () => Promise.resolve({
                  data: null,
                  error: { code: '42P01', message: 'relation "system_meta" does not exist' },
                }),
              }),
            }),
          };
        }
        return {
          select: () => {
            const p: any = Promise.resolve({ data: [], error: null });
            p.gte = () => Promise.resolve({ data: [], error: null });
            p.abortSignal = () => {
              fullResyncCalled = true;
              return p;
            };
            return p;
          },
        };
      },
    };

    await syncNow({ forceFull: false, trigger: 'routine_sync', client: mockClientWithMissingSystemMeta as any });

    // Lo stato deve rimanere 'idle' senza errori
    const state = getSyncState();
    expect(state.status).toBe('idle');
    expect(state.lastError).toBeNull();

    // Il record esistente rimane integro
    const giochi = await getGiochi();
    expect(giochi.length).toBe(1);
    expect(giochi[0].id).toBe('g-stabile');

    // Non è stato scatenato il Full Resync atomico (fullResyncCalled rimane false)
    expect(fullResyncCalled).toBe(false);
  });
});



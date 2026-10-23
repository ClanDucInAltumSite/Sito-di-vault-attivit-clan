import { supabase } from './supabase';
import {
  CONTENT_TABLES,
  ContentTableName,
  Gioco,
  Ban,
  Canto,
  Evento,
  OdgPunto,
  TipoEvento,
  Allegato,
  getDb,
  getEventi,
  getOdgPunti,
  upsertRecords,
} from './db';
import { I18N } from './i18n';
import { isEventoDataDaDefinire } from './calendario';

export interface TrashItem {
  id: string;
  table: ContentTableName;
  title: string;
  subtitle: string;
  deleted_at: string;
}

/**
 * Punto di estensione per la rimozione fisica dei file da Supabase Storage (Fase 5).
 * Documentato in docs/DECISIONS.md (ADR-0009).
 */
async function deleteAssociatedStorageFiles(table: ContentTableName, id: string): Promise<void> {
  try {
    const db = await getDb();
    let pathsToRemove: string[] = [];

    if (table === 'allegati') {
      const all = (await db.get('allegati', id)) as Allegato | undefined;
      if (all?.storage_path) {
        pathsToRemove.push(all.storage_path);
      }
    } else {
      const field =
        table === 'giochi'
          ? 'gioco_id'
          : table === 'bans'
          ? 'ban_id'
          : table === 'canti'
          ? 'canto_id'
          : 'evento_id';

      const allegati = (await db.getAllFromIndex('allegati', field, id)) as Allegato[];
      pathsToRemove = allegati.map((a) => a.storage_path).filter(Boolean);

      // Elimina anche i record allegati corrispondenti
      for (const a of allegati) {
        await supabase.from('allegati').delete().eq('id', a.id);
        await db.delete('allegati', a.id);
      }
    }

    if (pathsToRemove.length > 0) {
      await supabase.storage.from('allegati').remove(pathsToRemove);
    }
  } catch (err) {
    console.warn('[Storage Cleanup] Errore durante la rimozione dei file da storage:', err);
  }
}

/**
 * Salva o aggiorna un gioco (online-only).
 */
export async function saveGioco(input: {
  id?: string;
  nome: string;
  regole: string;
  materiali?: string;
}): Promise<Gioco> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  let savedRecord: Gioco;

  if (input.id) {
    const { data, error } = await supabase
      .from('giochi')
      .update({
        nome: input.nome.trim(),
        regole: input.regole.trim(),
        materiali: (input.materiali || '').trim(),
        updated_at: now,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  } else {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `g_${Date.now()}`;
    const { data, error } = await supabase
      .from('giochi')
      .insert({
        id: newId,
        nome: input.nome.trim(),
        regole: input.regole.trim(),
        materiali: (input.materiali || '').trim(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  }

  // Scrivi subito in locale per reattività immediata
  await upsertRecords('giochi', [savedRecord]);
  return savedRecord;
}

/**
 * Salva o aggiorna un ban (online-only).
 */
export async function saveBan(input: {
  id?: string;
  nome: string;
  testo: string;
  note_gesti?: string;
}): Promise<Ban> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  let savedRecord: Ban;

  if (input.id) {
    const { data, error } = await supabase
      .from('bans')
      .update({
        nome: input.nome.trim(),
        testo: input.testo.trim(),
        note_gesti: (input.note_gesti || '').trim(),
        updated_at: now,
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  } else {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}`;
    const { data, error } = await supabase
      .from('bans')
      .insert({
        id: newId,
        nome: input.nome.trim(),
        testo: input.testo.trim(),
        note_gesti: (input.note_gesti || '').trim(),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  }

  await upsertRecords('bans', [savedRecord]);
  return savedRecord;
}

/**
 * Salva o aggiorna un canto con accordi (online-only).
 */
export async function saveCanto(input: {
  id?: string;
  titolo: string;
  autore?: string | null;
  categoria?: 'scout' | 'chiesa' | 'esterni' | null;
  tonalita?: string | null;
  ritmo?: string | null;
  tempo_bpm?: number | null;
  bpm_testo?: string | null;
  misura?: string | null;
  capotasto?: number | null;
  origine?: 'import_pdf' | 'import_docx' | 'manuale' | null;
  nota_fonte?: string | null;
  testo_chordpro: string;
}): Promise<Canto> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  let savedRecord: Canto;

  const rawBpmTesto = (input.bpm_testo || '').trim() || null;
  // Se tempo_bpm non è passato ma bpm_testo contiene un numero, estraiamo un intero ragionevole per il metronomo
  let calculatedBpm = typeof input.tempo_bpm === 'number' && !isNaN(input.tempo_bpm) ? input.tempo_bpm : null;
  if (calculatedBpm === null && rawBpmTesto) {
    const numMatch = rawBpmTesto.match(/\d+/);
    if (numMatch) {
      const parsed = parseInt(numMatch[0], 10);
      if (parsed >= 30 && parsed <= 300) {
        calculatedBpm = parsed;
      }
    }
  }

  const payload: any = {
    titolo: input.titolo.trim(),
    autore: (input.autore || '').trim() || null,
    categoria: input.categoria !== undefined ? input.categoria : null,
    tonalita: (input.tonalita || '').trim() || null,
    ritmo: (input.ritmo || '').trim() || null,
    tempo_bpm: calculatedBpm,
    bpm_testo: rawBpmTesto || (calculatedBpm !== null ? String(calculatedBpm) : null),
    misura: (input.misura || '').trim() || null,
    capotasto: typeof input.capotasto === 'number' && !isNaN(input.capotasto) ? input.capotasto : null,
    origine: input.origine || null,
    nota_fonte: (input.nota_fonte || '').trim() || null,
    testo_chordpro: input.testo_chordpro.trim(),
    updated_at: now,
  };

  const newId = input.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}`);

  const executeSupabaseSave = async (includeBpmTesto: boolean) => {
    const currentPayload: Record<string, any> = { ...payload };
    if (!includeBpmTesto) {
      delete currentPayload.bpm_testo;
    }

    if (input.id) {
      return await supabase
        .from('canti')
        .update(currentPayload)
        .eq('id', input.id)
        .select()
        .single();
    } else {
      return await supabase
        .from('canti')
        .insert({
          ...currentPayload,
          id: newId,
          created_at: now,
          deleted_at: null,
        })
        .select()
        .single();
    }
  };

  let { data, error } = await executeSupabaseSave(true);

  // Se una colonna non esiste sul server Supabase (migrazione SQL mancante),
  // NON salvare in silenzio perdendo dati: segnala esplicitamente all'amministratore la migrazione da eseguire.
  if (error) {
    const msg = error.message || '';
    if (msg.includes('categoria')) {
      throw new Error("Migrazione 0007 non applicata: la colonna 'categoria' non esiste nel database Supabase. Esegui 0007_canti_categoria.sql nel SQL Editor di Supabase.");
    }
    if (msg.includes('origine') || msg.includes('nota_fonte')) {
      throw new Error("Migrazione 0008 non applicata: la colonna 'origine' o 'nota_fonte' non esiste nel database Supabase. Esegui 0008_canti_origine_fonte.sql nel SQL Editor di Supabase.");
    }
    if (msg.includes('bpm_testo')) {
      throw new Error('Migrazione 0006 non applicata: salvataggio annullato. Esegui la migrazione SQL nel database Supabase per abilitare la colonna bpm_testo.');
    }
    if ((error as any).code === 'PGRST204') {
      throw new Error(`Migrazione SQL non applicata nel database Supabase (${msg || 'colonna mancante'}). Esegui le migrazioni in supabase/migrations/ nel SQL Editor.`);
    }
    throw new Error(error.message);
  }
  savedRecord = data;

  // Nel record locale IndexedDB preserviamo bpm_testo se passato, garantendo la reattività dell'interfaccia
  if (payload.bpm_testo && !savedRecord.bpm_testo) {
    savedRecord.bpm_testo = payload.bpm_testo;
  }

  await upsertRecords('canti', [savedRecord]);
  return savedRecord;
}

/**
 * Salva o aggiorna un evento del calendario (online-only).
 * Valida che fine >= inizio (se fine è specificata).
 */
export async function saveEvento(input: {
  id?: string;
  titolo: string;
  tipo: TipoEvento;
  inizio: string;
  fine?: string | null;
  tutto_il_giorno?: boolean;
  luogo?: string | null;
  descrizione?: string | null;
  responsabile?: string | null;
  cosa_portare?: string | null;
}): Promise<Evento> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const titolo = input.titolo.trim();
  if (!titolo) {
    throw new Error('Il titolo dell\'evento è obbligatorio.');
  }

  if (input.fine && new Date(input.fine).getTime() < new Date(input.inizio).getTime()) {
    throw new Error(I18N.calendario.erroreDateFine);
  }

  const now = new Date().toISOString();
  let savedRecord: Evento;

  const payload = {
    titolo,
    tipo: input.tipo,
    inizio: input.inizio,
    fine: input.fine ? input.fine : null,
    tutto_il_giorno: Boolean(input.tutto_il_giorno),
    luogo: (input.luogo || '').trim() || null,
    descrizione: (input.descrizione || '').trim() || null,
    responsabile: (input.responsabile || '').trim() || null,
    cosa_portare: (input.cosa_portare || '').trim() || null,
    updated_at: now,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from('eventi')
      .update(payload)
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  } else {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `e_${Date.now()}`;
    const { data, error } = await supabase
      .from('eventi')
      .insert({
        ...payload,
        id: newId,
        created_at: now,
        deleted_at: null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  }

  await upsertRecords('eventi', [savedRecord]);
  return savedRecord;
}

/**
 * Salva o aggiorna un punto all'Ordine del Giorno (online-only).
 */
export async function saveOdgPunto(input: {
  id?: string;
  evento_id: string;
  testo: string;
  ordine?: number;
  completato?: boolean;
  riportato_da?: string | null;
}): Promise<OdgPunto> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const testo = input.testo.trim();
  if (!testo) {
    throw new Error('Il testo del punto ODG è obbligatorio.');
  }

  const now = new Date().toISOString();
  let savedRecord: OdgPunto;

  if (input.id) {
    const updatePayload: any = {
      testo,
      updated_at: now,
    };
    if (typeof input.ordine === 'number') updatePayload.ordine = input.ordine;
    if (typeof input.completato === 'boolean') updatePayload.completato = input.completato;
    if (input.riportato_da !== undefined) updatePayload.riportato_da = input.riportato_da;

    const { data, error } = await supabase
      .from('odg_punti')
      .update(updatePayload)
      .eq('id', input.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  } else {
    let assignedOrdine = input.ordine;
    if (typeof assignedOrdine !== 'number') {
      const existing = await getOdgPunti(input.evento_id, true);
      const maxOrd = existing.reduce((max, p) => Math.max(max, p.ordine), -1);
      assignedOrdine = maxOrd + 1;
    }

    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `odg_${Date.now()}`;
    const { data, error } = await supabase
      .from('odg_punti')
      .insert({
        id: newId,
        evento_id: input.evento_id,
        testo,
        ordine: assignedOrdine,
        completato: Boolean(input.completato),
        riportato_da: input.riportato_da || null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    savedRecord = data;
  }

  await upsertRecords('odg_punti', [savedRecord]);
  return savedRecord;
}

/**
 * Spunta/despunta un punto ODG (online-only, riservato ad admin).
 */
export async function toggleOdgPunto(id: string, completato: boolean): Promise<OdgPunto> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('odg_punti')
    .update({ completato, updated_at: now })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await upsertRecords('odg_punti', [data]);
  return data;
}

/**
 * Riordina una lista di punti ODG assegnando 'ordine' in base alla sequenza fornita.
 */
export async function reorderOdgPunti(_eventoId: string, orderedIds: string[]): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  const db = await getDb();

  for (let i = 0; i < orderedIds.length; i++) {
    const pointId = orderedIds[i];
    if (!pointId) continue;

    const { data, error } = await supabase
      .from('odg_punti')
      .update({ ordine: i, updated_at: now })
      .eq('id', pointId)
      .select();

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error('Operazione non autorizzata: permessi di amministratore mancanti.');
    }

    const local = await db.get('odg_punti', pointId);
    if (local) {
      local.ordine = i;
      local.updated_at = now;
      await db.put('odg_punti', local);
    }
  }
}

/**
 * Trova la prossima riunione futura programmata rispetto alla data inizio specificata.
 */
export async function findNextFutureMeeting(currentInizio: string): Promise<Evento | null> {
  const allEvents = await getEventi(false);
  const currentTime = new Date(currentInizio).getTime();

  // 1. Prima controlla se c'è una riunione aperta "data da definire" creata appositamente per la prossima riunione
  const tbdMeeting = allEvents.find(
    (e) => e.tipo === 'riunione' && isEventoDataDaDefinire(e) && e.deleted_at === null
  );
  if (tbdMeeting) {
    return tbdMeeting;
  }

  // 2. Altrimenti cerca la prossima riunione futura programmata
  const futureMeetings = allEvents.filter(
    (e) => e.tipo === 'riunione' && !isEventoDataDaDefinire(e) && new Date(e.inizio).getTime() > currentTime && e.deleted_at === null
  );

  futureMeetings.sort((a, b) => new Date(a.inizio).getTime() - new Date(b.inizio).getTime());
  return futureMeetings[0] || null;
}

/**
 * Riporta tutti i punti ODG non completati dall'evento sorgente alla riunione di destinazione.
 * Imposta il campo 'riportato_da' sull'id del punto di origine.
 */
export async function forwardUnfinishedOdgPunti(
  fromEventoId: string,
  toEventoId: string
): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const fromPoints = await getOdgPunti(fromEventoId, false);
  const unfinished = fromPoints.filter((p) => !p.completato && p.deleted_at === null);

  if (unfinished.length === 0) return 0;

  // Carica i punti della riunione di destinazione (compresi cancellati per non ricreare duplicati)
  const toExisting = await getOdgPunti(toEventoId, true);
  const alreadyForwardedSourceIds = new Set<string>(
    toExisting
      .filter((p) => p.riportato_da !== null && p.riportato_da !== undefined)
      .map((p) => p.riportato_da as string)
  );

  // Filtra solo i punti che NON sono ancora stati riportati verso questa riunione
  const toForward = unfinished.filter((p) => !alreadyForwardedSourceIds.has(p.id));
  if (toForward.length === 0) return 0;

  let nextOrdine = toExisting.reduce((max, p) => Math.max(max, p.ordine), -1) + 1;

  const now = new Date().toISOString();
  const newRecords: OdgPunto[] = [];

  for (const point of toForward) {
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `odg_${Date.now()}_${Math.random()}`;
    const payload = {
      id: newId,
      evento_id: toEventoId,
      testo: point.testo,
      ordine: nextOrdine++,
      completato: false,
      riportato_da: point.id,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    const { data, error } = await supabase
      .from('odg_punti')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    newRecords.push(data);
  }

  await upsertRecords('odg_punti', newRecords);
  return newRecords.length;
}

/**
 * Soft delete di un record (imposta deleted_at = now() sia su Supabase che in IndexedDB).
 */
export async function softDeleteRecord(table: ContentTableName, id: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id)
    .select();

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Operazione non autorizzata: permessi di amministratore mancanti.');
  }

  const db = await getDb();
  const item = await db.get(table, id);
  if (item) {
    item.deleted_at = now;
    item.updated_at = now;
    await db.put(table, item);
  }
}

/**
 * Ripristino di un record dal cestino (imposta deleted_at = null).
 */
export async function restoreRecord(table: ContentTableName, id: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(table)
    .update({ deleted_at: null, updated_at: now })
    .eq('id', id)
    .select();

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Operazione non autorizzata: permessi di amministratore mancanti.');
  }

  const db = await getDb();
  const item = await db.get(table, id);
  if (item) {
    item.deleted_at = null;
    item.updated_at = now;
    await db.put(table, item);
  }
}

/**
 * Eliminazione definitiva permanente di un singolo record.
 */
export async function hardDeleteRecord(table: ContentTableName, id: string): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  await deleteAssociatedStorageFiles(table, id);

  const { data, error } = await supabase.from(table).delete().eq('id', id).select();
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Operazione non autorizzata: permessi di amministratore mancanti.');
  }

  const db = await getDb();
  await db.delete(table, id);

  // Incrementa l'epoca sul server per forzare il Full Resync atomico sui client offline
  try {
    await supabase.rpc('bump_sync_epoch');
  } catch (err) {
    console.warn('[Admin] Impossibile invocare bump_sync_epoch (migrazione non ancora applicata?):', err);
  }
}

/**
 * Recupera tutti gli elementi attualmente nel cestino (con deleted_at != null).
 */
export async function getTrashItems(): Promise<TrashItem[]> {
  const db = await getDb();
  const items: TrashItem[] = [];

  for (const table of CONTENT_TABLES) {
    const all = await db.getAll(table);
    for (const record of all) {
      if (record.deleted_at) {
        let title = '';
        let subtitle = '';

        if (table === 'giochi') {
          title = record.nome;
          subtitle = 'Gioco';
        } else if (table === 'bans') {
          title = record.nome;
          subtitle = 'Ban';
        } else if (table === 'canti') {
          title = record.titolo;
          subtitle = 'Canto';
        } else if (table === 'eventi') {
          title = record.titolo;
          subtitle = `Evento • ${record.tipo}`;
        } else if (table === 'odg_punti') {
          title = record.testo;
          subtitle = 'Punto ODG';
        } else if (table === 'allegati') {
          title = record.nome_file;
          subtitle = `Allegato • ${record.mime}`;
        }

        items.push({
          id: record.id,
          table,
          title: title || record.id,
          subtitle,
          deleted_at: record.deleted_at,
        });
      }
    }
  }

  items.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());
  return items;
}

/**
 * Svuotamento Cestino: elimina definitivamente i record contrassegnati.
 * Se olderThanDays è fornito, elimina solo quelli eliminati più di N giorni fa (es. 180 giorni).
 * Altrimenti svuota tutto il cestino.
 */
export async function purgeTrash(olderThanDays = 180): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  const trash = await getTrashItems();
  const now = Date.now();
  const thresholdMs = olderThanDays * 24 * 60 * 60 * 1000;
  const expiredItems = trash.filter((item) => (now - new Date(item.deleted_at).getTime()) >= thresholdMs);

  // 1. Rimuovi prima i file fisici da Supabase Storage con l'API Storage
  for (const item of expiredItems) {
    try {
      await deleteAssociatedStorageFiles(item.table, item.id);
    } catch (storageErr) {
      console.warn(`[Storage] Errore rimozione file associati a ${item.table}/${item.id}:`, storageErr);
    }
  }

  // 2. Poi invoca l'RPC admin per la pulizia delle righe scadute (> 180 giorni)
  if (olderThanDays >= 180) {
    try {
      await supabase.rpc('purge_old_tombstones');
    } catch (err) {
      console.warn('[Admin] RPC purge_old_tombstones non eseguibile (migrazione non ancora applicata?):', err);
    }
  }

  // 3. Elimina fisicamente i singoli record rimasti ed aggiorna IndexedDB
  let count = 0;
  for (const item of expiredItems) {
    await hardDeleteRecord(item.table, item.id);
    count++;
  }

  return count;
}

/**
 * Esportazione completa dell'archivio in un file JSON scaricabile localmente.
 */
export async function exportBackupJson(): Promise<void> {
  const db = await getDb();
  const backupData: Record<string, any> = {
    export_date: new Date().toISOString(),
    app: 'Vault Scout - Duc In Altum',
    schema_version: 1,
    tables: {},
  };

  for (const table of CONTENT_TABLES) {
    backupData.tables[table] = await db.getAll(table);
  }

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vault-scout-backup-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Esportazione facoltativa dell'elenco completo dei file allegati (percorsi, dimensioni, URL diretti).
 * Permette ai capi di conservare una lista dettagliata di tutti i file presenti in Storage
 * e di riscaricarli facilmente anche all'esterno dell'applicazione.
 */
export async function exportAttachmentsManifestJson(): Promise<void> {
  const db = await getDb();
  const allegati = await db.getAll('allegati');
  const activeAllegati = allegati.filter((a) => !a.deleted_at);

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://lpeiyzwccedtqjbficjo.supabase.co';

  const manifest = {
    export_date: new Date().toISOString(),
    total_files: activeAllegati.length,
    total_bytes: activeAllegati.reduce((acc, a) => acc + (a.dimensione || 0), 0),
    note: "Questo file contiene l'elenco e gli URL di tutti i file salvati nello Storage Supabase. I file possono essere scaricati singolarmente tramite gli URL indicati.",
    files: activeAllegati.map((a) => ({
      id: a.id,
      nome_file: a.nome_file,
      storage_path: a.storage_path,
      mime: a.mime,
      dimensione_bytes: a.dimensione,
      url_download: `${SUPABASE_URL}/storage/v1/object/public/allegati/${a.storage_path}`,
      associato_a: a.gioco_id ? `gioco:${a.gioco_id}` : a.ban_id ? `ban:${a.ban_id}` : a.canto_id ? `canto:${a.canto_id}` : a.evento_id ? `evento:${a.evento_id}` : 'non_associato',
      created_at: a.created_at,
    })),
  };

  const jsonString = JSON.stringify(manifest, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const dateStr = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vault-scout-allegati-manifest-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface BackupPreviewItem {
  table: ContentTableName;
  id: string;
  title: string;
  action: 'insert' | 'update' | 'skip_older';
  currentUpdatedAt?: string;
  backupUpdatedAt: string;
  record: any;
}

export interface BackupPreviewDiff {
  valid: boolean;
  error?: string;
  exportDate?: string;
  totalInBackup: number;
  toInsert: BackupPreviewItem[];
  toUpdate: BackupPreviewItem[];
  skippedOlder: BackupPreviewItem[];
}

/**
 * Valida lo schema del file di backup JSON e genera l'anteprima delle modifiche (diff)
 * senza toccare né scrivere nel database locale o remoto.
 * Rifiuta schemi malformati o non conformi.
 */
export async function validateAndPreviewBackupJson(jsonString: string): Promise<BackupPreviewDiff> {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    return {
      valid: false,
      error: `File JSON non valido o corrotto: ${err.message}`,
      totalInBackup: 0,
      toInsert: [],
      toUpdate: [],
      skippedOlder: [],
    };
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.tables || typeof parsed.tables !== 'object') {
    return {
      valid: false,
      error: 'Formato backup non conforme: manca la sezione "tables" con i dati.',
      totalInBackup: 0,
      toInsert: [],
      toUpdate: [],
      skippedOlder: [],
    };
  }

  const db = await getDb();
  const toInsert: BackupPreviewItem[] = [];
  const toUpdate: BackupPreviewItem[] = [];
  const skippedOlder: BackupPreviewItem[] = [];
  let totalCount = 0;

  for (const table of CONTENT_TABLES) {
    const rawRows = parsed.tables[table];
    if (!rawRows) continue;

    if (!Array.isArray(rawRows)) {
      return {
        valid: false,
        error: `La tabella "${table}" nel backup deve essere un array di record.`,
        totalInBackup: 0,
        toInsert: [],
        toUpdate: [],
        skippedOlder: [],
      };
    }

    const currentRows = await db.getAll(table);
    const currentMap = new Map<string, any>(currentRows.map((r) => [r.id, r]));

    for (const record of rawRows) {
      if (!record || typeof record !== 'object' || !record.id || !record.created_at || !record.updated_at) {
        return {
          valid: false,
          error: `Record malformato nella tabella "${table}": manca id, created_at o updated_at.`,
          totalInBackup: 0,
          toInsert: [],
          toUpdate: [],
          skippedOlder: [],
        };
      }

      totalCount++;
      const current = currentMap.get(record.id);
      const title = record.nome || record.titolo || record.testo || record.nome_file || record.id;

      if (!current) {
        toInsert.push({
          table,
          id: record.id,
          title,
          action: 'insert',
          backupUpdatedAt: record.updated_at,
          record,
        });
      } else {
        const backupTime = new Date(record.updated_at).getTime();
        const currentTime = new Date(current.updated_at).getTime();

        if (backupTime > currentTime) {
          toUpdate.push({
            table,
            id: record.id,
            title,
            action: 'update',
            currentUpdatedAt: current.updated_at,
            backupUpdatedAt: record.updated_at,
            record,
          });
        } else {
          // Protezione: non sovrascrivere silenziosamente record con data uguale o più recente!
          skippedOlder.push({
            table,
            id: record.id,
            title,
            action: 'skip_older',
            currentUpdatedAt: current.updated_at,
            backupUpdatedAt: record.updated_at,
            record,
          });
        }
      }
    }
  }

  return {
    valid: true,
    exportDate: parsed.export_date,
    totalInBackup: totalCount,
    toInsert,
    toUpdate,
    skippedOlder,
  };
}

/**
 * Applica le modifiche del backup preventivamente validate con conferma esplicita dell'admin.
 * Inserisce solo i nuovi e aggiorna quelli con timestamp più recente, preservando l'integrità.
 */
export async function executeBackupImport(diff: BackupPreviewDiff): Promise<{ inserted: number; updated: number; skipped: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error(I18N.status.offlineNotice);
  }

  if (!diff.valid) {
    throw new Error(diff.error || 'Backup non valido');
  }

  const itemsToApply = [...diff.toInsert, ...diff.toUpdate];
  let inserted = 0;
  let updated = 0;

  // Raggruppa per tabella
  const byTable = new Map<ContentTableName, any[]>();
  for (const item of itemsToApply) {
    const list = byTable.get(item.table) || [];
    list.push(item.record);
    byTable.set(item.table, list);
    if (item.action === 'insert') inserted++;
    else updated++;
  }

  for (const [table, records] of byTable.entries()) {
    // Upsert su Supabase con la sessione Admin corrente
    for (const record of records) {
      const { error } = await supabase.from(table).upsert(record);
      if (error) {
        throw new Error(`Errore durante l'importazione nella tabella ${table}: ${error.message}`);
      }
    }

    // Scrittura locale IndexedDB
    await upsertRecords(table, records);
  }

  // Incrementa l'epoca sul server se possibile per allineare gli altri dispositivi
  try {
    await supabase.rpc('bump_sync_epoch');
  } catch (_e) {
    // Prosegue se RPC non supportata
  }

  return {
    inserted,
    updated,
    skipped: diff.skippedOlder.length,
  };
}

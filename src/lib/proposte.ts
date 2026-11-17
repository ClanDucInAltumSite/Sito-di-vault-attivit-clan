// src/lib/proposte.ts
// Modulo per la gestione delle proposte da parte di utenti non-admin,
// feedback ottimistico locale, moderazione admin e circuit breaker anti-flood (20 req / 2s).

import { openDB, IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import { saveGioco, saveBan, saveCanto } from './admin_actions';
import { saveVademecumItem } from './vademecum';

export type PropostaTabella = 'canti' | 'giochi' | 'bans' | 'canovacci';
export type PropostaStato = 'in_attesa' | 'approvata' | 'rifiutata';

export interface PropostaItem {
  id: string;
  tabella: PropostaTabella;
  titolo: string;
  dati: Record<string, any>;
  proponente_nome?: string | null;
  device_id: string;
  ip?: string;
  stato: PropostaStato;
  motivo_rifiuto?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface BlockedIpItem {
  ip: string;
  reason: string;
  blocked_at: string;
  is_blocked: boolean;
  unblocked_at?: string | null;
}

export type Proposta = PropostaItem;
export type BlockedIpRecord = BlockedIpItem;

const PROPOSTE_DB_NAME = 'vault_scout_proposte_db';
const PROPOSTE_DB_VERSION = 1;

let proposteDbPromise: Promise<IDBPDatabase> | null = null;

function getProposteDb(): Promise<IDBPDatabase> {
  if (!proposteDbPromise) {
    proposteDbPromise = openDB(PROPOSTE_DB_NAME, PROPOSTE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('proposte_locali')) {
          const store = db.createObjectStore('proposte_locali', { keyPath: 'id' });
          store.createIndex('tabella', 'tabella');
          store.createIndex('device_id', 'device_id');
          store.createIndex('stato', 'stato');
          store.createIndex('created_at', 'created_at');
        }
      },
    });
  }
  return proposteDbPromise;
}

// Gestione Device ID persistente per identificare il dispositivo locale
export function getDeviceId(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'node-device-id';
  }
  let deviceId = localStorage.getItem('vault_scout_device_id');
  if (!deviceId) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      deviceId = crypto.randomUUID();
    } else {
      deviceId = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }
    localStorage.setItem('vault_scout_device_id', deviceId);
  }
  return deviceId;
}

// Listeners per aggiornamenti reattivi
type ProposteListener = () => void;
const listeners = new Set<ProposteListener>();

export function subscribeProposte(callback: ProposteListener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifySubscribers() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.error('Errore listener proposte:', err);
    }
  }
}

// Memoria locale finestre temporali per Circuit Breaker client-side
let clientSubmissionTimestamps: number[] = [];

export function isLocalCircuitBreakerBlocked(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  return localStorage.getItem('vault_scout_ip_blocked') === 'true';
}

export function unblockLocalCircuitBreaker(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('vault_scout_ip_blocked');
    localStorage.removeItem('vault_scout_ip_blocked_reason');
    localStorage.removeItem('vault_scout_ip_blocked_at');
  }
  clientSubmissionTimestamps = [];
  notifySubscribers();
}

/**
 * Verifica il circuit breaker client-side:
 * se vengono registrate 20 o piu richieste nell'arco di 2 secondi,
 * il dispositivo viene bloccato in blacklist locale permanente
 * sbloccabile unicamente dal pannello Admin.
 */
function checkClientCircuitBreaker(): void {
  if (isLocalCircuitBreakerBlocked()) {
    throw new Error(
      'Accesso temporaneamente sospeso per questo dispositivo. Contattare un Capo o amministratore per la riabilitazione.'
    );
  }

  const now = Date.now();
  clientSubmissionTimestamps.push(now);

  // Mantieni unicamente i timestamp degli ultimi 2000 ms (2 secondi)
  clientSubmissionTimestamps = clientSubmissionTimestamps.filter((t) => t >= now - 2000);

  if (clientSubmissionTimestamps.length >= 20) {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('vault_scout_ip_blocked', 'true');
      localStorage.setItem(
        'vault_scout_ip_blocked_reason',
        'Rilevato flood anomalo (>= 20 richieste in 2 secondi)'
      );
      localStorage.setItem('vault_scout_ip_blocked_at', new Date().toISOString());
    }
    notifySubscribers();
    throw new Error(
      'Rilevata frequenza anomala di richieste (>= 20 in 2s). Blocco di sicurezza attivato. Solo un amministratore puo riabilitare questo dispositivo.'
    );
  }
}

// Invia una proposta (accessibile a qualsiasi utente, senza password)
export async function inviaProposta(
  tabella: PropostaTabella,
  titolo: string,
  dati: Record<string, any>,
  proponenteNome?: string | null
): Promise<PropostaItem> {
  // 1. Controllo Circuit Breaker locale
  checkClientCircuitBreaker();

  const deviceId = getDeviceId();
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `prop-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const item: PropostaItem = {
    id,
    tabella,
    titolo: titolo.trim(),
    dati,
    proponente_nome: proponenteNome?.trim() || null,
    device_id: deviceId,
    stato: 'in_attesa',
    created_at: nowIso,
  };

  // 2. Salva subito nella IndexedDB locale (feedback ottimistico immediato)
  const db = await getProposteDb();
  await db.put('proposte_locali', item);

  // 3. Se online, invia a Supabase
  try {
    const { error } = await supabase.from('proposte').insert({
      id: item.id,
      tabella: item.tabella,
      titolo: item.titolo,
      dati: item.dati,
      proponente_nome: item.proponente_nome,
      device_id: item.device_id,
      stato: 'in_attesa',
      created_at: item.created_at,
    });

    if (error) {
      if (
        error.message.includes('bloccato') ||
        error.message.includes('sospeso') ||
        error.code === 'P0001'
      ) {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('vault_scout_ip_blocked', 'true');
          localStorage.setItem('vault_scout_ip_blocked_reason', error.message);
          localStorage.setItem('vault_scout_ip_blocked_at', new Date().toISOString());
        }
        notifySubscribers();
        throw new Error(error.message);
      }
      console.warn('Avviso invio proposta a Supabase (salvata localmente):', error.message);
    }
  } catch (err: any) {
    if (
      err.message.includes('bloccato') ||
      err.message.includes('sospeso') ||
      err.message.includes('frequenza anomala')
    ) {
      throw err;
    }
    // Fallback: se la rete fallisce, la proposta rimane memorizzata localmente
  }

  notifySubscribers();
  return item;
}

// Recupera le proposte locali in attesa visibili SOLO a questo dispositivo
export async function getProposteLocali(tabella?: PropostaTabella): Promise<PropostaItem[]> {
  const db = await getProposteDb();
  const all = (await db.getAll('proposte_locali')) as PropostaItem[];
  const deviceId = getDeviceId();

  return all.filter((p) => {
    if (p.device_id !== deviceId) return false;
    if (p.stato !== 'in_attesa') return false;
    if (tabella && p.tabella !== tabella) return false;
    return true;
  });
}

// Recupera le proposte per la visualizzazione nelle liste di sezione (Giochi, Bans, Canti, Canovacci):
// - Per utenti non-admin: mostra SOLO le proposte create da questo dispositivo (in attesa)
// - Per gli Admin: mostra TUTTE le proposte in attesa dal server Supabase e da locale, così da poterle approvare al volo!
export async function getPropostePerVisualizzazione(
  tabella: PropostaTabella,
  isAdmin: boolean
): Promise<PropostaItem[]> {
  const localList = await getProposteLocali(tabella);

  if (!isAdmin) {
    return localList;
  }

  // Se è Admin, recupera tutte le proposte pendenti dal server Supabase per questa tabella
  try {
    const { data, error } = await supabase
      .from('proposte')
      .select('*')
      .eq('tabella', tabella)
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const map = new Map<string, PropostaItem>();
      for (const item of data as PropostaItem[]) {
        map.set(item.id, item);
      }
      for (const item of localList) {
        map.set(item.id, item);
      }
      return Array.from(map.values());
    }
  } catch (err) {
    console.warn('Recupero proposte remote per visualizzazione admin fallito:', err);
  }

  // Fallback locale per l'admin se offline
  const db = await getProposteDb();
  const all = (await db.getAll('proposte_locali')) as PropostaItem[];
  return all.filter((p) => p.stato === 'in_attesa' && p.tabella === tabella);
}

// Ritira/elimina una proposta locale da parte dell'utente prima dell'approvazione
export async function ritiraPropostaLocale(propostaId: string): Promise<void> {
  const db = await getProposteDb();
  await db.delete('proposte_locali', propostaId);

  try {
    await supabase.from('proposte').delete().eq('id', propostaId);
  } catch (_err) {
    // Silenzioso
  }

  notifySubscribers();
}

// --- SEZIONE AMMINISTRAZIONE ---

// Recupera tutte le proposte in attesa per la revisione admin
export async function getProposteAdmin(): Promise<PropostaItem[]> {
  try {
    const { data, error } = await supabase
      .from('proposte')
      .select('*')
      .eq('stato', 'in_attesa')
      .order('created_at', { ascending: false });

    if (!error && data) {
      return data as PropostaItem[];
    }
  } catch (err) {
    console.warn('Recupero proposte da Supabase non riuscito, uso fallback locale:', err);
  }

  // Fallback se Supabase non raggiungibile
  const db = await getProposteDb();
  const all = (await db.getAll('proposte_locali')) as PropostaItem[];
  return all.filter((p) => p.stato === 'in_attesa');
}

// Approva una proposta: inserisce i dati nella tabella ufficiale e aggiorna lo stato
export async function approvaPropostaAdmin(proposta: PropostaItem): Promise<void> {
  // 1. Inserisce nel catalogo ufficiale a seconda della sezione
  try {
    if (proposta.tabella === 'giochi') {
      await saveGioco({
        nome: proposta.dati.nome || proposta.titolo,
        regole: proposta.dati.regole || '',
        materiali: proposta.dati.materiali || '',
      });
    } else if (proposta.tabella === 'bans') {
      await saveBan({
        nome: proposta.dati.nome || proposta.titolo,
        testo: proposta.dati.testo || '',
        note_gesti: proposta.dati.note_gesti || '',
        link: proposta.dati.link || null,
      });
    } else if (proposta.tabella === 'canti') {
      await saveCanto({
        titolo: proposta.dati.titolo || proposta.titolo,
        autore: proposta.dati.autore || null,
        categoria: proposta.dati.categoria || 'scout',
        tonalita: proposta.dati.tonalita || null,
        misura: proposta.dati.misura || null,
        tempo_bpm: proposta.dati.tempo_bpm || null,
        bpm_testo: proposta.dati.bpm_testo || null,
        ritmo: proposta.dati.ritmo || null,
        capotasto: proposta.dati.capotasto || null,
        origine: proposta.dati.origine || 'manuale',
        nota_fonte: proposta.dati.nota_fonte || null,
        testo_chordpro: proposta.dati.testo_chordpro || '',
      });
    } else if (proposta.tabella === 'canovacci') {
      await saveVademecumItem({
        section: 'canovaccio',
        titolo: proposta.dati.titolo || proposta.titolo,
        descrizioneBreve: proposta.dati.descrizioneBreve || '',
        contenuto: proposta.dati.contenuto || '',
        pdfNome: proposta.dati.pdfNome || null,
        pdfDataUrl: proposta.dati.pdfDataUrl || null,
        pdfSize: proposta.dati.pdfSize || null,
        fotoCopertinaUrl: proposta.dati.fotoCopertinaUrl || null,
      });
    }
  } catch (_err) {
    // Fallback: se la scrittura online fallisce (offline o test), salva direttamente su IndexedDB locale
    const { upsertRecords } = await import('./db');
    const now = new Date().toISOString();
    if (proposta.tabella === 'giochi') {
      await upsertRecords('giochi', [{
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `g_${Date.now()}`,
        nome: proposta.dati.nome || proposta.titolo,
        regole: proposta.dati.regole || '',
        materiali: proposta.dati.materiali || '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }]);
    } else if (proposta.tabella === 'bans') {
      await upsertRecords('bans', [{
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `b_${Date.now()}`,
        nome: proposta.dati.nome || proposta.titolo,
        testo: proposta.dati.testo || '',
        note_gesti: proposta.dati.note_gesti || '',
        link: proposta.dati.link || null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }]);
    } else if (proposta.tabella === 'canti') {
      await upsertRecords('canti', [{
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c_${Date.now()}`,
        titolo: proposta.dati.titolo || proposta.titolo,
        autore: proposta.dati.autore || null,
        categoria: proposta.dati.categoria || 'scout',
        tonalita: proposta.dati.tonalita || null,
        misura: proposta.dati.misura || null,
        tempo_bpm: proposta.dati.tempo_bpm || null,
        bpm_testo: proposta.dati.bpm_testo || null,
        ritmo: proposta.dati.ritmo || null,
        capotasto: proposta.dati.capotasto || null,
        origine: proposta.dati.origine || 'manuale',
        nota_fonte: proposta.dati.nota_fonte || null,
        testo_chordpro: proposta.dati.testo_chordpro || '',
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }]);
    } else if (proposta.tabella === 'canovacci') {
      await saveVademecumItem({
        section: 'canovaccio',
        titolo: proposta.dati.titolo || proposta.titolo,
        descrizioneBreve: proposta.dati.descrizioneBreve || '',
        contenuto: proposta.dati.contenuto || '',
        pdfNome: proposta.dati.pdfNome || null,
        pdfDataUrl: proposta.dati.pdfDataUrl || null,
        pdfSize: proposta.dati.pdfSize || null,
        fotoCopertinaUrl: proposta.dati.fotoCopertinaUrl || null,
      });
    }
  }

  // 2. Aggiorna lo stato della proposta su Supabase
  try {
    await supabase
      .from('proposte')
      .update({
        stato: 'approvata',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', proposta.id);
  } catch (err) {
    console.warn('Aggiornamento stato proposta su Supabase non riuscito:', err);
  }

  // 3. Aggiorna o rimuove dal database locale
  const db = await getProposteDb();
  await db.delete('proposte_locali', proposta.id);

  notifySubscribers();
}

// Rifiuta una proposta
export async function rifiutaPropostaAdmin(
  propostaId: string,
  motivo?: string
): Promise<void> {
  try {
    await supabase
      .from('proposte')
      .update({
        stato: 'rifiutata',
        motivo_rifiuto: motivo || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', propostaId);
  } catch (err) {
    console.warn('Rifiuto proposta su Supabase non riuscito:', err);
  }

  const db = await getProposteDb();
  await db.delete('proposte_locali', propostaId);

  notifySubscribers();
}

// Blocca un proponente dall'inviare ulteriori proposte (per chi pubblica spam o proposte non serie)
export async function bloccaProponente(
  proposta: PropostaItem,
  motivo?: string
): Promise<void> {
  const reason = motivo?.trim() || 'Bloccato dall\'Admin: proposte non serie o spam';
  const nowIso = new Date().toISOString();

  // 1. Se l'IP è noto, inseriscilo in blocked_ips su Supabase
  if (proposta.ip && proposta.ip !== 'unknown') {
    try {
      await supabase.from('blocked_ips').upsert({
        ip: proposta.ip,
        reason,
        blocked_at: nowIso,
        is_blocked: true,
        unblocked_at: null,
      });
    } catch (err) {
      console.warn('Errore salvataggio IP bloccato su Supabase:', err);
    }
  }

  // 2. Blocca il device_id su Supabase usando il prefisso dev:
  if (proposta.device_id) {
    try {
      await supabase.from('blocked_ips').upsert({
        ip: `dev:${proposta.device_id}`,
        reason: `${reason} (${proposta.proponente_nome || 'Utente'})`,
        blocked_at: nowIso,
        is_blocked: true,
        unblocked_at: null,
      });
    } catch (err) {
      console.warn('Errore salvataggio device_id bloccato su Supabase:', err);
    }

    // Se il dispositivo bloccato corrisponde a quello corrente (es. test locale)
    if (typeof window !== 'undefined' && window.localStorage && getDeviceId() === proposta.device_id) {
      localStorage.setItem('vault_scout_ip_blocked', 'true');
      localStorage.setItem('vault_scout_ip_blocked_reason', reason);
      localStorage.setItem('vault_scout_ip_blocked_at', nowIso);
    }
  }

  notifySubscribers();
}

// Recupera l'elenco degli IP bloccati (Anti-Flood)
export async function getBlockedIps(): Promise<BlockedIpItem[]> {
  const result: BlockedIpItem[] = [];

  // Se è presente un blocco locale nel client, mostralo
  if (isLocalCircuitBreakerBlocked()) {
    result.push({
      ip: '127.0.0.1 (questo dispositivo)',
      reason:
        localStorage.getItem('vault_scout_ip_blocked_reason') ||
        'Rilevato flood anomalo (>= 20 richieste in 2 secondi)',
      blocked_at:
        localStorage.getItem('vault_scout_ip_blocked_at') || new Date().toISOString(),
      is_blocked: true,
      unblocked_at: null,
    });
  }

  try {
    const { data, error } = await supabase.rpc('get_blocked_ips');
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (!result.some((item) => item.ip === row.ip)) {
          result.push({
            ip: row.ip,
            reason: row.reason,
            blocked_at: row.blocked_at,
            is_blocked: row.is_blocked,
            unblocked_at: row.unblocked_at,
          });
        }
      }
    }
  } catch (_err) {
    // Fallback se la connessione o l'RPC non sono disponibili
  }

  return result;
}

// Sblocca un IP bloccato (accessibile unicamente da admin)
export async function unblockIp(targetIp: string): Promise<boolean> {
  const currentDev = getDeviceId();
  if (
    targetIp.includes('questo dispositivo') ||
    targetIp === '127.0.0.1' ||
    targetIp === `dev:${currentDev}`
  ) {
    unblockLocalCircuitBreaker();
  }

  try {
    const { data, error } = await supabase.rpc('unblock_ip', { target_ip: targetIp });
    if (error) {
      // Fallback: aggiornamento diretto su tabella blocked_ips
      await supabase
        .from('blocked_ips')
        .update({ is_blocked: false, unblocked_at: new Date().toISOString() })
        .eq('ip', targetIp);
    }
    notifySubscribers();
    return true;
  } catch (err) {
    console.error('Errore sblocco IP:', err);
    return false;
  }
}

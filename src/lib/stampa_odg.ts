// src/lib/stampa_odg.ts
// Modulo dedicato alla Stampa dell'Ordine del Giorno (ODG) e Scadenze:
// - Foglio A4 verticale pulito
// - Elenco eventi con data, orario, luogo e responsabile
// - Punti ODG con stato distinto (proposto, discusso, approvato, rimandato)
// - Sezioni opzionali: Presenze, Scadenze collegate, Note e Verbale
// - Regola break-inside: avoid sui punti ODG
// - Persistenza dedicata in sessionStorage (chiave: stampa_odg)

import { Evento, OdgPunto, QuadernoPagina, getDb } from './db';
import {
  parseDateOnly,
  isEventoDataDaDefinire,
  isEventoOrariDaDefinire,
  getCleanDescrizione,
} from './calendario';

export const SESSION_STORAGE_ODG_KEY = 'stampa_odg';

export type OdgPuntoStato = 'proposto' | 'discusso' | 'approvato' | 'rimandato';

export const RETENTION_DAYS_PAST = 30;

/**
 * Verifica se un evento o una pagina è passata da più di 30 giorni.
 * Gli eventi futuri e gli eventi con data da concordare restituiscono false.
 */
export function isEventOlderThan30Days(
  dateStr: string | null | undefined,
  days = RETENTION_DAYS_PAST
): boolean {
  if (!dateStr) return false;
  try {
    const d = parseDateOnly(dateStr);
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays > days;
  } catch (_e) {
    return false;
  }
}

export interface StampaOdgConfig {
  selectedOdgIds?: string[];
  selectedQuadernoIds?: string[];
  selectedEventiIds: string[];
  selectedAppuntiIds?: string[]; // Retrocompatibilità
  activeSubTab?: 'odg' | 'quaderno' | 'eventi' | 'appunti';
  includePresenze?: boolean;
  includeScadenze?: boolean;
  includeNoteVerbale?: boolean;
  includeCosaPortare?: boolean;
  includeProgramma?: boolean;
  includeFirme?: boolean;
}

export const DEFAULT_STAMPA_ODG_CONFIG: StampaOdgConfig = {
  selectedOdgIds: [],
  selectedQuadernoIds: [],
  selectedEventiIds: [],
  selectedAppuntiIds: [],
  activeSubTab: 'odg',
  includePresenze: true,
  includeScadenze: true,
  includeNoteVerbale: true,
  includeCosaPortare: true,
  includeProgramma: true,
  includeFirme: true,
};

/**
 * Carica la configurazione di stampa ODG da sessionStorage (o default).
 */
export function loadStampaOdgConfig(): StampaOdgConfig {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { ...DEFAULT_STAMPA_ODG_CONFIG };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_ODG_KEY);
    if (!raw) return { ...DEFAULT_STAMPA_ODG_CONFIG };
    const parsed = JSON.parse(raw);
    const selectedOdgIds = Array.isArray(parsed.selectedOdgIds)
      ? parsed.selectedOdgIds
      : Array.isArray(parsed.selectedEventiIds)
      ? parsed.selectedEventiIds
      : [];
    const selectedQuadernoIds = Array.isArray(parsed.selectedQuadernoIds)
      ? parsed.selectedQuadernoIds
      : Array.isArray(parsed.selectedAppuntiIds)
      ? parsed.selectedAppuntiIds.map((id: string) => id.replace('quad:', ''))
      : [];
    const selectedEventiIds = Array.isArray(parsed.selectedEventiIds)
      ? parsed.selectedEventiIds
      : [];

    return {
      selectedOdgIds,
      selectedQuadernoIds,
      selectedEventiIds,
      selectedAppuntiIds: Array.isArray(parsed.selectedAppuntiIds) ? parsed.selectedAppuntiIds : [],
      includePresenze: parsed.includePresenze !== undefined ? Boolean(parsed.includePresenze) : true,
      includeScadenze: parsed.includeScadenze !== undefined ? Boolean(parsed.includeScadenze) : true,
      includeNoteVerbale:
        parsed.includeNoteVerbale !== undefined ? Boolean(parsed.includeNoteVerbale) : true,
      includeCosaPortare:
        parsed.includeCosaPortare !== undefined ? Boolean(parsed.includeCosaPortare) : true,
      includeProgramma:
        parsed.includeProgramma !== undefined ? Boolean(parsed.includeProgramma) : true,
      includeFirme: parsed.includeFirme !== undefined ? Boolean(parsed.includeFirme) : true,
      activeSubTab:
        parsed.activeSubTab === 'appunti'
          ? 'appunti'
          : parsed.activeSubTab === 'quaderno'
          ? 'quaderno'
          : parsed.activeSubTab === 'eventi'
          ? 'eventi'
          : 'odg',
    };
  } catch (_e) {
    return { ...DEFAULT_STAMPA_ODG_CONFIG };
  }
}

/**
 * Salva la configurazione di stampa ODG in sessionStorage.
 */
export function saveStampaOdgConfig(config: StampaOdgConfig): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_ODG_KEY, JSON.stringify(config));
  } catch (_e) {}
}

/**
 * Determina lo stato di un punto ODG:
 * - 'approvato': se marcato completato o se il testo contiene [approvato]
 * - 'rimandato': se ha riportato_da valorizzato o se il testo contiene [rimandato]
 * - 'discusso': se il testo contiene [discusso]
 * - 'proposto': stato predefinito di partenza
 */
export function getOdgPuntoStato(p: OdgPunto): OdgPuntoStato {
  const t = p.testo.toLowerCase();
  if (/\[approvato\]/i.test(t)) return 'approvato';
  if (/\[rimandato\]/i.test(t)) return 'rimandato';
  if (/\[discusso\]/i.test(t)) return 'discusso';
  if (/\[proposto\]/i.test(t)) return 'proposto';

  if (p.completato) return 'approvato';
  if (p.riportato_da !== null && p.riportato_da !== '') return 'rimandato';

  return 'proposto';
}

/**
 * Pulisce il testo del punto ODG rimuovendo eventuali tag espliciti di stato.
 */
export function getCleanOdgPuntoText(p: OdgPunto): string {
  return p.testo
    .replace(/\[(?:proposto|discusso|approvato|rimandato)\]/gi, '')
    .trim();
}

export interface PrintableODGPunto {
  id: string;
  testo: string;
  cleanTesto: string;
  stato: OdgPuntoStato;
  completato: boolean;
  riportatoDa: string | null;
  ordine: number;
}

export interface PrintableODGEvent {
  evento: Evento;
  dataFormattata: string;
  orarioFormattato: string | null;
  cleanDescrizione: string;
  punti: PrintableODGPunto[];
  appunti?: string | null;
  cosaPortare?: string | null;
}

export interface PrintableODGDataset {
  eventi: PrintableODGEvent[];
  odgItems: PrintableODGEvent[];
  appuntiEventi: PrintableODGEvent[];
  quadernoPagine: QuadernoPagina[];
  eventiItems: PrintableODGEvent[];
  scadenzeGenerali: Evento[];
  totalSelected: number;
}

/**
 * Carica i dati per la stampa dell'Ordine del Giorno, Appunti ed Eventi da IndexedDB.
 * Modalità generale: include tutti gli elementi selezionati tra ODG, Appunti ed Eventi
 * permettendo di stamparli insieme in un unico job di stampa.
 */
export async function loadPrintableODGData(config: StampaOdgConfig): Promise<PrintableODGDataset> {
  const db = await getDb();

  const allEventi = (await db.getAll('eventi')) as Evento[];
  const activeEventi = allEventi.filter((ev) => ev.deleted_at === null);
  const eventiMap = new Map(activeEventi.map((e) => [e.id, e]));

  // Helper per costruire un PrintableODGEvent
  async function buildPrintableEvent(ev: Evento): Promise<PrintableODGEvent> {
    const rawPunti = (await db.getAllFromIndex('odg_punti', 'evento_id', ev.id)) as OdgPunto[];
    const activePunti = rawPunti
      .filter((p) => p.deleted_at === null)
      .sort((a, b) => a.ordine - b.ordine);

    const printablePunti: PrintableODGPunto[] = activePunti.map((p) => ({
      id: p.id,
      testo: p.testo,
      cleanTesto: getCleanOdgPuntoText(p),
      stato: getOdgPuntoStato(p),
      completato: p.completato,
      riportatoDa: p.riportato_da,
      ordine: p.ordine,
    }));

    const dateOnly = parseDateOnly(ev.inizio);
    const isTbd = isEventoDataDaDefinire(ev);
    const dataFormattata = isTbd
      ? 'Data da concordare'
      : dateOnly.toLocaleDateString('it-IT', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });

    const isDateOnly = isEventoOrariDaDefinire(ev) || ev.tutto_il_giorno;
    let orarioFormattato: string | null = null;
    if (!isTbd && !isDateOnly) {
      const start = new Date(ev.inizio);
      const startTimeStr = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      if (ev.fine) {
        const end = new Date(ev.fine);
        const endTimeStr = end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        orarioFormattato = `${startTimeStr} – ${endTimeStr}`;
      } else {
        orarioFormattato = startTimeStr;
      }
    }

    return {
      evento: ev,
      dataFormattata,
      orarioFormattato,
      cleanDescrizione: getCleanDescrizione(ev.descrizione),
      punti: printablePunti,
      appunti: ev.appunti || null,
      cosaPortare: ev.cosa_portare || null,
    };
  }

  // 1. ODG selezionati (da selectedOdgIds)
  const odgIds = config.selectedOdgIds || [];
  const odgItems: PrintableODGEvent[] = [];
  for (const id of odgIds) {
    const ev = eventiMap.get(id);
    if (ev) {
      odgItems.push(await buildPrintableEvent(ev));
    }
  }

  // 2. Pagine del Quaderno di Clan selezionate
  const rawQuadernoIds = [
    ...(config.selectedQuadernoIds || []),
    ...((config.selectedAppuntiIds || [])
      .filter((id) => id.startsWith('quad:'))
      .map((id) => id.replace('quad:', ''))),
  ];
  const quadernoIds = Array.from(new Set(rawQuadernoIds));

  const quadernoPagine: QuadernoPagina[] = [];
  if (quadernoIds.length > 0) {
    const allQuaderno = (await db.getAll('quaderno')) as QuadernoPagina[];
    const quadernoMap = new Map(
      allQuaderno.filter((q) => q.deleted_at === null).map((q) => [q.id, q])
    );
    for (const qId of quadernoIds) {
      const qPage = quadernoMap.get(qId);
      if (qPage) {
        quadernoPagine.push(qPage);
      }
    }
  }

  // 2b. Appunti Eventi selezionati (da selectedAppuntiIds, non-quaderno)
  const appuntiEventiIds = (config.selectedAppuntiIds || [])
    .filter((id) => !id.startsWith('quad:'))
    .map((id) => id.replace(/^ev-/, ''));

  const appuntiEventi: PrintableODGEvent[] = [];
  for (const id of appuntiEventiIds) {
    const ev = eventiMap.get(id);
    if (ev) {
      appuntiEventi.push(await buildPrintableEvent(ev));
    }
  }

  // 3. Eventi selezionati (da selectedEventiIds)
  const eventiIds = config.selectedEventiIds || [];
  const eventiItems: PrintableODGEvent[] = [];
  for (const id of eventiIds) {
    const ev = eventiMap.get(id);
    if (ev) {
      eventiItems.push(await buildPrintableEvent(ev));
    }
  }

  // Supporto legacy: se non c'è odg/quaderno/appunti ma ci sono selectedEventiIds
  if (
    odgItems.length === 0 &&
    quadernoPagine.length === 0 &&
    appuntiEventi.length === 0 &&
    eventiItems.length === 0 &&
    config.selectedEventiIds &&
    config.selectedEventiIds.length > 0
  ) {
    for (const id of config.selectedEventiIds) {
      const ev = eventiMap.get(id);
      if (ev) eventiItems.push(await buildPrintableEvent(ev));
    }
  }

  // Lista cumulativa per retrocompatibilità
  const allSelectedEventi: PrintableODGEvent[] = [];
  const seenIds = new Set<string>();
  for (const item of [...odgItems, ...appuntiEventi, ...eventiItems]) {
    if (!seenIds.has(item.evento.id)) {
      seenIds.add(item.evento.id);
      allSelectedEventi.push(item);
    }
  }

  // 4. Scadenze generali in programma se includeScadenze è attivo
  let scadenzeGenerali: Evento[] = [];
  if (config.includeScadenze) {
    const todayTime = new Date().setHours(0, 0, 0, 0);
    scadenzeGenerali = activeEventi
      .filter((ev) => {
        if (ev.tipo !== 'scadenza') return false;
        const start = parseDateOnly(ev.inizio).getTime();
        return start >= todayTime;
      })
      .sort((a, b) => parseDateOnly(a.inizio).getTime() - parseDateOnly(b.inizio).getTime());
  }

  const totalSelected =
    odgItems.length + quadernoPagine.length + appuntiEventi.length + eventiItems.length;

  return {
    eventi: allSelectedEventi,
    odgItems,
    quadernoPagine,
    appuntiEventi,
    eventiItems,
    scadenzeGenerali,
    totalSelected,
  };
}

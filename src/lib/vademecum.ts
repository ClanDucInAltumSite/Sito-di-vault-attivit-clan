// src/lib/vademecum.ts
// Modulo per la gestione dei Documenti Fondamentali e Regole del Clan (Vademecum)
// Carta di Clan, Regole del Clan e Canovacci per Pattuglie con supporto allegati PDF
// Persistenza locale autonoma e sicura su IndexedDB con sincronizzazione cloud automatica su Supabase (system_meta)

import { openDB, IDBPDatabase } from 'idb';
import { supabase } from './supabase';

export type VademecumDocType = 'carta_clan' | 'regole_clan' | 'canovaccio';

export interface VademecumItem {
  id: string;
  section: VademecumDocType;
  titolo: string;
  descrizioneBreve: string;
  contenuto: string;
  pdfNome?: string | null;
  pdfDataUrl?: string | null;
  pdfSize?: number | null;
  fotoCopertinaUrl?: string | null;
  updatedAt: string;
}

const VADEMECUM_DB_NAME = 'vault_scout_vademecum_db';
const VADEMECUM_DB_VERSION = 1;

let vademecumDbPromise: Promise<IDBPDatabase> | null = null;

function getVademecumDb(): Promise<IDBPDatabase> {
  if (!vademecumDbPromise) {
    vademecumDbPromise = openDB(VADEMECUM_DB_NAME, VADEMECUM_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('vademecum_items')) {
          const store = db.createObjectStore('vademecum_items', { keyPath: 'id' });
          store.createIndex('section', 'section');
          store.createIndex('updatedAt', 'updatedAt');
        }
      },
    });
  }
  return vademecumDbPromise;
}

const getAssetUrl = (relativePath: string) => {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath;
  return `${cleanBase}${cleanPath}`;
};

// Dati predefiniti curati e reali del Clan Duc In Altum
export const DEFAULT_VADEMECUM_ITEMS: VademecumItem[] = [
  {
    id: 'carta_clan',
    section: 'carta_clan',
    titolo: 'Carta di Clan',
    descrizioneBreve: 'I valori, la legge della strada e gli impegni comunitari del Clan',
    contenuto: "## [color:amber:Fede]\n\n[size:16:La fede è un viaggio in continuo divenire che ha come obiettivo la costruzione di un rapporto con Dio.][size:16: ]\n\n[size:16:Come clan crediamo che sia importante vivere il percorso di fede sia in modo personale che all'interno della comunità attraverso la ricerca e nel riconoscimento dei valori base del cristianesimo.][size:16: ]\n\n[size:16:Come clan ci impegniamo ad essere più intraprendenti e autonomi nel fare le attività di fede come:]\n\n- portare avanti il progetto ACE (almeno una volta al mese)\n\n- catechesi più vicine a noi\n- condivisioni spontanee.\n\n\n# [color:lime:Strada]\n\n[size:16:La strada dá e crea.][size:16: L'importanza di essa risiede nel modo con cui la viviamo.][size:16: ]\n\n[size:16:Fare strada muta i legami ed i punti di vista all'interno della comunità.][size:16: ]\n\n[size:16:É un modo per crescere,][size:16: conoscere ed affrontare i propri limiti attraverso la fatica,][size:16: per contemplare la bellezza della natura ed aumentare il nostro contatto con essa.][size:16: ]\n\n[size:16:La strada la percorriamo insieme,][size:16: passo dopo passo,][size:16: aiutandoci e confortandoci con l'obiettivo di arrivare alla meta prefissata.][size:16: ]\n\n[size:16:Come clan ci impegniamo a mantenere una buona costanza nelle uscite di strada.][size:16: Ci impegniamo a trovare un punto d'incontro nella natura della camminata.]\n\n# **[color:blue:Servizio]**\n\nServire è una scelta di vita quotidiana.\n\nL'essenza del servizio è essere utili per il prossimo con la consapevolezza di non essere indispensabili.\n\nDonare il proprio tempo agli altri senza aspettarsi nulla in cambio è un'opportunità per crescere ed arricchirsi.\n\n*\"Chi semina datteri, non mangia datteri\" *\n\nCome clan riconosciamo la bellezza nell' interfacciarsi con nuove realtà, aquisendone consapevolezza e gratitudine.\n\nNoi del clan ci impegniamo ad essere costanti ed attivi nei servizi affidati, vivendoli al meglio sia singolarmente che in comunità, e a dedicare alcune delle uscite al servizio di comunità.\n\n\n# [color:purple:Stile]\n\n[size:16:Siamo scout,][size:16: non facciamo scout.][size:16: Indossare l'uniforme e' una presa di posizione molto forte,][size:16: con o senza di essa abbracciamo gli ideali e i principi dello scoutismo.][size:16: ]\n\n[size:16:Siccome rappresentiamo a livello nazionale un'associazione,][size:16: e a livello mondiale un movimento,][size:16: crediamo sia importante mantenere un comportamento adeguato e rispettoso indipendentemente dalle circostanze.][size:16: ]\n\n[size:16:Come uniforme perfetta intendiamo:][size:16: camicia o polo,][size:16: fazzolettone,][size:16: pantaloni,][size:16: cintura,][size:16: maglione,][size:16: calzettoni e scarpe chiuse.][size:16: ]\n\n[size:16:Riconosciamo di dover indossare l'uniforme in queste occasioni:]\n\n- cerimonie ufficiali\n\n- messa\n\n- mezzi di trasporto\n\nIn tutti gli altri casi ci riserviamo di poterci confrontare per trovare il giusto compromesso.\n\n\n# [color:red:Comunità]\n\n[size:16:La nostra comunità e' un gruppo di persone sullo stesso piano che cresce e cammina verso degli obbiettivi in comune,][size:16: sotto le stesse regole e gli stessi ideali,][size:16: per migliorarsi.][size:16: ]\n\n[size:16:Crediamo che in una comunità sia importante cercare un punto d'incontro attraverso il dialogo,][size:16: l'ascolto e la riflessione.][size:16: ]\n\n[size:16:Siamo felici di accogliere nuovi membri nella comunità.][size:16: Sulla base di questi presupposti ci impegniamo attraverso il gioco e il lavoro a essere presenti con la volontà di mantenere la parola data.][size:16: ]\n\n[size:16:Inoltre,][size:16: crediamo che i seguenti elementi possano rafforzare la comunità:]\n\n- essere presenti e attivi con costanza\n- essere propensi alla condivisione\n- essere intraprendenti mettendo a disposizione le proprie capacità.\n\nCi prefiggiamo di fare almeno un'uscita ogni mese e mezzo ed una riunione a settimana.\n\n\n# [color:brown:Territorio]\n\nNoi del clan siamo cittadini del mondo percio' puntiamo a mantenere gli stessi valori che applichiamo nella nostra zona. In tutto il territorio.\n\nLa zona in cui compiamo piu' cittadinanza attiva e' Ponte San Giovanni e aree limitrofe.\n\nQuando parliamo di territorio non intendiamo solo il territorio fisico, ma anche l'insieme delle relazioni e associazioni che ne fanno parte. Per questo noi del clan ci impegniamo a:\n\n- organizzare un'attivita' che coinvolga gli abitanti del territorio\n- dare disponibilita' alle richieste di aiuto da parte degli altri enti della zona\n\n*\"Lasciate il mondo un po' migliore di come l'avete trovato\"*\"",
    pdfNome: null,
    pdfDataUrl: null,
    pdfSize: null,
    fotoCopertinaUrl: getAssetUrl('vademecum/carta-clan-cover.webp'),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'regole_clan',
    section: 'regole_clan',
    titolo: 'Regole del Clan',
    descrizioneBreve: 'Patto di convivenza, orari, sede, telefoni e cassa',
    contenuto: "Riunione martedì/mercoledì alternando e gestita da due di noi\nNO cuffiette categorico\n\n[size:16:* Telefoni: a riunione usarli il meno possibile, in uscita mai (ci ritagliamo un piccolo momento dopo le attività prima di andare a dormire)\n* Fumo: nei momenti morti fuori dalle attività, senza sottrarsi alla comunità solo secondo le proprie necessità\n* se non si viene a riunione motivare il perché\n* rispondere ai messaggi che vengono inviati\n* non parlare sopra agli altri\n* mantenere un linguaggio opportuno (assolutamente no bestemmie, le parolacce non devono diventare un'abitudine nel linguaggio).\n* ogni membro della comunità si prende la responsabilità di richiamare gli altri in caso di trasgressione delle regole (ci poniamo come obiettivo di non arrivare ad un doppio richiamo)]",
    pdfNome: null,
    pdfDataUrl: null,
    pdfSize: null,
    fotoCopertinaUrl: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'canovaccio_logistica',
    section: 'canovaccio',
    titolo: 'Canovaccio Logistica uscita/route',
    descrizioneBreve: "Guida operativa per imparare da zero a realizzare la logistica di un'uscita o di una route.",
    contenuto: "[color:green:Parte 1: Logistica diun'uscita]\n\nPrima si definisce il tipo di uscita, poi si mette in sicurezza una base semplice e funzionale. Il percorso segue l'attività, mentre la logistica rende il programma davvero realizzabile.\n\n**1. Base e accoglienza**\n- Definire il tipo di uscita: scegliere tra strada o servizio.\n- Trovare dove dormire (in ordine di priorità): parrocchia -> sede o sale tramite conoscenze -> base scout.\n- Verificare gli spazi: chiedere spazio per dormire, bagno e — se servisse — cucina.\n- Chiudere gli accordi: confermare disponibilità, offerta e referente.\n\n[color:red:2. Percorso, attività e budget]\n- Allineare il percorso all'attività: verificare che sia coerente con catechesi, animazione, panorama o eremo.",
    pdfNome: 'Canovaccio Pattuglia Logistica_compressed.pdf',
    pdfDataUrl: getAssetUrl('docs/Canovaccio_Pattuglia_Logistica_compressed.pdf'),
    pdfSize: 1261347,
    fotoCopertinaUrl: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'canovaccio_veglia_bivacco',
    section: 'canovaccio',
    titolo: 'Canovaccio Veglia Serale e Fuoco di Bivacco',
    descrizioneBreve: 'Guida per impostare tema, ambientazione, brani, canti e preghiera',
    contenuto: `# CANOVACCIO VEGLIA SERALE E FUOCO DI BIVACCO

Traccia per animare una veglia serale profonda e coinvolgente.

---

### FASE 1 — INTRODUZIONE E AMBIENTAZIONE (10 min)
- Accensione del fuoco con formula o breve riflessione.
- Canto iniziale di apertura per creare atmosfera e silenzio.
- Lancio del tema: una frase guida o una breve storia provocatoria.

---

### FASE 2 — ASCOLTO E TESTIMONIANZA (20 min)
- Lettura di un testo significativo (brano letterario, articolo di attualità o testimonianza).
- Momento musicale: canto a tema con chitarra solista.
- Domanda stimolo per la riflessione personale.

---

### FASE 3 — DINAMICA O GESTO SIMBOLICO (15 min)
- Gesto concreto: scrivere un pensiero su un foglietto da affidare al fuoco, un nodo alla corda, uno scambio di un segno di pace.
- Momento di condivisione libera per chi desidera prendere la parola.

---

### FASE 4 — CONCLUSIONE E PREGHIERA (10 min)
- Lettura del Vangelo o preghiera del Rover e della Scolta.
- Canto serale (es. Il Canto della Promessa o Al Cader del Giorno).
- Saluto della buonanotte e silenzio del campo.`,
    pdfNome: null,
    pdfDataUrl: null,
    pdfSize: null,
    fotoCopertinaUrl: null,
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Inizializza il database con i contenuti predefiniti se vuoto
 */
async function ensureVademecumDefaults(db: IDBPDatabase): Promise<void> {
  const count = await db.count('vademecum_items');
  if (count === 0) {
    const tx = db.transaction('vademecum_items', 'readwrite');
    for (const item of DEFAULT_VADEMECUM_ITEMS) {
      await tx.store.put(item);
    }
    await tx.done;
    return;
  }

  // Se il database locale contiene ancora i vecchi template generici o segnaposto,
  // effettua l'upgrade immediato ai documenti reali recuperati del Clan
  const items = await db.getAll('vademecum_items');
  const hasOldPlaceholder = items.some(
    (i) => i.contenuto && (
      i.contenuto.includes('I QUATTRO PILASTRI DEL NOSTRO CAMMINO') ||
      i.contenuto.includes("L'orario di inizio riunione è sacro")
    )
  );

  if (hasOldPlaceholder || !items.some(i => i.titolo && i.titolo.includes('Logistica'))) {
    const tx = db.transaction('vademecum_items', 'readwrite');
    for (const def of DEFAULT_VADEMECUM_ITEMS) {
      const existing = items.find((i) => i.id === def.id || (i.section === def.section && def.section !== 'canovaccio'));
      if (
        !existing ||
        existing.contenuto.includes('I QUATTRO PILASTRI DEL NOSTRO CAMMINO') ||
        existing.contenuto.includes("L'orario di inizio riunione è sacro") ||
        (def.section === 'canovaccio' && def.id === 'canovaccio_logistica' && !items.some(i => i.titolo.includes('Logistica')))
      ) {
        await tx.store.put(def);
      }
    }
    await tx.done;
  }
}

let vademecumSyncTimer: any = null;

/**
 * Avvia la sincronizzazione Vademecum in background con debounce
 */
export function triggerBackgroundVademecumSync(delayMs = 300): void {
  if (typeof window === 'undefined') return;
  if (typeof process !== 'undefined' && process.env.VITEST) return;
  if (vademecumSyncTimer) clearTimeout(vademecumSyncTimer);
  vademecumSyncTimer = setTimeout(() => {
    syncVademecum().catch((err) => {
      console.warn('[Vademecum] Sincronizzazione background non riuscita:', err);
    });
  }, delayMs);
}

/**
 * Recupera tutti i documenti Vademecum
 */
export async function getVademecumItems(): Promise<VademecumItem[]> {
  try {
    const db = await getVademecumDb();
    await ensureVademecumDefaults(db);
    triggerBackgroundVademecumSync();
    return await db.getAll('vademecum_items');
  } catch (err) {
    console.error('Errore getVademecumItems:', err);
    return DEFAULT_VADEMECUM_ITEMS;
  }
}

/**
 * Recupera un singolo documento per ID
 */
export async function getVademecumItem(id: string): Promise<VademecumItem | null> {
  try {
    const db = await getVademecumDb();
    await ensureVademecumDefaults(db);
    const item = await db.get('vademecum_items', id);
    if (item) return item;
    return DEFAULT_VADEMECUM_ITEMS.find((d) => d.id === id) || null;
  } catch (err) {
    console.error('Errore getVademecumItem:', err);
    return DEFAULT_VADEMECUM_ITEMS.find((d) => d.id === id) || null;
  }
}

/**
 * Salva o aggiorna un documento Vademecum (solo admin sul client)
 */
export async function saveVademecumItem(input: {
  id?: string;
  section: VademecumDocType;
  titolo: string;
  descrizioneBreve: string;
  contenuto: string;
  pdfNome?: string | null;
  pdfDataUrl?: string | null;
  pdfSize?: number | null;
  fotoCopertinaUrl?: string | null;
}): Promise<VademecumItem> {
  const db = await getVademecumDb();
  await ensureVademecumDefaults(db);

  const existing = input.id ? await db.get('vademecum_items', input.id) : null;
  const id = input.id || (input.section === 'canovaccio' ? `canovaccio_${Date.now()}` : input.section);

  const updated: VademecumItem = {
    id,
    section: input.section,
    titolo: input.titolo.trim() || 'Documento senza titolo',
    descrizioneBreve: input.descrizioneBreve.trim() || '',
    contenuto: input.contenuto.trim(),
    pdfNome: input.pdfNome !== undefined ? input.pdfNome : existing?.pdfNome ?? null,
    pdfDataUrl: input.pdfDataUrl !== undefined ? input.pdfDataUrl : existing?.pdfDataUrl ?? null,
    pdfSize: input.pdfSize !== undefined ? input.pdfSize : existing?.pdfSize ?? null,
    fotoCopertinaUrl: input.fotoCopertinaUrl !== undefined ? input.fotoCopertinaUrl : existing?.fotoCopertinaUrl ?? null,
    updatedAt: new Date().toISOString(),
  };

  await db.put('vademecum_items', updated);
  notifyVademecumListeners();
  if (!(typeof process !== 'undefined' && process.env.VITEST)) {
    pushVademecumToRemote().catch(() => {});
  }
  return updated;
}

/**
 * Converte un file immagine in Data URL compresso (max 1200x700, WebP/JPEG)
 * per garantire fluidità, offline storage immediato in IndexedDB e nessun lag.
 */
export async function compressCoverImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error("Il file selezionato non è un'immagine valida."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1200;
        const maxHeight = 700;
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        try {
          const webpData = canvas.toDataURL('image/webp', 0.85);
          if (webpData.startsWith('data:image/webp')) {
            resolve(webpData);
            return;
          }
        } catch {
          // fallback
        }
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error("Impossibile caricare l'immagine."));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Errore durante la lettura del file immagine."));
    reader.readAsDataURL(file);
  });
}

/**
 * Elimina un documento (usato per i singoli canovacci)
 */
export async function deleteVademecumItem(id: string): Promise<void> {
  const db = await getVademecumDb();
  await db.delete('vademecum_items', id);
  notifyVademecumListeners();
  if (!(typeof process !== 'undefined' && process.env.VITEST)) {
    pushVademecumToRemote().catch(() => {});
  }
}

/**
 * Verifica se un elenco di documenti Vademecum contiene personalizzazioni
 * rispetto ai contenuti predefiniti di fabbrica.
 */
export function isVademecumCustomized(items: VademecumItem[]): boolean {
  if (!items || items.length === 0) return false;
  if (items.length !== DEFAULT_VADEMECUM_ITEMS.length) return true;

  for (const item of items) {
    const def = DEFAULT_VADEMECUM_ITEMS.find((d) => d.id === item.id);
    if (!def) return true;
    if (item.titolo !== def.titolo) return true;
    if (item.contenuto !== def.contenuto) return true;
    if (item.descrizioneBreve !== def.descrizioneBreve) return true;
    if (item.fotoCopertinaUrl !== def.fotoCopertinaUrl) return true;
    if (item.pdfDataUrl !== def.pdfDataUrl) return true;
  }
  return false;
}

/**
 * Carica l'elenco dei documenti Vademecum su Supabase (tabella system_meta)
 * se l'utente attuale è autenticato come amministratore.
 */
export async function pushVademecumToRemote(client: any = supabase, itemsToPush?: VademecumItem[]): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    if (typeof process !== 'undefined' && process.env.VITEST && client === supabase) {
      return false;
    }
    if (!client || typeof client.from !== 'function') {
      return false;
    }

    const { data: { session } } = client.auth && typeof client.auth.getSession === 'function'
      ? await client.auth.getSession()
      : { data: { session: null } };

    if (!session?.user) {
      return false; // Solo gli amministratori autenticati possono scrivere in system_meta
    }

    let items = itemsToPush;
    if (!items) {
      const db = await getVademecumDb();
      await ensureVademecumDefaults(db);
      items = await db.getAll('vademecum_items');
    }

    const { error } = await client.from('system_meta').upsert({
      key: 'vademecum_items',
      value: items,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.warn('[VademecumSync] Errore push su Supabase:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[VademecumSync] Eccezione pushVademecumToRemote:', err?.message || err);
    return false;
  }
}

/**
 * Scarica i documenti Vademecum da Supabase e aggiorna IndexedDB locale se necessario.
 */
export async function pullVademecumFromRemote(client: any = supabase): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    if (typeof process !== 'undefined' && process.env.VITEST && client === supabase) {
      return false;
    }
    if (!client || typeof client.from !== 'function') {
      return false;
    }

    const db = await getVademecumDb();
    await ensureVademecumDefaults(db);
    const localItems = await db.getAll('vademecum_items');
    const localCustomized = isVademecumCustomized(localItems);

    let fromQuery = client.from('system_meta');
    if (!fromQuery || typeof fromQuery.select !== 'function') {
      return false;
    }
    let selQuery = fromQuery.select('value, updated_at');
    if (!selQuery || typeof selQuery.eq !== 'function') {
      return false;
    }
    let eqQuery = selQuery.eq('key', 'vademecum_items');
    if (!eqQuery || typeof eqQuery.maybeSingle !== 'function') {
      return false;
    }

    const { data, error } = await eqQuery.maybeSingle();

    if (error) {
      console.warn('[VademecumSync] Errore pull da Supabase:', error.message);
      return false;
    }

    if (data && Array.isArray(data.value) && data.value.length > 0) {
      const remoteItems = data.value as VademecumItem[];
      const remoteUpdatedAt = data.updated_at || '';

      let localMaxUpdated = '';
      for (const item of localItems) {
        if (item.updatedAt && item.updatedAt > localMaxUpdated) {
          localMaxUpdated = item.updatedAt;
        }
      }

      const remoteCustomized = isVademecumCustomized(remoteItems);
      const remoteHasOldPlaceholder = remoteItems.some(
        (i) => i.contenuto && (
          i.contenuto.includes('I QUATTRO PILASTRI DEL NOSTRO CAMMINO') ||
          i.contenuto.includes("L'orario di inizio riunione è sacro")
        )
      );

      // REGOLA FERREA DI PROTEZIONE DATI:
      // 1. Se il server contiene vecchi placeholder generici o default non personalizzati
      //    e il dispositivo locale ha documenti reali, NON sovrascrivere mai il locale!
      if (remoteHasOldPlaceholder && !localCustomized) {
        return false;
      }
      if (localCustomized && !remoteCustomized) {
        // Salva i dati locali su cloud se admin
        pushVademecumToRemote(client, localItems).catch(() => {});
        return false;
      }

      // Sovrascrivi solo se locale non è personalizzato o remoto è personalizzato e più recente
      if (!localCustomized || (remoteCustomized && remoteUpdatedAt && remoteUpdatedAt > localMaxUpdated)) {
        // Garantisce che carta_clan e regole_clan siano sempre presenti
        const finalItems = [...remoteItems];
        for (const def of DEFAULT_VADEMECUM_ITEMS) {
          if (!finalItems.some((i) => i.id === def.id)) {
            finalItems.push(def);
          }
        }

        const tx = db.transaction('vademecum_items', 'readwrite');
        await tx.store.clear();
        for (const item of finalItems) {
          await tx.store.put(item);
        }
        await tx.done;
        notifyVademecumListeners();
        return true;
      }

      // Se locale è personalizzato ed è più recente del server, e siamo admin: push automatico al server
      if (localCustomized && localMaxUpdated > remoteUpdatedAt) {
        await pushVademecumToRemote(client, localItems);
      }
    } else {
      // Supabase non ha ancora il record 'vademecum_items'.
      // Se il dispositivo locale ha contenuti personalizzati (es. il PC dell'admin),
      // effettua il seed iniziale sul cloud!
      if (localCustomized) {
        await pushVademecumToRemote(client, localItems);
      }
    }

    return true;
  } catch (err: any) {
    console.warn('[VademecumSync] Eccezione pullVademecumFromRemote:', err?.message || err);
    return false;
  }
}

/**
 * Sincronizzazione bidirezionale del Vademecum con Supabase
 */
export async function syncVademecum(client: any = supabase): Promise<void> {
  await pullVademecumFromRemote(client);
}

// Sistema di sottoscrizione per aggiornare la UI in tempo reale al salvataggio
type VademecumListener = () => void;
const vademecumListeners = new Set<VademecumListener>();

export function subscribeVademecum(listener: VademecumListener): () => void {
  vademecumListeners.add(listener);
  return () => {
    vademecumListeners.delete(listener);
  };
}

function notifyVademecumListeners(): void {
  for (const listener of vademecumListeners) {
    try {
      listener();
    } catch (e) {
      console.warn('Errore listener vademecum:', e);
    }
  }
}

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

// Dati predefiniti curati e realistici per Clan Scout
export const DEFAULT_VADEMECUM_ITEMS: VademecumItem[] = [
  {
    id: 'carta_clan',
    section: 'carta_clan',
    titolo: 'Carta di Clan',
    descrizioneBreve: 'I valori, la legge della strada e gli impegni comunitari del Clan',
    contenuto: `# CARTA DI CLAN — DUC IN ALTUM

> "La felicità non viene dal possedere o dall'essere serviti, ma dall'essere utili agli altri e dal percorrere la strada insieme."
> — Baden-Powell

---

### PREAMBOLO
Noi, Rover e Scolte della Comunità di Clan, scegliamo di camminare insieme alla scoperta di noi stessi, dei nostri fratelli e del mondo.
Questa Carta è il nostro patto d'onore e il riferimento costante del nostro percorso verso la Partenza.

---

### I QUATTRO PILASTRI DEL NOSTRO CAMMINO

#### 1. LA STRADA
- La strada è fatica vissuta nella gioia, zaino essenziale sulle spalle e passo condiviso con chi è più lento.
- Camminare all'aperto ci insegna il silenzio, l'essenzialità e lo stupore davanti alla bellezza del creato.
- Non lasciamo tracce negative del nostro passaggio, ma custodiamo ogni sentiero con rispetto.

#### 2. LA COMUNITÀ
- Nel Clan nessuno è invisibile: ogni voce ha diritto di ascolto e ogni opinione è accolta con lealtà.
- La verifica fraterna non è giudizio, ma aiuto reciproco a crescere nelle scelte di vita.
- Viviamo la corresponsabilità: la riuscita delle attività e la custodia della nostra sede dipendono da ciascuno.

#### 3. LA FEDE
- Ci mettiamo in cammino come cercatori di Dio, confrontando le nostre scelte quotidiane con il Vangelo.
- La preghiera attorno al fuoco e la riflessione personale ci aiutano a discernere la nostra vocazione.

#### 4. IL SERVIZIO
- Il servizio non è beneficenza occasionale, ma stile di vita: farsi prossimo con umiltà, continuità e gioia.
- Ci impegniamo ad amare il nostro territorio e ad agire come cittadini attivi e responsabili.

---

### LA PARTENZA
Chi sceglie la Partenza testimonia che i valori scout non restano confinati nel Clan, ma diventano la bussola dell'età adulta: operare nel mondo da persone libere, leali e accoglienti.`,
    pdfNome: null,
    pdfDataUrl: null,
    pdfSize: null,
    fotoCopertinaUrl: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'regole_clan',
    section: 'regole_clan',
    titolo: 'Regole del Clan',
    descrizioneBreve: 'Patto di convivenza, orari, sede, telefoni e cassa',
    contenuto: `# REGOLE DEL CLAN E PATTO DI CONVIVENZA

Il rispetto di queste regole è segno della nostra fraternità scout e della nostra maturità comunitaria.

---

### 1. PUNTUALITÀ E PARTECIPAZIONE
- L'orario di inizio riunione è sacro: arrivare in ritardo significa mancare di rispetto al tempo degli altri.
- Le assenze vanno comunicate ai Capi e alla propria Pattuglia almeno **24 ore prima**, con motivazione valida.
- Chi accumula assenze ingiustificate è chiamato a un colloquio con i Capi e a un servizio comunitario per il Clan.

---

### 2. USO DELLO SMARTPHONE E DISPOSITIVI DIGITALI
- Durante le riunioni di Clan e di Pattuglia i telefoni rimangono riposti nello zaino e silenziosi.
- Durante le uscite e le route i telefoni sono in **modalità non disturbare**: vogliamo vivere il momento presente e guardarci negli occhi, non attraverso uno schermo.
- L'uso è consentito solo per esigenze di sicurezza, orientamento GPS o contatti autorizzati dai Capi.

---

### 3. CURA DELLA SEDE E DEL MATERIALE
- La sede è la nostra casa scout: al termine di ogni attività si lasciano pavimenti puliti, tavoli ordinati e luci spente.
- Il materiale comune (tende, fornellini, teloni, attrezzi) va controllato prima dell'uso e riposto rigorosamente asciutto e pulito.
- Chi danneggia un materiale per negligenza ne cura la riparazione o la sostituzione.

---

### 4. CASSA DI CLAN E AUTOFINANZIAMENTO
- Il pagamento delle quote avviene sempre nei tempi concordati.
- Ognuno si impegna attivamente nei lavori di autofinanziamento per sostenere le uscite di chi ha maggiori difficoltà.
- La cassa è gestita con totale trasparenza e rendicontata ad ogni Punto della Strada.

---

### 5. SPIRITO DI PATTUGLIA E INCARICHI
- Ciascuna pattuglia svolge con cura il proprio incarico (animazione, cassa, materiale, liturgia, pronto soccorso).
- Ognuno porta il proprio contributo senza scaricare il lavoro sugli altri.`,
    pdfNome: null,
    pdfDataUrl: null,
    pdfSize: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'canovaccio_uscita_pattuglia',
    section: 'canovaccio',
    titolo: 'Canovaccio Uscita e Hike di Pattuglia',
    descrizioneBreve: 'Traccia organizzativa per orari, percorso, budget, menu e sicurezza',
    contenuto: `# CANOVACCIO USCITA / HIKE DI PATTUGLIA

Traccia operativa da compilare prima di presentare l'uscita ai Capi Unità.

---

### 1. SCHEDA GENERALE
- **Pattuglia responsabile:** [Nome Pattuglia]
- **Data e orari:** Partenza [Giorno / Ora] — Rientro [Giorno / Ora]
- **Luogo di destinazione:** [Nome località, quota e comune]
- **Mezzi di trasporto:** [Treno / Autobus / A piedi / Orari e coincidenze]

---

### 2. ITINERARIO E CARTOGRAFIA
- **Sentieri CAI previsti:** [Numeri segnavia e tappe intermedie]
- **Dislivello:** Salita: +[X] m | Discesa: -[Y] m | Distanza: [Z] km
- **Tempo stimato di marcia:** [Ore previste con pause]
- **Punti acqua verificati:** [Sorgenti e fontane attive lungo il percorso]
- **Piano B (Percorso alternativo in caso di maltempo):** [Descrivere la variante]

---

### 3. MENU ED ENERGIA
- **Pranzo al sacco:** [Alimenti leggeri ed energetici]
- **Cena al fuoco / fornellino:** [Menu caldo, facile da cucinare e nutriente]
- **Colazione:** [Biscotti, frutta secca, marmellata, tè caldo]
- **Budget complessivo a testa:** Euro [Cifra prevista]

---

### 4. MATERIALI E SICUREZZA
- **Cassetta di pronto soccorso:** Controllata con disinfettante, garze, cerotti vesciche, telo termico.
- **Dotazione di pattuglia:** Tenda leggera, fornellino con bombola piena, cordino, pala pieghevole.
- **Numeri di emergenza registrati:** Soccorso Alpino 112/118, numeri Capi Unità, stazione Carabinieri locale.`,
    pdfNome: null,
    pdfDataUrl: null,
    pdfSize: null,
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
    if (item.fotoCopertinaUrl) return true;
    if (item.pdfDataUrl) return true;
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

      // Se locale non è personalizzato (è ancora allo stato default),
      // oppure se il server ha un timestamp più recente: sovrascrivi locale
      if (!localCustomized || (remoteUpdatedAt && remoteUpdatedAt > localMaxUpdated)) {
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

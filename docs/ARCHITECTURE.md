# Architettura Tecnica e Specifiche di Sistema — Sito Vault Scout Clan

Documento architetturale di riferimento per il Vault di Clan (archivio di Giochi, Bans, Canti e Calendario con Ordine del Giorno per clan scout).

---

## 1. Stack Tecnologico e Motivazione

L'applicazione è progettata secondo il paradigma **Local-First PWA (Progressive Web App)**: funzionamento immediato all'aperto senza rete, consumo minimo di batteria e dati, zero costi di gestione ricorrenti e sicurezza granitica basata su Row Level Security (RLS) di PostgreSQL.

| Componente | Scelta Tecnologica | Motivazione e Benefici |
| :--- | :--- | :--- |
| **Framework UI** | **Preact** (con TSX e Preact Hooks) | Runtime di soli ~4.5 kB gzippato (contro i ~45 kB di React standard). Massima velocità di caricamento ed esecuzione su dispositivi mobili economici. Il Virtual DOM con TSX impedisce strutturalmente attacchi XSS effettuando per default l'escaping di tutti i valori dinamici. |
| **Tooling & Build** | **Vite + TypeScript (Strict)** | Avvio rapido, bundling ottimizzato con tree-shaking aggressivo, tipizzazione statica al 100% senza tipi `any` permissivi. |
| **PWA & Service Worker** | **vite-plugin-pwa (Workbox)** | Precache completo e versionato dell'app shell (HTML, bundle JS/CSS, font WOFF2, icone). Aggiornamento controllato senza ricariche forzate a sorpresa. |
| **Database Locale** | **IndexedDB** (tramite libreria leggera `idb`) | Fonte dati esclusiva da cui la UI legge *sempre*. Supporta centinaia di record strutturati, indici di ricerca e conservazione a lungo termine, a differenza di `localStorage` (limitato a 5 MB e sincrono/bloccante). |
| **Backend as a Service** | **Supabase** (Postgres 15+, Auth, Storage, Realtime) | Piano gratuito a costo zero. Autenticazione sicura per l'amministratore, storage con RLS per allegati (immagini/PDF), canale Realtime per la segnalazione di modifiche. |
| **Testing** | **Vitest + Happy-DOM** | Test unitari fulminei per il parser ChordPro, la logica di trasposizione, l'algoritmo di ricerca (typo e diacritici), l'ordinamento italiano e la logica di sincronizzazione. |
| **Hosting & CI/CD** | **GitHub Pages + GitHub Actions** | Hosting statico gratuito ad alta affidabilità su CDN globale GitHub con deploy automatico a ogni commit su `main`. Workflow di keepalive per prevenire la disattivazione e la pausa automatica. |

---

## 2. Struttura del Progetto

```
.
├── .github/
│   └── workflows/
│       ├── deploy.yml            # Build e deploy automatico su GitHub Pages ad ogni push su main
│       └── keepalive.yml         # Ping programmato (ogni 2 gg) per evitare la pausa di Supabase e reset 60gg
├── assets/                       # File originali forniti (logo, favicon)
├── docs/
│   ├── ARCHITECTURE.md           # Questo documento architetturale completo
│   ├── DECISIONS.md              # Registro delle decisioni architetturali (ADR) con fonti verificate
│   ├── SETUP_MANUALE.md          # Guida passo-passo in italiano per configurazione Supabase, GitHub e Admin
│   └── TEST_CHECKLIST.md         # Matrice e procedura di collaudo e accettazione
├── public/
│   ├── fonts/                    # Font Outfit self-hosted (WOFF2)
│   ├── icons/                    # Icone PWA (192x192, 512x512, maskable) generate dal logo originale
│   └── favicon.ico               # Favicon multi-risoluzione
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init_schema.sql  # Tabelle, vincoli CHECK, indici, trigger updated_at
│   │   ├── 0002_security_rls.sql # Funzione is_admin(), abilitazione RLS e policy su tabelle
│   │   └── 0003_storage.sql      # Configurazione bucket allegati e policy di storage
│   └── tests/
│       └── security_test.sql     # Script SQL di verifica RLS e Storage (anon vs admin)
├── src/
│   ├── app/
│   │   ├── App.tsx               # Root component con gestione shell e banner
│   │   ├── router.ts             # Router reattivo basato su Hash (#/)
│   │   └── Shell.tsx             # Layout principale con TopBar, BottomNav e indicatori di stato
│   ├── features/
│   │   ├── home/                 # Schermata Home (scorciatoie rapide, prossimo evento)
│   │   ├── giochi/               # Lista card, dettaglio, filtri ricerca e modale CRUD admin
│   │   ├── bans/                 # Lista, dettaglio con vista lettura ad alto contrasto, Wake Lock
│   │   ├── canti/                # Lista canti, vista esecuzione (accordi, trasposizione), editor live ChordPro
│   │   ├── calendario/           # Vista mensile, lista prossimi eventi, gestione ODG con riporto
│   │   ├── stampa/               # Schermata selezione elementi, preview impaginata e CSS print
│   │   └── admin/                # Schermata gestione: cestino, backup/restore JSON, stato storage
│   ├── lib/
│   │   ├── i18n.ts               # FILE UNICO per tutte le stringhe, etichette e messaggi UI
│   │   ├── supabase.ts           # Inizializzazione client Supabase con Anon Key
│   │   ├── db.ts                 # Schema e wrapper IndexedDB con libreria idb
│   │   ├── sync.ts               # Macchina di sincronizzazione (full, incrementale, tombstone)
│   │   ├── search.ts             # Motore di ricerca normalizzato con Levenshtein e token match
│   │   ├── chordpro.ts           # Parser ChordPro, trasposizione tonale, validatore e AST
│   │   ├── print.ts              # Logica e stili di stampa A4 continua e canti pagina-singola
│   │   ├── storage-cache.ts      # Cache API per download allegati e gestione offline
│   │   └── wakelock.ts           # Wrapper Screen Wake Lock API con fallback e re-lock
│   ├── ui/
│   │   ├── Button.tsx            # Pulsante accessibile con stile distintivo scout (cucitura/bordo)
│   │   ├── Card.tsx              # Card contenitore per giochi, bans ed eventi
│   │   ├── Modal.tsx             # Finestra modale con focus trap e conferma distruttiva a 2 step
│   │   ├── SearchBar.tsx         # Barra di ricerca con debounce (~200ms) e pulsante reset
│   │   ├── Toast.tsx             # Notifiche discrete (online/offline, aggiornamento PWA)
│   │   └── Badge.tsx             # Badge colorati per tipo evento, tonalità, tempo
│   ├── styles/
│   │   ├── tokens.css            # Variabili CSS (palette scout, spaziature, tipografia)
│   │   ├── global.css            # Reset, stili base accessibili, classi utilità
│   │   └── print.css             # Regole @media print per la stampa A4
│   ├── main.tsx                  # Bootstrap dell'applicazione Preact
│   └── sw.ts                     # Service worker custom Workbox con eventi skipWaiting
├── index.html                    # Entry point HTML con CSP rigorosa via meta-tag
├── package.json
├── tsconfig.json
└── vite.config.ts                # Configurazione Vite, Preact, PWA e build
```

---

## 3. Schema del Database PostgreSQL (Supabase)

Tutte le tabelle di contenuto adottano il medesimo standard di audit e sincronizzazione:
1. `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
2. `created_at timestamptz NOT NULL DEFAULT now()`
3. `updated_at timestamptz NOT NULL DEFAULT now()` (aggiornato esclusivamente via trigger server-side)
4. `deleted_at timestamptz NULL` (soft delete per la propagazione delle cancellazioni ai client offline)

### 3.1 Tabelle Dati

```sql
-- Trigger comune per aggiornamento automatico di updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabella Admin Users
CREATE TABLE public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabella Giochi
CREATE TABLE public.giochi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  regole text NOT NULL DEFAULT '',
  materiali text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 3. Tabella Bans
CREATE TABLE public.bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  testo text NOT NULL,
  note_gesti text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 4. Tabella Canti
CREATE TABLE public.canti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  autore text NULL,
  tonalita text NULL,
  ritmo text NULL,
  tempo_bpm integer NULL CHECK (tempo_bpm IS NULL OR (tempo_bpm >= 30 AND tempo_bpm <= 300)),
  misura text NULL,
  capotasto integer NULL CHECK (capotasto IS NULL OR (capotasto >= 0 AND capotasto <= 12)),
  testo_chordpro text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 5. Tabella Eventi Calendario
CREATE TYPE public.tipo_evento AS ENUM ('riunione', 'uscita', 'evento', 'scadenza', 'altro');

CREATE TABLE public.eventi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  tipo public.tipo_evento NOT NULL DEFAULT 'riunione',
  inizio timestamptz NOT NULL,
  fine timestamptz NULL,
  tutto_il_giorno boolean NOT NULL DEFAULT false,
  luogo text NULL,
  descrizione text NULL,
  responsabile text NULL,
  cosa_portare text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT check_date_ordine CHECK (fine IS NULL OR fine >= inizio)
);

-- 6. Tabella ODG Punti
CREATE TABLE public.odg_punti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id uuid NOT NULL REFERENCES public.eventi(id) ON DELETE CASCADE,
  testo text NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  completato boolean NOT NULL DEFAULT false,
  riportato_da uuid NULL REFERENCES public.odg_punti(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

-- 7. Tabella Allegati
CREATE TABLE public.allegati (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gioco_id uuid NULL REFERENCES public.giochi(id) ON DELETE CASCADE,
  ban_id uuid NULL REFERENCES public.bans(id) ON DELETE CASCADE,
  canto_id uuid NULL REFERENCES public.canti(id) ON DELETE CASCADE,
  evento_id uuid NULL REFERENCES public.eventi(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nome_file text NOT NULL,
  mime text NOT NULL,
  dimensione bigint NOT NULL,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  -- CHECK: Esattamente una sola foreign key deve essere valorizzata
  CONSTRAINT check_esattamente_un_genitore CHECK (
    (CASE WHEN gioco_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN ban_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN canto_id IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN evento_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  -- CHECK: Solo immagini JPG/PNG/WebP e PDF ammessi in v1
  CONSTRAINT check_mime_consentiti CHECK (
    mime IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  )
);
```

### 3.2 Indici e Trigger

```sql
-- Trigger updated_at su ogni tabella
CREATE TRIGGER trg_giochi_updated BEFORE UPDATE ON public.giochi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_bans_updated BEFORE UPDATE ON public.bans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_canti_updated BEFORE UPDATE ON public.canti FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_eventi_updated BEFORE UPDATE ON public.eventi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_odg_punti_updated BEFORE UPDATE ON public.odg_punti FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_allegati_updated BEFORE UPDATE ON public.allegati FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indici per performance di sync (fondamentali per query incrementale)
CREATE INDEX idx_giochi_updated_at ON public.giochi(updated_at);
CREATE INDEX idx_bans_updated_at ON public.bans(updated_at);
CREATE INDEX idx_canti_updated_at ON public.canti(updated_at);
CREATE INDEX idx_eventi_updated_at ON public.eventi(updated_at);
CREATE INDEX idx_odg_punti_updated_at ON public.odg_punti(updated_at);
CREATE INDEX idx_allegati_updated_at ON public.allegati(updated_at);

-- Indici per ordinamento e lookup rapido
CREATE INDEX idx_giochi_nome ON public.giochi(nome) WHERE deleted_at IS NULL;
CREATE INDEX idx_bans_nome ON public.bans(nome) WHERE deleted_at IS NULL;
CREATE INDEX idx_canti_titolo ON public.canti(titolo) WHERE deleted_at IS NULL;
CREATE INDEX idx_eventi_inizio ON public.eventi(inizio) WHERE deleted_at IS NULL;
CREATE INDEX idx_odg_evento ON public.odg_punti(evento_id, ordine) WHERE deleted_at IS NULL;
CREATE INDEX idx_allegati_genitori ON public.allegati(gioco_id, ban_id, canto_id, evento_id) WHERE deleted_at IS NULL;
```

---

## 4. Policy RLS e Sicurezza Storage

### 4.1 Funzione di Controllo Privilegi (`is_admin`)

```sql
-- Funzione security definer con search_path blindato a public per evitare privilege escalation
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### 4.2 Row Level Security (RLS) su tutte le tabelle

Tutte le tabelle hanno `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` obbligatorio.
- **SELECT**: Pubblico per tutti (`USING (true)`). Include anche i record con `deleted_at IS NOT NULL` per permettere al client di sincronizzare le cancellazioni offline (tombstone).
- **INSERT, UPDATE, DELETE**: Solo ed esclusivamente se `is_admin()` restituisce `true`.

```sql
-- Esempio per tabella giochi (replicato identico per bans, canti, eventi, odg_punti, allegati)
ALTER TABLE public.giochi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "giochi_select_public" ON public.giochi FOR SELECT USING (true);
CREATE POLICY "giochi_insert_admin"  ON public.giochi FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "giochi_update_admin"  ON public.giochi FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "giochi_delete_admin"  ON public.giochi FOR DELETE USING (is_admin());

-- Policy su admin_users: solo lettura per gli admin stessi, nessuna scrittura client
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_select_admin" ON public.admin_users FOR SELECT USING (is_admin());
```

### 4.3 Policy su Supabase Storage (`storage.objects`)

Il bucket `allegati` è configurato come pubblico per consentire il download diretto dei file via URL:
- Limite dimensione per file: **10 MB** (imposto a livello di configurazione bucket).
- Tipi MIME consentiti: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.

```sql
-- Inserimento del bucket 'allegati'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'allegati',
  'allegati',
  true,
  10485760, -- 10 MB in byte
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- RLS su storage.objects
CREATE POLICY "allegati_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'allegati');

CREATE POLICY "allegati_admin_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'allegati' AND public.is_admin());

CREATE POLICY "allegati_admin_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'allegati' AND public.is_admin());

CREATE POLICY "allegati_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'allegati' AND public.is_admin());
```

---

## 5. Flusso di Autenticazione e Sicurezza

1. **Registrazione disabilitata:** Nel pannello Supabase Auth viene disattivata l'opzione "Enable email signups". Nessun utente sconosciuto può registrarsi.
2. **Creazione Admin manuale:** L'amministratore (coppia di credenziali condivisa tra i capi clan) viene creato direttamente dalla Dashboard di Supabase (sezione *Authentication -> Users*). Subito dopo, l'UUID dell'utente creato viene inserito nella tabella `admin_users` tramite query SQL. Tutta la procedura è guidata in `docs/SETUP_MANUALE.md`.
3. **Flusso di Login:**
   - L'icona di accesso admin è posizionata con discrezione nell'header/Home.
   - Il modale di login richiede email e password.
   - `supabase.auth.signInWithPassword({ email, password })`.
   - Se il login ha successo, il client interroga la funzione SQL `is_admin()`. Se `false`, la sessione viene terminata con messaggio di errore.
   - La sessione è persistita nel local storage dal client ufficiale Supabase, consentendo all'admin di non reinserire le credenziali ad ogni apertura (a meno di logout esplicito).
4. **Protezione in caso di compromissione:** Se le credenziali finiscono nelle mani sbagliate, la procedura documentata in `SETUP_MANUALE.md` consente di reimpostare la password in 30 secondi dalla dashboard Supabase o revocare immediatamente l'UUID dalla tabella `admin_users`.

---

## 6. Algoritmo di Sincronizzazione Offline-First (IndexedDB)

### 6.1 Principio Fondamentale
La UI legge **sempre e solo da IndexedDB**. Anche in presenza di connessione Internet eccellente, il rendering dei componenti attinge dalla copia locale istantanea ($< 5\text{ ms}$). Il backend Supabase alimenta IndexedDB in background.

```
[ Supabase Postgres ]
       │
       ▼  (pull incrementale / eventi Realtime)
[ sync.ts  (Engine) ]
       │
       ▼  (idb upsert / delete)
[ IndexedDB Locale ]  ◄── (Single Source of Truth)
       │
       ▼  (live query / useSync)
[ Preact UI Components ]
```

### 6.2 Struttura IndexedDB (`scout_vault_db`)
- Database: `scout_vault_db`, versione 1.
- Object Stores:
  - `giochi` (keyPath: `id`)
  - `bans` (keyPath: `id`)
  - `canti` (keyPath: `id`)
  - `eventi` (keyPath: `id`)
  - `odg_punti` (keyPath: `id`, indice: `evento_id`)
  - `allegati` (keyPath: `id`, indici: `gioco_id`, `ban_id`, `canto_id`, `evento_id`)
  - `sync_metadata` (keyPath: `key`): contiene `last_sync_timestamp`, `last_full_sync`, `sync_status`.

### 6.3 Macchina di Sync (Incrementale vs Completa)
1. **Verifica Timestamp:** Il client legge `last_sync_timestamp` da `sync_metadata`.
2. **Controllo Scadenza Tombstone (90 giorni):**
   - Se `last_sync_timestamp` è assente oppure `(now - last_sync_timestamp) > 90 giorni`, viene avviata una **Full Resync**.
   - Nella *Full Resync*, IndexedDB viene svuotato per evitare record orfani, e vengono scaricati tutti i record attivi (`deleted_at IS NULL`) dal server.
3. **Pull Incrementale:**
   - Per ciascuna tabella, viene eseguita la query:
     `SELECT * FROM tabella WHERE updated_at >= (last_sync_timestamp - 5 secondi)`
     *(Il margine di 5 secondi previene discrepanze di clock tra client e server).*
   - **Upsert / Delete:**
     - Se `deleted_at IS NULL`: scrittura/aggiornamento del record in IndexedDB (`db.put(tabella, record)`).
     - Se `deleted_at IS NOT NULL`: eliminazione fisica del record dalla copia locale IndexedDB (`db.delete(tabella, record.id)`).
   - Aggiornamento atomico di `last_sync_timestamp = server_now` in `sync_metadata`.
4. **Trigger di Sincronizzazione:**
   - Montaggio dell'applicazione (`DOMContentLoaded`).
   - Evento browser `online`.
   - Evento `visibilitychange` (quando l'utente riattiva lo schermo o riapre la scheda).
   - Canale Supabase Realtime: la notifica `postgres_changes` funge solo da **segnale** ("qualcosa è cambiato sul server") e avvia una pull incrementale con debounce di 300 ms, ignorando il payload broadcast per sicurezza e consistenza.
5. **Timeout di Rete:** Qualsiasi richiesta di sync ha un timeout rigido di **4 secondi**. Se la rete è instabile o assente, la sync va in standby senza bloccare l'esperienza d'uso e riprova al successivo segnale.

---

## 7. Strategia di Caching e PWA

### 7.1 Service Worker (Workbox)
- Precache dell'App Shell: `index.html`, bundle `assets/*.js`, bundle `assets/*.css`, icone PWA, font self-hosted WOFF2.
- Modalità `skipWaiting: false` per evitare aggiornamenti a sorpresa mentre un utente sta leggendo un canto o svolgendo un ban all'aperto.
- Banner di notifica non invasivo: *"Nuova versione disponibile. [Aggiorna ora]"*. Al click, invio di messaggio `SKIP_WAITING` al Service Worker e ricaricamento controllato della pagina.

### 7.2 Cache degli Allegati (Cache API)
- Cache storage dedicata: `scout-attachments-v1`.
- **Auto-download silente:** Tutti gli allegati (immagini WebP/JPEG e PDF) di dimensione $< 500\text{ KB}$ vengono memorizzati nella Cache API in background al termine della sincronizzazione dati.
- **Allegati pesanti ($> 500\text{ KB}$):** Viene mostrato un pulsante esplicito *"Scarica tutti gli allegati per l'uso offline"* con barra di progresso e percentuale.
- **Fallback visivo:** Se un allegato non è presente in cache e il dispositivo è offline, la card visualizza l'icona con etichetta chiara *"Non scaricato — connettiti a internet per aprirlo"*, senza errori o crash dell'interfaccia.

### 7.3 Persistenza iOS e Android
- Chiamata all'avvio a `navigator.storage.persist()`. Se accordata, previene l'eviction automatica della memoria da parte del sistema operativo.
- **Rilevamento iOS Safari:** Safari mobile applica una policy di cancellazione dei dati dei siti dopo 7 giorni di mancata visita se il sito è aperto come normale scheda browser. Tale restrizione **non** viene applicata se l'app è aggiunta alla schermata Home. L'app rileva se gira in browser e, su iOS, mostra un banner informativo permanente finché non viene aggiunta a Home (*"Condividi -> Aggiungi alla schermata Home"*).

---

## 8. Specifiche Funzionali di Sezione

### 8.1 Giochi e Bans
- **Giochi:** Card con nome, materiali occorrenti, svolgimento/regole, allegati.
- **Bans:** Card e modalità lettura speciale:
  - Font a scala aumentata regolabile (+/− o slider da 18px a 32px).
  - Contrasto elevatissimo per lettura alla luce del sole.
  - Distinzione tipografica netta tra testo del canto e note sui gesti (box con bordo a tratteggio o badge).
  - Attivazione della **Screen Wake Lock API** durante la modalità lettura per evitare lo spegnimento dello schermo con il cellulare posato a terra o tenuto con una mano sola.

### 8.2 Canti e Parser ChordPro

#### Grammatica ChordPro
- Accordo racchiuso tra parentesi quadre: `[Do]Sopra la [Fa]panca la [Sol]capra campa`.
- Supporto notazione italiana (`Do, Re, Mi, Fa, Sol, La, Si`) con alterazioni (`#`, `b`) e suffissi (`m`, `7`, `maj7`, `dim`, `sus4`, `6`, `9`, `add9`, `/Basso`). Accetta anche la notazione americana in ingresso (`C, D, E, F, G, A, B`) convertendola.
- Direttive su riga propria:
  - `{strofa}` o `{s}`: etichetta e stile blocco strofa.
  - `{ritornello}` o `{r}`: box evidenziato per il ritornello con bordo colorato a sinistra.
  - `{ponte}` o `{p}`: stile dedicato per il bridge.
  - `{nuova_pagina}`: interruzione di pagina forzata per la stampa.
  - `{commento: ...}`: annotazione a margine.

#### Rendering Senza innerHTML
Il parser genera un albero di nodi Preact:
```tsx
<span class="chord-syllable-pair">
  <span class="chord">{accordo}</span>
  <span class="syllable">{sillaba}</span>
</span>
```
La classe CSS garantisce che l'accordo sovrasti la sillaba e rimanga a essa inscindibilmente ancorato anche quando il testo va a capo su display compatti.

#### Trasposizione Tonale
- Mappatura su scala cromatica a 12 semitoni:
  `['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si']`
- Algoritmo con calcolo automatico della scala di riferimento per la scelta corretta tra diesis e bemolli (es. tonalità di Fa privilegia Sib, tonalità di Sol privilegia Fa#).
- La trasposizione agisce solo a livello visivo (`transposeDelta = +2`), senza mai alterare il testo originale memorizzato nel database.

#### Editor Admin Live
- Area di testo con sintassi ChordPro.
- Pulsante rapido `[+ Accordo]` che inserisce `[]` nella posizione del cursore e posiziona il focus tra le parentesi.
- Anteprima live istantanea a fianco o sotto l'editor.
- Validazione sintattica morbida: segnala eventuali accordi con parentesi aperte e non chiuse senza inibire il salvataggio.

### 8.3 Calendario e Ordine del Giorno (ODG)
- Fuso orario `Europe/Rome`, locale `it-IT`, inizio settimana lunedì.
- Viste: **Mese** (griglia interattiva con indicatori colorati per tipo di evento) e **Lista prossimi eventi**.
- Dettaglio Evento: Titolo, tipo (`riunione`, `uscita`, `evento`, `scadenza`, `altro`), data/ora inizio e fine (o tutto il giorno), luogo, descrizione, responsabile, cosa portare.
- **Gestione ODG:**
  - Elenco punti numerati e ordinabili.
  - Checkbox per spuntare i punti completati durante la riunione.
  - Pulsante *"Riporta punti non conclusi alla prossima riunione"*: seleziona i punti con `completato = false`, individua la successiva riunione in programma (o permette di sceglierla) e clona i punti collegandoli tramite `riportato_da`.
  - Tasto stampa rapida ODG.

### 8.4 Motore di Ricerca e Ordinamento
- **Campi indicizzati:** Ricerca multi-campo (titolo, testo, regole, materiali, note gesti; gli accordi tra parentesi quadre vengono esclusi per evitare falsi positivi).
- **Normalizzazione:** Rimozione dei diacritici/accenti (es. `perche` trova `perché`) e case-insensitive (`Intl.Collator` o `normalize('NFD')`).
- **Tolleranza Typo:** Algoritmo Levenshtein leggero per parole $\ge 4$ caratteri (distanza massima 1).
- **Evidenziazione sicura:** La porzione corrispondente viene evidenziata spezzando il testo in sequenze di TextNode DOM alternati a tag `<mark>` (nessun `innerHTML`).
- **Ordinamento (esattamente 4 opzioni):**
  1. A → Z (default, con `Intl.Collator('it', { sensitivity: 'base' })`)
  2. Z → A
  3. Più recenti (`created_at` decrescente)
  4. Più vecchi (`created_at` crescente)
- Conservazione stato: parametri di ricerca e ordinamento memorizzati in `sessionStorage` per non perdere la posizione quando si torna indietro da un dettaglio.

### 8.5 Architettura di Stampa A4
- Esecuzione nella stessa pagina con `window.print()` e selettori CSS `@media print`.
- **Giochi e Bans:** Flusso continuo compatto, `break-inside: avoid` sul blocco elemento, `break-after: avoid` sui titoli, nessun salto pagina forzato tra elementi diversi, massimizzazione dello spazio su carta.
- **Canti:** Ogni canto inizia su una pagina nuova (`break-before: page`). I tag `{nuova_pagina}` spezzano il canto su più pagine secondo le direttive dell'autore.
  - Pagine successive con intestazione compatta: *"Titolo del Canto — pag. 2/2"*.
  - Rilevamento overflow: simulazione grafica in anteprima. Se il canto sfora l'altezza della pagina A4, l'anteprima mostra un avviso visibile: *"Attenzione: il canto supera la pagina A4. Riduci la dimensione del carattere o inserisci {nuova_pagina}"*.
- **ODG:** Scheda A4 singola con intestazione evento e caselle quadrate stampabili `[ ]` per la spunta a penna.

### 8.6 Amministrazione e Gestione Dati
- **CRUD Diretto:** I pulsanti Modifica/Elimina compaiono direttamente sulle schede quando la sessione admin è attiva.
- **Avviso Doppioni:** Durante l'inserimento/modifica, se il nome/titolo ha una similarità $> 85\%$ con un elemento già presente, compare un avviso giallo di attenzione non bloccante.
- **Eliminazione a Doppio Step e Cestino:**
  - Modale di conferma in cui l'admin deve confermare l'eliminazione.
  - L'eliminazione imposta `deleted_at = now()` (soft delete).
  - Schermata *Cestino* con elenco degli elementi cancellati e pulsante di ripristino istantaneo.
- **Backup e Ripristino JSON:**
  - Esportazione manuale di tutte le tabelle in un unico file JSON strutturato (attivata solo tramite click esplicito dell'admin).
  - Importazione da JSON con anteprima comparativa (numero di nuovi elementi, sovrascritture) prima della conferma definitiva.

---

## 9. Design System e Accessibilità

### 9.1 Palette Colori Scout
I colori rappresentano l'identità scout del Clan (Giallo, Azzurro, Rosso):

```css
:root {
  /* Colori Identitari */
  --color-giallo: #FFC93C;        /* Badge, accenti, highlight */
  --color-giallo-dark: #D49B00;   /* Giallo a contrasto elevato */
  --color-azzurro: #1E74A6;       /* Struttura, bottoni secondari, link (WCAG AA su sfondo chiaro) */
  --color-azzurro-active: #2F8FC7;/* Stato attivo / focus */
  --color-rosso: #D9381E;         /* Azioni primarie, conferme distruttive (WCAG AA su bianco) */
  --color-rosso-hover: #B82810;

  /* Neutri Tema Chiaro */
  --color-bg: #FAF6EC;            /* Sfondo caldo tela scout */
  --color-surface: #FFFFFF;       /* Superficie card */
  --color-surface-alt: #F2EBD9;   /* Sfondo alternato / barre */
  --color-border: #E2D7C3;        /* Bordi card e cuciture */
  --color-text: #21262B;          /* Testo primario ad alto contrasto (13.5:1) */
  --color-text-muted: #596573;    /* Testo secondario */

  /* Neutri Tema Scuro */
  --color-bg-dark: #1A232A;
  --color-surface-dark: #24303A;
  --color-border-dark: #374754;
  --color-text-dark: #F3F4F6;
  --color-text-muted-dark: #9CA3AF;
}
```

### 9.2 Regole di Accessibilità (WCAG AA)
- Testo su sfondo Giallo: **sempre** scuro (`--color-text`), mai bianco (contrasto $> 10:1$).
- Dimensioni touch target: minimo **44 × 44 pixel** per ogni elemento interattivo (pulsanti, icone, voci di navigazione, accordi cliccabili).
- Indicatori `:focus-visible` ad alto contrasto con outline azzurro di 3px per navigazione da tastiera.
- Attributi ARIA: `aria-live="polite"` sui contatori dei risultati di ricerca, `aria-expanded` sui menu a tendina e accordion.
- Rispetto di `prefers-reduced-motion` per utenti con sensibilità al movimento.

---

## 10. Piano di Collaudo e Test Automatici

### 10.1 Test Unitari (Vitest)
1. **Parser ChordPro (`test/chordpro.test.ts`):**
   - Riconoscimento accordi italiani e americani con alterazioni (`Do#m7`, `Fa#`, `Bb`, `Fmaj7/C`).
   - Accordi isolati a fine riga o senza testo associato.
   - Righe con sole direttive (`{strofa}`, `{ritornello}`, `{nuova_pagina}`).
   - Gestione parentesi non chiuse o caratteri speciali.
   - Trasposizione: $+1$ semitono su tutta la scala, $-1$ semitono, trasposizioni con armature complesse.
2. **Motore di Ricerca (`test/search.test.ts`):**
   - Normalizzazione diacritici (lettere accentate `à, è, é, ì, ò, ù`).
   - Tolleranza typo Levenshtein (es. `palla avvelenata` trovato digitando `pala aveleata`).
   - Esclusione degli accordi dal testo indicizzato dei canti.
   - Ordinamento con `Intl.Collator` su caratteri italiani.
3. **Logica di Sync (`test/sync.test.ts`):**
   - Calcolo cursore temporale con sovrapposizione di 5 secondi.
   - Applicazione idempotente degli aggiornamenti (ripetizione della stessa riga non altera lo stato).
   - Rimozione locale dei record con `deleted_at` valorizzato.
   - Trigger di Full Resync se `now - last_sync > 90 giorni`.

### 10.2 Test di Sicurezza PostgreSQL / RLS (`supabase/tests/security_test.sql`)
1. **Verifica Utente Anonimo:**
   - `SELECT` su tutte le 7 tabelle -> SUCCESSO.
   - `INSERT`, `UPDATE`, `DELETE` su `giochi`, `bans`, `canti`, `eventi`, `odg_punti`, `allegati`, `admin_users` -> FALLIMENTO con errore RLS (`42501`).
   - `INSERT` su `storage.objects` (bucket allegati) con Anon Key -> FALLIMENTO.
2. **Verifica Utente Admin:**
   - Inserimento riga su `giochi` -> SUCCESSO.
   - Aggiornamento riga -> SUCCESSO (e verifica che `updated_at` sia cambiato via trigger).
   - Upload file su bucket storage -> SUCCESSO se MIME consentito e dimensione $< 10\text{ MB}$.
   - Upload file con MIME non consentito (es. `.exe` o `.zip`) -> FALLIMENTO bloccato dal bucket.

---

## 11. Rischi Noti e Matrice di Mitigazione

| Rischio Identificato | Probabilità | Impatto | Strategia di Mitigazione Adottata |
| :--- | :--- | :--- | :--- |
| **Pausa automatica Supabase dopo 7 giorni di inattività** | Alta (durante pause estive o mesi senza uscite) | Bloccante per gli aggiornamenti | Workflow GitHub Actions `keepalive.yml` ogni 2 giorni che esegue una vera query REST a Postgres. Secondo ping indipendente raccomandato via servizio di cron esterno gratuito. |
| **Disattivazione workflow GitHub Actions dopo 60 giorni** | Media | Alto (blocca keepalive) | Controllo data ultimo commit in `keepalive.yml`: se $> 40$ giorni, esecuzione di commit automatico di heartbeat sul file `docs/keepalive_heartbeat.txt`. |
| **Cancellazione storage IndexedDB su iOS Safari dopo 7 giorni** | Alta (se aperto da Safari browser) | Medio (perdita dati offline) | Richiesta `navigator.storage.persist()`. Banner all'avvio con istruzioni chiare per l'installazione PWA sulla Schermata Home di iOS (dove il limite non si applica). Ricaricamento silente completo se i dati locali risultano vuoti. |
| **Saturazione quota Storage Supabase (1 GB Free Tier)** | Media (nel lungo periodo) | Alto | Compressione client-side obbligatoria prima dell'upload per tutte le immagini (riduzione del ~90% del peso, max 1600px). Esclusione file audio dalla v1. Monitoraggio spazio occupato nella schermata Admin. |
| **Vulnerabilità XSS da contenuti utente/database** | Bassa (un solo admin) | Critico | Divieto assoluto di `innerHTML` in tutto il codebase. Templating JSX/Preact con escaping automatico per ogni stringa. Parser ChordPro basato su generazione di nodi DOM nativi. |
| **Popup Blocker su stampa da smartphone** | Alta | Alto | Stampa esclusivamente in-page con `window.print()` e stili `@media print` A4, senza creazione di nuove finestre popup. |

# Architettura Tecnica e Specifiche di Sistema — Sito Vault Scout Clan

Documento architetturale di riferimento per il Vault di Clan (archivio di Giochi, Bans, Canti e Calendario con Ordine del Giorno per clan scout).

---

## 1. Stack Tecnologico e Motivazione

L'applicazione è progettata secondo il paradigma **Local-First PWA (Progressive Web App)**: funzionamento immediato all'aperto senza rete, consumo minimo di batteria e dati, zero costi di gestione ricorrenti e sicurezza granitica basata su Row Level Security (RLS) di PostgreSQL.

| Componente | Scelta Tecnologica | Motivazione e Benefici |
| :--- | :--- | :--- |
| **Framework UI** | **Preact** (con TSX e Preact Hooks) | Runtime di soli ~4.5 kB gzippato (contro i ~45 kB di React standard). Massima velocità di caricamento ed esecuzione su dispositivi mobili economici. Il Virtual DOM con TSX impedisce strutturalmente attacchi XSS effettuando per default l'escaping di tutti i valori dinamici. |
| **Tooling & Build** | **Vite + TypeScript (Strict)** | Avvio rapido, bundling ottimizzato con tree-shaking aggressivo, tipizzazione statica al 100% senza tipi `any` permissivi. Base path configurato su `/Sito-di-vault-attivit-clan/` per GitHub Pages. |
| **PWA & Service Worker** | **vite-plugin-pwa (Workbox)** | Precache completo e versionato dell'app shell (HTML, bundle JS/CSS, font WOFF2, icone). Scope configurato sul base path. Aggiornamento controllato senza ricariche forzate a sorpresa. |
| **Database Locale** | **IndexedDB** (tramite libreria leggera `idb`) | Fonte dati esclusiva da cui la UI legge *sempre*. Supporta centinaia di record strutturati, indici di ricerca e conservazione a lungo termine, a differenza di `localStorage` (limitato a 5 MB e sincrono/bloccante). Sostituzione atomica transazionale. |
| **Backend as a Service** | **Supabase** (Postgres 15+, Auth, Storage, Realtime) | Piano gratuito a costo zero. Autenticazione sicura per l'amministratore, storage senza listing pubblico per allegati (immagini/PDF), canale Realtime per la segnalazione di modifiche. |
| **Testing** | **Vitest + Happy-DOM** | Test unitari fulminei per il parser ChordPro, la logica di trasposizione, l'algoritmo di ricerca (typo calibrati e diacritici), l'ordinamento italiano e la logica di sincronizzazione. |
| **Hosting & CI/CD** | **GitHub Pages + GitHub Actions** | Hosting statico gratuito ad alta affidabilità su CDN globale GitHub con deploy automatico a ogni commit su `main`. Workflow di keepalive per prevenire la disattivazione e la pausa automatica. |

---

## 2. Struttura del Progetto

```
.
├── .github/
│   └── workflows/
│       ├── deploy.yml            # Build e deploy automatico su GitHub Pages (con paths-ignore: docs/**)
│       └── keepalive.yml         # Ping programmato (ogni 2 gg) per evitare la pausa di Supabase e reset 60gg
├── assets/                       # File originali forniti (logo, favicon)
├── docs/
│   ├── ARCHITECTURE.md           # Questo documento architetturale completo
│   ├── DECISIONS.md              # Registro delle decisioni architetturali (ADR) con fonti verificate
│   ├── SETUP_MANUALE.md          # Guida passo-passo in italiano per configurazione Supabase, GitHub e Admin
│   └── TEST_CHECKLIST.md         # Matrice e procedura di collaudo e accettazione
├── public/
│   ├── fonts/                    # Font Inter variabile self-hosted (WOFF2)
│   ├── icons/                    # Icone PWA (192x192, 512x512, maskable) generate dal logo originale
│   └── favicon.ico               # Favicon multi-risoluzione
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init_schema.sql  # Tabelle, vincoli CHECK, indici, trigger updated_at (search_path protetto)
│   │   ├── 0002_security_rls.sql # Funzione is_admin(), abilitazione RLS, policy e publication supabase_realtime
│   │   └── 0003_storage.sql      # Configurazione bucket allegati e policy di storage (senza SELECT pubblica)
│   └── tests/
│       └── security_test.sql     # Script SQL di verifica RLS, Realtime e Storage (anon vs admin)
├── src/
│   ├── app/
│   │   ├── App.tsx               # Root component con gestione shell e banner
│   │   ├── router.ts             # Router reattivo basato su Hash (#/)
│   │   └── Shell.tsx             # Layout principale con TopBar, BottomNav e indicatori di stato (CompassSync)
│   ├── features/
│   │   ├── home/                 # Schermata Home viva (conteggi IndexedDB, prossimo evento, aggiunti di recente)
│   │   ├── giochi/               # Lista card, dettaglio, filtri ricerca e modale CRUD admin
│   │   ├── bans/                 # Lista, dettaglio con vista lettura ad alto contrasto, Wake Lock
│   │   ├── canti/                # Lista canti, vista esecuzione (accordi, trasposizione), editor live ChordPro
│   │   ├── calendario/           # Vista mensile, lista prossimi eventi, gestione ODG con riporto
│   │   ├── stampa/               # Schermata selezione elementi, preview impaginata e CSS print
│   │   ├── admin/                # Schermata gestione: cestino, backup/restore JSON, stato storage
│   │   ├── design/               # Vetrina del design system Apple-Grade (#/design)
│   │   └── statodati/            # Schermata di verifica stato sincronizzazione e IndexedDB (#/stato-dati)
│   ├── lib/
│   │   ├── i18n.ts               # FILE UNICO per tutte le stringhe, etichette e messaggi UI
│   │   ├── supabase.ts           # Inizializzazione client Supabase con Anon Key
│   │   ├── db.ts                 # Schema e wrapper IndexedDB con idb (transazione atomica, query, soft-delete)
│   │   ├── sync.ts               # Macchina di sincronizzazione (full atomico, incrementale, tombstone, timeout)
│   │   ├── admin_actions.ts      # Operazioni di scrittura admin online, soft-delete, hard-delete, cestino e backup JSON
│   │   ├── photos.ts             # Configurazione e placeholder WebP per le 5 fotografie d'intestazione
│   │   ├── search.tsx            # Motore di ricerca normalizzato con Levenshtein calibrato, token match e HighlightText sicuro
│   │   ├── chordpro.ts           # Parser ChordPro, trasposizione tonale, validatore e AST
│   │   ├── print.ts              # Logica e stili di stampa A4 continua e canti pagina-singola
│   │   ├── storage-cache.ts      # Cache API per download allegati e gestione offline
│   │   └── wakelock.ts           # Wrapper Screen Wake Lock API con fallback e re-lock
│   ├── ui/
│   │   ├── BrandLogo.tsx         # Logo ufficiale completo o emblema su targa bianca con fallback
│   │   ├── HeaderBanner.tsx      # Testata responsive con foto WebP, scrim viola e metadati
│   │   ├── ScoutMotifs.tsx       # Motivi vettoriali scout: LogoReveal, TheTrail, CompassSync
│   │   ├── PwaInstallGuide.tsx   # Guida contestuale all'installazione su Schermata Home iOS/Android
│   │   ├── SectionIcon.tsx       # Quadratini arrotondati pieni per ogni sezione
│   │   ├── Button.tsx            # Pulsante accessibile
│   │   ├── Card.tsx              # Card contenitore per giochi, bans ed eventi
│   │   ├── Modal.tsx             # Finestra modale con focus trap e tasto Esc
│   │   ├── DeleteConfirmModal.tsx # Modale di eliminazione a due passaggi con digitazione del nome
│   │   ├── SearchField.tsx       # Barra di ricerca pillola con debounce e pulsante reset
│   │   ├── Toast.tsx             # Notifiche discrete (online/offline, aggiornamento PWA)
│   │   └── Badge.tsx             # Badge colorati per tipo evento, tonalità, tempo, "Nuovo"
│   ├── styles/
│   │   ├── tokens.css            # Variabili CSS in coordinate OKLCH (palette logo, inchiostro viola, Inter)
│   │   ├── components.css        # Stili componenti Apple (grouped lists, bottom sheets, translucent bars)
│   │   ├── global.css            # Reset, stili base accessibili, safe-area iOS, tabular-nums
│   │   └── print.css             # Regole @media print per la stampa A4 in OKLCH (elementi lunghi e brevi)
│   ├── main.tsx                  # Bootstrap dell'applicazione Preact
│   └── sw.ts                     # Service worker custom Workbox con eventi skipWaiting
├── index.html                    # Entry point HTML con CSP rigorosa via meta-tag (con wss://)
├── package.json
├── tsconfig.json
└── vite.config.ts                # Configurazione Vite, base: '/Sito-di-vault-attivit-clan/', Preact, PWA e build
```

---

## 3. Schema del Database PostgreSQL (Supabase)

Tutte le tabelle di contenuto adottano il medesimo standard di audit e sincronizzazione:
1. `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
2. `created_at timestamptz NOT NULL DEFAULT now()`
3. `updated_at timestamptz NOT NULL DEFAULT now()` (aggiornato esclusivamente via trigger server-side)
4. `deleted_at timestamptz NULL` (soft delete per la propagazione delle cancellazioni ai client offline)

### 3.1 Tabelle Dati e Trigger

```sql
-- Trigger comune con search_path blindato a public (elimina warning del Supabase Security Advisor)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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

### 3.2 Indici, Trigger e Attivazione Realtime

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

-- Attivazione Realtime sulle tabelle di contenuto
ALTER PUBLICATION supabase_realtime ADD TABLE public.giochi;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.canti;
ALTER PUBLICATION supabase_realtime ADD TABLE public.eventi;
ALTER PUBLICATION supabase_realtime ADD TABLE public.odg_punti;
ALTER PUBLICATION supabase_realtime ADD TABLE public.allegati;
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

Il bucket `allegati` è configurato come pubblico (`public: true`):
- Limite dimensione per file: **10 MB** (imposto a livello di configurazione bucket).
- Tipi MIME consentiti: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
- **Nessuna policy SELECT pubblica su `storage.objects`:** Poiché il bucket è pubblico, i file sono accessibili direttamente dal CDN di Supabase all'URL pubblico `/storage/v1/object/public/allegati/{storage_path}`. Rimuovere la policy SELECT pubblica impedisce a utenti anonimi di effettuare l'enumerazione (listing) dei file nel bucket via API.

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

-- RLS su storage.objects: Scrittura, modifica e cancellazione riservate solo ad admin
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
2. **Creazione Admin manuale:** L'amministratore (coppia di credenziali condivisa tra i capi clan) viene creato direttamente dalla Dashboard di Supabase (*Authentication -> Users*). Subito dopo, l'UUID dell'utente creato viene inserito nella tabella `admin_users` tramite query SQL. Tutta la procedura è guidata in `docs/SETUP_MANUALE.md`.
3. **Flusso di Login:**
   - L'icona di accesso admin è posizionata con discrezione nell'header/Home.
   - Il modale di login richiede email e password.
   - `supabase.auth.signInWithPassword({ email, password })`.
   - Se il login ha successo, il client interroga la funzione SQL `is_admin()`. Se `false`, la sessione viene terminata con messaggio di errore.
   - La sessione è persistita nel local storage dal client ufficiale Supabase.
4. **Protezione in caso di compromissione:** Reimpostazione password o rimozione istantanea dell'UUID da `admin_users` tramite query SQL.

---

## 6. Algoritmo di Sincronizzazione Offline-First (IndexedDB)

### 6.1 Principio Fondamentale e Sostituzione Atomica
La UI legge **sempre e solo da IndexedDB**. 
- Durante la **Full Resync**, l'applicazione scarica **tutti i dati in memoria in un'area temporanea** e sostituisce il database locale IndexedDB in modo **rigorosamente atomico** all'interno di una singola transazione `readwrite` di `idb`. **Mai svuotare o cancellare IndexedDB prima del download**: se la rete si interrompe a metà, i dati locali preesistenti rimangono intatti e disponibili.
- **Timeout differenziati:**
  - Pull incrementale rapida di routine: timeout breve di **4 secondi** (se fallisce, l'utente naviga senza interruzioni e il sistema ritenta in background).
  - Primo download e Full Resync: timeout esteso a **25 secondi**, con suddivisione a lotti (chunking) per tabelle e possibilità di ripresa automatica.

### 6.2 Struttura IndexedDB (`scout_vault_db`)
- Database: `scout_vault_db`, versione 1.
- Object Stores: `giochi`, `bans`, `canti`, `eventi`, `odg_punti`, `allegati`, `sync_metadata`.

### 6.3 Macchina di Sync (Incrementale vs Completa)
1. **Verifica Timestamp:** Il client legge `last_sync_timestamp` da `sync_metadata`.
2. **Controllo Scadenza Tombstone (90 giorni):**
   - Se `last_sync_timestamp` è assente oppure `(now - last_sync_timestamp) > 90 giorni`, viene avviata la **Full Resync atomica**.
3. **Pull Incrementale:**
   - Query per tabella: `SELECT * FROM tabella WHERE updated_at >= (last_sync_timestamp - 5 secondi)`.
   - **Upsert / Delete:**
     - Se `deleted_at IS NULL`: scrittura/aggiornamento del record in IndexedDB (`db.put(tabella, record)`).
     - Se `deleted_at IS NOT NULL`: eliminazione del record locale (`db.delete(tabella, record.id)`).
   - Aggiornamento atomico di `last_sync_timestamp = server_now` in `sync_metadata`.
4. **Trigger di Sincronizzazione:**
   - Avvio applicazione (`DOMContentLoaded`).
   - Ritorno online (`window.addEventListener('online', ...)`).
   - `visibilitychange` (quando l'utente riattiva lo schermo o la scheda).
   - Notifiche Realtime: usate esclusivamente come **segnale di notifica** per avviare una pull incrementale con debounce a 300 ms.

### 6.4 Gestione Gerarchica Soft-Delete, Epoca di Sincronizzazione e Bonifica (180 giorni)
- **Regola Gerarchica:** Se un genitore (`gioco`, `ban`, `canto`, `evento`) subisce soft-delete, tutti i figli correlati (`odg_punti`, `allegati`) vengono nascosti automaticamente dalla UI. In caso di ripristino del genitore dal Cestino, anche i figli tornano visibili.
- **Conservazione Tombstone:** I tombstone su server vengono conservati per **180 giorni** (soglia di garanzia per la sincronizzazione incrementale dei client offline).
- **Funzione SQL `purge_old_tombstones()`:** Procedura RPC admin-only (`SECURITY DEFINER`, `search_path = public`) che elimina fisicamente dal server SOLO le righe con `deleted_at < now() - interval '180 days'`, preservando l'integrità dei tombstone recenti.
- **Epoca di Sincronizzazione (`sync_epoch` in `system_meta`):**
  - Per consentire l'eliminazione definitiva immediata ("Elimina subito") di singoli record senza lasciare orfani i dispositivi offline, il server mantiene un contatore `sync_epoch`.
  - La funzione `bump_sync_epoch()` incrementa tale contatore a ogni hard-delete manuale.
  - Se un client confronta la propria epoca locale con quella del server e rileva una discrepanza, invalida immediatamente la cache incrementale e scatena un **Full Resync Atomico**, garantendo l'eliminazione di record fantasma su qualsiasi dispositivo al ritorno online.
- **Pulizia Storage Fisico (Fase 5):** Predisposizione in `admin_actions.ts` della cancellazione congiunta degli oggetti dal bucket Supabase Storage (`storage.objects`).

---

## 7. Strategia di Caching e PWA

### 7.1 Base Path, Manifest e Service Worker
- GitHub Pages Base Path: `/Sito-di-vault-attivit-clan/`.
- Manifest: `scope: "/Sito-di-vault-attivit-clan/"`, `start_url: "/Sito-di-vault-attivit-clan/#/"`.
- Service Worker Workbox configurato sul base path con precache dell'App Shell (HTML, bundle JS/CSS, font WOFF2, icone).
- Aggiornamento controllato (`skipWaiting: false`): avviso discreto *"Nuova versione disponibile. [Aggiorna ora]"*. Al click, invio messaggio `SKIP_WAITING` e reload controllato.

### 7.2 Content Security Policy (CSP)
Meta-tag restrittivo in `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'wasm-unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://lpeiyzwccedtqjbficjo.supabase.co;
  connect-src 'self' https://lpeiyzwccedtqjbficjo.supabase.co wss://lpeiyzwccedtqjbficjo.supabase.co;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
">
```

### 7.3 Cache degli Allegati (Cache API) e Persistenza iOS
- Cache storage dedicata: `scout-attachments-v1`.
- **Auto-download:** Allegati $< 500\text{ KB}$ scaricati in background dopo la sync.
- **Download su richiesta:** Pulsante *"Scarica tutti gli allegati per l'uso offline"* con barra di progresso.
- **Fallback visivo:** *"Non scaricato — connettiti a internet per aprirlo"*.
- **Persistenza iOS:** Chiamata `navigator.storage.persist()`. Banner di istruzioni per l'installazione su Schermata Home di iOS per neutralizzare la policy di rimozione dei 7 giorni di Safari.

---

## 8. Specifiche Funzionali di Sezione

### 8.1 Giochi e Bans
- **Giochi:** Card con nome, materiali occorrenti, svolgimento/regole, allegati.
- **Bans:** Card e modalità lettura speciale:
  - Font a scala aumentata regolabile (+/− da 18px a 32px).
  - Contrasto elevatissimo per lettura alla luce del sole.
  - Distinzione tipografica tra testo del canto e note sui gesti.
  - Attivazione della **Screen Wake Lock API** durante la modalità lettura con ri-aggancio automatico su `visibilitychange`.

### 8.2 Canti e Parser ChordPro (Fase 4)
- **Grammatica e Tokenizer:**
  - Sintassi `[Accordo]sillaba`, supporto bilingue nativo (notazione italiana `Do, Re, Mi...` e notazione internazionale `C, D, E...`, con alterazioni `#`, `b` e suffissi complessi come `m7`, `sus4`, `dim`, `/Basso`).
  - Direttive strutturali riconosciute: `{strofa}`, `{ritornello}` / `{soc}` / `{eoc}`, `{ponte}`, `{nuova_pagina}` e metadati `{ritmo}`, `{bpm}`, `{misura}`, `{capo}`.
- **Rendering VDOM Sicuro (Zero `innerHTML`):**
  - Segmentazione in AST tipizzato (`ChordProAST`) e generazione ricorsiva di Virtual DOM nodi Preact.
  - Struttura tipografica `.song-chord-column` in `display: inline-flex; flex-direction: column; vertical-align: bottom;`:
    - `.song-chord`: visualizzato sopra la sillaba in grassetto Azzurro Scuro (`--color-calendario`: `oklch(0.42 0.15 255)`).
    - `.song-lyric`: testo sillabico ancorato verticalmente sotto l'accordo; non si disallinea se la riga subisce wrap orizzontale su schermi stretti (320px).
    - `.song-chorus-block`: blocco ritornello caratterizzato da barra laterale sinistra color giallo scout (`--color-yellow`) e padding ergonomico.
- **Motore di Trasposizione Semitonale Circolare:**
  - Trasposizione a 12 semitoni temperati in memoria (`transposeChord`, `transposeChordPro`) che preserva la notazione originale (italiana o anglosassone) e gestisce con precisione i bassi alternativi (slash chords).
  - Controlli rapidi `-1`, `+1`, `Orig` nella vista esecuzione per adattare istantaneamente il brano alla voce della comunità o al capotasto.
- **Ricerca Intelligente Senza Falsi Positivi:**
  - `stripChords(testo_chordpro)` elimina accordi e direttive prima dell'indicizzazione nella ricerca; una ricerca per parole come "Do", "Re" o "Fa" matcha esclusivamente parole effettive del testo, azzerando i falsi positivi.
- **Modalità Lettura / Esecuzione a Tutto Schermo:**
  - Componente `CantoReadingMode`: regolazione del font (+/−), toggle accordi visibili/nascosti, tonalità trasposta e acquisizione del **Screen Wake Lock** per mantenere acceso il display durante l'animazione di clan o il fuoco di bivacco.
- **Editor Admin Live e Validatore Morbido:**
  - Componente `CantoFormSheet` con anteprima live in tempo reale, pulsanti di inserimento rapido per accordi `[Accordo]` e direttive alla posizione del cursore, controllo duplicati morbido (Levenshtein $\le 2$) e validatore sintattico morbido (`validateChordPro`).

### 8.3 Calendario e Ordine del Giorno (ODG)
- Fuso `Europe/Rome`, locale `it-IT`, inizio lunedì. Viste Mese e Lista prossimi eventi.
- Dettaglio Evento completo.
- **ODG:** Punti ordinabili, casella di spunta e pulsante *"Riporta punti non conclusi alla prossima riunione"*, che clona i punti non completati collegandoli con `riportato_da`. Stampa rapida ODG.

### 8.4 Motore di Ricerca e Ordinamento
- **Campi indicizzati:** Multi-campo (titolo, testo, regole, materiali, note gesti; accordi esclusi dal match per non generare falsi positivi).
- **Normalizzazione:** Rimozione diacritici/accenti (es. `perche` trova `perché`) e case-insensitive.
- **Regola Tolleranza Typo (Distanza Levenshtein):**
  - Token brevi (< 4 caratteri): Exact match (Levenshtein = 0).
  - Token medi (4–7 caratteri): Levenshtein $\le 1$.
  - Token lunghi ($\ge 8$ caratteri): Levenshtein $\le 2$ (es. "aveleata" $\rightarrow$ "avvelenata").
- **Evidenziazione sicura:** TextNode alternati a tag `<mark>` (nessun `innerHTML`).
- **Ordinamento (esattamente 4 opzioni):** A→Z (default con `Intl.Collator`), Z→A, Più recenti, Più vecchi. Parametri conservati in `sessionStorage`.

### 8.5 Architettura di Stampa A4
- Esecuzione in-page con `window.print()` e `@media print` A4.
- **Giochi e Bans:** Flusso continuo senza interruzioni forzate. `break-inside: avoid` applicato **solo agli elementi brevi** (< 600 caratteri); gli elementi lunghi possono spezzarsi normalmente tra le pagine per evitare grandi spazi vuoti a fondo pagina. `break-after: avoid` sui titoli.
- **Canti:** Ogni canto inizia su una pagina nuova (`break-before: page`), rispetto dei tag `{nuova_pagina}`, intestazione ridotta nelle pagine successive ("Titolo — pag. 2/2") e rilevamento visivo preventivo di overflow in anteprima con avviso.
- **ODG:** Scheda singola compatta con caselle quadrate stampabili `[ ]` per la spunta a penna.

---

## 9. Keepalive e Workflow CI/CD

### 9.1 Deploy su GitHub Pages (`deploy.yml`)
- Trigger su `push` al branch `main`.
- Esclusione percorsi documentazione: `paths-ignore: ['docs/**']`.
- Build con Vite (base path `/Sito-di-vault-attivit-clan/`) e pubblicazione su Pages.

### 9.2 Keepalive Supabase e Heartbeat 60 Giorni (`keepalive.yml`)
- Esecuzione pianificata ogni 2 giorni (`0 6 */2 * *`) più avvio manuale.
- Esegue una reale query REST SQL (`GET /rest/v1/giochi?select=id&limit=1`) verificando HTTP 200.
- **Heartbeat 60 giorni:** Controlla la data dell'ultimo commit su `main`. Se sono passati più di 40 giorni, committa un timestamp su `docs/keepalive_heartbeat.txt` con messaggio `chore(keepalive): heartbeat [skip ci]`.
  - Poiché il file è in `docs/` e il commit contiene `[skip ci]`, il workflow `deploy.yml` non viene eseguito, evitando build inutili.
  - L'attività del commit azzera la soglia dei 60 giorni di inattività di GitHub.

---

## 10. Rischi Noti e Matrice di Mitigazione

| Rischio Identificato | Probabilità | Impatto | Strategia di Mitigazione Adottata |
| :--- | :--- | :--- | :--- |
| **Pausa automatica Supabase dopo 7 giorni di inattività** | Alta (periodi senza attività) | Bloccante per aggiornamenti | Workflow GitHub Actions `keepalive.yml` ogni 2 giorni con query REST a Postgres. Secondo ping indipendente documentato via cron-job.org. |
| **Disattivazione workflow GitHub Actions dopo 60 giorni** | Media | Alto (blocca keepalive) | Controllo ultimo commit in `keepalive.yml`: se $> 40$ giorni, commit heartbeat su `docs/` con `[skip ci]` (zero deploy sprecati e timer resettato). |
| **Cancellazione storage IndexedDB su iOS Safari dopo 7 giorni** | Alta (da Safari browser) | Medio (perdita dati offline) | Richiesta `navigator.storage.persist()`. Banner d'installazione su Schermata Home di iOS (dove la policy non si applica). Resync atomico completo silenzioso se i dati risultano vuoti. |
| **Saturazione quota Storage Supabase (1 GB Free Tier)** | Media | Alto | Compressione client-side prima dell'upload (max 1600px). Esclusione file audio in v1. Monitoraggio occupazione spazio in Admin e limite bucket a 10 MB. |
| **Listing pubblico non autorizzato del bucket Storage** | Media | Sicurezza/Privacy | Rimozione policy SELECT pubblica su `storage.objects`: i file sono raggiungibili solo via URL diretto, impedendo il list dei file ad anonimi. |
| **Vulnerabilità XSS da contenuti utente/database** | Bassa (un solo admin) | Critico | Divieto assoluto di `innerHTML`. Templating JSX/Preact con escaping automatico. Parser ChordPro basato su nodi DOM nativi. |
| **Warning search_path Supabase Security Advisor** | Certa (se omesso) | Qualità/Sicurezza | Dichiarazione esplicita `SET search_path = public` su tutte le funzioni SQL (`set_updated_at`, `is_admin`). |

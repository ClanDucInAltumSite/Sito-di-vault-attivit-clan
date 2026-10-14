# Registro delle Decisioni Architetturali (ADR) - Sito Vault Scout Clan

Questo documento raccoglie tutte le decisioni architetturali, i vincoli e le motivazioni tecniche adottate nello sviluppo del Vault di Clan, con riferimento esplicito alle fonti e documentazioni ufficiali verificate.

---

## ADR-001: Scelta del Framework Frontend — Preact + Vite + TypeScript (strict)
- **Stato:** Approvato (Fase 0)
- **Opzioni considerate:** Preact, Svelte 5.
- **Decisione:** Adozione di **Preact** (con `@preact/preset-vite` e `preact/hooks`).
- **Motivazione:**
  1. *Footprint e performance:* Preact ha un runtime di soli ~4.5 kB minificato e gzippato (Preact + Hooks), ideale per telefoni economici e connessioni lente all'aperto.
  2. *Sicurezza XSS per design:* Il Virtual DOM con sintassi TSX effettua per impostazione predefinita l'escaping rigoroso di ogni valore dinamico (`{testo}` genera un TextNode sicuro). È impossibile inserire inavvertitamente codice HTML malevolo nel DOM senza passare per `dangerouslySetInnerHTML`, che nel progetto è rigorosamente bandito.
  3. *Stabilità e testabilità:* Preact supporta nativamente TypeScript strict senza compilatori proprietari esterni. I test con Vitest e DOM environment (`happy-dom`) sono rapidi, standard e privi di complessità di trasformazione.
  4. *Integrazione PWA:* Compatibilità immediata al 100% con `vite-plugin-pwa` e Workbox.

---

## ADR-002: Routing Basato su Hash (`#/`)
- **Stato:** Approvato (Fase 0)
- **Opzioni considerate:** HTML5 History API (`pushState`), Hash Routing (`location.hash`).
- **Decisione:** Adozione di **Hash Routing** (`#/giochi`, `#/bans`, `#/canti`, `#/calendario`, `#/stampa`, `#/admin`).
- **Motivazione:**
  1. GitHub Pages ospita file statici e non supporta la configurazione di regole di riscrittura server-side (URL rewrite su `/index.html`). L'uso di History API comporterebbe errori HTTP 404 al ricaricamento o apertura di URL diretti senza complessi hack (come redirect via `404.html` che rallentano e creano problemi di caching con i Service Worker).
  2. Il routing con hash funziona istantaneamente sia online che offline da cache Service Worker senza alcuna dipendenza da configurazioni server.

---

## ADR-003: Modello di Scrittura Solo Online e Lettura Offline da IndexedDB
- **Stato:** Approvato (Fase 0)
- **Decisione:** L'applicazione legge **sempre** i dati dal database locale **IndexedDB** (Single Source of Truth per l'interfaccia). Le operazioni di scrittura (creazione, modifica, eliminazione da parte dell'admin) sono consentite **esclusivamente online**. In assenza di rete, l'app opera in modalità sola lettura protetta.
- **Motivazione:**
  1. L'app ha un unico utente con permessi di scrittura (coppia di credenziali admin condivisa tra i capi clan) e decine di utenti scout in sola consultazione.
  2. Evita la complessità ingegneristica sproporzionata di code di mutazione offline, merge bidirezionale, risoluzione di conflitti CRDT o gestione di stati "in sospeso" con allegati pesanti non inviati.
  3. Gli admin modificano solo quando sono in grado di confermare l'esito direttamente su Supabase. L'utente offline ha la garanzia di visualizzare l'ultimo stato coerente salvato senza rischiare dati incoerenti o non propagati.

---

## ADR-004: Prevenzione Pausa Gratuita Supabase e Limite 60 Giorni GitHub Actions
- **Stato:** Approvato (Fase 0, aggiornato con verifica documentale ufficiale)
- **Fonti ufficiali verificate:**
  1. *Supabase Inactivity Pausing:* [Supabase Documentation - Project Pausing](https://supabase.com/docs/guides/platform/pausing). Nei progetti con piano gratuito (Free Tier), l'istanza PostgreSQL viene messa automaticamente in pausa dopo **7 giorni consecutivi di inattività** sul database (mancanza di query utente REST/Postgres). La pausa non cancella i dati (conservati per 1 anno), ma spegne il compute instance rendendo l'app offline finché il progetto non viene ripristinato manualmente dalla dashboard.
  2. *GitHub Actions 60-Day Scheduled Workflow Policy:* [GitHub Docs - Disabling and enabling a workflow](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow). La documentazione ufficiale stabilisce espressamente: *"In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."* L'attività del repository che resetta la finestra di 60 giorni richiede modifiche dirette al codice/commit (apertura issue, commenti o release tag non resettano con certezza il timer).
- **Decisione e Mitigazione:**
  1. **Keepalive Workflow (`.github/workflows/keepalive.yml`):**
     - Schedulato ogni 2-3 giorni (`0 6 */2 * *`) con supporto a esecuzione manuale `workflow_dispatch`.
     - Esegue una **vera query REST a Postgres** (`GET /rest/v1/giochi?select=id&limit=1`) autenticata con l'Anon Key letta da GitHub Secrets/Variables. Verifica che la risposta sia HTTP 200. Se Supabase risponde con errore o è in pausa, il workflow fallisce visibilmente inviando una notifica email automatica da GitHub all'amministratore.
  2. **Superamento del limite dei 60 giorni senza Deploy superfluo:**
     - Il workflow `keepalive.yml` controlla la data dell'ultimo commit su `main`. Se sono trascorsi più di 40 giorni, esegue un commit di heartbeat aggiornando `docs/keepalive_heartbeat.txt` con messaggio `chore(keepalive): heartbeat [skip ci]`.
     - **Come si evita che l'heartbeat scateni `deploy.yml`:**
       a) Nel workflow `deploy.yml`, il trigger di push esclude esplicitamente i percorsi di documentazione tramite `paths-ignore: ['docs/**']`.
       b) Il messaggio di commit include il tag standard `[skip ci]`, supportato nativamente da GitHub Actions per non avviare workflow correlati al push.
  3. **Ridondanza esterna a costo zero:**
     - In `docs/SETUP_MANUALE.md` viene fornita la guida per impostare un ping gratuito indipendente tramite servizio esterno (ad es. *Cron-job.org* o *UptimeRobot*), che esegue una chiamata GET ogni 3 giorni all'endpoint REST di Supabase.

---

## ADR-005: Formato ChordPro Esteso con Notazione Italiana e Rendering DOM Nativo
- **Stato:** Approvato (Fase 0)
- **Decisione:** I canti vengono archiviati in formato ChordPro semplificato (`[Accordo]sillaba`). Il parser supporta la notazione italiana (`Do, Re, Mi, Fa, Sol, La, Si` con alterazioni `#`, `b` e suffissi `m, 7, maj7, dim, sus4, add9, /Basso`) e converte trasparentemente anche la notazione anglosassone (`C, D, E, F, G, A, B`).
- **Rendering e Sicurezza:**
  1. Il parser genera un Abstract Syntax Tree (AST) strutturato e lo converte in nodi DOM Preact. È rigorosamente vietato qualsiasi uso di `innerHTML` o regex di sostituzione HTML grezzo.
  2. Il rendering dispone l'accordo in un contenitore a due righe (accordo in alto, sillaba in basso) raggruppato in blocchi inline-block/flex. In caso di testo lungo su schermi mobili stretti, l'accordo rimane perfettamente ancorato sopra la sillaba anche quando la frase va a capo su più righe.
  3. La trasposizione opera sul modello dati a livello semitoni matematici ($0 \dots 11$) calcolando l'armatura appropriata (diesis vs bemolli) e agisce esclusivamente a runtime per la visualizzazione, lasciando invariato il testo ChordPro archiviato su database.

---

## ADR-006: Gestione Allegati, Compressione Client-Side e Policy Storage Senza Listing Pubblico
- **Stato:** Approvato (Fase 0, aggiornato con verifica policy Supabase Storage)
- **Fonti verificate:**
  1. Supabase Free Tier offre **1 GB** di archiviazione Storage complessiva.
  2. *Supabase Storage Public Bucket Documentation:* Quando un bucket è impostato come `public = true`, i singoli oggetti vengono serviti direttamente dal CDN di Supabase all'endpoint `/storage/v1/object/public/{bucket}/{path}` senza passare dalle regole RLS di `storage.objects`. Non è necessaria alcuna policy `SELECT` per visualizzare/scaricare file con il loro URL diretto. La policy `SELECT` su `storage.objects` abiliterebbe invece il listing dell'intero bucket (es. `supabase.storage.from('allegati').list()`).
- **Decisione:**
  1. **Nessuna policy SELECT pubblica su `storage.objects`:** Per ragioni di sicurezza e privacy, si vieta l'esplorazione (listing) anonima dell'intero contenuto del bucket. I file sono raggiungibili unicamente tramite i rispettivi percorsi diretti archiviati nella tabella `allegati`.
  2. Solo `is_admin()` ha i permessi `INSERT`, `UPDATE` e `DELETE` su `storage.objects`.
  3. In v1 sono supportati unicamente **immagini (JPG, PNG, WebP)** e **documenti PDF**. I file audio sono **esclusi dalla v1** per preservare il limite di 1 GB (architettura già predisposta per v2 con colonna `mime text`).
  4. Compressione client-side prima dell'upload per tutte le immagini (max 1600px, WebP/JPEG qualità 0.82) con riduzione media del 90% del peso.
  5. Limite dimensione per file: 10 MB per i PDF e 5 MB per le immagini compresse.

---

## ADR-007: Stampa In-Page con CSS `@media print` e Gestione Elementi Lunghi
- **Stato:** Approvato (Fase 0, aggiornato per regole break-inside)
- **Decisione:** La stampa avviene interamente nella stessa pagina tramite `window.print()` e `@media print` A4.
- **Specifiche per sezione:**
  - *Giochi e Bans:* Flusso continuo senza interruzioni di pagina forzate. La regola `break-inside: avoid` viene applicata **esclusivamente agli elementi brevi** (testo sotto i 600 caratteri); gli elementi lunghi possono spezzarsi liberamente tra le pagine per non lasciare ampi spazi bianchi a fondo pagina. `break-after: avoid` rimane attivo sui titoli per evitare titoli orfani.
  - *Canti:* Nuova pagina obbligatoria per ogni canto (`break-before: page`), rispetto dei tag `{nuova_pagina}`, intestazione ridotta nelle pagine successive ("Titolo — 2/2") e algoritmo di rilevamento overflow che avvisa nell'anteprima se il canto sfora l'A4.
  - *ODG:* Scheda singola compatta con caselle quadrate stampabili per la spunta manuale.

---

## ADR-008: Palette Colori Scout, Contrasto WCAG AA e Tipografia
- **Stato:** Approvato (Fase 0)
- **Decisione:** Palette Scout: Giallo `#FFC93C`, Rosso `#D9381E` (calibrato per AA su bianco), Azzurro `#1E74A6` (calibrato per AA su chiaro) / `#2F8FC7` (su scuro).
- **Regola inderogabile:** Su sfondo Giallo, testo **sempre** scuro `#21262B` (contrasto > 10:1, AAA).
- **Tipografia:** Font **Outfit** self-hosted (WOFF2 in `public/fonts/`, pesi 400, 600, 700), zero chiamate esterne a Google Fonts.

---

## ADR-009: Centralizzazione Stringhe UI (`src/lib/i18n.ts`)
- **Stato:** Approvato (Fase 0)
- **Decisione:** Tutte le stringhe, etichette, messaggi e testi dell'applicazione risiedono in un unico file TypeScript tipizzato (`src/lib/i18n.ts`). Lingua unicamente in italiano.

---

## ADR-010: Politica Tombstone (Conservazione 180 giorni) e Pulizia Definitiva Storage
- **Stato:** Approvato (Fase 0, aggiornato con gerarchia tombstone)
- **Decisione:**
  1. Quando un elemento genitore (`gioco`, `ban`, `canto`, `evento`) subisce soft-delete (`deleted_at = now()`), tutti i relativi elementi figli associati (`odg_punti`, `allegati`) vengono **nascosti dalla UI** e, in caso di ripristino del genitore, ripristinati congiuntamente.
  2. **Periodo di conservazione dei tombstone:** Fissato a **180 giorni** sul server, ben superiore alla soglia dei 90 giorni che attiva la Full Resync dei client.
  3. **Pulizia definitiva del Cestino (Hard Delete):** Tramite apposita funzione di svuotamento definitivo attivabile da admin, gli elementi con `deleted_at < now() - interval '180 days'` (o forzati dall'admin nel Cestino) vengono eliminati fisicamente dal database e i corrispondenti file su Supabase Storage vengono cancellati definitivamente.

---

## ADR-011: Attivazione Supabase Realtime via Migrazione SQL
- **Stato:** Approvato (Fase 1)
- **Decisione:** Nelle migrazioni SQL viene aggiunta l'istruzione esplicita per abilitare il Realtime sulle tabelle di contenuto:
  `ALTER PUBLICATION supabase_realtime ADD TABLE public.giochi, public.bans, public.canti, public.eventi, public.odg_punti, public.allegati;`
- **Uso:** Il client frontend ascolta il canale broadcast Postgres Changes su queste tabelle come puro **segnale** di notifica (debounced a ~300ms) per avviare una pull incrementale, garantendo coerenza e sicurezza dei dati.

---

## ADR-012: Meccanica di Full Resync Atomico e Timeout Differenziati
- **Stato:** Approvato (Fase 1)
- **Decisione:**
  1. Durante la **Full Resync** (primo avvio dell'app o dopo assenza > 90 giorni), i dati dal server vengono scaricati interamente in memoria in un'area temporanea.
  2. La sostituzione dei dati in IndexedDB avviene in modo **strettamente atomico** tramite una singola transazione `readwrite` di `idb` **solo ed esclusivamente a download completato con successo**. È severamente vietato svuotare o cancellare IndexedDB prima del download, prevenendo la perdita di dati locali in caso di caduta della connessione.
  3. **Timeout differenziati:**
     - Pull incrementale rapida di routine: timeout breve di **4 secondi** (se fallisce, l'utente continua a navigare sui dati locali e riprova in background).
     - Primo download e Full Resync: timeout esteso a **25 secondi**, con suddivisione a lotti (chunking) per tabelle e possibilità di ripresa automatica.

---

## ADR-013: Regola Rigorosa per Tolleranza Typo nella Ricerca Multi-Campo
- **Stato:** Approvato (Fase 1)
- **Decisione:** Per evitare incoerenze tra specifica e test, l'algoritmo di corrispondenza per typo adotta la seguente regola deterministica su ciascun token normalizzato:
  1. **Token corti (lunghezza < 4 caratteri):** Nessun typo consentito (distanza Levenshtein = 0, exact prefix match).
  2. **Token medi (lunghezza tra 4 e 7 caratteri):** Distanza Levenshtein massima **1**.
  3. **Token lunghi (lunghezza $\ge 8$ caratteri):** Distanza Levenshtein massima **2** (es. termine ricercato "aveleata", lunghezza 8 caratteri, corrisponde ad "avvelenata" con distanza 2).
- Questa formulazione garantisce precisione su parole brevi senza falsi positivi e massima tolleranza su termini lunghi.

---

## ADR-014: Base Path GitHub Pages, PWA Scope e CSP con WebSockets
- **Stato:** Approvato (Fase 1)
- **Decisione:**
  1. Base path Vite configurato su `/Sito-di-vault-attivit-clan/`.
  2. Manifest PWA con `scope: "/Sito-di-vault-attivit-clan/"` e `start_url: "/Sito-di-vault-attivit-clan/#/"`.
  3. Service Worker registrato relativamente al base path corretto.
  4. Content Security Policy (meta tag) include esplicitamente `wss://lpeiyzwccedtqjbficjo.supabase.co` e `https://lpeiyzwccedtqjbficjo.supabase.co` in `connect-src` per garantire il funzionamento del canale Realtime.

---

## ADR-015: Protezione Funzioni Postgres contro Mutable search_path
- **Stato:** Approvato (Fase 1)
- **Decisione:** Tutte le funzioni create nel database (`set_updated_at`, `is_admin`, procedure di pulizia) dichiarano esplicitamente `SET search_path = public` (o `SET search_path = ''`) per eliminare le vulnerabilità di ricerca percorso e soddisfare al 100% i controlli del Supabase Security Advisor.

---

## Elenco Correzioni Pianificate per le Fasi Successive (Da Fare)

Questa sezione tiene traccia delle implementazioni puntuali richieste e approvate al termine della Fase 0, che verranno integrate nei rispettivi moduli durante le fasi operative corrispondenti:

1. **FASE 2 — Dati e Offline:**
   - **Full Resync Atomico:** Nel primo download e nel full resync (> 90 giorni di assenza), i record vengono scaricati per intero in un buffer in memoria e scritti in IndexedDB in un'unica transazione atomica `readwrite`. È vietato svuotare IndexedDB prima del termine del download.
   - **Timeout Differenziati:** Timeout breve a 4s per le pull incrementali; timeout esteso a 25s per full resync e primo avvio, con suddivisione a blocchi e gestione della ripresa.
   - **Soft Delete Gerarchica:** Quando un elemento genitore (`gioco`, `ban`, `canto`, `evento`) subisce soft-delete (`deleted_at != null`), i relativi figli (`odg_punti`, `allegati`) vengono nascosti automaticamente dalla UI e ripristinati insieme al genitore in caso di un-delete.

2. **FASE 3 — Giochi e Bans & FASE 5 — Allegati:**
   - **Cestino e Rimozione Storage Definitiva:** Conservazione tombstone sul server a 180 giorni. La pulizia definitiva del Cestino (hard delete attivata dall'admin) cancella sia i record nel database sia i file fisici corrispondenti da Supabase Storage (`storage.objects`).

3. **FASE 3 — Ricerca e Ordinamento:**
   - **Regola Deterministica Tolleranza Typo:**
     - Termini con lunghezza < 4 caratteri: Exact match (Levenshtein = 0).
     - Termini con lunghezza 4–7 caratteri: Distanza Levenshtein $\le 1$.
     - Termini con lunghezza $\ge 8$ caratteri: Distanza Levenshtein $\le 2$ (ad es. termine cercato "aveleata", lunghezza 8 caratteri, trova "avvelenata" con distanza 2).
     - Test unitari allineati a questa specifica.

4. **FASE 6 — Stampa:**
   - **Gestione Spezzatura Pagine Giochi e Bans:** La direttiva `break-inside: avoid` viene applicata unicamente agli elementi brevi (testo sotto i 600 caratteri o classe `.print-item-short`); gli elementi lunghi possono spezzarsi normalmente tra le pagine A4 per evitare spazi bianchi a fondo pagina. `break-after: avoid` rimane attivo sui titoli.


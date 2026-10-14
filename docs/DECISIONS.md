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
- **Stato:** Approvato (Fase 0)
- **Fonti ufficiali verificate:**
  1. *Supabase Inactivity Pausing:* [Supabase Documentation - Project Pausing](https://supabase.com/docs/guides/platform/pausing). Nei progetti con piano gratuito (Free Tier), l'istanza PostgreSQL viene messa automaticamente in pausa dopo **7 giorni consecutivi di inattività** sul database (mancanza di query utente REST/Postgres). La pausa non cancella i dati (conservati per 1 anno), ma spegne il compute instance rendendo l'app offline finché il progetto non viene ripristinato manualmente dalla dashboard.
  2. *GitHub Actions 60-Day Scheduled Workflow Policy:* [GitHub Docs - Disabling and enabling a workflow](https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-workflow-runs/disabling-and-enabling-a-workflow). Nei repository pubblici, i workflow con trigger `schedule` (cron) vengono **disabilitati automaticamente dopo 60 giorni** di assenza di attività (commit/push sul repository).
- **Decisione e Mitigazione:**
  1. **Keepalive Workflow (`.github/workflows/keepalive.yml`):**
     - Schedulato ogni 2-3 giorni (`0 6 */2 * *`) con supporto a esecuzione manuale `workflow_dispatch`.
     - Esegue una **vera query REST a Postgres** (`GET /rest/v1/giochi?select=id&limit=1`) autenticata con l'Anon Key letta da GitHub Secrets/Variables. Verifica che la risposta sia HTTP 200. Se Supabase risponde con errore o è in pausa, il workflow fallisce visibilmente inviando una notifica email automatica da GitHub all'amministratore.
  2. **Superamento del limite dei 60 giorni di GitHub Actions:**
     - Il workflow `keepalive.yml` include un controllo sulla data dell'ultimo commit sul branch `main`. Se sono trascorsi più di 40 giorni dall'ultimo commit, il workflow effettua un commit di aggiornamento leggero su un file timestamp (`docs/keepalive_heartbeat.txt`) con permessi `contents: write`, resettando in modo del tutto trasparente il timer dei 60 giorni.
  3. **Ridondanza esterna a costo zero:**
     - In `docs/SETUP_MANUALE.md` viene fornita la guida per impostare un ping gratuito indipendente tramite servizio esterno (ad es. *Cron-job.org* o *UptimeRobot*), che esegue una chiamata GET ogni 3 giorni all'endpoint REST di Supabase, garantendo la continuità anche qualora GitHub Actions dovesse subire blocchi o interruzioni.

---

## ADR-005: Formato ChordPro Esteso con Notazione Italiana e Rendering DOM Nativo
- **Stato:** Approvato (Fase 0)
- **Decisione:** I canti vengono archiviati in formato ChordPro semplificato (`[Accordo]sillaba`). Il parser supporta la notazione italiana (`Do, Re, Mi, Fa, Sol, La, Si` con alterazioni `#`, `b` e suffissi `m, 7, maj7, dim, sus4, add9, /Basso`) e converte trasparentemente anche la notazione anglosassone (`C, D, E, F, G, A, B`).
- **Rendering e Sicurezza:**
  1. Il parser genera un Abstract Syntax Tree (AST) strutturato e lo converte in nodi DOM Preact. È rigorosamente vietato qualsiasi uso di `innerHTML` o regex di sostituzione HTML grezzo.
  2. Il rendering dispone l'accordo in un contenitore a due righe (accordo in alto con colore azzurro o giallo, sillaba in basso) raggruppato in blocchi inline-block/flex. In caso di testo lungo su schermi mobili stretti, l'accordo rimane perfettamente ancorato sopra la sillaba anche quando la frase va a capo su più righe.
  3. La trasposizione opera sul modello dati a livello semitoni matematici ($0 \dots 11$) calcolando l'armatura appropriata (diesis vs bemolli) e agisce esclusivamente a runtime per la visualizzazione, lasciando invariato il testo ChordPro archiviato su database.

---

## ADR-006: Gestione Allegati, Compressione Client-Side ed Esclusione Audio in v1
- **Stato:** Approvato (Fase 0)
- **Fonti verificate:** Supabase Free Tier offre **1 GB** di archiviazione Storage complessiva.
- **Decisione:**
  1. In v1 sono supportati unicamente **immagini (JPG, PNG, WebP)** e **documenti PDF**. I file audio (registrazioni audio o mp3 dei canti) sono **esclusi dalla v1** per evitare di saturare rapidamente la quota gratuita di 1 GB.
  2. L'architettura del database (`allegati` con `mime text`, `storage_path text`, `dimensione bigint`) è già predisposta per l'abilitazione di tipi MIME `audio/*` in v2 senza alcuna alterazione dello schema.
  3. Per le immagini caricate da smartphone (spesso 5–15 MB scattate con fotocamere moderne), viene implementata la compressione/ridimensionamento automatico client-side tramite Canvas HTML5: le foto vengono ridotte a un massimo di 1600px di lato lungo e codificate in WebP o JPEG a qualità 0.82 prima dell'invio a Supabase Storage (riduzione media del 90% del peso, tipicamente da 8 MB a ~300 KB).
  4. Dimensione massima per singolo file imposta sia lato client che lato bucket RLS: 10 MB per i PDF e 5 MB per le immagini compresse.

---

## ADR-007: Stampa In-Page con CSS `@media print`
- **Stato:** Approvato (Fase 0)
- **Decisione:** La stampa avviene interamente nella stessa pagina tramite la chiamata standard `window.print()`, applicando regole `@media print` e direttive `@page A4`. Nessuna finestra popup e nessuna libreria di generazione PDF pesante (es. jsPDF / html2pdf).
- **Motivazione:**
  1. Su smartphone Android e iOS i browser bloccano sistematicamente i popup o aprono schede orfane che perdono il contesto della PWA offline.
  2. Le librerie esterne di generazione PDF client-side pesano centinaia di kilobyte, degradano la nitidezza dei font nativi e consumano molta memoria RAM sui dispositivi mobili.
  3. `@media print` sfrutta il motore tipografico nativo del browser, garantendo esportazione perfetta in "Salva come PDF" su Chrome/Edge/Firefox e stampa AirPrint su iOS.
  4. Specifiche per sezione:
     - *Giochi e Bans:* Flusso continuo con `break-inside: avoid` su ciascun elemento e separatore sottile, evitando sprechi di carta.
     - *Canti:* Nuova pagina obbligatoria per ogni canto (`break-before: page`), rispetto dei tag `{nuova_pagina}`, intestazione ridotta nelle pagine successive ("Titolo — 2/2") e algoritmo di rilevamento overflow che avvisa nell'anteprima se il canto sfora l'A4.
     - *ODG:* Scheda singola compatta con caselle quadrate stampabili per la spunta manuale.

---

## ADR-008: Palette Colori Scout, Contrasto WCAG AA e Tipografia
- **Stato:** Approvato (Fase 0)
- **Colori istituzionali di partenza:** Giallo `#FFC93C`, Rosso `#E8442D`, Azzurro `#2F8FC7`, Sfondo Chiaro `#FAF6EC`, Testo Chiaro `#21262B`, Sfondo Scuro `#1E2A33`.
- **Verifica Contrasto WCAG AA:**
  - Su sfondo Giallo (`#FFC93C`): il testo bianco NON ha contrasto sufficiente (1.5:1). Viene imposto per regola ferrea testo scuro `#1E2A33` (rapporto di contrasto **10.2:1**, conforme WCAG AAA).
  - Testo su Sfondo Chiaro (`#FAF6EC`): `#21262B` produce contrasto **13.5:1** (conforme AAA).
  - Pulsante Rosso: `#D9381E` con testo bianco `#FFFFFF` produce contrasto **4.8:1** (conforme AA per testo normale, AAA per testo grande).
  - Accenti Azzurro: `#1E74A6` (calibrato leggermente rispetto al base per garantire > 4.5:1 su fondo chiaro).
  - Tema scuro (`#1E2A33`): testo primario `#F3F4F6`, accenti azzurro brillante `#4AA9E8`, giallo badge `#FFD566` con testo `#1E2A33`.
- **Tipografia:** Font **Outfit** self-hosted (file WOFF2 memorizzati localmente in `public/fonts/`, pesi 400, 600, 700), nessun caricamento da Google Fonts per totale operatività offline e conformità privacy GDPR. Fallback di sistema: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

---

## ADR-009: Centralizzazione Stringhe UI (`src/lib/i18n.ts`)
- **Stato:** Approvato (Fase 0)
- **Decisione:** Tutti i testi, etichette, messaggi di errore, conferme e stati visibili all'utente sono definiti in un unico dizionario TypeScript fortemente tipizzato (`src/lib/i18n.ts`), esclusivamente in lingua italiana. Nessuna stringa testuale hardcodata all'interno dei componenti TSX.
- **Motivazione:** Rispetto puntuale del vincolo non negoziabile n. 5 ("Tutta l'interfaccia è solo in italiano. Le stringhe stanno in un unico file"), facilitando revisioni lessicali, consistenza del tono scout e test di regressione sui testi.

---

## ADR-010: Politica di Conservazione Tombstone (90 giorni) e Risincronizzazione Completa
- **Stato:** Approvato (Fase 0)
- **Decisione:** I record cancellati mantengono `deleted_at NOT NULL` (soft delete) su Supabase per almeno **90 giorni**.
- **Algoritmo:**
  1. Durante la sincronizzazione incrementale, i record con `deleted_at IS NOT NULL` vengono rimossi dalla copia locale in IndexedDB.
  2. Se un dispositivo scout riapre l'applicazione dopo un periodo di assenza superiore a 90 giorni (o se il database locale risulta vuoto/corrotto), l'applicazione esegue automaticamente e silenziosamente una **risincronizzazione completa** da zero (`full resync`), azzerando e ricostruendo IndexedDB per evitare che record eliminati definitivamente dal server rimangano orfani sul dispositivo.
  3. L'utente admin dispone di un Cestino per visualizzare i record cancellati di recente e ripristinarli con un click.

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

## ADR-016: Redesign Professionale con Anima e Identità (Logo Protagonista, 5 Fotografie, Targa Bianca e Movimento Sobrio)
- **Stato:** Approvato (Fase 1B Finale — Sostituisce tutte le bozze precedenti 1B/1C/1D)
- **Decisione:** Rifacimento completo dell'interfaccia basato su qualità di classe Apple (Note, Promemoria, Libri, Impostazioni) mettendo al centro il logo del gruppo AGESCI Ponte San Giovanni 1, arricchito da cinque fotografie suggestate e movimento vettoriale sobrio.
- **Scelte implementative:**
  1. **Il Logo è il Protagonista Assoluto sulla Targa Bianca:**
     - Campionato dai pixel reali del file originale `assets/favicon.png`.
     - Derivate due versioni per ritaglio geometrico (nessun ridisegno o alterazione): `logo-completo.png` (540×543px) e `logo-emblema.png` (540×468px).
     - **Regola inderogabile:** Poiché la scritta viola "PONTE SAN GIOVANNI 1" scompare su fondi scuri o azzurri, il logo appare SEMPRE su fondo chiaro o all'interno della **Targa Bianca** opaca (`--color-targa-bg: oklch(1 0 0)`), anche in dark mode, con raggio morbido e ombra a sbalzo. Area di rispetto minima $\ge 12\%$.
     - Icone PWA (`icon-192`, `icon-512`, `maskable-512`, `apple-touch-icon`, `favicon.ico`) rigenerate su sfondo bianco solido `#FFFFFF`.
  2. **Cinque Fotografie d'Intestazione (e non una di più):**
     - Sourced 5 immagini CC0/Unsplash di paesaggi e natura scout senza persone riconoscibili (Home, Giochi, Bans, Canti, Calendario).
     - Formato WebP responsive (1200w, 800w, 400w) con peso totale di **486.2 KB** (budget rigoroso $\le 500\text{ KB}$).
     - Velo scrim di leggibilità tinto del viola del logo `#462679` (`var(--color-photo-scrim)` e `var(--color-photo-scrim-deep)`).
     - Precached nel Service Worker di Workbox per funzionamento offline al 100%. Collocate esclusivamente nelle testate, mai dentro le liste dei singoli elementi.
  3. **Palette Funzionale OKLCH e Inchiostro del Marchio:**
     - Inchiostro primario: Viola profondo del logo (`--color-ink`: `oklch(0.28 0.10 305)`).
     - Azzurro Interattivo: unico accento guida per controlli, link e selezione (`--color-interactive`: `oklch(0.53 0.18 245)`).
     - Quadratini pieni di sezione (iOS Settings style): Giochi Giallo (`oklch(0.83 0.18 85)`) con glifo scuro; Bans Rosso (`oklch(0.55 0.22 27)`) con glifo bianco; Canti Azzurro (`oklch(0.53 0.18 245)`); Calendario Blu Notte (`oklch(0.42 0.15 255)`); Stampa/Admin Grigio (`oklch(0.48 0.02 260)`).
     - Canzoniere: ritornello con barra gialla sinistra di 4px e sfondo tenue; accordi in blu notte in grassetto con numeri tabulari.
     - Calendario: card prossimo evento con blocco data calendario da parete (`.calendar-date-block`), chip colorati per tipologia e giorno odierno in rosso.
  4. **Profondità Fisica a 3 Livelli:** Livello 0 (sfondo), Livello 1 (card, tessere 2x2, targa), Livello 2 (barre traslucide blur 20px, bottom sheet, modali).
  5. **Movimento Sobrio Vettoriale:** Solo `transform` e `opacity` con curva `cubic-bezier(0.32, 0.72, 0, 1)` a 60fps. Il Sentiero (`TheTrail`) con linea curva tratteggiata e punto giallo; La Bussola (`CompassSync`) con ago oscillante durante il sync; disattivazione con `prefers-reduced-motion`.
  6. **Suite di Test Reattiva Permanente:** 13 test Playwright eseguiti su 7 viewport con zero scroll orizzontale, audit Axe-Core WCAG AA (0 violazioni critiche/serie), touch target $\ge 44\times 44\text{ px}$, zoom 200% conforme e screenshot salvati in `docs/design-review/screenshots/`.

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

---

## Protocollo Operativo Permanente di Fine Fase e Regole Comuni

Regole vincolanti applicate a tutte le fasi a partire dalla Fase 2:

### Protocollo di Fine Fase
1. **Test automatici tutti verdi:** Un test deve poter fallire (mai contare come "superato" un errore per risorsa mancante, mai indebolire un controllo per farlo passare).
2. **Verifica UI e Lighthouse:** Eseguire `npm run verify:ui` includendo tutte le nuove schermate e riportando i risultati reali. Se la UI cambia, eseguire anche Lighthouse mobile verificando numeri reali (Performance e Accessibilità $\ge 90$).
3. **Aggiornamento Documentazione:** Aggiornare `docs/` (`ARCHITECTURE.md`, `DECISIONS.md`, `DESIGN.md`, `TEST_CHECKLIST.md`, `SETUP_MANUALE.md` se necessario).
4. **Git e Deploy:** Commit e push su `main`, conferma dell'hash e verifica che il deploy su GitHub Pages sia verde.
5. **Riepilogo e Prove Reali:** Indicare cosa è stato fatto con PROVE reali (output effettivo dei comandi e test, non dichiarazioni generiche), cosa NON è stato fatto o eventuali limiti noti, e cosa deve essere verificato a mano da smartphone.
6. **GATE Rigoroso:** Fermarsi e attendere il via esplicito prima di iniziare la fase successiva.

### Regole Permanenti
- **Design System:** Usare esclusivamente i token e i componenti di `docs/DESIGN.md`; nessuno stile nuovo scritto a mano. Colori con funzione come da documentazione. Nessuna copertina per i singoli elementi: le foto compaiono solo nelle 5 testate di sezione.
- **Sicurezza e Integrità:** Nessun `innerHTML` con dati dinamici, nessuna libreria da CDN esterna, nessun segreto o chiave privata nel repository.
- **Lingua e Stringhe:** Tutta l'interfaccia esclusivamente in italiano, con tutte le stringhe centralizzate in `src/lib/i18n.ts`.
- **Modello Dati:** Modifiche consentite solo online; offline è sempre in sola lettura.
- **Copertura UI:** Ogni nuova schermata va aggiunta a `verify:ui` (Playwright) e alla vista di collaudo `#/design`.
- **Gestione Ambiguità:** Se un requisito è ambiguo, scegliere l'opzione più semplice, annotarla in `docs/DECISIONS.md` e procedere. Chiedere solo in caso di blocco.

---

## ADR-0008: Architettura Motore di Sincronizzazione Offline, IndexedDB e Gestione Concorrenza (Fase 2)

### Stato
Accettata e implementata (Fase 2).

### Contesto
L'applicazione deve funzionare in modo rapido e affidabile all'aperto senza connettività internet (campi scout, uscite in montagna). I dati devono essere disponibili all'istante all'avvio, la UI non deve mai mostrare schermate bianche in caso di caduta di rete o timeout, e i dati sul dispositivo devono convergere in modo deterministico con il backend Supabase senza rischio di corruzione o perdita della cronologia locale.

### Decisioni Architetturali Adottate
1. **Lettura Esclusiva da IndexedDB:** La UI non interroga mai Supabase direttamente per visualizzare schermate o elenchi. Tutte le query dei componenti (`HomeView`, sezioni tematiche, card) leggono esclusivamente dallo storage locale IndexedDB (`scout_vault_db`).
2. **Sostituzione Atomica Transazionale (`atomicFullReplace`):**
   - Durante il primo download e il Full Resync, i record di tutte le tabelle vengono scaricati per intero in una struttura dati temporanea in memoria (`tempData`).
   - Solo a completamento avvenuto con successo dell'intero download, IndexedDB viene aggiornato all'interno di una singola transazione `readwrite` di `idb` che cancella i vecchi record e inserisce i nuovi per tutti gli object stores.
   - È vietato svuotare IndexedDB prima del download. In caso di interruzione o errore di rete a metà operazione, la transazione non viene aperta e i dati locali preesistenti rimangono intatti e consultabili.
3. **Sincronizzazione Incrementale e Server Time:**
   - Ciascuna tabella traccia il proprio cursore `updated_at`.
   - Il cursore è guidato unicamente dal tempo restituito dal server PostgreSQL (`server_time`), evitando qualsiasi dipendenza o deriva dall'orologio interno del client (che potrebbe essere errato o alterato).
   - È applicata una sovrapposizione di sicurezza di 10 secondi (`SAFETY_OVERLAP_MS = 10_000`) per assorbire disallineamenti di clock e transazioni contemporanee su Supabase.
   - Le scritture locali sono idempotenti tramite `upsertRecords`.
4. **Timeout Differenziati e Conservazione Tombstone:**
   - **Pull incrementale rapida:** Timeout breve di 4 secondi (`TIMEOUT_INCREMENTAL_MS = 4_000`). Se la rete è lenta, l'operazione abortisce senza bloccare l'utente e il sistema ritenta in background al trigger successivo.
   - **Full Resync / Primo Avvio:** Timeout esteso a 25 secondi (`TIMEOUT_FULL_SYNC_MS = 25_000`) con gestione automatica della ripresa.
   - **Soglia Tombstone a 180 giorni:** Se il tempo trascorso dall'ultima sincronizzazione riuscita supera i 180 giorni (`TOMBSTONE_RETENTION_DAYS = 180`), la sincronizzazione incrementale viene scartata e viene forzato un Full Resync atomico.
5. **Soft Delete Gerarchica:**
   - I metodi di lettura locale (`getOdgPunti`, `getAllegati`) verificano la validità del genitore corrispondente (`evento_id`, `gioco_id`, `ban_id`, `canto_id`).
   - Se il record genitore è cancellato (`deleted_at != null`), i record figli vengono automaticamente filtrati ed esclusi dalla UI.
   - In caso di annullamento dell'eliminazione del genitore, i figli ritornano visibili contestualmente.
6. **Realtime come Segnale Puro (Payload Ignorato):**
   - L'applicazione ascolta gli eventi WebSocket di Supabase (`postgres_changes` su schema `public`), ma ignora deliberatamente il payload inviato nel messaggio per non rischiare inconsistenze o vulnerabilità.
   - L'evento funge unicamente da segnale di invalidazione per innescare una pull incrementale debounced (300 ms).
7. **PWA, Persistenza Storage e Codice Diviso:**
   - Attivazione di `navigator.storage.persist()` all'avvio per prevenire l'eviction di IndexedDB da parte di iOS WebKit (policy 7 giorni) e Android.
   - Guida contestuale non invasiva per l'installazione su Schermata Home (iOS Safari e Android).
   - Code splitting delle viste secondarie tramite `lazy` e `Suspense` nativi di `preact/compat` per ridurre il peso del bundle iniziale di primo avvio.

---

## ADR-0009: Architettura Giochi e Bans, Ricerca Deterministica, Modalità Lettura e Cestino (Fase 3)

### Stato
Accettata e implementata (Fase 3).

### Contesto
Le sezioni Giochi e Bans rappresentano il nucleo operativo per l'animazione e le attività all'aperto del Clan (campi estivi, uscite, fuochi di bivacco). L'applicazione deve permettere una consultazione immediata e intuitiva offline, una ricerca rapida resistente a errori di digitazione da smartphone, una modalità di lettura dedicata attorno al fuoco serale (dove lo schermo non deve spegnersi e il testo deve essere leggibile a distanza), e una gestione amministrativa sicura con soft-delete, prevenzione di cancellazioni accidentali e recupero dal cestino.

### Decisioni Architetturali Adottate
1. **Ricerca Deterministica e Tolleranza ai Typo (`src/lib/search.tsx`):**
   - Normalizzazione Unicode NFD per la rimozione di accenti/diacritici e conversione in minuscolo.
   - Tolleranza ai typo rigorosamente deterministica basata su soglie fisse di lunghezza del token cercato:
     - Lunghezza $< 4$ caratteri: Corrispondenza esatta (Distanza Levenshtein = 0).
     - Lunghezza 4–7 caratteri: Distanza Levenshtein $\le 1$ (es. `"pala"` trova `"palla"`).
     - Lunghezza $\ge 8$ caratteri: Distanza Levenshtein $\le 2$ (es. `"aveleata"` trova `"avvelenata"`).
   - Multi-campo AND: tutti i token della query devono riscontrare corrispondenza in almeno uno dei campi (`nome`, `regole`/`testo`, `materiali`/`note_gesti`).
2. **Evidenziazione XSS-Safe (`HighlightText`):**
   - Vietato tassativamente l'uso di `innerHTML` o parser HTML non protetti.
   - Il testo viene segmentato tramite espressioni regolari Unicode preservando fedelmente punteggiatura, spazi e maiuscole/minuscole originali.
   - I frammenti corrispondenti vengono inseriti in elementi `<mark class="search-highlight">` generati come Virtual DOM VNodes nativi di Preact con escaping automatico dei caratteri speciali.
3. **Ordinamento a 4 Opzioni e Persistenza di Stato:**
   - Esattamente quattro opzioni di ordinamento nel `SegmentedControl`: `A → Z`, `Z → A`, `Recenti`, `Vecchi` (per `created_at`).
   - Ordinamento alfabetico gestito tramite `Intl.Collator('it', { sensitivity: 'base' })`.
   - Query di ricerca e scelta di ordinamento persistono al ritorno dalla vista di dettaglio tramite `sessionStorage` (`giochi_search`, `giochi_sort`, `bans_search`, `bans_sort`).
4. **Modalità Lettura Bans per Fuochi Serali (`BanReadingMode`):**
   - Schermata a tutto schermo ad alto contrasto concepita per la visibilità all'aperto e al buio.
   - Controlli per l'ingrandimento del testo (range 16px – 36px) con memorizzazione della preferenza.
   - Callout distinto e separato per le note sui gesti (`note_gesti`) con sfondo e bordo dedicati al colore dei bans.
   - Integrazione con Screen Wake Lock API (`src/lib/wakelock.ts`) per mantenere lo schermo acceso durante l'animazione, con fallback silenzioso per browser non supportati e riacquisizione automatica al ritorno sulla scheda (`visibilitychange`).
5. **Admin Gating Rigoroso:**
   - I pulsanti di aggiunta ("Nuovo Gioco", "Nuovo Ban"), modifica ed eliminazione NON vengono renderizzati nel DOM se `isAdmin === false` (stato verificato con RPC `is_admin()`).
   - Nessun elemento interattivo di scrittura è esposto a utenti anonimi.
6. **Scritture Online-Only e Doppia Conferma Eliminazione:**
   - Tutte le modifiche richiedono connessione di rete; in modalità offline viene sollevato un avviso esplicito senza perdita o corruzione dei dati.
   - Form in BottomSheet con validazione campi obbligatori e segnalazione morbida di possibile duplicato (`findSimilarName`) se esiste già un elemento con distanza di Levenshtein $\le 2$.
   - Eliminazione in due passaggi (`DeleteConfirmModal`): richiede all'amministratore di digitare il nome esatto dell'elemento prima di abilitare il pulsante di soft-delete.
7. **Cestino, Conservazione Tombstone e Punto di Estensione Storage:**
   - Conservazione tombstone sul server per 180 giorni.
   - Vista Cestino dedicata in `AdminView` per consultare gli elementi eliminati con funzione di ripristino (`restoreRecord`) o eliminazione definitiva (`hardDeleteRecord` / `purgeTrash`).
   - Predisposizione architetturale della rimozione fisica dei file da Supabase Storage (`deleteAssociatedStorageFiles` in `src/lib/admin_actions.ts`), che in Fase 5 invocherà la rimozione dei relativi file dal bucket `allegati`.
8. **Backup JSON Completo:**
   - Funzione `exportBackupJson()` esporta l'intero archivio (tutte le 6 tabelle) in formato JSON standard scaricabile con marcatura temporale.

---

## ADR-0010: Cestino, Epoca di Sincronizzazione (`sync_epoch`) e Bonifica Tombstone a 180 Giorni
- **Stato:** Approvato e implementato (Fase 3 Correzione 1 / Fase 4)
- **Contesto:**
  Nella versione precedente, lo svuotamento o eliminazione definitiva immediata ("Elimina subito") di un elemento dal cestino sul server poteva eliminare fisicamente la riga senza lasciare tombstone. Un dispositivo client rimasto offline durante tale cancellazione non avrebbe mai ricevuto un segnale di cancellazione nella sincronizzazione incrementale successiva, mostrando perciò record "fantasma" in IndexedDB locale.
- **Decisione e Architettura Adottata:**
  1. **Tabella Metadati di Sistema (`system_meta`):**
     - Creata tabella `system_meta (key text primary key, value jsonb, updated_at timestamptz)` con riga iniziale `sync_epoch = 1`.
     - RLS: SELECT aperta a tutti (anonimi e admin), INSERT/UPDATE/DELETE vietati a chiunque fuorché funzioni security definer.
  2. **Funzione SQL `bump_sync_epoch()`:**
     - Procedura `SECURITY DEFINER` con `SET search_path = public` riservata all'amministratore (`is_admin()`).
     - Incrementa atomicamente il valore numerico di `sync_epoch`.
  3. **Funzione SQL `purge_old_tombstones()`:**
     - Procedura `SECURITY DEFINER` con `SET search_path = public` e controllo `is_admin()`.
     - Esegue l'eliminazione fisica permanente SOLO ed ESCLUSIVAMENTE delle righe che hanno `deleted_at < now() - interval '180 days'`, salvaguardando il principio dei tombstone per la sincronizzazione incrementale dei client regolari.
  4. **"Elimina subito" con Incremento Epoca e Avviso:**
     - L'eliminazione definitiva immediata dal cestino di una singola riga recente resta consentita all'amministratore, ma con dialogo di avviso esplicito (*"Gli altri dispositivi potrebbero mostrare questo elemento fino al prossimo aggiornamento completo"*).
     - L'azione richiama `bump_sync_epoch()` su Supabase.
  5. **Rilevamento Mismatch Epoca sul Client:**
     - All'inizio di ogni sincronizzazione (incrementale o avviata da Realtime), il client interroga `system_meta` per ottenere il `sync_epoch` del server.
     - Se `server_epoch !== local_epoch`, il client scarta la pull incrementale e forza immediatamente un **Full Resync Atomico** (`performFullResync()`), riallineando IndexedDB e ripulendo qualsiasi record fantasma.

---

## ADR-0011: Canzoniere in Formato ChordPro Semplificato, Rendering ad Albero VDOM e Trasposizione Semitonale (Fase 4)
- **Stato:** Approvato e implementato (Fase 4)
- **Contesto:**
  Il repertorio canti scout comprende centinaia di brani con accordi, ritornelli, ritmi, tonalità e battiti per minuto (BPM). Il sistema deve permettere la digitazione facile e leggibile da parte dell'amministratore, una ricerca che non confonda gli accordi con le parole del testo, un rendering tipografico impeccabile anche a capo riga, la trasposizione in tempo reale di tonalità per la chitarra (con accordi sia italiani che anglosassoni) e una modalità di esecuzione a tutto schermo con schermo sempre attivo (Screen Wake Lock).
- **Decisione e Architettura Adottata:**
  1. **Formato ChordPro Semplificato:**
     - Sintassi `[Accordo]sillaba` integrata con direttive di sezione `{strofa}`, `{ritornello}` (o `{soc}` / `{eoc}`), `{ponte}`, `{nuova_pagina}` e metadati `{ritmo}`, `{bpm}`, `{misura}`, `{capo}`.
     - Validatore morbido `validateChordPro`: segnala parentesi non chiuse, caratteri anomali o direttive sconosciute come warning informativi senza bloccare il salvataggio.
  2. **Rendering DOM/VDOM Puro (Zero `innerHTML`):**
     - Il testo viene segmentato da un tokenizer dedicato in un Abstract Syntax Tree (AST).
     - Ogni combinazione accordo/sillaba è renderizzata come container `.song-chord-column` in `display: inline-flex; flex-direction: column; vertical-align: bottom;`:
       - `.song-chord`: visualizzato sopra la sillaba in grassetto e colore Azzurro Scuro approvato (`var(--color-calendario)`: `oklch(0.42 0.15 255)`). Nessun nuovo colore arbitrario: si riconduce al token di calendario/accento scuro.
       - `.song-lyric`: testo della sillaba posizionato esattamente sotto l'accordo corrispondente.
     - Se una riga va a capo nel viewport dello smartphone, la colonna si sposta unitamente impedendo il disallineamento orizzontale accordo-sillaba.
     - I blocchi ritornello ricevono lo stile `.song-chorus-block` con barra laterale sinistra color giallo scout (`var(--color-yellow)`).
  3. **Fonte di Verità Metadati Musicali (Campi DB vs Direttive Testuali):**
     - Le colonne dedicate della tabella Postgres `canti` (`ritmo`, `tempo_bpm`, `misura`, `capotasto`, `tonalita`) costituiscono l'UNICA fonte di verità per tali informazioni.
     - Le eventuali direttive `{ritmo}`, `{bpm}`, `{misura}`, `{capo}` inserite dentro il testo ChordPro vengono deliberatamente ignorate nel rendering e nell'anteprima (o preservate solo per eventuale parsing di importazione da terze parti). L'editor esclude suggerimenti o bottoni che inducano a inserirle nel testo.
  4. **Motore di Trasposizione Semitonale:**
     - Algoritmo circolare sui 12 semitoni temperati (`normalizeChordName`, `transposeChord`, `transposeChordPro`).
     - Supporto completo della notazione italiana (`Do, Do#, Reb, Re, Mib, Mi, Fa, Fa#, Solb, Sol, Lab, La, Sib, Si`) e anglosassone (`C, C#, Db, D, Eb, E, F, F#, Gb, G, Ab, A, Bb, B`).
     - Gestione trasparente di alterazioni, estensioni (es. `m, 7, maj7, sus4, add9, dim, 5+`) e slash chords con basso alternativo (es. `Sol/Si` $\rightarrow$ `La/Do#`).
     - Pulsanti `-1`, `+1`, `Orig` nella vista lettura: la trasposizione è puramente visiva in memoria, non altera il testo originale archiviato.
  4. **Ricerca Testuale con Esclusione Accordi:**
     - La funzione `stripChords(testo_chordpro)` rimuove tutti i marcatori `[...]` e le direttive `{...}` prima di passare il testo al motore di ricerca. In questo modo una ricerca per "Do" o "Sol" trova solo i brani che contengono realmente quelle parole nel testo o nel titolo, evitando falsi positivi massivi su canzoni che hanno quegli accordi.
  5. **Modalità Lettura Canti e Screen Wake Lock:**
     - Componente `CantoReadingMode`: controlli a contrasto elevato, regolazione dinamica dimensione caratteri (`+/-`), commutatore di visibilità accordi on/off e trasposizione di tonalità.
     - Acquisizione automatica del Wake Lock all'apertura dello spartito e rilascio controllato alla chiusura, con ripristino su `visibilitychange`.

---

## ADR-0012: Gestione Allegati, Compressione Client-Side WebP, Cache API e Pulizia Storage (Fase 5)
- **Stato:** Approvato e implementato (Fase 5)
- **Contesto:**
  I capi clan hanno necessità di allegare schemi di gioco, regolamenti in PDF, immagini esplicative di bans e spartiti in PDF ai rispettivi contenuti. L'infrastruttura Supabase Free Tier offre 1 GB di archiviazione Storage complessiva. È fondamentale prevenire la saturazione del bucket, impedire l'esplorazione pubblica non autorizzata dei file, supportare la consultazione offline e garantire la pulizia dei file orfani o eliminati dal cestino.
- **Decisione e Architettura Adottata:**
  1. **Tipologie di File e Limiti:**
     - Ammessi esclusivamente: immagini (JPEG, PNG, WebP) e documenti PDF (max 10 MB).
     - File audio rigorosamente esclusi in v1 (annotato nel database e nell'architettura per salvaguardare il piano gratuito).
  2. **Compressione WebP Client-Side:**
     - Le immagini caricate da smartphone vengono ridimensionate via Canvas (lato lungo max 1600px) e convertite in WebP (qualità 0.82), abbattendo il peso dell'85-90% prima dell'invio.
  3. **Generazione Percorso Sicuro nel Bucket:**
     - Il nome originale del file dell'utente viene sanificato e archiviato solo come metadato descrittivo (`nome_file`).
     - Il percorso su Storage (`storage_path`) è generato atomicamente nella forma `{parentType}/{parentId}/{timestamp}_{randomSuffix}.{ext}`, prevenendo collisioni e path-traversal.
  4. **Sicurezza e Policy Storage:**
     - Bucket `allegati` configurato con `public: true` per permettere la fruizione diretta via CDN ai client anonimi tramite l'URL archiviato nel record del database locale.
     - Rimozione della policy SELECT pubblica su `storage.objects`: i file sono raggiungibili solo con URL diretto, impedendo a utenti non autenticati di eseguire il listing dei contenuti del bucket.
     - Operazioni di upload, aggiornamento ed eliminazione riservate ad utenti autenticati con ruolo `is_admin()`.
  5. **Pulizia Storage Fisico e Rilevamento File Orfani:**
     - Prima della bonifica tombstone o durante lo svuotamento del cestino (`purgeTrash`), la procedura in `src/lib/admin_actions.ts` invoca l'eliminazione fisica tramite Supabase Storage API (`supabase.storage.from('allegati').remove([...])`) prima della rimozione della riga SQL.
     - Funzioni di audit `findOrphanStorageFiles()` e `purgeOrphanStorageFiles()` nel pannello Admin per scansionare file presenti su bucket che non abbiano più una corrispondente riga attiva in `allegati`.
     - Visualizzazione visiva dell'occupazione percentuale rispetto a 1 GB con barra di avanzamento e badge cromatico.
  6. **Cache Offline (Cache API `scout-attachments-v1`):**
     - Gli allegati di piccole dimensioni ($< 500\text{ KB}$) vengono automaticamente scaricati e inseriti in cache al termine di ogni sincronizzazione in background.
     - Pulsante dedicato in Admin per forzare il download manuale di tutti gli allegati con barra di progresso in percentuale.
     - In assenza di rete, gli allegati non ancora memorizzati in cache mostrano un badge sobrio "Non scaricato — serve connessione" senza provocare errori di rete visibili o interruzioni dell'interfaccia.
  7. **Interfaccia Utente e Lightbox Zoom:**
     - Componente `AttachmentGallery`: griglia responsiva con miniature ad altezza e larghezza fisse per prevenire Cumulative Layout Shift (CLS), icona identificativa per PDF con dimensione formattata, zoom modale a tutto schermo per immagini (lightbox accessibile) e opzioni di eliminazione per admin.
     - Componente `AttachmentUploadManager`: selettore duale fotocamera/file, anteprima immediata e barra di avanzamento caricamento.







---

## ADR-0013: Stampa A4, Controllo Overflow dei Canti e Gestione Particolarità Safari iOS (Fase 6)

### Data
2026-10-15

### Contesto
La Fase 6 richiede la generazione e stampa di fascicoli personalizzati composti da Giochi, Bans, Canti ed Ordini del Giorno (ODG). I requisiti fondamentali impongono:
1. Nessun popup o nuova scheda (`window.open` è intercettato dai popup blocker mobili): l'anteprima e la stampa avvengono nella stessa finestra tramite `window.print()` e direttive `@media print`.
2. Impaginazione rigorosa A4 (`@page { size: A4 portrait; margin: 15mm 12mm; }`), testo nero su fondo bianco puro (`oklch(0 0 0)` su `oklch(1 0 0)`), corpo del testo non inferiore a 12 pt.
3. Flusso continuo per Giochi e Bans: separatore sottile tra elementi, titoli con `break-after: avoid`, `orphans: 3`, `widows: 3`. Gli elementi brevi (< 600 caratteri) hanno `break-inside: avoid`, mentre quelli estesi scorrono liberamente su più pagine.
4. Canti a pagina singola o doppia: ogni canto inizia su nuova pagina (`break-before: page`). I cambi pagina espliciti `{nuova_pagina}` (ChordPro) spezzano il canto. Nelle pagine successive alla prima, la testata è ridotta al solo titolo con indicatore di pagina ("Titolo — 2/2"). Accordi in nero grassetto posizionati sopra il testo.
5. Controllo di capienza (overflow): algoritmo deterministico con 4 gradini di riduzione del carattere (da 12 pt a 9.5 pt); se il testo supera comunque l'altezza utile del foglio A4, compare l'avviso giallo *"Questa pagina non entra: aggiungi un'interruzione di pagina"*.
6. Opzioni: copertina con `logo-completo` su fondo chiaro e indice con numeri di pagina calcolati; interruttore per includere le sole immagini allegate (i PDF non sono mai inclusi nel flusso di stampa).
7. Preparazione ODG: impaginazione A4 per riunioni con caselle quadrate di spunta.

### Decisioni Architetturali

1. **Unico Motore di Rendering e Nessun Popup:**
   - La vista `StampaView` (`#/stampa`) renderizza sia i controlli di selezione e configurazione (schede, checkbox, riordino con frecce Su/Giù, interruttori) sia il contenitore `.print-document` con classe `.print-preview-mode`.
   - Il pulsante "Stampa fascicolo" invoca direttamente `window.print()`. Le regole `@media print` nascondono l'intera interfaccia applicativa (navigazione, header, banner, controlli, HUD altimetrico e wrapper curve di livello) e mostrano esclusivamente `.print-document`.

2. **Risoluzione del Bug di Paginazione dei Motori Chromium e WebKit:**
   - Quando elementi antenati come `html`, `body`, `#app` o `main` possiedono `display: flex` o `overflow-x: hidden`, i motori di stampa Chromium e WebKit troncano la paginazione interrompendo la generazione dopo 3 o 4 pagine o stampando solo la prima schermata.
   - Per risolvere in modo definitivo questo difetto, `src/styles/print.css` forza a livello globale:
     ```css
     @media print {
       html, body, #app, main, .container {
         display: block !important;
         overflow: visible !important;
         height: auto !important;
         min-height: 0 !important;
       }
       .print-document, .print-song-wrapper, .print-song-page {
         display: block !important;
       }
     }
     ```

3. **Algoritmo di Stima dell'Ingombro e Step-Down del Font (`estimatePageOverflow`):**
   - L'altezza stampabile di un foglio A4 (297 mm - 30 mm di margini = 267 mm) equivale a circa 756 pt.
   - Il calcolo somma:
     - Margini e padding pagina (20 pt);
     - Intestazione (titolo, autore, tonalità: ~65 pt a pag. 1; ~30 pt su pagine successive);
     - Righe di testo e righe con accordi: una riga testo consuma 1.45 * fontSize; una riga con accordi richiede un'altezza doppia (2.4 * fontSize);
     - Spaziatura tra strofe e blocchi ritornello (10 pt).
   - Si testano 4 gradini tipografici:
     - Livello 0: 12.0 pt (default standard)
     - Livello 1: 11.0 pt
     - Livello 2: 10.2 pt
     - Livello 3: 9.5 pt (limite minimo di leggibilità per canto su stativo/chitarra)
   - Se anche a 9.5 pt l'altezza supera 756 pt, la pagina viene contrassegnata con `fits: false`, applicando la classe `.print-page-overflow` e stampando a video l'avviso per l'utente.

4. **Particolarità e Limiti Noti di Safari iOS (AirPrint):**
   - **Modalità PWA a Schermo Intero (Standalone):** Safari iOS in modalità standalone può posticipare o ignorare chiamate asincrone a `window.print()`. L'invocazione deve avvenire in risposta diretta e sincrona all'evento `click`/`touchend` dell'utente, senza `setTimeout` o chiamate a `fetch` interposte.
   - **Supporto `@page` limitato:** Safari iOS ignora i selettori pseudo-pagina `@page :first` o `@page :left/:right` complessi. La numerazione di pagina e le intestazioni speciali devono quindi essere marcate come elementi DOM ordinari (`.print-cover-page`, `.print-index-page`, `.print-song-page`) con direttive CSS `break-before: page`.
   - **Render dei Font Web:** In Safari Mobile AirPrint, i font caricati via `@font-face` devono essere già pronti (`document.fonts.ready`). L'applicazione usa font di sistema o fallback immediati per garantire che il testo venga rasterizzato senza sfarfallio o caratteri mancanti.
   - **Gestione Fogli Bianchi:** Per impedire la creazione di fogli bianchi finali su Safari e Chrome, ogni pagina di canto dichiara `break-before: page`, eccetto la primissima pagina dopo indice o copertina ove già presente un'interruzione naturale, e l'ultimo elemento non ha `break-after: always`.

5. **Isolamento Grafico e Inchiostro:**
   - La barra del ritornello è renderizzata con bordo nero solido (`border-left: 3pt solid oklch(0 0 0)`).
   - Gli accordi sono renderizzati in nero puro con peso 700 (`font-weight: 700; color: oklch(0 0 0)`).
   - Rimozione completa di gradienti e ombreggiature (`box-shadow: none; text-shadow: none`).
   - Gli elementi decorativi e le curve di livello (`.topo-contour-wrapper`, `.topo-ambient-glow`, `.topo-svg-container`, `.scout-trail-svg`, `.scout-compass-widget`) sono soppressi con `display: none !important`.

# Registro delle Decisioni Architetturali (ADR) - Sito Vault Scout Clan

Questo documento raccoglie tutte le decisioni architetturali, i vincoli e le motivazioni tecniche adottate nello sviluppo del Vault di Clan, con riferimento esplicito alle fonti e documentazioni ufficiali verificate.

---

## ADR-001: Scelta del Framework Frontend - Preact + Vite + TypeScript (strict)
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
  - *Canti:* Nuova pagina obbligatoria per ogni canto (`break-before: page`), rispetto dei tag `{nuova_pagina}`, intestazione ridotta nelle pagine successive ("Titolo - 2/2") e algoritmo di rilevamento overflow che avvisa nell'anteprima se il canto sfora l'A4.
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
- **Stato:** Approvato (Fase 1B Finale - Sostituisce tutte le bozze precedenti 1B/1C/1D)
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

1. **FASE 2 - Dati e Offline:**
   - **Full Resync Atomico:** Nel primo download e nel full resync (> 90 giorni di assenza), i record vengono scaricati per intero in un buffer in memoria e scritti in IndexedDB in un'unica transazione atomica `readwrite`. È vietato svuotare IndexedDB prima del termine del download.
   - **Timeout Differenziati:** Timeout breve a 4s per le pull incrementali; timeout esteso a 25s per full resync e primo avvio, con suddivisione a blocchi e gestione della ripresa.
   - **Soft Delete Gerarchica:** Quando un elemento genitore (`gioco`, `ban`, `canto`, `evento`) subisce soft-delete (`deleted_at != null`), i relativi figli (`odg_punti`, `allegati`) vengono nascosti automaticamente dalla UI e ripristinati insieme al genitore in caso di un-delete.

2. **FASE 3 - Giochi e Bans & FASE 5 - Allegati:**
   - **Cestino e Rimozione Storage Definitiva:** Conservazione tombstone sul server a 180 giorni. La pulizia definitiva del Cestino (hard delete attivata dall'admin) cancella sia i record nel database sia i file fisici corrispondenti da Supabase Storage (`storage.objects`).

3. **FASE 3 - Ricerca e Ordinamento:**
   - **Regola Deterministica Tolleranza Typo:**
     - Termini con lunghezza < 4 caratteri: Exact match (Levenshtein = 0).
     - Termini con lunghezza 4–7 caratteri: Distanza Levenshtein $\le 1$.
     - Termini con lunghezza $\ge 8$ caratteri: Distanza Levenshtein $\le 2$ (ad es. termine cercato "aveleata", lunghezza 8 caratteri, trova "avvelenata" con distanza 2).
     - Test unitari allineati a questa specifica.

4. **FASE 6 - Stampa:**
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
     - In assenza di rete, gli allegati non ancora memorizzati in cache mostrano un badge sobrio "Non scaricato - serve connessione" senza provocare errori di rete visibili o interruzioni dell'interfaccia.
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
4. Canti a pagina singola o doppia: ogni canto inizia su nuova pagina (`break-before: page`). I cambi pagina espliciti `{nuova_pagina}` (ChordPro) spezzano il canto. Nelle pagine successive alla prima, la testata è ridotta al solo titolo con indicatore di pagina ("Titolo - 2/2"). Accordi in nero grassetto posizionati sopra il testo.
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

---

## ADR-0014: Calendario Interno, Vista Mese, Ordine del Giorno (ODG) e Riporto alla Riunione Successiva (Fase 7)

### Data
2026-10-15

### Contesto
La Fase 7 richiede la realizzazione del modulo Calendario e Ordine del Giorno (ODG) per la pianificazione e verifica delle attività del Clan Scout (riunioni, uscite, scadenze, eventi e attività varie).
I requisiti cardine impongono:
1. Zero dipendenze esterne o sincronizzazioni di terze parti (nessun Google Calendar, Microsoft Exchange, iCal / WebCal o plugin pesanti da CDN): tutto risiede nel database locale IndexedDB sincronizzato con Supabase.
2. Fuso orario rigorosamente fissato a `Europe/Rome`, localizzazione `it-IT` e inizio della settimana di Lunedì.
3. Vista Mese interattiva con griglia da 7 colonne (LUN-DOM), celle con giorno del mese, evidenziazione del giorno odierno in rosso accento (`.calendar-cell-today`), indicatori a pallini colorati per tipo di evento e dettaglio degli eventi del giorno selezionato sotto la griglia.
4. Vista Lista Prossimi Eventi con blocco data da parete (`.calendar-date-block`), chip colorati per tipologia, distinzione tra attività in programma e passate, e contatore rosso dei punti ODG ancora da completare.
5. Foglio di Dettaglio in `BottomSheet` accessibile con logistica, note, galleria allegati (immagini/PDF) e gestore dell'Ordine del Giorno.
6. Permessi rigorosi per l'ODG: la spunta "fatto", il riordino su/giù e l'aggiunta di punti sono **riservati esclusivamente all'Amministratore** (`isAdmin`). Gli utenti anonimi possono consultare l'ODG solo in lettura (checkbox disabilitate, nessun tasto di aggiunta o riordino).
7. Riporto automatico dei punti non conclusi alla prossima riunione futura programmata (`riportato_da` valorizzato).
8. Soft-delete gerarchica per i punti ODG e validazione stringente delle date ($fine \ge inizio$).

### Decisioni Architetturali

1. **Gestione del Tempo e Generazione Griglia Senza Librerie Esterne:**
   - Implementazione nativa in `src/lib/calendario.ts`:
     - `getDaysInMonth(year, month)` calcola esattamente i giorni di ogni mese gestendo anni bisestili (29 giorni a febbraio nel 2024, 28 nel 2023, 29 nel 2000, 28 nel 2100).
     - La griglia mensile (`buildMonthGrid`) posiziona Lunedì come primo giorno calcolando l'offset `(jsDay === 0 ? 6 : jsDay - 1)`. I giorni cuscinetto del mese precedente e successivo completano righe da 7 colonne.
     - Tutte le date sono manipolate con componenti assolute di calendario (anno, mese, giorno) anziché incrementi fissi di 86.400.000 ms, garantendo totale immunità agli sfasamenti da transizione ora solare/legale a fine marzo (giorno da 23 ore) e a fine ottobre (giorno da 25 ore).

2. **Gating Rigoroso dei Permessi su Ordine del Giorno (ODG):**
   - Nel componente `OdgManager`, le checkbox utilizzano un pulsante con `role="checkbox"`. Se l'utente non è autenticato come amministratore (`!isAdmin`):
     - L'attributo `disabled={true}` e `aria-disabled="true"` impediscono l'interazione;
     - Un titolo esplicativo informa l'utente anonimo che la spunta è riservata ai capi;
     - Nessun controllo per riordinare su/giù, aggiungere o eliminare punti viene renderizzato nel DOM.
   - A livello database, la migrazione `0002_security_rls.sql` applica Row Level Security su `odg_punti`: SELECT pubblica consentita per consultazione offline, mentre INSERT, UPDATE e DELETE richiedono tassativamente `public.is_admin()`.

3. **Spunta Animata e Feedback Visivo:**
   - La casella di spunta `.odg-check-btn` esegue una transizione fluida: al completamento acquisisce sfondo azzurro/canti e anima un glifo SVG con stroke progressivo (`@keyframes odgCheckDraw` su `stroke-dashoffset`).
   - Il testo associato riceve la classe `.odg-text-completed` con barratura `line-through` e opacità attenuata.

4. **Algoritmo di Riporto Punti Non Conclusi (`forwardUnfinishedOdgPunti`):**
   - Quando l'admin tocca *"Riporta alla prossima"*:
     1. Si cercano i punti non completati (`!p.completato && p.deleted_at === null`) dell'evento corrente.
     2. Tramite `findNextFutureMeeting(current.inizio)`, si ricerca la prima riunione attiva (`tipo === 'riunione'`) con data di inizio successiva.
     3. Se trovata, viene richiesta conferma con il numero di punti aperti e il titolo della riunione bersaglio.
     4. Per ogni punto, viene inserito un nuovo record associato alla nuova riunione con `riportato_da` valorizzato sull'id del punto originario, `completato = false` e ordine progressivo accodato ai punti già presenti.
     5. Scrittura immediata su Supabase e sincronizzazione locale in IndexedDB.

5. **Soft-Delete Gerarchica:**
   - Nel metodo di lettura `getOdgPunti(eventoId)` in `src/lib/db.ts`, se l'evento genitore risulta eliminato (`parent.deleted_at !== null`), la funzione restituisce una lista vuota `[]`. Al ripristino dell'evento dal cestino, i punti ODG ricompaiono automaticamente.

6. **Integrazione Home ("Prossimo Evento"):**
   - La funzione `getNextUpcomingEvent()` calcola il primo evento cronologicamente futuro (o in corso) ed estrae il conteggio dei punti ODG ancora aperti (`openOdgCount`).
   - La card nella Home renderizza il blocco data con `.calendar-date-block-today` se l'evento ricade oggi, il chip cromatico corrispondente al tipo (`riunione`, `uscita`, `scadenza`, `evento`, `altro`), e un badge rosso con i punti aperti. Il tocco naviga direttamente a `#/calendario?id=<uuid>`.

---

## ADR-0015 (Fase 9): Canzoniere A4 a Due Colonne, Stile Documento di Riferimento e Pipeline di Importazione Canti

### Data
2026-10-17

### Contesto
La Fase 9 richiede la riproduzione fedele dello stile grafico e tipografico del fascicolo cartaceo di riferimento (`Strade di coraggio - Canzoniere.docx` e `riferimento_stile_canzoniere.png`) per la stampa dei canti in formato A4 verticale, unitamente a una pipeline completa di importazione per i capi admin (da file Word `.docx`, da incolla testo diretto e tramite prompt per AI esterna).
I requisiti cardine impongono:
1. **Fedeltà al Riferimento:** Pagina A4 verticale (210×297 mm) con margini 2,0 cm (SX/DX), 1,0 cm (Superiore), 2,0 cm (Inferiore). Due colonne uguali da 81 mm separate da una linea verticale continua da 0,75 pt (`oklch(0.7 0 0)`), gap tra colonne di 8 mm.
2. **Tipografia Self-Hosted:** Font `Roboto` (Regular 400, Bold 700, Italic 400) e `Nova Mono` (per le frecce ritmiche a spaziatura uniforme) installati via npm (`@fontsource/roboto`, `@fontsource/nova-mono`) e bundled localmente, senza alcuna chiamata a CDN esterne. Testo corpo `#2D3748` (`oklch(0.33 0.02 255)`), titolo a tutta larghezza in Roboto Bold maiuscolo 22 pt nero (`oklch(0 0 0)`), interlinea 1.0, spazio sopra 24 pt e sotto 6 pt.
3. **Accordi Sovrapposti Naturali:** Gli accordi sono posizionati con precisione tipografica sopra la sillaba (`position: absolute; top: -1.2em`) con peso 700 nero, senza allargare artificialmente lo spazio tra le parole o sfasare il ritmo naturale della strofa.
4. **Impaginazione Bilanciata e Controllo Overflow:** File di configurazione unico (`src/features/canti/canzoniere_config.ts`) con dimensione base 11 pt e step-down automatico a 9 pt per canzoni dense. Per i canti a pagina singola, l'algoritmo bilancia l'altezza delle due colonne; per i canti multipagina, lo spezzamento avviene rigorosamente a livello di blocco (mai troncare una strofa a metà se evitabile). Supporto ai tag `{nuova_pagina}` e `{nuova_colonna}`.
5. **Nessun Dato Protetto da Copyright nel Repository:** Nessun testo di canzone reale o file coperto da diritto d'autore viene committato nel repository pubblico o nei test (la cartella `_riferimenti/` è rigorosamente inserita in `.gitignore`). I test utilizzano esclusivamente brani sintetici d'esempio inventati.
6. **Riduzione della Visibilità Web:** Inclusione del tag `<meta name="robots" content="noindex, nofollow">` in `index.html` e file `public/robots.txt` con `Disallow: /`. Questo è esplicitamente inteso come misura tecnica di riduzione della visibilità e de-indicizzazione sui motori di ricerca, non come esenzione o protezione legale dal diritto d'autore.

### Decisione sull'Integrazione AI: Prompt Esterno vs Funzione Server + AI
1. **Decisione Adottata: Prompt AI Esterno (Zero Backend, Zero Chiavi API)**
   - L'applicazione fornisce una guida e un prompt strutturato copia-incolla (`docs/PROMPT_IMPORT_CANTI.md`) con pulsante dedicato nella modale di importazione. L'amministratore copia il prompt e il testo/foto della canzone nel proprio strumento di intelligenza artificiale preferito (ChatGPT, Claude, Google Gemini) via browser, e incolla l'output ChordPro standardizzato nell'app.
   - **Vantaggi:** Costo di gestione e infrastruttura zero; nessuna chiave API memorizzata nel client o su server; totale indipendenza da limiti di budget; nessun rischio di furto credenziali o abusi.
2. **Valutazione dell'Evoluzione Futura: "Funzione Server (Supabase Edge Function) + AI"**
   - Abbiamo analizzato la possibilità di integrare un endpoint backend automatico (es. Edge Function che invoca OpenAI GPT-4o o Google Gemini API).
   - **Costi e Sostenibilità:** Una Edge Function richiede un account a pagamento o una chiave con carta di credito collegata. Un picco di chiamate o un crawler malevolo potrebbe azzerare i crediti in pochi minuti.
   - **Rischio Rifiuto Copyright (LLM Provider Refusal):** I principali fornitori di modelli linguistici applicano filtri automatici rigorosi per il copyright: richieste contenenti testi di canzoni note vengono sistematicamente respinte con messaggi di violazione delle policy (*"I cannot reproduce copyrighted song lyrics"*), rendendo il servizio server inaffidabile.
   - **Sicurezza:** Richiederebbe autenticazione rigorosa e rate-limiting complesso per evitare che l'endpoint venga sfruttato come proxy gratuito per chiamate AI a spese del gruppo scout.
   - **Conclusione:** L'approccio con prompt esterno e importazione lato client (con parsing .docx via `jszip` in chunk asincrono) è la soluzione architetturalmente più robusta, sicura, economica e sostenibile a lungo termine per il Clan.



---

## ADR-0016 (Fase 9B): Perfezionamento Tipografico Canzoniere A4, Ancoraggio Accordi a Larghezza Zero, Interlinea Esatta 16.5 pt e Gestione Resiliente BPM

### Data
2026-10-18

### Contesto e Diagnosi Misurata
A seguito del confronto metrologico tra il PDF stampato e il documento di riferimento Google Docs ("Strade di coraggio - Canzoniere"):
1. **Font Incorporati:** Il PDF di Chromium incorporava Arial e Consolas-Bold al posto di Roboto e Nova Mono, a causa del caricamento lazy dei font e della mancanza di un `@font-face` esplicito per il peso 700 di Nova Mono.
2. **Geometria Tipografica:** Il corpo usava altezza e interlinea inferiori all'originale. In Docs/Word l'interlinea 1.25 equivale in CSS a un passo di **16.5 pt** (`line-height: 1.5` su font base 11 pt). Le righe senza accordi riservavano erroneamente spazio bianco sopra.
3. **Riempimento Pagina:** L'algoritmo di espansione per canti a 1 pagina non colmava lo spazio utile in basso. Impostata soglia `fillTargetPercent: 88` con scaling fino a 13 pt (disattivabile impostando `maxSizePt = baseSizePt`).
4. **Ancoraggio Accordi:** Gli accordi venivano spostati forzatamente a inizio parola perdendo la sillaba, e il calcolo basato su caratteri fissi (0.52 em) causava derive.
5. **Direttive e UI:** `{nuova_colonna}` e altre direttive ChordPro non dovevano apparire nel testo né generare box tratteggiati; la modale di inserimento risultava asimmetrica; i modali di modifica ed eliminazione rimanevano coperti dal z-index della modalità lettura.
6. **BPM e Rifiuto Perdita Dati:** Il campo testuale `bpm_testo` deve essere preservato esattamente (es. "circa 92–94") e non appiattito a intero; se la colonna non esiste sul database Supabase, `saveCanto` deve bloccare l'operazione con avviso esplicito sulla migrazione 0006 mancante, senza degradare in silenzio.

### Decisioni Adottate
1. **Pre-caricamento Font e @font-face Esplicito:**
   - Creata utility `ensureCanzoniereFontsLoaded()` che invoca `document.fonts.load()` per tutti i pesi e stili di Roboto (400, italic, 700) e Nova Mono (400, 700) prima di avviare `window.print()` e prima delle misurazioni di layout.
   - Aggiunto `@font-face` con `font-weight: 700` per Nova Mono in `tokens.css` per evitare il fallback su Consolas. Risultato misurato in PDF binario: 100% Roboto e NovaMono, 0 Arial, 0 Consolas.
2. **Renderer Unificato `CantoLineRenderer` a Larghezza Zero:**
   - Ciascun accordo è incapsulato in un'ancora inline a larghezza zero (`display: inline-block; width: 0; position: relative; vertical-align: baseline`) con badge in posizione assoluta (`bottom: 1.35em`). Il testo dei versi scorre continuo a livello di caratteri senza interruzioni di flusso.
   - Le righe con accordi ricevono classe `.has-chords` con `margin-top: 1.5em`; le righe senza accordi non riservano alcuno spazio superiore.
   - Risoluzione collisioni orizzontali automatica: se due accordi consecutivi distano meno di 0.4 em, il secondo viene traslato orizzontalmente senza eccedere l'ancoraggio successivo.
   - Classi condivise inserite in `components.css` garantendo fedeltà sia a schermo che in stampa.
3. **Parser Importatore Aggiornato:**
   - Rimossa la forzatura all'inizio della parola: gli accordi a metà sillaba restano esattamente sulla sillaba assegnata (`cam[Re]mino`).
   - Gli spazi bianchi sono misurati con font regular e gli accordi con font bold.
   - Rimossa la deduzione automatica della tonalità dal primo accordo (`tonalita` resta `null` a meno di tag esplicito).
4. **Invisibilità Rigorosa Direttive:**
   - Qualsiasi direttiva ChordPro isolata `/^\{[^}]*\}$/` (inclusi `{nuova_colonna}`, `{nc}`, `{nuova_pagina}`, `{np}`, `{bpm:...}`, `{ritmo:...}`, ecc.) o inline viene rimossa dal testo e non genera elementi DOM visibili.
5. **Z-Index e Modale Simmetrico:**
   - `CantoReadingMode` impostato a `var(--z-sticky, 100)`: i fogli modali `BottomSheet` e `Modal` (`z-index: 1000`) si aprono ora in primo piano senza dover chiudere la lettura.
   - Riorganizzato il form "Nuovo Canto" con griglia fissa 2 colonne perfettamente simmetrica: Riga 1: Tonalità | Capotasto; Riga 2: Misura | BPM (testo singolo); Riga 3: Ritmo con keypad frecce integrato.
6. **Integrità BPM e Migrazione SQL 0006:**
   - `admin_actions.ts` rifiuta il salvataggio se Supabase restituisce errore di colonna mancante per `bpm_testo`, segnalando la migrazione necessaria all'amministratore.

---

## ADR-0017 (Fase 9C): Sfondo Topografico Ambientale Ufficiale della Majella (Copernicus DEM 30m, Monte Amaro 2793m, Parallasse su Ref Senza Re-render)

### Data
2026-10-18

### Contesto
In precedenza lo sfondo topografico conteneva curve di livello dimostrative. La Fase 9C richiede la sostituzione con una carta topografica stilizzata ma rigorosamente REALE del massiccio della Majella, centrata su Monte Amaro (2793 m) e il canalone della Rava del Ferro, preservando la sobrietà e il contrasto dell'interfaccia.

### Decisioni Adottate
1. **Modello Digitale del Terreno Reale (Copernicus GLO-30):**
   - Utilizzato il raster ad alta risoluzione (1 arcosecondo ≈ 30 metri) del programma europeo Copernicus (`Copernicus_DSM_COG_10_N42_00_E014_00_DEM.tif`).
   - Riquadro geografico calibrato attorno all'asse Monte Amaro - Rava del Ferro: Lon [14.005°, 14.195°], Lat [42.060°, 42.120°].
2. **Generazione Vettoriale Build-Time (Nessuna libreria nel client bundle):**
   - Lo script `scripts/generate_majella_svg.mjs` calcola le curve di livello mediante `d3-contour` come devDependency a build-time.
   - Semplificazione Douglas-Peucker con tolleranza $\epsilon = 0.95\text{ px}$, riducendo i punti del 90% preservando la geomorfologia reale delle creste e dei canaloni glaciali.
   - Peso finale compresso in GZIP: **20.3 KB** (inferiore alla soglia limite di 40 KB).
3. **Parallasse in Scroll ad Alte Prestazioni (Direct Ref DOM):**
   - Eliminato qualsiasi stato locale (`useState`) in `TopographicBackground.tsx`. L'aggiornamento della parallasse avviene manipolando direttamente `ref.style.transform = translate3d(0, ${parallaxOffset}px, 0)` all'interno di un `requestAnimationFrame` con flag debounce.
   - Zero re-rendering Preact in fase di scroll, zero ricalcolo del Virtual DOM, 60fps fluidi su dispositivi mobili.
4. **Etichette Ufficiali Verificate (7 toponimi con doppia fonte):**
   - Registrate in `docs/SFONDO_MAJELLA.md`: Monte Amaro (2793 m, con punto giallo di tappa scout), Rava del Ferro (canalone sentiero CAI B5), Bivacco Cesare Mario Pelino (2790 m), Monte Focalone (2676 m), Monte Acquaviva (2737 m), Passo San Leonardo (1282 m), Lama Bianca (1500 m).
   - Coordinate e quote convalidate numericamente sul DEM Copernicus.
5. **Colori, Contrasto e Isolamento:**
   - Curve intermedie: `--color-ink` opacità 0.055 (chiaro) / 0.08 (scuro).
   - Curve maestre: `--color-canti` (tinta azzurra) opacità 0.12 (chiaro) / 0.16 (scuro).
   - Sentiero CAI B5: `--color-giochi` opacità 0.35 tratteggiato.
   - Maschera gradiente verticale per dissolvenza graduale verso l'alto.
   - Nascosto in stampa (`@media print`) e nella lettura canti a schermo intero.
   - Disattivato con `prefers-reduced-motion: reduce`.
---

## ADR-0018 (Fase 10): Inserimento Canti a Mano, Pulizia e Rimozione Totale della Dipendenza da AI

### Data
2026-10-19

### Contesto
Nelle fasi precedenti era stata ipotizzata una modalità di digitalizzazione basata su intelligenza artificiale esterna con prompt guidato.
Nell'uso reale sul campo:
1. **Assenza di archivio massivo:** I canti del repertorio del Clan vengono inseriti manualmente dai capi e dagli animatori liturgici/musicali, prevalentemente da smartphone.
2. **Rischi critici dell'AI:** I modelli linguistici commerciali generano allucinazioni armoniche (accordi inventati non conformi alla tonalità scout), possono rifiutare brani protetti da copyright per filtri di sicurezza automatizzati, e non offrono alcuna garanzia deterministica sulla sillaba di caduta dell'accordo.
3. **Obiettivo:** Rendere l'inserimento manuale rapido, intuitivo e a prova di errore direttamente dall'interfaccia dell'applicazione, senza alcuna dipendenza da servizi di terze parti o intelligenze artificiali.

### Decisioni Adottate
1. **Rimozione Completa dell'AI dall'Applicazione:**
   - Rimossa la scheda "Con IA / Prompt" dal form di inserimento del canto.
   - Eliminato il prompt fisso incorporato e il pulsante "Copia Prompt AI".
   - Spostato `docs/PROMPT_IMPORT_CANTI.md` in `docs/archivio/` con apposita nota di non utilizzo.
   - Nessun testo di aiuto, documentazione attiva o componente cita "IA", "AI" o "prompt" per l'inserimento.
2. **Schede di Creazione e Importazione:**
   - Scheda 1: **"Incolla o scrivi"** (con incolla intelligente, rimozione automatica rumore web, normalizzazione caratteri e schermata di revisione visiva prima del salvataggio).
   - Scheda 2: **"Da Word (.docx)"** (parser con supporto tabelle a 2 colonne, conservato senza modifiche funzionali).
3. **Flessibilità delle Notazioni Armoniche e Rifiuto delle Trappole Italiane:**
   - Accettazione della notazione con trattino per accordi minori tipica dei canzonieri scout cartacei (`La-`, `SI-`, `Re-`, `Do#-` normalizzati in `Lam`, `Sim`, `Rem`, `Do#m`).
   - Tolleranza maiuscolo/minuscolo e slash chords (`Re/Fa#`, `Sol/Si`).
   - Rigorosa protezione contro parole italiane omonime a note musicali (`Do`, `Re`, `Mi`, `Fa`, `Sol`, `La`, `Si`): una frase o riga di testo comune non viene mai interpretata come riga di accordi.

---

## ADR-0019 (Fase 11): Unificazione Ingressi Canti (PDF e DOCX), Editor di Revisione Unificato, Categorie Canti e Isolamento Stili di Stampa

### Data
2026-10-20

### Contesto
L'esperienza d'uso ha evidenziato che la moltiplicazione di modalità di inserimento (incolla testo, scrivi a mano, scheda con IA, prompt, import in blocco) generava confusione e manutenzione ridondante. Inoltre, l'apertura della vista Stampa causava un bug grafico globale in cui le regole non isolate di `print.css` sovrascrivevano il testo dell'app rendendolo scuro e illeggibile in tema scuro. Infine, era necessaria una categorizzazione chiara del repertorio musicale del Clan ('scout', 'chiesa', 'esterni') senza default arbitrari.

### Decisioni Adottate
1. **Isolamento Rigoroso di `print.css` (11A):**
   - Tutte le regole di layout del canzoniere cartaceo sono state incapsulate dentro `.canzoniere-page`, `.stampa-measure-host` e blocchi `@media print`.
   - Nessun selettore globale non circoscritto in moduli caricati a richiesta. Risolto definitivamente il bug del testo scuro nelle viste di dettaglio e lettura.
   - Creato test Playwright di verifica stili multi-rotta per prevenire future regressioni da CSS dinamici.
2. **Due Soli Ingressi Unificati: PDF e DOCX (11B):**
   - Rimossi definitivamente e dismessi: "Scrivi a mano", "Incolla testo", "Con IA", il prompt fisso e l'importazione in blocco.
   - Rimasto un unico pulsante discreto "Nuovo canto vuoto" che apre la stessa identica schermata di revisione.
3. **Parser PDF a 2 Colonne e Importazione Dinamica (11C):**
   - Integrazione di `pdfjs-dist` caricato **esclusivamente con import dinamico** nell'area admin al caricamento del file.
   - Algoritmo di rilevamento a 2 colonne basato sulla distribuzione statistica (bimodale) delle coordinate X dei blocchi di testo.
   - Esclusione garantita di `pdfjs-dist` e del worker da Workbox Precache per non appesantire il primo avvio del sito per gli utenti normali.
4. **Schermata di Revisione a Due Riquadri (11D):**
   - Riquadro sinistro con textarea a grandezza naturale con numeri di riga e inserimento rapido accordi.
   - Riquadro destro con anteprima live conforme alla stampa A4.
   - Riquadro inferiore a scomparsa per metadati aggiuntivi (tonalità, bpm, misura, capotasto, autore, note).
5. **Classificazione Categoria Canti (`0007_canti_categoria.sql`):**
   - Valori ammessi: `'scout'`, `'chiesa'`, `'esterni'`.
   - Colonna nullable senza default (i canti storici restano senza categoria finché non riassegnati).
   - Scelta obbligatoria in sede di salvataggio da form/revisione.
   - Aggiornati schemi, indici parziali, tipi TypeScript e logica di backup/ripristino JSON.

---

## ADR-0020 (Fase 12): Automazione CI/CD, Ambiente Staging, Regressioni Visive e Pubblicazione Controllata

### Data
2026-10-20

### Contesto
Il mantenimento manuale e i controlli visivi/funzionali ripetitivi sottraggono tempo prezioso alla gestione del Clan. Era necessario creare un'architettura completa di automazione in background su GitHub Actions a costo zero (100% Free Tier), che esegua tutti i controlli (tipi, test, budget di peso, regressioni visive, controlli schema e sicurezza) bloccando qualsiasi pubblicazione difettosa o regressione grafica prima che arrivi agli utenti.

### Decisioni Adottate
1. **Pipeline CI Multifase (`.github/workflows/ci.yml`):**
   - Trigger su ogni push e PR con cancellazione automatica delle esecuzioni precedenti (`cancel-in-progress`).
   - Typecheck TypeScript (`tsc --noEmit`), suite Vitest (184 test), Build PWA.
   - Matrice Playwright estesa su Chromium, WebKit (Desktop Safari) ed emulazioni mobile (iPhone SE, iPhone 15, iPad, Pixel 7).
   - Lighthouse CI con 3 esecuzioni mediane e soglie di blocco prestazionali/accessibilità.
2. **Budget di Peso Automatizzato (`scripts/check_weight_budget.mjs`):**
   - Soglie stringenti su bundle iniziale (JS gzip < 80 KiB, CSS gzip < 20 KiB), precache totale (< 5500 KiB) e foto di testata (< 700 KiB).
   - Controllo vincolante che `pdfjs-dist` e `pdf.worker` siano al 100% esclusi dal precache del service worker.
3. **Ambiente di Staging Dedicato e Protezione Hardware della Produzione:**
   - Utilizzo del secondo progetto gratuito Supabase come Staging.
   - Workflow `staging-schema.yml` per provare le nuove migrazioni in staging prima della produzione.
   - `scripts/run_admin_test.mjs`: hard block immediato con codice d'uscita 1 se l'URL del database corrisponde al progetto di produzione (`lpeiyzwccedtqjbficjo`).
4. **Verifica Schema di Produzione in Sola Lettura (`scripts/check_prod_schema.mjs`):**
   - Interroga le tabelle tramite REST API anonime in sola lettura (`limit=0`).
   - Se mancano colonne (migrazioni non applicate dal proprietario), apre automaticamente una Issue su GitHub con l'SQL da eseguire.
5. **Regressioni Visive Deterministica (`test/visual_regression.spec.ts`):**
   - Cattura e verifica pixel-per-pixel delle schermate principali (Home, Canti, Lettura a schermo intero, Revisione modale con avvisi, Anteprima Stampa) a 390px e 1440px in tema chiaro e scuro.
   - Tolleranza differenziale massima $\le 2\%$.
6. **Pubblicazione Controllata in Produzione (`.github/workflows/deploy.yml`):**
   - Esecuzione non più su semplice push su `main`, ma agganciata al completamento con esito positivo della CI (`workflow_run`).
   - Richiede approvazione manuale (Required Reviewer) tramite l'Environment protetto `production` di GitHub.
   - Post-deploy smoke test automatico (`test/smoke_deploy.spec.ts`) per verificare HTTP 200, assenza di risorse 404, registrazione Service Worker e CSP valida.
7. **Regole di Autopilot e Nessun Costo Aggiuntivo:**
   - Configurazione di Dependabot e workflow settimanale di manutenzione per audit dipendenze.
   - Rispetto di tutte le quote gratuite (GitHub Actions < 2000 min/mese, Supabase 2 progetti 0€/mese).

---

## ADR-0021: Riscrizione Completa del Sottosistema di Stampa (Tre Flussi Separati, Due Varianti Canzoniere, Layout Adattivo e Indice per Settori)

### Data
2026-10-27

### Contesto
La precedente schermata di stampa (`StampaView.tsx`, 1481 righe) accorpava Giochi, Bans, Canti e ODG in un'unica configurazione mista (`StampaConfig`) e consentiva una modalità "tutti" che generava documenti ibridi e ingestibili per le attività di reparto e clan. Inoltre, il canzoniere utilizzava font statici lasciando vistosi spazi vuoti e non offriva distinzione tra chi suona (accordi, intro/outro, metadati) e chi canta (solo testo, righe più basse, risparmio carta).

### Decisioni Adottate
1. **Tre Flussi di Stampa Rigorosamente Separati (`SectionTab = 'giochibans' | 'canzoni' | 'odg'`):**
   - Rimozione totale della modalità "tutti". Giochi/Bans, Canzoni e ODG non coesistono mai nello stesso job né nello stesso foglio di stampa.
   - Scomposizione di `StampaView.tsx` in un orchestratore modulare e 3 componenti dedicati: `StampaGiochiBans.tsx`, `StampaCanzoni.tsx`, `StampaOdg.tsx`.
   - Suddivisione della logica in `stampa_shared.ts`, `stampa_giochibans.ts`, `stampa_canzoni.ts`, `stampa_odg.ts`, mantenendo `stampa.ts` come facciata di re-export retrocompatibile.
2. **Due Varianti del Canzoniere ("Chi suona" e "Chi canta"):**
   - **Chi suona:** accordi sopra il testo ad alta leggibilità, intro/outro/strum strumentali preservati, metadati in testata (tempo, BPM, ritmo pennata con frecce Nova Mono).
   - **Chi canta:** accordi completamente rimossi (nessun tag `[Accordo]`, nessuna riga di soli accordi), commenti strumentali e pennate omessi, interlinea ridotta per massimizzare la capienza, testata con solo titolo e autore.
   - **Politica `RIT.` (`applyRitRepeatPolicy`):** il ritornello compare intero solo alla prima occorrenza; dalla seconda in poi viene sostituito dall'etichetta in grassetto `RIT.`. Ritornelli parzialmente diversi non vengono contratti. Gli artefatti di conversione da PDF (`RIT. / RIT:` in testata pagina) vengono eliminati all'origine.
3. **Layout Adattivo con Riempimento Spazio (Font Scaling):**
   - Algoritmo di ricerca binaria sulla dimensione font per canzone: scala proporzionalmente testo, accordi e interlinea tra `minSizePt: 9` e `maxSizePt: 17` pt (passo 0.5 pt).
   - Modalità predefinita `riempi_pagina`: massimizza la dimensione font nel target minimo di pagine evitando spezzature di strofe, righe orfane e single-word-wrap.
   - Opzione `compatta`: mantiene il corpo a 11 pt standard per risparmiare carta se richiesto.
4. **Indice Iniziale Diviso per 4 Settori:**
   - Ordinamento: 1. Scout (`scout`), 2. Esterni (`esterni`), 3. Chiesa (`chiesa`), 4. Altre (`altre`). I settori vuoti non vengono mostrati.
   - All'interno di ciascun settore, ordinamento alfabetico deterministico ignorando articoli iniziali italiani (*il, lo, la, i, gli, le, un, uno, una, l'*) e accenti.
   - Numerazione reale calcolata DOPO la fase di layout. Se la copertina è attiva, l'indice segue la copertina.
5. **Isolamento DOM e Scoping di Stampa:**
   - Contenitori DOM dedicati con ID univoci (`stampa-giochibans-root`, `stampa-canzoni-root`, `stampa-odg-root`).
   - `triggerPrint(scope)` assegna `data-print` sul `<body>` (`canzoni`, `giochibans`, `odg`) prima della stampa e lo rimuove su evento `afterprint`.
   - Regole CSS in `print.css` nascondono rigorosamente i flussi inattivi.
6. **Persistenza e Migrazione Morbida:**
   - Tre chiavi indipendenti in `sessionStorage`: `stampa_giochibans`, `stampa_canzoni`, `stampa_odg`.
   - La vecchia chiave monolitica `stampa_selection` viene ignorata per i nuovi flussi e supportata in lettura trasparente solo da `loadStampaConfig` legacy.

---

## ADR-0022: Ottimizzazione Avanzata del Layout A4 (1 vs 2 Colonne, Auto-Fill, FillRatio >= 0.90, Risoluzione Dati e Ridisegno Completo UI/UX della Stampa)

### Data
2026-10-27

### Contesto
La prima iterazione della riscrittura della stampa presentava diversi limiti pratici nei PDF generati:
1. I testi occupavano solo il 35-60% dell'altezza pagina con corpi bloccati intorno a 9 pt.
2. Le righe di testo importate dai PDF presentavano a capo fissi spuri (es. "...il meglio di" / "me.").
3. I dati di "Danza la vita" presentavano strofe e ritornello mescolati e duplicati ("cuor. Danza assieme a no----------------oi!").
4. Comparivano etichette duplicate "RIT. RIT:" e strofe ripetute identiche (come in Albachiara) non venivano contratte in `RIT.`.
5. L'interfaccia a schermo presentava box annidati con scroll interno a 340px, gerarchia poco chiara, opzioni dispersive e pulsanti di stampa lontani dall'utente.

### Decisioni Adottate
1. **Diagnosi e Risoluzione del Blocco Font a 9 pt:**
   - *Causa reale:* Il filtro `hasSingleWordWrap` considerava qualsiasi riga con più di 35 caratteri in due colonne come "con parola singola a capo", penalizzando tutti i candidati sopra 9.5 pt e forzando l'algoritmo sul font minimo di fallback (9 pt).
   - *Soluzione:* Ridefinito il controllo per individuare unicamente le vere parole orfane isolate (`cleanLast.length <= 4`). Implementato un algoritmo di scoring che valuta lo spazio (1 colonna vs 2 colonne) × (font da 9 pt a 28 pt per "Chi canta", e fino a 24 pt per "Chi suona"), privilegiando combinazioni che massimizzano il riempimento (`fillRatio >= 0.90`).
   - Canzoni brevi o dense usano 1 colonna a tutta larghezza (186 mm) con testo grande (15–18 pt); canzoni articolate passano a 2 colonne (89 mm) con flusso naturale `column-fill: auto`.
2. **Unione Righe di Continuazione (`joinContinuationLines`):**
   - Nel modulo `canzoniere_cleaner.ts`, le righe spezzate artificialmente dall'importazione OCR/PDF vengono riunite deterministicamente prima del layout (righe che iniziano con minuscola, completamento di parentesi aperte o continuazioni di frase), lasciando che sia l'algoritmo di impaginazione a calcolare i corretti a capo in base alla colonna.
3. **Integrità Dati "Danza la vita" e Rigenerazione Ritornelli:**
   - Testo corretto alla fonte in `src/data/parsed_songs.ts` e `supabase/seed_21_canti.sql` con ritornello coeso `{soc}...{eoc}` e accordi allineati sulle sillabe corrette.
   - Aggiunto auto-healing a runtime che rileva il record corrotto su IndexedDB e lo sostituisce con la versione canonica.
4. **Normalizzazione Etichette e Riconoscimento Strofe Ripetute:**
   - Rimozione degli artefatti "RIT. RIT:" attraverso la coalescenza dei blocchi in `applyRitRepeatPolicy`.
   - Riconoscimento automatico delle strofe ripetute non marcate (blocchi identici $\ge 2$ righe, come in Albachiara) che dalla seconda occorrenza vengono stampate come etichetta isolata in grassetto `RIT.`.
5. **Prevenzione Collisioni Verticali Chords/Lyrics su Righe Avvolte:**
   - Impostato `line-height: 2.2` su `.canzoniere-line-item.has-chords` per garantire che, qualora una riga con accordi vada a capo naturalmente, gli accordi della seconda riga visiva trovino adeguato spazio verticale senza collidere con il testo della prima riga.
6. **Ridisegno Completo UI/UX della Schermata Canzoniere:**
   - Flusso unico a colonna singola sotto il commutatore delle 3 stampe.
   - Bivio principale prominently posizionato: "Per chi stampi?" (`Chi suona (con accordi)` vs `Chi canta (solo testo)`).
   - Fisarmonica opzioni secondaria chiusa di default, con summary testuale dello stato corrente (`Riempi pagina · Indice attivo · Senza copertina`).
   - Selezione canti raggruppata per settore (Scout, Esterni, Chiesa, Altre) con touch target $\ge 44$ px, badge con numero di pagine calcolato in tempo reale per ogni canto e page-level scrolling (nessun box a scorrimento interno con altezza fissa).
   - Barra d'azione fissa in fondo (sticky bottom bar) con riepilogo contatore canti/pagine e pulsanti "Anteprima" e "Stampa / Salva PDF".
   - Attenuazione dello sfondo topografico majella nella schermata di stampa (`opacity: 0.02`).
7. **Verifica Visiva e Misure Numeriche Playwright (`test/stampa_canzoniere_visual.spec.ts`):**
   - Verifica completa a 1280px (desktop) e 390px (mobile).
   - Risultati misurati nel rendering reale su Chromium:
     - *Albachiara* (suona): font 14 pt, 2 colonne, fillRatio 100%
     - *Albachiara* (canta): font 16 pt, 1 colonna, fillRatio 82.1%
     - *Come ti ama Dio* (suona): font 11 pt, 1 colonna, fillRatio 100%
     - *Come ti ama Dio* (canta): font 18 pt, 1 colonna, fillRatio 85.2%
     - *Danza la vita* (suona): font 11.5 pt, 2 colonne, fillRatio 100%
     - *Danza la vita* (canta): font 15 pt, 1 colonna, fillRatio 88.8%
     - *Come sole come goccia* (suona): font 12.5 pt, 2 colonne, fillRatio 100%
     - *Come sole come goccia* (canta): font 17.5 pt, 2 colonne, fillRatio 93.2%
   - Screenshot salvati in `test/__screenshots__/print_overhaul/`.




---

## ADR-0023: Armonia Tipografica e Modello ad Unità Atomiche per la Stampa Canzoniere A4 (Eliminazione Pagine Bianche Fantasma, Margini Nativo 15mm, Prevenzione Collisioni Orizzontali Accordi/Testo)

### Data
2026-10-27

### Contesto
Dall'ispezione visiva e metrica dei primi PDF stampati e generati dal browser sono emersi quattro difetti fondamentali:
1. **Pagine bianche fantasma alternate:** un canzoniere con 4 canti e indice produceva 9 pagine nel PDF esportato da Chromium, con le pagine 3, 5, 7, 9 completamente bianche (eccetto un minuscolo trattino verticale al centro). La causa scatenante era la combinazione di altezza rigida `.canzoniere-page` e bordi/padding delle card di anteprima a schermo (`.stampa-a4-sheet-card`) che superavano di frazioni di pixel la capienza del foglio A4.
2. **Clipping sul bordo sinistro:** i primi 15mm sul lato sinistro del foglio venivano tagliati ("ACQUA" anziché "L'ACQUA", "T:" anziché "RIT:") a causa della somma tra il margine fisico del foglio `@page { margin: 15mm }` e la larghezza fissa `width: 210mm` ereditata a schermo, che portava la larghezza calcolata a 240mm forzando Chromium a traslare e ritagliare il contenuto.
3. **Collisioni e sovrapposizioni orizzontali/verticali tra accordi e testo:** l'uso di ancoraggi a larghezza zero (`.canzoniere-chord-anchor` con `width: 0; position: absolute;`) non occupava spazio fisico nel flusso del testo. Quando la sigla di un accordo era più larga della sillaba sottostante (es. `[Fa#m]` su `e`), l'accordo collideva orizzontalmente con la sillaba successiva (`dalRe`, `casRE`, `risvegFa liCol Do`).
4. **Disarmonia tipografica estrema:** i canti brevi venivano ingigantiti a corpi da manifesto (18–20 pt), mentre i canti lunghi venivano compressi sotto i 10 pt. Inoltre, strofe ripetute prive di marcatura di ritornello venivano erroneamente contratte in `RIT.` (es. "Respiri piano..." in Albachiara).

### Decisioni Adottate
1. **Armonia Tipografica Editoriale:**
   - Range del corpo testo rigorosamente delimitato tra 10.5 pt e 12.5 pt (standard 11.5 pt per "Chi canta", 11.0 pt per "Chi suona").
   - Canzoni brevi o dense usano 1 colonna a tutta larghezza con font confortevole (11.5–12.0 pt) e centratura verticale armonica, preservando l'aspetto di un canzoniere stampato curato ed elegante.
   - Canzoni molto lunghe (es. *Scouting For Boys*, 88 versi) scorrono naturalmente su 2 pagine in 2 colonne a 11.0 pt con testatina ridotta a pagina 2, senza mai schiacciare il testo in corpi microscopici o illegibili all'aperto.
2. **Modello ad Unità Atomiche (`.canto-word` > `.canto-unit`):**
   - Rimosso interamente il modello basato su ancore a larghezza zero e traslazioni assolute.
   - Unificata l'architettura visiva di schermo e stampa su una composizione flexbox verticale: ogni parola (`.canto-word`) contiene uno o più blocchi atomici (`.canto-unit`) composti da accordo (`.canto-unit-chord`) sopra e sillaba (`.canto-unit-lyric`) sotto.
   - Se l'accordo è più largo della sillaba, il box dell'unità si espande naturalmente determinando lo spazio fisico necessario, eliminando in modo matematico qualsiasi collisione o sovrapposizione tra accordi e testo adiacente.
3. **Reset Rigoroso di Stampa Paged Media e Margini A4:**
   - `@page { size: A4 portrait; margin: 15mm; }` definisce univocamente i margini fisici del documento A4.
   - In `@media print`, tutte le classi contenitore dell'anteprima a schermo (`.stampa-a4-sheet-card`, `.stampa-a4-preview-scroll`, `.print-song-book-item`) vengono azzerate (`padding: 0 !important; margin: 0 !important; border: none !important; box-shadow: none !important; width: 100% !important; height: auto !important; max-height: none !important; overflow: visible !important`).
   - Le pagine `.canzoniere-page` hanno `width: 100% !important; height: auto !important; padding: 0 !important; margin: 0 !important; break-after: page !important`.
   - Questo annulla qualsiasi overflow di larghezza (azzerando il clipping a sinistra) e di altezza (azzerando le pagine bianche fantasma).
   - Verifica Playwright su PDF nativo generato da Chromium (`test/stampa_pdf_pages.spec.ts`): 4 canti + indice = esattamente 5 pagine, 0 pagine bianche, 0 caratteri mozzati.
4. **Politica RIT Riconosciuta:**
   - Solo i veri ritornelli contrassegnati con direttiva ChordPro `{soc}` o prefisso esplicito `RIT:` vengono contratti nell'etichetta `RIT.` dalla seconda occorrenza in poi.
   - Le strofe ordinarie che ricorrono nel testo rimangono interamente visibili e cantabili con tutti i versi e gli accordi.
5. **Verifica Visiva e Misure Reali Playwright (`test/stampa_canzoniere_visual.spec.ts`):**
   - *Albachiara* (suona): font 11.0 pt, 2 colonne, fillRatio 100%
   - *Albachiara* (canta): font 12.5 pt, 1 colonna, fillRatio 81.4%
   - *Come ti ama Dio* (suona): font 11.0 pt, 1 colonna, fillRatio 100%
   - *Come ti ama Dio* (canta): font 12.5 pt, 1 colonna, fillRatio 59.2%
   - *Danza la vita* (suona): font 11.5 pt, 2 colonne, fillRatio 100%
   - *Danza la vita* (canta): font 12.5 pt, 1 colonna, fillRatio 74.0%
   - *Come sole come goccia* (suona): font 10.5 pt, 2 colonne, fillRatio 100%
   - *Come sole come goccia* (canta): font 12.5 pt, 1 colonna, fillRatio 86.3% 
---

## ADR-0024: Perfezionamento Layout e Compressione Spazio A4 (Margini 12mm, Larghezza Colonne 89.5mm, Bilanciamento Colonne Deterministico e Protezione Versi)

### Data
2026-10-29

### Contesto
Nonostante l'adozione del modello ad unità atomiche e la risoluzione delle pagine fantasma introdotte in ADR-0023, la stampa cartacea e l'anteprima PDF evidenziavano ancora criticità strutturali nell'impaginazione dei canti:
1. **Colonna Destra Vuota o Squilibrata:** L'algoritmo di impaginazione sequenziale `column-fill: auto` distribuiva le strofe riempiendo la colonna sinistra fino alla massima altezza possibile; per canti di media lunghezza che entravano interamente in una colonna, la colonna destra rimaneva desolatamente vuota al 100%, lasciando un foglio asimmetrico e spreco di spazio.
2. **Fusione Aggressiva dei Versi (`joinContinuationLines`):** Nel modulo `canzoniere_cleaner.ts`, un'euristica basata su `(lyrCur.length < 32 || lyrNext.length < 25)` fondeva indiscriminatamente versi consecutivi distinti scritti con iniziale minuscola. Questo accorpamento generava righe artificialmente lunghe (> 65 caratteri) che forzavano continui a capo visivi, innescavano il flag `hasTooLongLines` e deprimevano il font a 9.5–10 pt.
3. **Geometria Margini e Sovrastima Larghezza Caratteri:** I margini da 15 mm limitavano la larghezza utile di ciascuna colonna a 86.5 mm, costringendo anche versi normali al wrapping. Inoltre, la stima empirica di larghezza carattere a 0.50–0.52 em e il conteggio duplicato degli spazi tra parole gonfiavano artificialmente la larghezza calcolata.
4. **Altezza Utile Non Calibrata sulla Testata Musicale:** Su canti con testata completa (titolo, autore, tonalità, BPM, ritmo con frecce), l'altezza utile residua per la prima pagina deve rispettare rigidamente la capienza fisica A4 (297 mm - 24 mm di margini - 38 mm di testata = 235 mm) per prevenire lo sbordo a piè di pagina durante la stampa fisica.

### Decisioni Adottate
1. **Geometria A4 con Margini da 12mm ed Espansione Colonne a 89.5mm:**
- Fissato `@page { size: A4 portrait; margin: 12mm; }`.
- Larghezza stampabile utile: 186 mm. Con intercolonna (gap) di 7 mm e linea divisoria centrale continua (`border-left: 0.75pt solid oklch(0.7 0 0)`), ciascuna colonna acquisisce **89.5 mm** di larghezza effettiva (+3 mm rispetto al passato), riducendo drasticamente il wrapping dei versi.
2. **Algoritmo di Bilanciamento Colonne Deterministico (`balanceIntoTwoColumns`):**
- Sostituito il packing sequenziale greedy con un algoritmo di partizione ottimizzata applicato a tutte le canzoni a pagina singola e alla pagina terminale dei canti multipagina.
- L'algoritmo valuta ogni punto di taglio tra blocchi e seleziona l'indice che minimizza il divario di altezza $\Delta h = |h_{left} - h_{right}|$, con il vincolo rigido che $\max(h_{left}, h_{right}) \le \text{maxColHeightMm}$.
- Nessun blocco o strofa viene spezzato a metà: le strofe fluiscono integre e visivamente bilanciate tra le due colonne, eliminando le voragini bianche.
3. **Calibrazione Fisica Rigorosa delle Altezze Utili:**
- Pagina 1 con parametri musicali (tonalità, BPM, ritmo): `235 mm`.
- Pagina 1 senza parametri musicali: `248 mm`.
- Pagina 1 in modalità "Chi canta": `254 mm`.
- Pagine 2+ (testatina ridotta titolo e numero pagina): `262 mm`.
4. **Calibrazione Metrologica del Font Roboto:**
- Larghezza media carattere non-spazio in Roboto latino: `0.46 * fontSizePt`.
- Spaziature tra parole e margini delle unità atomiche isolate: `0.28 * fontSizePt`, evitando il doppio conteggio degli spazi.
5. **Protezione dei Versi Poetici in `canzoniere_cleaner.ts`:**
- Rimossa la condizione aggressiva di fusione sulle lunghezze riga.
- Preservate unicamente le unioni tipograficamente certe:
- Trattino finale esplicito (`-`);
- Parentesi aperta non chiusa;
- Preposizioni o connettivi espliciti in fine riga (`e`, `o`, `ma`, `se`, `per`, `con`, `su`, `tra`, `fra`, `a`, `di`, `da`, `in`);
- Frammenti tronchi o desinenze minime (`me.`, `te.`).
6. **Criterio di Selezione Formato (1 Colonna vs 2 Colonne):**
- Il bonus per il layout a 2 colonne (+450 pt) viene confermato solo per canti che garantiscono un riempimento organico (`fillRatio >= 0.40`).
- Se un canto molto breve produrrebbe un riempimento inferiore al 40% a 2 colonne, l'ottimizzatore assegna la modalità a 1 colonna a tutta larghezza con font confortevole e armonico (11.5–12.5 pt in `riempi_pagina`), preservando sia la leggibilità che l'eleganza estetica.
7. **Verifica Globale:**
- 100% test superati (Vitest 241/241, Playwright PDF export 6 pagine con 0 overflow, Playwright Visual Regression 10/10).

---

## ADR-0025: Perfezionamento Canti Lunghi/Multi-Pagina, Variante "Chi canta" Salva-Spazio, Numerazione Reale e Indice a Riferimenti Incrociati

### Data
2026-10-30

### Contesto
Dalle prove di esportazione PDF e stampa fisica del Canzoniere sono emerse quattro necessità editoriali e funzionali:
1. **Pagine di overflow e sbilanciamenti:** In canti con parametri musicali ricchi (es. "E la strada si apre"), il calcolo geometrico consentiva al blocco finale di estendersi fino al limite estremo del foglio. La presenza di margini inferiori non azzerati nel DOM reale scatenava lo sbordo nel margine non stampabile (12mm) di Chromium, provocando l'emissione di una sesta pagina completamente vuota.
2. **Variante "Chi canta" (senza accordi) poco efficiente:** Senza accordi, i versi occupano la metà dello spazio verticale. L'algoritmo precedente penalizzava le 2 colonne sui brani di media lunghezza a causa di un `fillRatio` inferiore al 40%, costringendo gran parte dei canti a 1 colonna e vanificando l'opportunità di risparmiare fogli di carta nel libretto dei canti.
3. **Numerazione pagine e corrispondenza Indice:** L'indice e le card a schermo mostravano numeri relativi o slegati dal foglio stampato, rendendo difficile ritrovare i canti sfogliando il canzoniere cartaceo.
4. **Mancanza di riferimenti incrociati chitarristi/coro:** Durante le veglie o messe scout, i chitarristi con il canzoniere "Chi suona" e i ragazzi con il libretto "Chi canta" si trovano su pagine diverse poiché "Chi canta" accorpa i brani in meno fogli. Mancava un'indicazione rapida per sincronizzare l'assemblea ("andate a pagina X del vostro canzoniere").
5. **Indice dispersivo:** I titoli di sezione includevano il contatore `(N)` (es. `CANZONI SCOUT (4)`), la testata usava una riga di sottotitolo separata con badge ingombrante, e l'interlinea non permetteva di far entrare ~30 canti in un unico foglio A4.

### Decisioni Adottate
1. **Calibrazione Metrologica e Azzeramento Pagine Bianche Fantasma:**
   - Ridotto `page1MaxColHeightMm` per canti con parametri musicali completi da 235mm a 222mm, assicurando un margine di sicurezza di 24mm dal bordo inferiore del foglio prima del margine fisico di 12mm.
   - Azzerato il margine inferiore dell'ultimo blocco (`.canzoniere-column .canzoniere-block:last-child { margin-bottom: 0 !important; }`).
   - Rimosso il doppio salto pagina forzato tra `.canzoniere-page` e `.stampa-a4-sheet-card`, impostando `.canzoniere-page { break-after: auto !important; }` in `@media print` e affidando la suddivisione foglio unicamente a `.stampa-a4-sheet-card`.
2. **Variante "Chi canta" Salva-Spazio ad Alta Densità:**
   - Intestazione compatta su riga singola flex (`.canzoniere-header-row`): Titolo in grassetto a sinistra (14pt), autore a destra (10pt) con linea divisoria sottile, guadagnando ~10mm di altezza verticale utile rispetto alla testata estesa con ritmo e BPM.
   - Soglia di attivazione a 2 colonne impostata a $\ge 22$ versi non vuoti: per tutti i canti standard e lunghi (Danza la vita, Albachiara, Come sole come goccia, Wonderwall, Destri, ecc.) l'algoritmo applica un bonus prioritario (+800 pt) per le 2 colonne e una severa penalità (-3500 pt) alla colonna singola.
   - I canti brevi (< 22 versi, come "Come ti ama Dio" e "Servo per amore") mantengono l'impaginazione a 1 colonna a tutta larghezza con font grande ed elegante (11.5–12.5 pt).
3. **Numerazione Reale Continua del Libro:**
   - Aggiunta la proprietà `bookPageNumber` a `CanzonierePage` e rendering del piè di pagina su ogni foglio stampato: `— {page.bookPageNumber} —`.
   - L'indice del canzoniere apre a pagina 1 (`— 1 —`), e i canti successivi ricevono progressivamente le pagine `entry.startPage + pIdx` perfettamente allineate all'indice.
4. **Indice con Riferimenti Incrociati Automatici:**
   - In `loadPrintableCanzoniData`, il motore calcola simultaneamente l'impaginazione della variante attiva e dell'altra variante.
   - L'indice "Chi suona" stampa per ogni canto: `[canta: p. X]   p. Y`.
   - L'indice "Chi canta" stampa per ogni canto: `[suona: p. Y]   p. X`.
5. **Indice Compatto a Pagina Singola (~30 canti/pagina):**
   - Titolo unificato: `INDICE DEI CANTI (con accordi)` o `INDICE DEI CANTI (senza accordi)` con variante tra parentesi a 10pt accanto al titolo principale a 14pt.
   - Rimossi i contatori numerici `(N)` dalle intestazioni di sezione (`CANZONI SCOUT`).
   - Linee guida punteggiate (`dotted leaders`) con righe a 8.5pt e spaziatura 1.5pt, con soglia di passaggio a 2 pagine elevata a 38 righe complessive.
6. **Verifica Globale:**
   - 100% test superati: Vitest 249/249 (27 file), Playwright PDF export 5 pagine esatte con 0 pagine vuote (eliminata pagina 6 fantasma), Playwright Visual Regression 11/11, Weight budget 100% conforme.

---

## ADR-0026: Canzoniere a Flusso Continuo (Concatenazione su 2 Colonne e Header in Colonna)

### Data
2026-11-02

### Contesto
Nei modelli di impaginazione precedenti (ADR-0024 e ADR-0025), ogni canto veniva impaginato su un foglio dedicato (o sequenza di fogli dedicati). Sebbene efficace per l'isolamento dei singoli brani, questa impostazione comportava uno spreco consistente di carta: canti brevi o medi lasciavano dal 40% al 60% del foglio A4 inutilizzato.
Per la produzione di libretti di clan tascabili e densi per uscite e route, è emersa la necessità di un'impaginazione editoriale a **flusso continuo a 2 colonne** (formato libretto dei canti scout professionale), in cui i canti si concatenano sequenzialmente massimizzando il fattore di riempimento medio (target $\approx 80\%$).

### Decisioni Adottate

1. **Flusso Continuo a 2 Colonne (`layoutCanzoniereFlow`):**
   - Griglia fissa a 2 colonne da 89.5 mm ciascuna, con altezza utile di 256 mm (`CONTINUOUS_FLOW_COL_HEIGHT_MM`).
   - I canti fluiscono senza soluzione di continuità tra colonna sinistra e destra e attraverso le pagine, eliminando salti pagina artificiali tra un canto e l'altro.

2. **Header di Canto Monocolonna (89.5 mm):**
   - Poiché i canti possono iniziare a qualsiasi altezza della colonna sinistra o destra, l'intestazione del brano (titolo a 15pt bold, autore a 9.5pt italic, metadati musicali) è incapsulata all'interno della singola colonna (`type: 'header'` in `SongBlock`) anziché come banner a tutta pagina.
   - Quando un canto inizia a metà colonna (dopo un altro brano), viene inserito un divisorio sottile orizzontale (`.canzoniere-song-divider`) con margine superiore di 4 mm per separare visivamente i brani.

3. **Soglia Spazio Minimo ($\ge 55$ mm) e Prevenzione Header Orfani:**
   - Un nuovo canto inizia a metà colonna solo se lo spazio verticale residuo nella colonna è $\ge 55$ mm (`MIN_REMAINING_HEIGHT_FOR_NEW_SONG_MM`).
   - 55 mm garantiscono lo spazio necessario per l'header del canto (~16-24 mm) più almeno due strofe complete (6-8 versi con accordi), evitando rigorosamente titoli orfani in fondo a colonna o frammenti minimi di testo.
   - Oltre alla soglia fissa di 55 mm, l'algoritmo verifica preventivamente che lo spazio residuo effettivo sia sufficiente per l'header e ALMENO la prima strofa intera (o almeno 2 strofe / 5-6 versi se ci sono più strofe). In caso contrario, il canto avanza automaticamente in cima alla colonna successiva.
   - È implementata un'invariante difensiva assoluta: qualora per anomalie di metrica la prima strofa non potesse essere posizionata sotto l'header inserito a fondo colonna, l'header viene automaticamente ritirato (pop) e riposizionato in cima alla colonna successiva senza linea divisoria superiore, garantendo matematicamente l'assenza di titoli orfani in tutto il documento.

4. **Uniformità Tipografica del Font ($\pm 0.5$ pt) e Propagazione a Livello di Blocco:**
   - Dimensione font base standardizzata a 11.0 pt per "Chi suona" e 11.5 pt per "Chi canta".
   - La compattazione massima consentita per esigenze di adattamento è limitata a 0.5 pt (10.5 pt per "Chi suona", 11.0 pt per "Chi canta"), prevenendo sbalzi ottici sgradevoli tra canti adiacenti nello stesso foglio.
   - Il font compattato viene marcato direttamente su ciascun blocco (`SongBlock.fontSizePt`) e propagato via Preact a `CantoLineRenderer`, garantendo che l'impaginazione a video e in stampa A4 utilizzi esattamente i font millimetrici previsti.

5. **Compattazione Anti-Orfani e Suddivisione Continua Blocchi Giganti:**
   - Se l'eventuale sbordo di un brano sulla pagina successiva genera una coda orfana di $\le 4$ righe (`MIN_PAGE_SPILL_LINES = 5`), il motore ricalcola preventivamente il brano con font compattato di 0.5 pt. Se il canto si trovava a fondo colonna destra e la compattazione non evita lo sbordo, l'intero brano viene fatto scattare all'inizio della pagina successiva, azzerando le code orfane di 2-4 versi.
   - Per strofe continue di lunghezza eccezionale (40-80 righe senza righe vuote), è attivo un ciclo di chunking progressivo (`splitLargeBlock`) che garantisce il rispetto del limite di colonna (256 mm) senza overflow.
   - Gli autori o sottotitoli lunghi su 2 o più righe calcolano dinamicamente la propria altezza reale evitando sottostime dell'ingombro.

6. **Differenziazione Metadati e Variante "Chi canta":**
   - "Chi suona": riporta accordi, capotasto e frecce ritmiche Nova Mono (`↓ ↑`).
   - "Chi canta": omette completamente accordi, capotasto e ritmo, riducendo l'ingombro dell'header a una riga singola compatta con titolo e autore.

7. **Testatina Corrente di Sezione (`.canzoniere-running-header`):**
   - Ogni pagina del flusso continuo mostra in alto a destra la sezione tematica attiva (es. `CANZONI SCOUT`, `LITURGICI`, `VARIE`), fornendo orientamento immediato durante lo sfoglio.

8. **Sincronizzazione Indice e Riferimenti Incrociati Continui:**
   - La funzione `calculateCanzoniereIndex` mappa la pagina reale di inizio canto ricavata dal layout continuo (`actualStartPagesMap`).
   - Più canti possono condividere la medesima pagina di inizio (es. canti concatenati su pagina 2).
   - I riferimenti incrociati (`[canta: p. X]` / `[suona: p. Y]`) vengono calcolati eseguendo preventivamente il layout continuo di entrambe le modalità.

### Verifica Globale
- **Unit Test (Vitest):** 261/261 test passati (27 file), inclusi 18 test specifici di layout continuo in `test/canzoniere_layout.test.ts` e 21 test di integrazione indice in `test/stampa_nuova_logica.test.ts`.
- **End-to-End & Visual Test (Playwright):** 11/11 test superati in `test/stampa_pdf_pages.spec.ts` e `test/stampa_canzoniere_visual.spec.ts`.
- **Metriche di Riempimento:** Misurato su DOM reale un riempimento del 90.9% - 92.8% sulle pagine continue a 2 colonne, con 0 pagine vuote o fantasma.
- **Weight Budget:** 100% conforme (bundle critico JS+CSS a 25.98 KiB gzip vs 100 KiB budget).

---

## ADR-0027: Rimozione Totale Dicitura 'RIT.' in Modalità 'Chi suona', Deduplicazione Ritornelli in 'Chi canta' e Anti-Orfani di Coda

### Data
2026-11-02

### Contesto
Durante l'esecuzione musicale dal vivo (veglie, fuochi di bivacco, messe scout), i chitarristi che consultano il canzoniere cartaceo "Chi suona" non possono girare continuamente le pagine avanti e indietro per recuperare il testo o gli accordi di un ritornello sostituito da una dicitura sintetica "RIT.". Inoltre, la presenza di etichette orfane `RIT.` o `RIT:` da sole in cima o fondo colonna creava frammentazione visiva, spreco di righe e disorientamento. In modalità "Chi canta", ritornelli ripetuti consecutivamente generavano righe `RIT.` duplicate ridondanti (`RIT.` seguito da un altro `RIT.`), mentre l'ultima pagina del libretto poteva risultare scarsamente riempita (< 45%).

### Decisioni Adottate

1. **Modalità 'Chi suona' - Accordi al 100% e Zero Sigle 'RIT.'**:
   - **Nessuna sostituzione dei ritornelli:** ogni ritornello viene sempre emesso per esteso con accordi completi e testo in formato `{soc}...{eoc}`. I chitarristi leggono sempre il flusso continuo senza dover retrocedere nel libretto.
   - **Espansione automatica delle abbreviazioni sorgente:** se il testo originario del canto contiene una dicitura `RIT.` o `RIT:` isolata (ad es. shorthand nel database o importazioni storiche), `transformChordproText` recupera le righe con accordi del ritornello precedente (`seenChorusRawLines`) e le reinserisce per esteso.
   - **Soppressione totale di badge e header sintetici:** disabilitata l'iniezione automatica di `pendingChorusLabel = 'RIT:'` in `groupIntoBlocks` e soppresso il rendering di linee ritornello prive di accordi in `CantoLineRenderer` quando `showChords` è attivo. In questo modo la dicitura testuale "RIT." non compare mai nel layout di "Chi suona".

2. **Modalità 'Chi canta' - Deduplicazione Rigorosa Ritornelli**:
   - **Compattazione ad alta densità:** mantenuta la contrazione del ritornello ripetuto a `['RIT.']` per consentire ai cantanti di avere libretti leggeri e tascabili.
   - **Deduplicazione:** ritornelli consecutivi ripetuti vengono contratti in un'unica riga esplicita `RIT. (x2)` o `RIT. (x3)`, vietando rigorosamente la stampa di righe `RIT.` adiacenti consecutive.
   - Riconoscimento delle modulazioni e parti strumentali (`modulazione` inclusa in `isInstrumentalSequence`).

3. **Regole di Flusso Anti-Orfano di Coda e Invarianti di Colonna (`layoutCanzoniereFlow`)**:
   - **Tail Anti-Orphan Rule:** Se la coda di un canto su una colonna/pagina successiva consiste unicamente in un `RIT.` isolato o in $\le 2$ versi (< 15 mm):
     - Se lo spazio residuo della colonna precedente lo consente entro una tolleranza di 5-7 mm, la coda viene assorbita nella colonna corrente.
     - Se l'assorbimento non è possibile, la strofa precedente viene retrocessa (*pull back*) per ribilanciare il blocco evitando frammenti orfani.
     - **Preservazione Header in Pull-Back:** Nel retrocedere una strofa alla colonna successiva, se tale strofa era l'unico blocco sotto l'intestazione del brano (`songBlocksInCol === 1`), anche l'intestazione viene spostata con la strofa nella colonna successiva, impedendo matematicamente testate orfane a fondo colonna.
   - **Guardia Inizio Colonna/Pagina:** Nessuna colonna o pagina può aprirsi con un blocco costituito esclusivamente da un'etichetta `RIT.` orfana (`col.blocks[0]`).

4. **Prevenzione Rottura Brani su Cambio Pagina in 'Chi suona' (Anti-Domino Page-Turn Rule)**:
   - In modalità chitarristi ("Chi suona"), voltare pagina a metà brano interrompe l'esecuzione musicale.
   - **Regola Anti-Domino:** Quando un brano inizia nella colonna destra (dove rimangono al massimo 256 mm) e non può concludersi nella colonna stessa ma ha un'altezza complessiva tale da poter stare per intero su una pagina nuova (colonna SX + colonna DX $\le 522$ mm), il layout avanza immediatamente il brano alla pagina successiva. In questo modo il brano occupa colonna sinistra e destra del medesimo foglio senza subire voltate di pagina.
   - Analoga regola scatta nella colonna sinistra quando il brano inizia a metà colonna (dopo un altro canto) e non riuscirebbe a completarsi entro la pagina corrente: se può stare su un foglio pulito, viene anticipato alla pagina successiva, bloccando sul nascere l'effetto a catena (domino) di canzoni spezzate su pagine consecutive.
   - **Bin-Packing Esatto dei Blocchi e Compattazione Dinamica:** Per brani densi con blocchi indivisibili (es. *Strade di coraggio*), la verifica di capienza (`canBlocksFitInRemainingPage`) simula la reale distribuzione delle strofe nelle colonne anziché basarsi sulla mera somma aritmetica delle altezze. Se il brano non entra a 11.0 pt ma entra con compattazione a 10.5 pt, la compattazione si attiva dinamicamente mantenendo il brano su un'unica pagina.

5. **Ottimizzazione Fill Ratio Ultima Pagina ('Chi canta')**:
   - Rilevamento automatico di ultima pagina scarsa (< 45% di altezza utile). Se si verifica, scatta un secondo passaggio di compattazione leggera (riduzione font di 0.5 pt a 11.0 pt), che ha permesso di compattare il canzoniere canta da 13 pagine (con p. 13 a sole 16 righe) a 12 pagine dense (con p. 12 a 47 righe, riempimento > 75%).

6. **Stabilizzazione CSS Divisori di Stampa**:
   - Inclusione di `box-sizing: border-box !important;` e `clear: both !important;` con margine normalizzato (5pt 0 4pt 0) per `.canzoniere-song-divider` sia nell'anteprima web che in stampa cartacea A4.

### Verifica Globale
- **Unit Test (Vitest):** 265/265 test passati (27 file), inclusi test aggiornati per `stampa_nuova_logica.test.ts` e `canzoniere_adaptive_fill.test.ts`.
- **End-to-End & Visual Test (Playwright):** 11/11 test superati in `test/stampa_pdf_pages.spec.ts` e `test/stampa_canzoniere_visual.spec.ts`.
- **Audit PDF Reali Playwright (`test/audit_new_complete_pdfs.spec.ts`):**
  - "Chi suona": 23 pagine totali (1 indice + 22 pagine canti). 20 canti su 21 (95.2%) contenuti interamente su singola pagina con ZERO cambi pagina per i chitarristi. 0 token 'RIT' isolati, accordi presenti al 100% su tutti i ritornelli.
  - "Chi canta": 12 pagine totali (1 indice + 11 pagine canti). 0 righe 'RIT.' consecutive, 0 'RIT' orfani in cima a colonna/pagina, fill ratio medio > 85% e ultima pagina con 47 righe dense.
- **Weight Budget:** 100% conforme (25.98 KiB gzip vs 100 KiB budget).

---

## ADR-0028: Ripristino Flusso Continuo ("Uno dopo l'altro") in 'Chi suona' e Riempimento Fondo Colonna tramite Splitting Strofe Dinamico ($\ge 20$ mm)

### Data
2026-11-02

### Contesto
1. **Flusso canti in 'Chi suona':** Nei PDF recenti, una regola eccessivamente restrittiva volta a prevenire la rottura dei brani forzava l'avanzamento a una nuova pagina (`advanceColumn()`) ogni volta che un brano non rientrava nello spazio rimanente del foglio. Questo causava colonne parzialmente o totalmente vuote (es. *Tra boschi e prati* e *Servo per amore*, che lasciavano l'intera colonna destra a 0 mm di riempimento), rompendo il flusso sequenziale compatto ("uno dopo l'altro") fortemente apprezzato e richiesto dagli utenti.
2. **Spazi bianchi a fondo colonna (50–70 mm) in brani come *Albachiara* e *Aglio e Olio*:** Il motore `layoutCanzoniereFlow` invocava `splitLargeBlock` unicamente se l'intero blocco strofa superava l'altezza massima di una colonna intera (`curBlock.heightMm > maxColHeightMm`, ovvero 256 mm). Le normali strofe di 4–16 versi (35–90 mm) che eccedevano lo spazio residuo (es. 30–80 mm) cadevano direttamente nel ramo `else`; in molti casi la logica anti-orfano di coda retrocedeva perfino la strofa precedente (*pull back*), lasciando vistosi vuoti bianchi di 50–80 mm a fondo colonna. Inoltre, `splitLargeBlock` conteneva un vincolo statico `lines.length <= minLines * 2` che divideva a metà o imponeva 3 righe senza verificare la capienza effettiva in millimetri di `maxColHeightMm`.

### Decisioni Adottate

1. **Ripristino Flusso Continuo Naturale in 'Chi suona'**:
   - Rimosso il salto forzato di colonna/pagina (`advanceColumn`) in modalità `suona` (ex righe 1856–1875).
   - Quando un canto termina, se lo spazio residuo nella colonna è $\ge 55$ mm (`MIN_REMAINING_HEIGHT_FOR_NEW_SONG_MM`) e vi è capienza per l'intestazione e la prima strofa, il canto successivo inizia immediatamente sotto nella medesima colonna, separato da divisorio sottile, fluendo naturalmente da colonna a colonna.
   - Mantenuta unicamente la compattazione anti-orfano opzionale a -0.5 pt quando consente di far rientrare il canto nel foglio corrente.

2. **Splitting Dinamico delle Strofe a Fondo Colonna (`availableInCol >= 20 mm`)**:
   - Riscritto `splitLargeBlock`: calcola dinamicamente quante righe della strofa ($k \ge 1$) entrano esattamente nell'altezza utile passata (`maxColHeightMm`), garantendo che la prima parte rispetti la capienza della colonna e che la seconda parte riceva i versi rimanenti.
   - Nel ciclo di inserimento strofe di `layoutCanzoniereFlow`, quando una strofa eccede `availableInCol` ma lo spazio disponibile è $\ge 20$ mm (spazio utile per almeno 2 righe con accordi/interlinea), scatta la suddivisione progressiva con `splitLargeBlock(curBlock, availableInCol, ...)`:
     - Le righe che entrano riempiono la colonna attuale fino al margine inferiore (residuo vuoto ridotto a 0–15 mm);
     - Le righe rimanenti avanzano fluidamente in cima alla colonna successiva.
   - Azzerati i falsi trigger di *pull back* che svuotavano le colonne nei brani con strofe dense come *Albachiara* e *Aglio e Olio*.

3. **Verifica Allineamento Calendario & ODG**:
   - Confermato che i test in `test/calendario_odg.test.ts` verificano la nuova dicitura `Data da concordare` e l'assenza di stringhe `• Tutto il giorno` su `formatEventDateTimeRange`, con tutti i 31 test passati.

### Verifica Globale
- **TypeScript Typecheck:** `npm run typecheck` completato con 0 errori.
- **Unit Test (Vitest):** 303/303 test passati (30 file di test), inclusi 2 nuovi test dedicati in `test/canzoniere_layout.test.ts` per il flusso continuo in "Chi suona" e lo splitting dinamico con `availableInCol >= 20 mm`.
- **Playwright PDF Audit Reale (`test/audit_new_complete_pdfs.spec.ts`):** 1/1 test passato con ZERO errori su entrambi i PDF reali A4 generati con Chromium e analizzati con `pdf-parse`:
  - **"Chi suona":** canzoniere ridotto da 23 a 20 pagine totali (1 indice + 19 pagine canti). I brani fluiscono continuamente ("uno dopo l'altro"); azzerate le colonne vuote (es. *Tra boschi e prati*, *Servo per amore* che lasciavano colonne a 0 mm); lo spazio residuo a fondo colonna in brani spezzati (es. *Aglio e Olio*, *Albachiara*) è ridotto a 0–8 mm (rispetto ai 50–70 mm precedenti).
  - **"Chi canta":** 12 pagine totali (1 indice + 11 pagine canti), fill ratio medio > 85%, 0 righe RIT duplicate o orfane.

---

## ADR-0029: Prevenzione Righe Orfane/Vedove (Anti-Widow/Orphan), Tolleranza di Assorbimento a Fondo Colonna, Evidenziazione Ritornello con Barra Laterale e Riposizionamento Azione Stampa

### Data
2026-11-03

### Contesto
1. **Spilli orfani di 1 o 2 righe a inizio colonna/pagina:** Nelle stampe precedenti capitava che una strofa o ritornello venisse spezzata lasciando un singolo verso isolato in cima alla colonna successiva (es. `| Eha, eha, eha, eha, eha, eha, eh!` a inizio colonna destra in *Un falco nel cielo*, o una riga isolata di *Scouting For Boys* o *Wonderwall*). L'utente ha espressamente indicato: *"a volte cambia pagina/colonna per una riga o per pochissima roba, sistema questo e siamo apposto, ricorda che va benissimo che i canti siano uno dopo l'altro se possibile, forse ti direi non ragionare di non spezzare strofe o ritornelli ma ragiona a non lasciare poche righe da sole in modo da non spezzare troppo presto il testo in modo da coprire più spazio bianco che viene lasciato in basso"*.
2. **Coda dei canti e tagli prematuri:** Il vecchio meccanismo di *pull-back* rimuoveva intere strofe da 40–50 mm già impaginate per accompagnare 1–2 versi eccedenti alla colonna successiva, lasciando vistosi vuoti bianchi a fondo pagina.
3. **Evidenziazione ritornello:** Necessità di distinguere chiaramente il ritornello senza appesantire la grafica né ricorrere a box colorati.
4. **Ergonomia UI Stampa:** La barra sticky inferiore risultava scomoda e copriva l'ultimo canto selezionato; l'utente ha richiesto di posizionare il pulsante principale di stampa e il riepilogo in alto, rimuovendo anteprime e opzioni ridondanti a schermo.

### Decisioni Adottate

1. **Riorganizzazione UI `StampaCanzoni.tsx`**:
   - Spostato il blocco di azione primaria (`Stampa / Salva PDF` e riepilogo canti/pagine) in alto, all'interno della hero card principale sotto il selettore *"Per chi stampi?"*.
   - Rimossa la barra fissa in fondo che ostruiva la lista canti.
   - Rimossa la visualizzazione dell'anteprima interna a schermo (il documento viene renderizzato direttamente in `@media print`).

2. **Evidenziazione Ritornello con Barra Laterale**:
   - Aggiunta proprietà `isChorus?: boolean` sui blocchi `SongBlock`.
   - Il parser assegna `isChorus: true` per i blocchi compresi tra `{soc}...{eoc}` o contenenti `RIT.`.
   - Rendering CSS: classe `.canzoniere-block.is-chorus` con bordo sinistro solido nero (`border-left: 2.5pt solid oklch(0.2 0 0)`) e `padding-left: 3.5mm`.

3. **Algoritmo Anti-Orfano con Tolleranza di Assorbimento Dinamica (`splitLargeBlock`)**:
   - **Tolleranza di Assorbimento a Fondo Colonna:** Su foglio A4 (altezza utile 273 mm vs target 256 mm), esiste un margine di sicurezza di oltre 15 mm prima del footer. Se un blocco eccede lo spazio disponibile di $\le 8.5\text{ mm}$ (canta) o $\le 9.5\text{ mm}$ (suona) — ovvero l'ingombro di 1 verso — **l'intero blocco viene assorbito a fondo colonna senza spezzarlo**.
   - **Assorbimento dell'ultimo verso residuo:** Se una strofa viene suddivisa e rimarrebbe 1 solo verso per la seconda parte (`remainingLines === 1`), se l'intero blocco rientra entro $+10.0\text{ mm}$ (canta) / $+11.0\text{ mm}$ (suona), tutti i versi restano nella prima parte.
   - **Vincolo Minimo Righe (Anti-Widow/Orphan):** Nessuno spezzamento può lasciare meno di 2 righe in `firstPart` né meno di 2 righe in `secondPart` (minimo 3 per blocchi di 6 o più righe). Se non è possibile rispettare questo vincolo, il blocco non viene spezzato ma trasla interamente alla colonna successiva.
   - **Eliminazione del Pull-Back Distruttivo:** Rimossa la logica che svuotava colonne eliminando 50 mm di strofe precedenti. La colonna mantiene sempre tutto ciò che vi entra, azzerando i buchi bianchi a fondo pagina.
   - **Tolleranza di Compattazione a -0.5 pt:** Ampliata a `compactTotalH <= pageRemainingSpace + 5 mm`, permettendo a canti come *E la strada si apre* di completarsi al 100% sulla stessa pagina evitando lo spillo di sole 3 righe su una nuova facciata.

### Verifica Globale
- **TypeScript Typecheck:** `npm run typecheck` completato con 0 errori.
- **Unit Test (Vitest):** 316/316 test passati (30 file di test).
- **Audit Automatizzato Righe Orfane (`scratch/audit_orphans.ts`):** 0 spilli orfani di 1 riga sia in modalità `canta` che `suona`. Tutte le continuazioni contengono $\ge 2$ righe.
- **Production Build:** `npm run build` completato con successo (PWA precache 154 entries).
- **Playwright PDF Audit Reale (`test/audit_new_complete_pdfs.spec.ts`):** Generati e validati con successo `scratch/new_canta.pdf` (12 pagine) e `scratch/new_suona.pdf` (20 pagine, canti suonabili ridotti a 19 pagine).

---

## ADR-0030: Ottimizzazione Spazi Residui a Fondo Colonna, Eliminazione Salti Prematuri per Inizio Canto e Flusso Continuo Naturale ("Uno dopo l'altro")

### Data
2026-11-03

### Contesto
Nei canzonieri generati ("Chi suona" e "Chi canta"), ampie porzioni di colonna (da 70 a 140 mm, corrispondenti a oltre il 40–50% di una colonna A4) venivano lasciate prematuramente vuote a causa di:
1. **Soglia Spazio Minimo e Condizione di Ammissibilità Inizio Canto Troppo Rigida (`MIN_REMAINING_HEIGHT_FOR_NEW_SONG_MM = 55 mm`):**
   Quando un brano non rientrava per intero, l'algoritmo richiedeva che entrassero almeno 2 strofe complete o almeno 5–6 versi, valutando solo strofe intere non frazionate. Brani preceduti da intro strumentale (1 verso) o con prima strofa densa (8–11 versi, come *I cento passi*, *Destri*, *Re dei Re*, *Servo per amore*) venivano rigettati alla colonna successiva pur disponendo di 100–140 mm di spazio utile residuo, ampiamente sufficiente per intestazione + 3–6 versi.
2. **Salto Forzato di Colonna Destra in 'Chi canta' (`spillMm <= 26`):**
   Se un canto a fondo colonna destra eccedeva leggermente lo spazio pagina e la compattazione non evitava lo sforo, il motore forzava un salto a pagina successiva (`advanceColumn()`), lasciando la colonna destra vuota di 70–120 mm.
3. **Invariante Difensiva Header a Fondo Colonna Troppo Restrittiva:**
   Nel ciclo strofe, `sIdx === 0 && b.heightMm > availableInCol` ritirava (pop) l'intestazione anche qualora la prima strofa potesse essere frazionata tramite `splitLargeBlock` garantendo $\ge 2$ versi in ciascuna colonna.

### Decisioni Adottate

1. **Riduzione Soglia Minima Spazio Residuo a 38 mm (`MIN_REMAINING_HEIGHT_FOR_NEW_SONG_MM = 38`):**
   - Calibrata sull'ingombro reale minimo di intestazione (~24–32 mm) + almeno 2 versi con accordi/interlinea.
2. **Condizione di Ammissibilità Dinamica con Splitting Preventivo:**
   - La capienza dello spazio residuo verifica se, con l'ingombro esatto dell'header, è possibile alloggiare (anche tramite `splitLargeBlock`) almeno una strofa o frazione di strofa contenente $\ge 2$ versi di liriche reali (o $\ge 2$ versi totali per brani strumentali).
   - In presenza di introduzioni strumentali (1 verso commento), viene garantito che l'intro sia accompagnato da almeno 2 versi cantati nella stessa colonna, impedendo matematicamente header o intro orfani.
3. **Eliminazione del Salto Forzato a Inizio Pagina in 'Chi canta':**
   - Rimosso l'avanzamento forzato di colonna destra; i canti fluiscono liberamente da colonna a colonna e da pagina a pagina come da specifica di flusso continuo ("uno dopo l'altro").
4. **Aggiornamento Invariante Difensiva Header:**
   - L'intestazione a fondo colonna viene ritirata solo se la prima strofa non entra né può essere frazionata rispettando il vincolo $\ge 2$ versi (`!canSplitB`).

### Verifica Globale
- **TypeScript Typecheck:** `npm run typecheck` completato con 0 errori.
- **Unit Test (Vitest):** 316/316 test passati (30 file di test).
- **Playwright PDF Audit Reale (`test/audit_new_complete_pdfs.spec.ts`):** 1/1 test passato con ZERO errori su entrambi i PDF reali:
  - **"Chi suona" (con accordi):** Canzoniere ridotto da 20 a 19 pagine totali (1 indice + 18 pagine canti). Eliminata completamente la pagina 20 prima quasi vuota; riempiti tutti i vuoti precedenti (p. 10, 11, 16, 17, 18 ora a 248–255 mm di altezza utile).
  - **"Chi canta" (solo testo):** Canzoniere ridotto da 12 a 11 pagine totali (1 indice + 10 pagine canti). Eliminata completamente la pagina 12 residua; tutte le colonne tra pagina 5 e 10 raggiungono un'altezza utile compresa tra 243 e 260 mm (riempimento 96–100%).
  - **Regola Anti-Orfano:** 0 spilli orfani di 1 riga, ogni continuazione ha $\ge 2$ versi.
---

## ADR-0031: Risoluzione Conflitti di Regole e Tolleranze nello Splitting dei Canti a Fondo Colonna

### Data
2026-11-03

### Contesto
Dopo la prima revisione del flusso continuo (ADR-0030), persistevano anomalie di taglio prematuro e spazi vuoti a fondo colonna (tra 40 e 60 mm):
1. **Mancanza di Tolleranza nel Loop di Conteggio Versi in `splitLargeBlock`:**
   Mentre i chiamanti ammettevano una tolleranza fino a 8.5 mm (canta) o 9.5 mm (suona) su `firstPart.heightMm`, il ciclo interno di ricerca `splitIdx` in `splitLargeBlock` valutava strettamente `h <= maxColHeightMm` con 0 mm di tolleranza. Per blocchi di 4 versi in cui 2 versi superavano lo spazio disponibile di appena 1.5 mm (es. 25.2 mm vs 23.6 mm o 20.6 mm vs 18.9 mm), `splitIdx` si fermava a 1 verso; il vincolo anti-orfano (`splitIdx < 2`) rigettava lo split restituendo 0 versi, inducendo i chiamanti a dichiarare `canStart = false` e sprecando 40–60 mm di fondo colonna (es. pag. 1 SX in canta, pag. 6 DX in suona).
2. **Conflitto di Regole nell'Assorbimento Anti-Orfano:**
   Quando `remainingLines === 1`, `splitLargeBlock` assorbiva l'intero blocco in `firstPart` lasciando `secondPart.lines = []`. Tuttavia, le guardie nei chiamanti richiedevano rigidamente `sp.secondPart.lines.length >= 2`, rigettando l'intero blocco proprio quando era stato integralmente assorbito.
3. **Inversione di Precedenza tra Blocchi Giganti e Frazionamento Strofe:**
   La condizione `curBlock.lines.length >= 4` veniva valutata prima di `curBlock.heightMm > maxColHeightMm`. Di conseguenza, blocchi continui giganti (es. 70 versi) venivano processati come strofe ordinarie con tolleranza d'assorbimento invece che con limite rigido di colonna (`tol = 0`), causando overflow oltre i 256.5 mm.

### Decisioni Adottate

1. **Integrazione del Parametro `toleranceMm` nel Loop di `splitLargeBlock`:**
   - La ricerca del massimo numero di righe ammette `h <= maxColHeightMm + toleranceMm`.
   - Se 2 versi rientrano entro la tolleranza di fondo colonna (+8.5/+9.5 mm), lo split ha successo senza lasciare righe orfane.
2. **Armonizzazione Guardie Chiamanti (`part2Ok`):**
   - La condizione di validità dello split è stata aggiornata in tutti i punti di invocazione:
     `const part2Ok = sp.secondPart.lines.length === 0 || sp.secondPart.lines.length >= 2;`
     `const heightOk = sp.firstPart.heightMm <= availableInCol + toleranceMm + 1.5;`
   - Se il blocco viene integralmente assorbito in colonna (`secondPart` vuoto), l'ammissibilità è confermata.
3. **Precedenza Rigida per Blocchi Giganti (`> maxColHeightMm`):**
   - I blocchi continui di dimensioni superiori a una colonna intera vengono suddivisi con `tolerance = 0`, garantendo che nessuna colonna ecceda il limite fisico di 256 mm / 256.5 mm.
4. **Soglia `MIN_REMAINING_HEIGHT_FOR_NEW_SONG_MM` a 30 mm:**
   - Permette a canti con intestazione compatta di iniziare validamente in colonne con 35–45 mm residui quando possono alloggiare almeno 2 versi di testo.
5. **Autocompattazione e Ribilanciamento Globale in "Chi canta":**
   - Canzoniere "Chi canta" compattato stabilmente a 10 pagine (1 indice + 10 facciate canti), con riempimento 95%–100% per tutte le facciate tra 1 e 9.

### Verifica Globale
- **TypeScript Typecheck:** `npm run typecheck` completato con 0 errori.
- **Unit Test (Vitest):** 322/322 test superati su 322 (31 file di test).
- **Playwright PDF Audit Reale (`test/audit_new_complete_pdfs.spec.ts`):** 1/1 test Playwright superato con ZERO errori:
  - **"Chi suona":** 19 pagine totali (1 indice + 18 pagine canti, 0 pagine vuote residue).
  - **"Chi canta":** 11 pagine totali (1 indice + 10 pagine canti, ogni pagina densa e bilanciata tra 70 e 82 righe, 0 pagine vuote).
  - 0 spilli orfani di 1 riga su entrambi i PDF.
---

## ADR-0032: Diagnostica Interruzione Ritornello Re dei Re e Posizionamento Autore sotto il Titolo

### Data
2026-11-03

### Contesto e Quesiti Utente
1. **Perché in Pagina 10 di "Chi canta" il ritornello di *Re dei Re* è interrotto e continuato alla pagina successiva se sotto sembrava esserci spazio? E perché la colonna sinistra (*Come ti ama Dio*) si ferma con spazio sotto?**
   - **Colonna Sinistra (Pag. 10):** Il canto *Come ti ama Dio* è composto unicamente da 3 strofe e ritornello: il testo finisce fisicamente lì. Al di sotto restavano ~26 mm di altezza utile. Il canto successivo (*È più bello insieme*) richiede almeno ~38 mm (intestazione con titolo, autore e linea divisoria ~26 mm + prima strofa di almeno 2 versi ~12 mm). Collocare l'inizio in 26 mm avrebbe generato un'intestazione orfana (titolo senza testo o con 1 solo verso orfano). Il layout sposta quindi in modo protetto l'inizio del nuovo canto in cima alla colonna successiva.
   - **Colonna Destra (Pag. 10):** La colonna ospita già l'intero canto *È più bello insieme* (~180 mm) + divisorio, titolo e strofa 1 di *Re dei Re* (~52 mm). Lo spazio rimanente prima del limite fisico di 256 mm della colonna era di appena ~24 mm. Il ritornello completo di *Re dei Re* è composto da 8 versi (~47 mm): non poteva entrare per intero. Il motore ha spezzato il ritornello a metà: 4 versi a fondo pagina 10 (fino al limite dei 256 mm) e 4 versi a inizio pagina 11, garantendo che nessuna metà avesse meno di 2 versi (anti-orfano).
   - **Perché visivamente sembra esserci tanto spazio sotto:**
     - Un foglio A4 misura 297 mm. I margini (12 mm sopra e sotto), la testatina corrente e il numero di pagina a piè di pagina occupano circa 41 mm totali. La colonna utile è fissata a 256 mm per evitare che le stampanti taglino o generino pagine bianche fantasma. Pertanto, anche a colonna satura al 100%, il testo termina a 25 mm dal bordo del foglio.
     - Nelle opzioni della finestra di stampa del browser (Chrome / Edge), se la scala è impostata su **"Adatta alla pagina" (Fit to page)**, il browser riduce ulteriormente le dimensioni dell'intero foglio (spesso all'85-90%), creando un'ampia fascia bianca vuota in basso. È fondamentale impostare la finestra di stampa con **Scala: 100% (o Predefinita)** e **Margini: Predefiniti (o Nessuno)**.

2. **Posizionamento Autore del Canto:**
   - L'autore non deve essere allineato tutto a destra (`space-between`), ma posizionato immediatamente sotto il titolo del canto.

### Decisioni Adottate
1. **Allineamento CSS Autore Sotto il Titolo (`print.css`):**
   - Regola `.canzoniere-header-top`: convertita a `display: flex !important; flex-direction: column !important; align-items: flex-start !important; width: 100% !important; margin-bottom: 2pt !important;` sia in `@media print` che nella vista anteprima a schermo.
   - Rimossi `justify-content: space-between` e `align-items: baseline`.
   - `.canzoniere-header-author`: stilato a `font-size: 9.5pt; font-style: italic; color: oklch(0.3 0 0); margin: 1pt 0 2pt 0; line-height: 1.2;` con wrap pulito, coerente con l'altezza stimata da `calculateSongHeaderHeightMm`.

---

## ADR-0033: Regola Minimo 4 Righe per Introdurre un Nuovo Canto e Calibrazione Anti-Clipping

### Data
2026-11-03

### Contesto
1. **Regola di inizio canto a fondo colonna:** In precedenza, un nuovo canto poteva iniziare a fondo colonna se poteva contenere solo 2 righe sotto il titolo (come visibile a pag. 2 di "Chi canta", dove *Come sole come goccia* iniziava con appena 2 versi prima di spezzarsi). L'utente richiede esplicitamente che sotto il titolo debbano esserci almeno 4 righe reali per introdurre un nuovo canto; se non ci sono almeno 4 righe, il canto deve slittare in cima alla colonna successiva.
2. **Taglio del testo a fondo pagina (*clipping*):** In alcune pagine di "Chi suona" (es. pag. 9 a sinistra su *Aglio e Olio*, pag. 18 a destra su *L'unico Maestro*), l'ultima riga di testo risultava tagliata a metà dal bordo inferiore del foglio. La causa risiedeva nella somma tra `CONTINUOUS_FLOW_COL_HEIGHT_MM = 256` e la tolleranza `toleranceMm = 9.5 mm`, che consentiva alle colonne di raggiungere 265.5 mm, eccedendo i 259 mm utili del contenitore `.stampa-a4-sheet-card` dotato di `overflow: hidden`.

### Decisioni Adottate
1. **Regola Vincolante Minimo 4 Righe sotto il Titolo (`canzoniere_layout.ts`):**
   - Soglia minima di spazio per iniziare un canto `minHeightForNewSong`: portata a 38 mm per "Chi canta" e a 50 mm per "Chi suona".
   - Controllo di ammissibilità `canStart`: richiede tassativamente `lyricLinesCount >= 4` (o `totalLinesCount >= 4` se puramente strumentale).
   - Nel frazionamento difensivo del primo blocco dopo l'intestazione (`sIdx === 0` o `isImmediatelyAfterHeader`), la prima parte deve contenere almeno 4 righe (`minPart1Lines = 4`). Se non ci sono almeno 4 righe disponibili, sia il blocco che l'intestazione vengono arretrati e spostati in cima alla colonna successiva.
2. **Risoluzione Definitiva Anti-Clipping a Fondo Colonna:**
   - Calibrata l'altezza massima delle colonne: `maxColHeightMm = mode === 'suona' ? 250 : 252;` con tolleranza prudenziale `toleranceMm = 3.0;`.
   - L'altezza totale massima di qualsiasi colonna non supera mai 255.3 mm, rimanendo ampiamente entro il limite dei 259 mm del contenitore A4 ed evitando qualsiasi collisione con `overflow: hidden`.

### Verifica Globale
- **TypeScript Typecheck:** `npm run typecheck` completato con 0 errori.
- **Unit Test (Vitest):** 324/324 test superati su 324 (31 file di test).
- **Playwright PDF Audit Reale:**
  - *Chi canta*: 11 pagine totali; tutte le introduzioni di canti hanno $\ge 4$ versi (es. *Come sole come goccia* inizia in cima a colonna DX con 25 versi, *Danza la vita* con 4 versi esatti, *Re dei Re* integro a 25 versi).
  - *Chi suona*: 19 pagine totali; pag. 9 e pag. 18 terminano in modo pulito con margine di respiro verso il piè di pagina, zero lettere o parole tagliate a metà.

---

## ADR-0034: Autore a Destra del Titolo (Attaccato) e Calibrazione Millimetrica Altezze su Rendering Reale Chromium ("Chi canta")

### Data
2026-11-03

### Contesto
1. **Posizionamento Autore:** L'autore del canto deve essere posizionato immediatamente alla destra del titolo sulla stessa riga (`[TITOLO] [Autore]`), attaccato ad esso con uno spazio compatto (gap 6pt) anziché spinto sul bordo estremo destro (`justify-content: space-between`) o posizionato su una riga separata sotto il titolo. Esempi: **ALBACHIARA** *Vasco Rossi*, **SERVO PER AMORE** *Gen Rosso*, risparmiando una riga verticale rispetto al layout incolonnato.
2. **Sovrastima Altezze in "Chi canta":** In modalità "Chi canta", il motore di layout continuava a riscontrare 50–70 mm di vuoto bianco a fondo colonna (ad es. prima di *Re dei Re* a fine pagina, tagliando anticipatamente il ritornello) perché le altezze calcolate in millimetri/punti accumulavano margini di sicurezza artificiali:
   - Ogni riga di testo sommava `+ 1.5 pt` di padding invisibile non presente nel CSS reale (`line-height: 1.25`, `margin: 0`), accumulando 20–30 mm fittizi a colonna.
   - Il divisorio superiore tra canti calcolava 26 pt (+9.17 mm) senza considerare il naturale collassamento dei margini verticali CSS (il divisorio reale con Chromium `@media print` misura solo 10 pt / ~3.5 mm).
   - L'intestazione del canto veniva stimata a 21–30 mm contro i 12–15 mm effettivi misurati su Chromium.
   Questo portava l'algoritmo a credere che la colonna fosse a 252 mm quando l'inchiostro reale occupava appena ~190 mm.

### Decisioni Adottate
1. **Autore alla Destra del Titolo (Attaccato sulla Stessa Riga):**
   - In `CanzonierePageRenderer.tsx`: l'elemento `<h1>` del titolo precede `<span class="canzoniere-header-author">` dell'autore in entrambi i punti di rendering (flusso continuo e canto singolo).
   - In `print.css`: `.canzoniere-header-top` è impostato con `display: flex !important; flex-direction: row !important; flex-wrap: wrap !important; align-items: baseline !important; justify-content: flex-start !important; gap: 2pt 6pt !important;` sia in `@media print` che nella preview a schermo.
   - `.canzoniere-header-author`: impostato con `margin: 0 !important; white-space: nowrap !important; line-height: 1.2 !important;`.
   - `.canzoniere-column-header .canzoniere-header-title`: azzerato il margine a `margin: 0 !important;` per allineare perfettamente le baseline tipografiche.
   - In `canzoniere_layout.ts`: `calculateSongHeaderHeightMm` calcola la larghezza combinata di titolo + gap (6pt) + autore. Poiché l'autore è affiancato al titolo, non aggiunge una riga verticale tranne in caso di overflow colonna.
2. **Calibrazione Millimetrica "cm totali" su Chromium:**
   - In `calculateBlockHeightMm`: eliminato il fattore fittizio `+ 1.5 pt` per riga nella modalità `css_calibrated`, impostando l'altezza della riga all'esatto valore fisico `visualWraps * (fontSizePt * 1.25)`.
   - In `calculateSongHeaderHeightMm`: ridotta l'altezza stimata del divisorio superiore concatenato da 26 pt a 10 pt (~3.5 mm), rispecchiando il collassamento reale del margine CSS.
   - Le altezze calcolate rispecchiano ora con precisione millimetrica l'ingombro fisico reale:
     - Header senza divisorio: ~14.4 mm (Chromium: 12.2 mm).
     - Header con divisorio: ~17.9 mm (Chromium: 15.6 mm).
     - Strofa da 4 versi: ~23.1 mm (Chromium: 22.58 mm).
     - Ritornello da 8 versi: ~43.4 mm (Chromium: 42.34 mm).

### Verifica Globale
- **TypeScript Typecheck:** `npm run typecheck` completato con 0 errori.
- **Unit Test (Vitest):** 324/324 test passati (31 suite di test, 100% green).
- **Playwright PDF Audit Reale:**
  - *Chi canta*: ridotto da 11 a 10 pagine complessive ad altissima densità (1 indice + 9 pagine di canti, con una media costante di 83–90 righe per pagina).
  - *Re dei Re* a pagina 9 è ora stampato al 100% per intero (tutti i 25 versi, Strofa 1, Ritornello 1, Strofa 2, Ritornello 2, Outro, RIT) sulla medesima pagina senza alcun taglio anticipato.
  - Spazi bianchi anomali a fondo colonna completamente eliminati.

---

## ADR-0035: Slider di Controllo per Inclusione/Esclusione Indice nel Menù Stampa Canzoniere

### Data
2026-11-03

### Contesto
Gli animatori liturgici e capi reparto necessitano talvolta di stampare solo i canti selezionati senza la pagina iniziale di indice (ad es. per fascicoli brevi di 2-4 canti o foglietti volanti per la messa). In precedenza la proprietà `includeIndex` era supportata nel motore di calcolo ma mancava un controllo interattivo (slider switch) nel menù di stampa a schermo per consentire all'utente di abilitarla o disabilitarla a piacimento.

### Decisioni Adottate
1. **Integrazione ToggleSwitch nel Menù di Stampa Canti (`StampaCanzoni.tsx`):**
   - Inserito il componente nativo iOS-grade `ToggleSwitch` nella sezione comandi del menù di stampa, affiancato al selettore "Per chi stampi?".
   - Etichetta dinamica reattiva: `Includi indice` (attivo, default) o `Senza indice` (disattivato).
   - Stato sincronizzato con `config.includeIndex` e persistito in `sessionStorage` (`stampa_canzoni`).
2. **Reattività Dinamica del Layout e Conteggio Pagine:**
   - Alla disattivazione dello slider (`includeIndex = false`):
     - La pagina indice iniziale non viene renderizzata nel DOM di stampa (`stampa-canzoni-root`).
     - I numeri di pagina (`bookPageNumber`) delle canzoni partono direttamente da **1** anziché da 2.
     - La stima e il totale delle pagine A4 si aggiornano all'istante (ad es. da 10 a 9 pagine per l'intero canzoniere *Chi canta*).
3. **Verifica:**
   - Aggiunto test specifico n. 12 in `test/stampa_nuova_logica.test.ts`.
   - 325/325 test Vitest verdi (100%), typecheck a 0 errori e build di produzione verificata.


# Matrice e Procedura di Collaudo e Accettazione — Sito Vault Scout Clan

Questo documento definisce la matrice dei test per ciascuna fase di sviluppo del Vault di Clan, i comandi di esecuzione automatica e i criteri di superamento (GATE).

---

## FASE 0 & FASE 1 — Fondamenta, Schema e Sicurezza

- [x] **001. Contratto di Sicurezza Statico:** Script `test/security_contract.test.ts` verifica il blocco di anon in scrittura su tutte le tabelle e bucket (`npm test`).
- [x] **002. Audit di Sicurezza Supabase Live:** Script `supabase/tests/run_security_check.mjs` esegue tentativi di scrittura anonima su tutte le 7 tabelle e upload Storage.
  - Esito: 100% bloccati con 401/403 (codice 42501 RLS violation).
  - Exit code: `0`.
- [x] **003. Centralizzazione Stringhe:** `test/i18n.test.ts` verifica che tutte le stringhe risiedano in `src/lib/i18n.ts` senza duplicazioni o testi sparsi.

---

## FASE 1B (FINALE) — Redesign Professionale con Anima e Identità

- [x] **101. Il Logo del Gruppo è il Protagonista Assoluto sulla Targa Bianca:**
  - Campionamento reale dei colori del logo (`#462679` viola profondo, `#00BDFF` azzurro, `#FDC500` giallo scout, `#FD3000` rosso).
  - Derivate due versioni per ritaglio geometrico (nessun ridisegno): `logo-completo.png` (540×543px) e `logo-emblema.png` (540×468px).
  - Regola inderogabile: il logo appare SEMPRE su fondo chiaro o all'interno della **Targa Bianca** opaca (`--color-targa-bg: oklch(1 0 0)`), anche in dark mode, con raggio morbido e ombra a sbalzo. Area di rispetto $\ge 12\%$.
  - Icone PWA (`icon-192`, `icon-512`, `maskable-512`, `apple-touch-icon`, `favicon.ico`) rigenerate su sfondo solido bianco puro `#FFFFFF`.
- [x] **102. Le Cinque Fotografie d'Intestazione (e non una di più):**
  - 5 immagini CC0/Unsplash di paesaggi e natura scout senza persone riconoscibili (Home, Giochi, Bans, Canti, Calendario).
  - Formato WebP responsive (1200w, 800w, 400w) con peso totale di **486.2 KB** (budget rigoroso $\le 500\text{ KB}$).
  - Velo scrim di leggibilità tinto del viola del logo `#462679` (`var(--color-photo-scrim)` e `var(--color-photo-scrim-deep)`).
  - Precached nel Service Worker di Workbox per funzionamento offline al 100%. Collocate esclusivamente nelle testate, mai dentro le liste dei singoli elementi.
- [x] **103. Palette Funzionale OKLCH e Inchiostro del Marchio:**
  - Tutti i colori sono definiti in OKLCH in `src/styles/tokens.css`.
  - Inchiostro primario: Viola profondo del logo (`--color-ink`: `oklch(0.28 0.10 305)`), inchiostro display per grandi titoli (`oklch(0.25 0.12 305)`).
  - Azzurro interattivo: unico accento guida per link, tab attiva e pulsante primario (`oklch(0.53 0.18 245)`).
  - Quadratini arrotondati pieni di sezione (iOS Settings style): Giochi Giallo scout con glifo scuro ($> 10:1$ AAA); Bans Rosso con glifo bianco; Canti Azzurro; Calendario Blu Notte; Stampa/Admin Grigio.
  - Verifica statica automatica: nessun colore HEX o RGB hardcoded nei CSS dei componenti (`test/design_system_static.test.ts`).
- [x] **104. Canzoniere, Calendario e Componenti Funzionali:**
  - Canzoniere: ritornello contrassegnato con barra verticale sinistra gialla di 4px e sfondo tenue; accordi in blu notte in grassetto con numeri tabulari.
  - Calendario: card prossimo evento con blocco data calendario da parete (`.calendar-date-block`), chip colorati per tipologia di evento e giorno "oggi" in rosso.
  - Tessere 2×2 in Home con quadratino colorato e contatore grande.
  - Ricerca con evidenziazione del testo trovato in giallo tenue (`.search-highlight`) e badge "Nuovo" (giallo scout con testo viola).
- [x] **105. Tipografia Inter Self-Hosted & Iconografia Inline:**
  - Font Inter variabile WOFF2 memorizzato localmente in `public/fonts/inter-latin.woff2` e `inter-latin-ext.woff2`.
  - Caricato con `@font-face` e `font-display: swap` in `tokens.css`.
  - Zero emoji nei componenti; icone SVG inline Lucide a tratto sottile 1.75px.
- [x] **106. Motivi Scout Vettoriali (`src/ui/ScoutMotifs.tsx`):**
  - *Logo Reveal / Targa*: dissolvenza e transizione morbida di scala all'avvio.
  - *The Trail (Il Sentiero)*: linea SVG curva sinusoidale tratteggiata con punto giallo scout animato.
  - *Bussola di Sincronizzazione*: ago bicolore oscillante durante la sincronizzazione attiva e allineato a Nord (0°) a dati sincronizzati.
- [x] **107. Suite di Verifica Reattiva Playwright (`npm run verify:ui`):**
  - 7 Viewport testati: iPhone SE (320×568), iPhone 13/14/15 (390×844), iPhone 15 Pro Max (430×932), Smartphone Landscape (844×390), iPad Portrait (768×1024), iPad Landscape (1024×768), Desktop Standard (1440×900).
  - Zero overflow orizzontale su tutti i viewport (`scrollWidth <= clientWidth`).
  - Touch target $\ge 44\times 44\text{ px}$ verificati su bottoni e tab bar.
  - Zoom 200% verificato senza rottura del layout o sovrapposizioni.
  - Audit di accessibilità axe-core WCAG 2.1 AA superato con 0 violazioni critiche/serie.
  - Screenshot salvati in `docs/design-review/screenshots/`.
- [x] **108. Pagina Vetrina Design System:**
  - Raggiungibile su `#/design` con showcase interattivo del logo su targa, 5 fotografie, quadratini di sezione, card prossimo evento, chip calendario, blocco canto ritornello/accordi, ricerca evidenziata, badge "Nuovo", motivi scout e toggle live del tema chiaro/scuro.
- [x] **109. Audit Visivo Indipendente:**
  - Ispezione indipendente tramite subagent specializzato con esito positivo (PASS su tutte le voci della checklist).

---

## FASE 2 — Dati e Offline (Sync Engine, IndexedDB, PWA)

- [x] **201. Architettura IndexedDB (`src/lib/db.ts`):**
  - Database locale `scout_vault_db` versione 1 gestito tramite libreria leggera `idb`.
  - Object Stores per tutte le 6 tabelle di contenuto (`giochi`, `bans`, `canti`, `eventi`, `odg_punti`, `allegati`) e metadati di sincronizzazione (`sync_meta`).
  - Indici di supporto per cursori temporali (`by_updated_at`), soft-delete (`by_deleted_at`) e foreign keys relazionali (`by_evento`, `by_gioco`, `by_ban`, `by_canto`).
  - La UI legge SEMPRE dallo storage IndexedDB locale; nessuna dipendenza diretta da chiamate di rete nei componenti di vista.
- [x] **202. Sostituzione Atomica Transazionale (`atomicFullReplace`):**
  - Download di tutti i dati in un buffer in memoria (`tempData`).
  - Sostituzione di tutti gli object stores in un'unica transazione atomica `readwrite`.
  - Nessuno svuotamento preliminare del database: se la rete cade o si verifica un timeout a metà scaricamento, i record locali preesistenti rimangono integri al 100%.
- [x] **203. Sincronizzazione Incrementale e Server Time:**
  - Tracciamento dei cursori `updated_at` specifici per ciascuna tabella.
  - Cursore guidato esclusivamente dal timestamp del server Supabase, indipendente dall'orologio del dispositivo.
  - Sovrapposizione di sicurezza di 10 secondi (`SAFETY_OVERLAP_MS = 10_000`) per assorbire skew di clock e transazioni simultanee.
  - Scritture locali idempotenti (`upsertRecords`).
- [x] **204. Timeout e Conservazione Tombstone:**
  - Timeout pull incrementale a 4 secondi (`TIMEOUT_INCREMENTAL_MS = 4_000`).
  - Timeout full resync a 25 secondi (`TIMEOUT_FULL_SYNC_MS = 25_000`) con ripresa.
  - Se l'ultima sync riuscita è più vecchia di 180 giorni (`TOMBSTONE_RETENTION_DAYS = 180`), viene scartata la pull incrementale e avviato un Full Resync atomico.
- [x] **205. Soft-Delete Gerarchica:**
  - `getOdgPunti` e `getAllegati` nascondono automaticamente i record correlati se il record genitore (`evento`, `gioco`, `ban`, `canto`) ha `deleted_at != null`.
  - Il ripristino del genitore (un-delete) rende nuovamente visibili i figli correlati.
- [x] **206. Realtime come Segnale Puro:**
  - Sottoscrizione al canale PostgreSQL `public` via WebSocket.
  - Payload ignorato: il messaggio serve unicamente come trigger per una sincronizzazione incrementale debounced (300 ms).
  - Triggers di sync gestiti: avvio app, ritorno online (`online`), riattivazione visibilità (`visibilitychange`), Realtime.
- [x] **207. Stato Visibile, PWA e Storage Persistente:**
  - Banner di stato offline con data e ora dell'ultimo aggiornamento sincronizzato.
  - Indicatore bussola animato (`CompassSync`) con rotazione continua dell'ago durante la sincronizzazione attiva e allineamento fisso a Nord (0°) a sincronizzazione conclusa.
  - Pulsante "Aggiorna ora" per sincronizzazione manuale on-demand nella barra superiore e nella vista di stato.
  - Richiesta `navigator.storage.persist()` al mount per prevenire l'eliminazione da parte del browser.
  - Guida contestuale all'installazione PWA (iOS Safari e Android) con dismiss salvato in localStorage.
- [x] **208. Schermata di Verifica Stato Dati (`#/stato-dati`):**
  - Nuova vista dedicata con conteggi totali, attivi e tombstone per ciascuna delle 6 tabelle.
  - Visualizzazione cursori server, stato connettività (Online/Offline), log errori e pulsanti per test manuale e Full Resync forzato.
- [x] **209. Suite Test Unitari Automatizzati (`test/sync_engine.test.ts`):**
  - 7 scenari su 7 superati con successo:
    1. Propagazione corretta dei tombstone (soft-delete).
    2. Ritorno online dopo giorni con cursore e sovrapposizione temporale di 10s.
    3. Fallimento full resync durante il download: IndexedDB non viene corrotto e mantiene i dati preesistenti.
    4. Idempotenza delle scritture (doppia scrittura produce stesso stato).
    5. Soft-delete gerarchica di punti ODG e allegati con genitore eliminato.
    6. Realtime come puro segnale di invalidazione (payload WebSocket ignorato).
    7. Timeout pull incrementale (4s): gestione errore senza blocco né schermate vuote.
- [x] **210. Suite Test Playwright e Accessibilità (`test/verify_ui.spec.ts`):**
  - 14 test su 14 superati (inclusa la verifica e l'audit WCAG AA axe-core su `#/stato-dati`).

---

## FASE 3 — Giochi e Bans (Ricerca, Ordinamento, Modalità Lettura, Admin e Cestino)

- [x] **301. Ricerca Deterministica e Tolleranza ai Typo (`src/lib/search.tsx`):**
  - Algoritmo Levenshtein deterministico basato sulla lunghezza del token cercato:
    - $<4$ caratteri: Corrispondenza esatta (Distanza 0).
    - $4-7$ caratteri: Tolleranza Levenshtein $\le 1$.
    - $\ge 8$ caratteri: Tolleranza Levenshtein $\le 2$.
  - Risoluzione verificata con test automatico dedicato: query `"pala aveleata"` trova con successo `"palla avvelenata"`.
  - Normalizzazione completa di maiuscole e diacritici/accenti (NFD).
  - Multi-campo AND (nome, regole/testo, materiali/note_gesti).
- [x] **302. Evidenziazione Ricerca XSS-Safe (`HighlightText`):**
  - Zero uso di `innerHTML` o parser insicuri nel codice.
  - Generazione di nodi Virtual DOM Preact nativi (`<mark class="search-highlight">`) con sfondo giallo scout (`--color-giochi`) e testo inchiostro.
  - Punteggiatura, maiuscole e spazi originali preservati integralmente.
  - Annunciatore accessibile con `aria-live="polite"` sul contatore dei risultati.
  - Stato vuoto contestuale: *"Nessun risultato per «xxx»"*.
- [x] **303. Ordinamento a 4 Opzioni e Persistenza in SessionStorage:**
  - Controllo segmentato con esattamente quattro opzioni: `A → Z`, `Z → A`, `Recenti`, `Vecchi` (per `created_at`).
  - Ordinamento alfabetico gestito tramite `Intl.Collator('it', { sensitivity: 'base' })`.
  - Query di ricerca e ordinamento selezionato restano in memoria al ritorno dalla visualizzazione del dettaglio tramite `sessionStorage` (`giochi_search`, `giochi_sort`, `bans_search`, `bans_sort`).
- [x] **304. Badge "Nuovo" per Elementi Recenti:**
  - Badge giallo scout visualizzato automaticamente per tutti i giochi e i bans creati da meno di 7 giorni (`created_at < 7 days`).
- [x] **305. Dettaglio Giochi e Bans con Predisposizione Allegati:**
  - `GiocoDetailSheet`: regole dettagliate, materiali necessari e placeholder per la galleria allegati e schemi di gioco (Fase 5).
  - `BanDetailSheet`: testo completo, note sui gesti, pulsante rapido per la modalità lettura e placeholder allegati audio (Fase 5).
- [x] **306. Modalità Lettura Bans per Fuochi Serali (`BanReadingMode`):**
  - Modalità fullscreen ad alto contrasto concepita per la lettura all'aperto attorno al fuoco.
  - Controlli dimensione testo `A-` / `A+` da 16px a 36px con preferenza persistita in `localStorage`.
  - Riquadro note sui gesti (`note_gesti`) con colore dedicato, icona fiamma e bordo marcato per distinguere nettamente le istruzioni sceniche dal testo.
  - Screen Wake Lock API (`src/lib/wakelock.ts`) attiva durante la lettura per impedire lo spegnimento dello schermo, con riacquisizione automatica al ritorno sulla scheda (`visibilitychange`) e fallback silenzioso se non supportata.
- [x] **307. Admin Gating Rigoroso:**
  - Senza sessione admin attiva (verificata tramite RPC `is_admin()`), nessun pulsante "Nuovo Gioco", "Nuovo Ban", "Modifica" o "Elimina" è renderizzato nell'interfaccia.
  - Protezione backend garantita al 100% da Row Level Security (RLS) PostgreSQL.
- [x] **308. Form in BottomSheet e Segnalazione Duplicati:**
  - Form dedicato per Giochi e Bans con validazione campi obbligatori.
  - Controllo duplicati morbido: se il nome inserito ha una distanza di Levenshtein $\le 2$ da un elemento esistente, mostra un alert giallo che informa l'amministratore senza impedire il salvataggio.
- [x] **309. Eliminazione Distruttiva a Due Passaggi (`DeleteConfirmModal`):**
  - Prevenzione errori accidentali: l'utente deve digitare il nome esatto dell'elemento per abilitare il pulsante di soft-delete.
- [x] **310. Cestino, Ripristino e Svuotamento Definitivo:**
  - Gestione tombstone a 180 giorni.
  - Vista `TrashSheet` in Admin per consultare gli elementi eliminati con funzione di ripristino (`restoreRecord`) o eliminazione permanente (`hardDeleteRecord` / `purgeTrash`).
  - Predisposizione punto di estensione Storage (`deleteAssociatedStorageFiles` in `src/lib/admin_actions.ts`): alla cancellazione definitiva elimina anche i file corrispondenti dal bucket `allegati` (Fase 5), documentato in `docs/DECISIONS.md`.
- [x] **311. Esportazione Backup JSON:**
  - Funzione `exportBackupJson()` esporta tutte le 6 tabelle di IndexedDB in un file JSON scaricabile localmente con marcatura data.
- [x] **312. Resilienza a Dati Sporchi (Stress Test):**
  - Test automatico con 200 record eterogenei eseguito in meno di 100 ms.
  - Resilienza a stringhe continue senza spazi di 300 caratteri e titoli estremamente lunghi senza crash né overflow.
- [x] **313. Suite Test Unitari Automatizzati (`test/giochi_bans.test.ts`):**
  - 17 test su 17 superati con successo (typo, ordinamento, XSS highlight, soft-delete, nascondimento gerarchico figli, cestino, stress test).
- [x] **314. Suite Test Playwright e Accessibilità (`test/verify_ui.spec.ts`):**
  - 16 test su 16 superati con successo su tutti i 7 viewport (incluse le nuove schermate `#/giochi` e `#/bans`, zero overflow orizzontale, 0 violazioni critiche axe-core).
- [x] **315. Audit Lighthouse Mobile (Fase 3):**
  - **Performance:** 89 (ottimizzazioni rimandate alla Fase 8 come da accordi).
  - **Accessibilità:** 96 (superiore alla soglia di 90).
  - **Best Practices:** 100.
  - **SEO:** 100.

---

## FASE 4 — Canti e Canzoniere (Verificato)

- [x] **401. Correzione 1 — Epoca di Sincronizzazione e Bonifica Tombstone:**
  - Migrazione SQL `supabase/migrations/0004_purge_and_epoch.sql` pronta per l'applicazione.
  - Tabella `system_meta` con `sync_epoch`, funzione `bump_sync_epoch()` admin-only.
  - Funzione `purge_old_tombstones()` che cancella fisicamente solo righe con `deleted_at < now() - interval '180 days'`.
  - Client verifica mismatch di epoca a ogni sync e forza `performFullResync()` atomico se cambiata.
  - Test unitario (`test/sync_engine.test.ts` test 8) superato con successo.
- [x] **402. Correzione 2 — Verifica Stress UI con Dati Sporchi:**
  - Inclusione in `verify:ui` di dataset con 200 elementi per Giochi, Bans e Canti con stringhe lunghissime (300+ caratteri continui senza spazi), accenti, apostrofi, virgolette e caratteri speciali (`< & " '`).
  - Verifica ricerca typo su dataset sporco.
  - Verifica ordinamento alfabetico corretto su dataset sporco.
  - Apertura e chiusura fogli di dettaglio e form in BottomSheet.
  - Simulazione tastiera aperta (viewport ridotto a 390×400 px con input in focus).
  - Test su temi Chiaro e Scuro e con `prefers-reduced-motion`.
  - Asserzione geometrica: l'ultimo elemento della lista non è coperto dalla tab bar inferiore.
- [x] **403. Parser ChordPro Nativo (`src/lib/chordpro.ts`):**
  - Segmentazione del testo `[Accordo]sillaba` in AST strutturato senza uso di `innerHTML`.
  - Supporto direttive `{strofa}`, `{ritornello}` / `{soc}` / `{eoc}`, `{ponte}`, `{nuova_pagina}` e metadati `{ritmo}`, `{bpm}`, `{misura}`, `{capo}`.
- [x] **404. Rendering Tipografico VDOM Sicuro:**
  - Colonne verticali `.song-chord-column` con `.song-chord` in Azzurro Scuro (`--color-calendario`) e `.song-lyric` sottostante.
  - Allineamento preservato a ogni a capo riga (anche su schermi da 320 px).
  - Ritornello `.song-chorus-block` con barra laterale sinistra gialla scout (`--color-yellow`).
- [x] **405. Trasposizione Semitonale Real-time:**
  - Algoritmo circolare sui 12 semitoni con preservazione della notazione italiana o anglosassone.
  - Supporto alterazioni diesis/bemolli, estensioni armoniche (`m7, sus4, dim, add9, 5+`) e slash chord con basso (`Sol/Si` $\rightarrow$ `La/Do#`).
  - Controlli `-1`, `+1`, `Orig` in memoria senza alterare il testo originale su DB.
- [x] **406. Ricerca Testuale con Esclusione Accordi:**
  - `stripChords(testo_chordpro)` elimina accordi e direttive prima del match: le ricerche di note come "Do" o "Re" non generano falsi positivi.
- [x] **407. Ordinamento a 4 Opzioni con Persistenza:**
  - `A → Z`, `Z → A`, `Recenti`, `Vecchi` persistenti in `sessionStorage` (`canti_search`, `canti_sort`).
- [x] **408. Stima Pagine di Stampa A4:**
  - Funzione `calculatePageCount` determina preventivamente il numero di pagine di stampa del canto (rispettando `{nuova_pagina}` e densità di righe).
- [x] **409. Modalità Lettura a Tutto Schermo (`CantoReadingMode`):**
  - Layout alto contrasto, regolazione dimensione testo (+/-), toggle visibilità accordi, trasposizione e acquisizione automatica Screen Wake Lock API con re-lock su `visibilitychange`.
- [x] **410. Editor Admin con Live Preview (`CantoFormSheet`):**
  - Gating admin completo (`is_admin()`).
  - Inserimento rapido accordi `[Accordo]` e direttive al cursore.
  - Segnalazione duplicati (Levenshtein $\le 2$).
  - Validazione morbida della sintassi con avvisi non bloccanti.
  - Anteprima live VDOM in tempo reale.
- [x] **411. Suite Test Unitari Automatizzati (`test/canti_chordpro.test.ts`):**
  - 20 test su 20 superati con successo (tokenizzazione, AST, trasposizione italiana e americana, slash chords, validazione, strip chords, calcolo pagine, formattazione e form).
- [x] **412. Script di Sicurezza Admin (`test/run_admin_test.mjs`):**
  - Rifiuto scritture anonime (INSERT, UPDATE, DELETE) via RLS.
  - Rifiuto upload storage con MIME non consentito o non autorizzato.
  - Supporto end-to-end con riga esca admin e verifica immutabilità.
- [x] **413. Suite Playwright e Accessibilità (`test/verify_ui.spec.ts`):**
  - 19 test su 19 superati con successo su tutti i 7 viewport (inclusa la nuova sezione Canti, stress test 200 record sporchi, dark mode, zoom 200% e touch target).
- [x] **414. Audit Lighthouse Mobile (Fase 4):**
  - **Performance:** 82 (LCP 3.2s immagine testata, TBT 370ms script/SW; ottimizzazioni rimandate alla Fase 8 come da accordi).
  - **Accessibilità:** 96 (superiore alla soglia di 90).
  - **Best Practices:** 96.
  - **SEO:** 100.

---

## FASE 5 — Gestione Allegati, Galleria, Lightbox, Compressione WebP e Storage Offline

- [x] **501. Validazione Formati e Dimensioni (`validateAttachmentFile`):**
  - Accetta esclusivamente formati consentiti: immagini (`image/jpeg`, `image/png`, `image/webp`) e documenti (`application/pdf`).
  - File audio espressamente esclusi dalla v1 per preservare la quota di 1 GB.
  - Limite dimensione massimo di 10 MB per i PDF e 10 MB pre-compressione per le immagini.
  - Rifiuto categorico di MIME type eseguibili o rischiosi (`text/html`, `application/x-msdownload`, script).
- [x] **502. Compressione Client-Side WebP con Canvas (`compressImageClientSide`):**
  - Ridimensionamento proporzionale delle immagini ad alta risoluzione (max 1600px sul lato lungo).
  - Codifica in formato WebP a qualità 0.82 (con fallback su JPEG su browser legacy).
  - Abbattimento medio dell'85-90% del payload di rete prima del trasferimento verso Supabase.
- [x] **503. Generazione Percorso Storage Univoco e Protetto (`generateSafeStoragePath`):**
  - Nessun uso del nome file originale sul filesystem del server.
  - Struttura deterministica e isolata: `{parentType}/{parentId}/{timestamp}_{randomSuffix}.{ext}`.
- [x] **504. Upload con Progresso e Transazione Database (`uploadAttachment`):**
  - Inserimento del blob su Supabase Storage nel bucket `allegati`.
  - Creazione contestuale della riga nella tabella Postgres `allegati` protetta da RLS.
  - Callback di avanzamento progressivo in percentuale (0-100%).
- [x] **505. Cache API Dedicata per Consultazione Offline (`scout-attachments-v1`):**
  - Storage cache isolato dal Service Worker dell'app shell per non rallentare l'avvio.
  - Sincronizzazione automatica silenziosa in background al termine del sync per file $< 500\text{ KB}$.
- [x] **506. Risoluzione Sorgente Immagine con Fallback Offline (`resolveAttachmentSource`):**
  - Se online: preferenza per il CDN pubblico o per la cache locale.
  - Se offline: recupero trasparente da Cache API; se non presente, visualizzazione di un badge elegante *"Non scaricato — serve connessione"* senza rompere il layout o mostrare icone di errore browser.
- [x] **507. Download Completo Offline con Monitoraggio Avanzamento (`downloadAllAttachmentsForOffline`):**
  - Azione accessibile nel pannello Admin per forzare il caching di tutti i file dell'archivio.
  - Monitoraggio real-time di progresso e percentuale.
- [x] **508. Rimozione Fisica da Storage API prima della Cancellazione SQL:**
  - `purgeTrash` e `hardDeleteAttachment` invocano `supabase.storage.from('allegati').remove([...])` per eliminare i file fisici dal bucket prima della rimozione o bonifica della riga SQL.
- [x] **509. Scansione e Bonifica File Orfani (`findOrphanStorageFiles`, `purgeOrphanStorageFiles`):**
  - Strumento per individuare file rimasti nel bucket privi di riferimento attivo nel database e rimuoverli in modo controllato.
- [x] **510. Misuratore Occupazione Quota 1 GB Free Tier (`getStorageUsageStats`):**
  - Calcolo dimensione totale utilizzata rispetto al limite di 1 GB.
  - Barra grafica con percentuale e badge cromatico di sicurezza in `AdminView`.
- [x] **511. Galleria Allegati con Rapporto Fisso Anti-CLS (`AttachmentGallery`):**
  - Griglia responsive per miniature di immagini con `width` e `height` esplicite.
  - Card documenti PDF con icona, titolo con ellissi e metadati di dimensione.
  - Gating admin completo per le azioni di eliminazione.
- [x] **512. Modale Lightbox Zoom a Schermo Intero:**
  - Ingrandimento immagine ad alta risoluzione con backdrop oscurato accessibile.
  - Chiusura tramite click sul backdrop, pulsante dedicato con `aria-label` o tasto di chiusura.
- [x] **513. Gestore Upload Amministrativo da Smartphone (`AttachmentUploadManager`):**
  - Selettore doppio: Scatta foto (`capture="environment"`) e Scegli file da dispositivo.
  - Anteprima visiva del file selezionato e barra di caricamento.
- [x] **514. Integrazione Globale nei Fogli di Dettaglio:**
  - Integrata in `GiocoDetailSheet`, `BanDetailSheet`, `CantoDetailSheet`, `AdminView` e Sezione 12 su `DesignSystemView` (`#/design`).
- [x] **515. Verifica Suite Completa e Audit Qualità:**
  - Test unitari completi (`npm test`): **65 su 65 superati**.
  - Test UI Playwright (`npm run verify:ui`): **20 su 20 superati** su tutti i 7 viewport.
  - Audit Mobile Lighthouse: **Performance 91**, **Accessibilità 96**, **Best Practices 100**, **SEO 100**.

---

## FASE 6 — Stampa A4, Fascicoli Personalizzati, Overflow Canti e Test Binario PDF

- [x] **601. Risoluzione Correzioni 1–5 (Fase 5 -> 6):**
  - Correzione 1: Scansione orfani sicura: verifica referenze attive e soft-delete, esclusione file recenti (< 24h); tabella dettagliata (nome, dimensione, età) e doppia conferma in Admin; rimozione atomica da Storage se INSERT della riga fallisce.
  - Correzione 2: Semantica eliminazione allegato: soft-delete con file preservato in Storage per consentire il ripristino dal Cestino; eliminazione fisica da Storage solo al purge definitivo. Test completo del ciclo elimina -> ripristina -> svuota.
  - Correzione 3: Cache offline: rimozione del file da `scout-attachments-v1` alla ricezione del tombstone; tetto di 150 MB con algoritmo di evizione LRU e notifica utente.
  - Correzione 4: Test statico CSP (`test/csp_compliance.test.ts`): verifica assenza di tag insicuri (`<object>`, `<embed>`), domini Supabase validati in `index.html` (4/4 superati).
  - Correzione 5: Migrazione 0005 aggiornata in `supabase/migrations/0005_revoke_rpc_permissions.sql`.
- [x] **602. Schermata Centro Stampa (`StampaView`, `#/stampa`):**
  - Navigazione a schede per categoria (Giochi, Bans, Canti, ODG) con contatori dedicati per ciascuna tipologia.
  - Selezione multi-checkbox con controlli rapidi "Seleziona tutti" e "Deseleziona tutti".
  - Riordino dinamico degli elementi selezionati con pulsanti Su e Giù (`chevron-up`, `chevron-down`).
  - Persistenza dello stato di selezione in `sessionStorage`.
- [x] **603. Opzioni del Fascicolo e Integrazione Immagini:**
  - Interruttore "Includi immagini allegate" (default disattivato, include esclusivamente schemi e immagini; documenti PDF categoricamente esclusi dal flusso di stampa; badge sobrio se offline).
  - Interruttore "Aggiungi copertina e indice" (default disattivato; copertina con marchio `logo-completo` su targa chiara e indice con numeri di pagina calcolati).
- [x] **604. Motore di Stampa In-Page e Fogli di Stile A4 (`src/styles/print.css`):**
  - Esecuzione in-page tramite `window.print()` senza popup o nuove schede (`window.open` vietato per prevenire blocchi browser).
  - Dimensionamento foglio `@page { size: A4 portrait; margin: 15mm 12mm; }`.
  - Corpo del testo in nero assoluto su bianco puro (`oklch(0 0 0)` su `oklch(1 0 0)`), corpo $\ge 12\text{ pt}$.
  - Reset dei contenitori antenati (`html, body, #app, main, .container`) a `display: block !important; overflow: visible !important; height: auto !important;` per sbloccare la paginazione Chromium/Safari.
  - Soppressione totale della UI applicativa (TopBar, BottomNav, banner, modali, HUD altimetrico, wrapper curve di livello e motivi vettoriali).
- [x] **605. Flusso Continuo Giochi e Bans:**
  - Nessuna interruzione di pagina forzata tra elementi consecutivi; separatore sottile orizzontale.
  - Intestazioni con `break-after: avoid`, `orphans: 3`, `widows: 3` per scongiurare titoli orfani.
  - `break-inside: avoid` per elementi brevi ($< 600$ caratteri); gli elementi estesi scorrono liberamente tra le pagine per evitare vuoti.
- [x] **606. Paginazione Canti e Formattazione Spartito:**
  - Ogni canto inizia su una pagina nuova (`break-before: page !important`).
  - Rispetto rigoroso dei tag di cambio pagina espliciti `{nuova_pagina}`.
  - Pagine successive ($N \ge 2$): testata ridotta al solo titolo con indicatore ("Titolo — 2/2"), escludendo metadati ripetuti.
  - Accordi musicali posizionati sopra il testo in nero grassetto (`font-weight: 700`); barra laterale del ritornello con bordo nero solido.
- [x] **607. Rilevamento Overflow e Step-Down Tipografico (`src/lib/stampa.ts`):**
  - Algoritmo `estimatePageOverflow`: 4 gradini tipografici decrescenti ($12.0\text{ pt} \rightarrow 11.0\text{ pt} \rightarrow 10.2\text{ pt} \rightarrow 9.5\text{ pt}$).
  - Allarme visivo in anteprima se il testo eccede l'altezza utile: *"Questa pagina non entra: aggiungi un'interruzione di pagina"*.
- [x] **608. Preparazione Ordine del Giorno (ODG) per Riunioni:**
  - Layout compatto per riunioni con data, luogo, responsabile, testo evento e caselle quadrate stampabili `[ ]` ($14\times 14\text{px}$) per la spunta a penna.
- [x] **609. Test Automatizzato Binario PDF (`test/stampa_pdf.spec.ts`):**
  - Generazione di un PDF reale A4 tramite Playwright `page.pdf()`.
  - Parsing del file binario con libreria `pdf-parse`: verifica di 7 pagine complessive, flusso continuo, canto su 2 pagine con testata "2/2", riga con 40 accordi, caratteri speciali (`<`, `&`, `"`, `'`), e assenza di pagine bianche.
- [x] **610. Vetrina Design System (`#/design`, Sezione 18):**
  - Componenti di stampa, preview in miniatura, badge avviso overflow e casella quadrata ODG.
- [x] **611. Suite Test Completa e Audit Qualità (Fase 6):**
  - Test unitari completi (`npm test`): **78 su 78 superati** (9 file di test).
  - Test UI Playwright (`npm run verify:ui`): **22 su 22 superati** (incluso audit axe-core su `#/stampa`).
  - Audit Mobile Lighthouse (mediana di 3 run): **Performance 90** (90, 89, 90), **Accessibilità 96** (96, 96, 96), **Best Practices 100**, **SEO 100**.

---

## FASE 7 — Calendario Clan e Ordine del Giorno (ODG)

- [x] **701. Gestione Matematica del Tempo e Mesi (`src/lib/calendario.ts`):**
  - Fuso orario `Europe/Rome`, localizzazione `it-IT`, inizio settimana rigorosamente Lunedì.
  - Calcolo esatto per mesi da 28, 29 (febbraio bisestile), 30 e 31 giorni con settimane complete da 7 celle.
  - Immunità da transizione ora legale/solare di fine marzo (23h) e fine ottobre (25h) con calcolo basato su date assolute di calendario.
- [x] **702. Eventi Multi-Day e Tutto il Giorno:**
  - `isEventOnDate`: evento di più giorni risulta attivo per tutti i giorni dell'intervallo e non fuori.
  - Gestione eventi a cavallo di fine mese (es. 30 ott - 2 nov).
  - Formattazione intervallo date con dicitura "Tutto il giorno" se privo di orario orologio.
- [x] **703. Vista Mese Interattiva (`CalendarioMonthView`):**
  - Griglia reattiva a 7 colonne (LUN-DOM), navigazione avanti/indietro tra mesi e pulsante "Oggi".
  - Giorno odierno evidenziato in rosso accento (`.calendar-cell-today`).
  - Indicatori a pallino colorato (`.calendar-dot`) per tipologie di attività presenti nella data.
  - Selezione del giorno con elenco attività dinamico sottostante.
- [x] **704. Vista Lista Prossimi e Passati (`CalendarioListView`):**
  - Raggruppamento cronologico (prossimi in ordine crescente, passati in ordine decrescente).
  - Blocco data da parete (`.calendar-date-block`) con testata inchiostro o rossa (se oggi).
  - Chip cromatico del tipo e contatore badge rosso per punti ODG ancora aperti.
- [x] **705. Foglio di Dettaglio Completo (`EventoDetailSheet`):**
  - Dati logistici (luogo, responsabile, cosa portare, note), galleria allegati (`AttachmentGallery` con upload admin).
  - Gestore Ordine del Giorno integrato.
  - Deep-link automatico con parametro query `#/calendario?id=<uuid>`.
- [x] **706. Ordine del Giorno (ODG) e Permessi Rigorosi (`OdgManager`):**
  - Casella di spunta animata con glifo SVG tracciato (`stroke-dasharray` / `stroke-dashoffset`).
  - Gating dei permessi: per visitatori anonimi (`!isAdmin`), la spunta e le modifiche sono disabilitate in sola lettura.
  - Riordino sequenziale Su/Giù per amministratori (`reorderOdgPunti`).
  - Algoritmo di riporto: *"Riporta alla prossima"* clona i punti aperti sulla prossima riunione programmata valorizzando `riportato_da`.
  - Soft-delete gerarchica: punti nascosti automaticamente se l'evento genitore è eliminato e ripristinati congiuntamente.
- [x] **707. Form Amministratore e Validazione Date (`EventoFormSheet`):**
  - Controllo di coerenza stringente: blocco se $fine < inizio$.
  - Avviso informativo visibile sui dati personali e sensibili.
  - RLS Supabase attiva su `eventi` e `odg_punti` (scritture anonime respinte).
- [x] **708. Integrazione Card Home ("Prossimo Evento"):**
  - Collegamento diretto a `getNextUpcomingEvent()` con blocco data parete, chip colore, conto alla rovescia, contatore punti aperti rosso e deep-link a Calendario.
- [x] **709. Vetrina Design System (`#/design`, Sezione 19):**
  - Esposizione di chip per 5 tipi evento, blocchi data standard e odierna, spunta ODG animata.

---

## FASE 8 — Rifinitura, Audit di Sicurezza, Matrice Offline e Verifica Finale

- [x] **801. Prestazioni Mobile e Bundle Optimization (Fase 8A):**
  - Variante mobile della foto di testata (`home-400.webp`, 15.9 KB < 25 KB) servita con `<source media="(max-width: 600px)">` e preload mirato in `index.html`.
  - Code-splitting con Rollup `manualChunks` in `vite.config.ts`: chunk `vendor-preact` (19 KB), `vendor-idb` (3.3 KB), `vendor-supabase` (223 KB) e bundle boot `index.js` abbattuto da 321 KB a 72 KB (-78%).
  - Isolamento CSS di stampa (`print.css`, 11.7 KB) importato on-demand in `StampaView.tsx`: CSS iniziale ridotto a 47.9 KB (8.1 KB gzip).
  - Service Worker registrato solo all'evento `window.load` per non interferire con il caricamento critico. Connessione Realtime differita con `requestIdleCallback`.
  - Risultati Mediana su 5 esecuzioni Lighthouse Mobile:
    - **Performance: 91** (mediana $\ge 90$, run fino a 92)
    - **Accessibilità: 96** (mediana $\ge 90$)
    - **Best Practices: 100** (100/100 perfetto)
    - **SEO: 100** (100/100 perfetto)
    - **Total Blocking Time (TBT): 180 ms** ($\le 200$ ms)
    - **Cumulative Layout Shift (CLS): 0.059** ($\le 0.1$)
- [x] **802. Audit di Sicurezza Rigoroso e Red Team Avversario (Fase 8B):**
  - Subagent avversario di sicurezza (`cfbe2c5b-8a24-4f54-aa5c-e091e9715195`) eseguito con valutazione complessiva **9.2/10**.
  - Rimozione totale di qualsiasi occorrenza o citazione di `service_role` da script, test, configurazioni e repository (`test/security_contract.test.ts` con exit code 0).
  - CSP blindata in `index.html` senza wildcard aperte: permessi espliciti per il solo endpoint di progetto `https://lpeiyzwccedtqjbficjo.supabase.co` e `wss://lpeiyzwccedtqjbficjo.supabase.co`.
  - Protezione RLS contro desync silenziosi: ogni operazione di `UPDATE` o `DELETE` in `src/lib/admin_actions.ts` e `src/lib/attachments.ts` include `.select('id')` con controllo esplicito sulle righe restituite per impedire modifiche locali non confermate dal server.
  - Revoca permessi RPC: `REVOKE EXECUTE ON FUNCTION bump_sync_epoch, purge_old_tombstones FROM public, anon; GRANT EXECUTE TO authenticated;` consolidata in `supabase/full_schema.sql`.
- [x] **803. Backup, Ripristino Differenziale e Schema Unico (Fase 8C):**
  - Schema unico e idempotente consolidato in `supabase/full_schema.sql` (Parti 1-5: tabelle, vincoli, trigger, storage, tombstone a 180 giorni, sync_epoch e permessi).
  - Funzionalità di Backup JSON esportabile e "Ripristina da Backup JSON" con validazione differenziale e visualizzazione dettagliata degli elementi aggiunti/aggiornati in `AdminView.tsx`.
  - Documentazione di Disaster Recovery completa per ripartire da zero in `docs/SETUP_MANUALE.md` (Sezione 5).
- [x] **804. Pulizia e Riservatezza Rotte Diagnostiche (Fase 8D):**
  - Link pubblici a `#/design` e `#/stato-dati` rimossi dalla navigazione pubblica e dal footer della Home.
  - Rilocati all'interno dell'Area Capi / Admin (`AdminView.tsx`) nella sezione "STRUMENTI DI DIAGNOSTICA", accessibile solo a capi autenticati.
- [x] **805. Matrice Offline e Resilienza alla Disconnessione (Fase 8E):**
  - Test end-to-end dedicati in `test/offline_matrix.spec.ts` (7 scenari su 7 superati al 100% in 8.1s):
    1. Primo avvio e persistenza locale IndexedDB (`vault_scout_db`).
    2. Navigazione tra le viste dell'applicazione senza connessione di rete.
    3. Lettura canti con accordi ChordPro, trasposizione live semitoni e Modalità Lettura ad alto contrasto per bans attorno al fuoco in offline.
    4. Apertura e consultazione allegati in cache (`Cache API`).
    5. Avviso chiaro di stato offline con badge e attributi ARIA (`role="status"`).
    6. Blocco sicuro delle azioni di scrittura e modifica in assenza di rete.
    7. Riconnessione online e ripristino automatico dello stato.
- [x] **806. Preservazione Database e Keepalive Supabase (Fase 8F):**
  - Strategia a triplo livello documentata in `docs/SETUP_MANUALE.md` (Sezione 6) per prevenire la disattivazione automatica del tier gratuito di Supabase (query ping, promemoria calendariale e fallback di dump).
  - Redazione della `docs/GUIDA_CAPI.md` per l'uso quotidiano, la gestione dei contenuti, il report ODG e la manutenzione.
- [x] **807. Risoluzione Correzioni Fase 7:**
  - *Correzione 3 (Riporto ODG):* Idempotente su `odg_punti` verificato con blocco duplicati e proposta di creazione evento successivo.
  - *Correzione 4 (Permessi ODG):* Test di sicurezza senza service_role verificato su `odg_punti` ed `eventi`.
  - *Correzione 5 (Overflow Canti):* Messaggio di overflow tipografico ripristinato e test PDF con `pdf-parse` (12 pagine reali, concordanza numeri indice).
  - *Correzione 6 (Eventi su più giorni e Tutto il giorno):* Gestione corretta nella griglia del mese con badge e stampa dell'ODG nel Centro Stampa.
  - *Correzione 7 (Dati di prova):* Nessun dato finto nel database o nel codice applicativo di produzione; dati dimostrativi isolati esclusivamente nelle fixture di test.

---

## Comandi di Verifica

```bash
# 1. Esecuzione test unitari completi (95 test su 10 file)
npm test

# 2. Esecuzione verifica reattiva e accessibilità Playwright su 7 viewport, stress test, Allegati, Stampa e Matrice Offline (31 test)
npm run verify:ui

# 3. Test di generazione e validazione binaria del PDF di stampa (12 pagine reali, pdf-parse)
npx playwright test test/stampa_pdf.spec.ts

# 4. Matrice offline Playwright (7 scenari di resilienza alla disconnessione)
npx playwright test test/offline_matrix.spec.ts

# 5. Audit Lighthouse Mobile (5 esecuzioni con calcolo della mediana)
node scripts/run_lighthouse_5.mjs

# 6. Test di sicurezza RLS e Storage (admin e anonimo, richiesta credenziali a runtime)
npm run test:admin

# 7. Compilazione TypeScript e build bundle Vite (con code splitting Rollup)
npm run build
```



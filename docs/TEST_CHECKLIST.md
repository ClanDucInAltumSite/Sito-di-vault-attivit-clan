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

## Comandi di Verifica

```bash
# 1. Esecuzione test unitari e suite di sincronizzazione offline (18 test)
npm test

# 2. Esecuzione verifica reattiva e accessibilità Playwright (14 test)
npm run verify:ui

# 3. Compilazione TypeScript e build bundle Vite
npm run build

# 4. Audit di sicurezza live Supabase (con Anon Key)
node supabase/tests/run_security_check.mjs
```

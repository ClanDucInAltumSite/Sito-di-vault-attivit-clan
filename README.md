# Vault Scout — Duc In Altum

Applicazione web progressiva (PWA) offline-first per Clan e Reparti Scout: gestione di Giochi, Bans, Canzoniere ChordPro, Calendario delle Uscite, Ordine del Giorno (ODG) e Centro Stampa ad alto contrasto.

## Caratteristiche Principali

- **Offline-First Reale:** Tutti i contenuti risiedono in IndexedDB locale (`idb`), con sincronizzazione incrementale bidirezionale verso Supabase Postgres via canali Realtime.
- **Centro Stampa Professionale A4:**
  - **Tre flussi completamente separati:** Giochi e Bans (flusso continuo), Canzoniere (2 colonne), Ordine del Giorno e Scadenze (scheda riunione). Nessuna modalità mista.
  - **Canzoniere a due varianti:** "Chi suona" (accordi sopra il testo, intro/strum/outro, ritmo pennata) e "Chi canta" (solo testo pulito ad alta densità).
  - **Regola RIT.:** Ritornello intero alla prima occorrenza; dalla seconda in poi sostituito dall'etichetta in grassetto `RIT.`.
  - **Layout adattivo:** Ricerca binaria della dimensione font (fino a 17 pt) per riempire lo spazio utile A4 a due colonne senza spezzature sgradevoli.
  - **Indice a inizio canzoniere per settori:** Canzoni scout, Canzoni esterne, Canzoni di chiesa, Altre canzoni, con ordinamento alfabetico senza articoli e numerazione pagina post-layout.
- **Importatore Canzoniere PDF/DOCX:** Riconoscimento sillabico degli accordi e metadati con zero librerie esterne pesanti.
- **Apple-Grade Design System:** Palette in token OKLCH, contrasto conforme WCAG AAA per la stampa a risparmio inchiostro, animazioni fluide iOS-style.

## Sviluppo

```bash
# Installa dipendenze
npm install

# Avvia server di sviluppo Vite
npm run dev

# Controllo tipi TypeScript
npm run typecheck

# Suite di test unitari e di integrazione (Vitest)
npm test

# Test golden di regressione su PDF/DOCX
npm run test:golden

# Build di produzione
npm run build

# Controllo budget di peso
npm run check:budget
```

## Struttura del Codice di Stampa

- `src/features/stampa/StampaView.tsx`: Shell orchestratrice con selettore `SegmentedControl` per i tre documenti.
- `src/features/stampa/StampaGiochiBans.tsx`: Flusso indipendente per Giochi e Bans.
- `src/features/stampa/StampaCanzoni.tsx`: Flusso indipendente per il Canzoniere (Chi suona / Chi canta).
- `src/features/stampa/StampaOdg.tsx`: Flusso indipendente per ODG, presenze e scadenze.
- `src/lib/stampa_shared.ts`: Funzioni condivise e gestione `triggerPrint(scope)` con attributo `body[data-print]`.
- `src/lib/stampa_canzoni.ts`: Logica RIT., ordinamento settori e calcolo indice post-layout.
- `src/lib/stampa_giochibans.ts`: Paginazione continua e caricamento allegati.
- `src/lib/stampa_odg.ts`: Elaborazione punti ODG con stato decisione e scadenze.
- `src/styles/print.css`: Regole di stampa isolata con `@media print`, dimensioni A4 e layout a due colonne.

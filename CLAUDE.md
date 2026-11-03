# Vault Scout - Guida per Assistenti AI (CLAUDE.md)

Vault Scout è un'applicazione web PWA offline-first per Clan e Reparti Scout (Duc In Altum), sviluppata in Preact, TypeScript, Vite e Supabase.

## Comandi di Sviluppo e Verifica

```bash
npm run typecheck         # Verifica tipi TypeScript con tsc --noEmit
npm test                  # Esegue la suite completa di test unitari e di integrazione (Vitest)
npm run test:golden       # Esegue la suite di test golden regressione su PDF/DOCX
npm run build             # Compila l'applicazione per la produzione in dist/
npm run check:budget      # Verifica rigorosa dei budget di peso (bundle JS/CSS, precache SW, foto)
```

## Architettura del Centro Stampa (Nuovo Sottosistema)

Il sottosistema di stampa è stato interamente riscritto per garantire fascicoli A4 professionali ad alto contrasto (nero su bianco), zero interferenze tra documenti e massimo sfruttamento dello spazio.

### 1. Tre Flussi Completamente Indipendenti
Non esiste alcuna modalità "tutti". I tre flussi non coesistono mai nello stesso job né nello stesso foglio di stampa:
1. **Stampa Giochi e Bans (`StampaGiochiBans.tsx`):**
   - Formato A4 continuo.
   - Selezione e riordino giochi e bans, opzione per allegati fotografici (mai PDF).
   - Elementi brevi (<600 caratteri) mantengono `break-inside: avoid`, elementi lunghi scorrono liberamente.
2. **Stampa Canzoniere (`StampaCanzoni.tsx`):**
   - Formato A4 a due colonne con linea verticale divisoria.
   - Due varianti distinte ("Chi suona" e "Chi canta").
   - Indice per settori a inizio volume.
3. **Stampa Ordine del Giorno e Scadenze (`StampaOdg.tsx`):**
   - Scheda A4 verticale per uscite e riunioni.
   - Punti ODG con stato distinto (`proposto`, `discusso`, `approvato`, `rimandato`) e `break-inside: avoid`.
   - Sezioni opzionali: Riquadro Presenze, Decisioni e Verbale, Scadenze imminenti.

### 2. Canzoniere: Due Varianti Separate
- **"Chi suona":** accordi stampati rigorosamente sopra il testo (ancorati a larghezza zero), intro/outro e sequenze strum preservati, intestazione con metadati musicali completi (tempo, BPM, ritmo di pennata con frecce Nova Mono, capotasto).
- **"Chi canta":** solo testo, nessun accordo né riga di soli accordi, commenti strumentali e pennate rimossi, interlinea compatta per massimizzare la capienza per colonna, intestazione ridotta (solo titolo e autore).

### 3. Regola `RIT.` (`applyRitRepeatPolicy`)
- Il ritornello viene stampato per intero (con accordi se in modalità "suona") SOLO alla prima occorrenza.
- Dalla seconda occorrenza in poi nella stessa canzone, viene sostituito dall'etichetta in grassetto **`RIT.`**.
- Un ritornello è ripetuto solo se il suo testo normalizzato è identico; variazioni o modulazioni non vengono contratte.
- Artefatti di importazione PDF (es. `RIT. / RIT:` in testata di pagina) vengono ripuliti all'origine.

### 4. Layout Adattivo e Riempimento Pagina
- Ogni canzone adatta la dimensione del font allo spazio utile dell'A4 a due colonne:
  - Ricerca binaria tra `minSizePt: 9` e `maxSizePt: 17` pt (passo 0.5 pt).
  - Modalità predefinita `riempi_pagina`: massimizza la leggibilità delle canzoni brevi riempiendo la pagina o le due colonne.
  - Modalità `compatta`: mantiene la dimensione standard a 11 pt.
  - Keep-together: nessuna strofa spezzata se evitabile, nessuna riga accordi orfana, nessun a capo con una sola parola (single-word wrap).

### 5. Indice Iniziale Diviso per Settori
- Posizionato a inizio canzoniere (dopo l'eventuale copertina), generato con numerazione di pagina effettiva calcolata post-layout.
- 4 settori ordinati rigorosamente:
  1. **Canzoni scout** (`categoria === 'scout'`)
  2. **Canzoni esterne** (`categoria === 'esterni'`)
  3. **Canzoni di chiesa** (`categoria === 'chiesa'`)
  4. **Altre canzoni** (altre o non categorizzate)
- I settori vuoti non vengono mostrati.
- All'interno di ciascun settore, le canzoni sono ordinate alfabeticamente ignorando articoli iniziali italiani (*il, lo, la, i, gli, le, un, uno, una, l'*) e accenti. Nel fascicolo stampato le canzoni seguono lo stesso identico ordine.

### 6. Isolamento DOM e Stili di Stampa
- Ciascuna schermata ha un root dedicato (`stampa-giochibans-root`, `stampa-canzoni-root`, `stampa-odg-root`).
- `triggerPrint(scope)` imposta `body[data-print="..."]` prima di `window.print()` e lo rimuove su evento `afterprint`.
- `print.css` nasconde rigidamente i flussi inattivi.
- Persistenza separata in `sessionStorage`: `stampa_giochibans`, `stampa_canzoni`, `stampa_odg`.

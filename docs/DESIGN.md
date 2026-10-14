# Sistema di Design e Specifiche dell'Interfaccia — Vault Clan (Duc In Altum)

Documento di riferimento per il design system, l'esperienza utente e l'architettura visiva del Vault di Clan.

---

## 1. Ricognizione e Analisi di Riferimento

Abbiamo analizzato quattro applicazioni leader per consultazione rapida, gestione liste e lettura testi all'aperto: **Apple Note**, **Apple Promemoria**, **Apple Libri**, e **Canzonieri digitali** (Ultimate Guitar / SongBook).

### Schemi Ricorrenti Efficaci
- **Liste Raggruppate (Grouped Lists):** I contenuti sono raggruppati in blocchi rettangolari con angoli smussati (12–16 px) su sfondo neutro, separati da linee sottili (0.5 px) indentate a sinistra. Nessuna frammentazione in dozzine di card isolate.
- **Unico Colore Accento:** Un solo colore guida (azzurro) attrae l'attenzione visiva sui comandi azionabili (link, tab bar, bottoni primari).
- **Tipografia con Gerarchia Netta:** Titoli grandi e autorevoli (Large Titles), etichette secondarie discrete, numeri tabulari dove vi sono date o misurazioni.
- **Superfici Traslucide:** Barra superiore e barra inferiore sfumate con effetto vetro (`backdrop-filter: blur(20px)`), che mantengono il contesto del contenuto durante lo scorrimento.
- **Micro-interazioni Fisiche:** Feedback immediato al tocco (leggera scala a 0.97 o cambio delicato di superficie), sheet che salgono dal basso per azioni secondarie.

### Difetti Comuni nelle App "da Template" (da eliminare radicalmente)
- Colori primari e secondari sparati ovunque contemporaneamente (giallo, azzurro e rosso nello stesso componente).
- Card tutte uguali con bordi spessi o ombre colorate che appesantiscono la vista sotto il sole.
- Uso di emoji al posto di icone professionali coerenti.
- Slogan di riempimento ("Benvenuto nel Vault!", "Archivio magnifico").
- Bordi tratteggiati decorativi, texture a tela finte o cuciture simulate che distraggono e degradano le prestazioni.
- Reflow e scatti causati da animazioni su proprietà come `height`, `margin` o `top`.

### Cosa Fa di Diverso il Vault di Clan
- **Sobrietà e Purezza Apple:** Sfondo grigio caldo calmo, liste raggruppate con angoli raccordati, comandi tattili generosi ($\ge 44\text{ px}$).
- **Partenza dal Logo Reale:** Colori campionati dai pixel reali del logo del clan (`assets/favicon.png`) e convertiti nello spazio colore percettivo **OKLCH**.
- **Il Tocco Scout non è Decorazione, è Movimento:** L'identità scout vive in tre soli motivi vettoriali a tratto sottile: il logo che si rivela all'avvio, il tracciato sottile del "sentiero" con la sua tappa gialla, e la "bussola" di sincronizzazione il cui ago oscilla durante il recupero dei dati e si assesta al termine.

---

## 2. Palette Colori e Spazio Colore OKLCH

Tutti i token colore sono definiti rigorosamente in **OKLCH** in `src/styles/tokens.css` per garantire uniformità percettiva e contrasto costante tra chiaro e scuro. Fanno eccezione unicamente `theme-color` nel meta tag e nel manifest PWA che richiedono formato HEX per compatibilità con le specifiche W3C/browser.

### Campionamento dal Logo Originale
Dal logo originale in `assets/favicon.png` sono stati estratti:
- **Giallo Identitario:** `#FDC500` $\rightarrow$ `oklch(0.83 0.18 85)`
- **Azzurro Identitario:** `#00BDFF` $\rightarrow$ Adattato per contrasto WCAG AA a `oklch(0.53 0.18 245)` in chiaro e `oklch(0.72 0.16 240)` in scuro
- **Rosso Identitario:** `#E8442D` / `#D9381E` $\rightarrow$ `oklch(0.55 0.22 27)`

### Regole d'Uso del Colore
1. **Azzurro = Unico Colore Guida:** Usato per controlli interattivi primari, icona del tab attivo, selezione segmento, link.
2. **Giallo = Solo Micro-Evidenziazioni:** Usato unicamente per il testo trovato nella ricerca, il punto di tappa finale del sentiero e il piccolo ago magnetico della bussola. Mai per sfondi estesi di card o pulsanti.
3. **Rosso = Solo Distruttivo e Data Odierna:** Usato esclusivamente per conferme di eliminazione, errori critici e l'indicatore numerico del giorno "oggi" nel calendario.
4. **Superfici Neutre:**
   - **Tema Chiaro:** Sfondo pagina `oklch(0.975 0.003 260)`, superfici raggruppate `oklch(1 0 0)`, separatori `oklch(0.90 0.005 260)`.
   - **Tema Scuro:** Sfondo pagina `oklch(0.15 0.01 260)` (grigio profondo iOS), superfici raggruppate `oklch(0.22 0.015 260)`, separatori `oklch(0.30 0.01 260)`.
5. **Contrasto WCAG AA Garantito:**
   - Testo su superficie chiara: `oklch(0.18 0.02 260)` (contrasto $\approx 14:1$, AAA).
   - Testo secondario chiaro: `oklch(0.48 0.02 260)` (contrasto $\ge 4.5:1$, AA).
   - Testo su evidenziazione gialla: sempre scuro `oklch(0.18 0.02 260)` (contrasto $> 10:1$, AAA).

---

## 3. Tipografia

- **Famiglia Caratteri:** **Inter** in formato variabile `woff2`, self-hosted in `public/fonts/`, caricato con `@font-face` locale e `font-display: swap`.
- Fallback di sistema: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif`.
- **Numeri Tabulari:** `font-variant-numeric: tabular-nums;` applicato a date, orari, contatori e battiti al minuto (BPM).

### Scala Tipografica Fluida
- **Large Title:** `clamp(1.75rem, 1.5rem + 1.25vw, 2.25rem)` (peso 700, interlinea 1.15)
- **Title 2 (Sezione):** `clamp(1.25rem, 1.15rem + 0.5vw, 1.45rem)` (peso 600, interlinea 1.25)
- **Title 3 / Headline:** `1.0625rem` (peso 600, interlinea 1.3)
- **Body:** `1rem` (16px, peso 400, interlinea 1.5)
- **Callout / Subheadline:** `0.9375rem` (15px, peso 400 o 500, interlinea 1.4)
- **Footnote / Didascalia:** `0.8125rem` (13px, peso 400, interlinea 1.35)

---

## 4. Spaziature, Raggi e Ombre

- **Griglia a 8 pt:** Spaziature rigorose: `4px` (xs), `8px` (sm), `16px` (md), `24px` (lg), `32px` (xl), `48px` (2xl).
- **Raggi di Curvatura (Border Radius):**
  - Gruppi / Liste raggruppate: `14px` (stile iOS Settings)
  - Pulsanti e Campi Input: `10px`
  - Capsule / Badge / Segmented Control: `9999px`
- **Ombre Neutre Subliminali:**
  - Superficie standard: nessuna ombra o `0 1px 2px rgba(0,0,0,0.03)`
  - Action Sheet / Modale: `0 8px 32px rgba(0,0,0,0.12)` (chiaro) / `0 8px 32px rgba(0,0,0,0.45)` (scuro). Mai ombre colorate.

---

## 5. Iconografia a Tratto Sottile

- Tutte le icone derivano dal set **Lucide** e sono renderizzate come vettori SVG inline puri con:
  `stroke="currentColor" stroke-width="1.75" fill="none" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"`
- Stessa larghezza visiva e consistenza di tratto per ogni sezione.
- **Nessuna emoji viene impiegata come icona di sistema.**

---

## 6. Il Movimento e i Tre Motivi Scout

### Regole Tecniche per il Movimento
- Si animano **esclusivamente `transform` e `opacity`** (accelerazione GPU hardware su layer composito, zero reflow/layout shift).
- Durata transizioni: `200ms` per pulsanti e tocchi, `280ms` per sheet e transizioni vista.
- Curva di accelerazione iOS: `cubic-bezier(0.32, 0.72, 0, 1)`.
- Reazione al tocco su righe e bottoni: `transform: scale(0.97)` con rilascio elastico morbido.
- `prefers-reduced-motion: reduce`: disattiva ogni spostamento e scalatura, preservando solo lievi dissolvenze di opacità.

### I Tre Motivi Scout
1. **Il Logo che si Rivela:**
   All'apertura della Home, il logo entra con dissolvenza fluida e crescita di scala da `0.96` a `1.0` in `450ms`. Non blocca né ritarda la visualizzazione dell'interfaccia.
2. **Il Sentiero:**
   Una linea tratteggiata curva sottile (SVG `stroke-dasharray` e `stroke-dashoffset`) che simula una rotta cartografica tracciata a penna, culminante in un punto di sosta giallo (`r="3"`). Compare sotto l'header della Home e negli stati vuoti.
3. **La Bussola:**
   Durante la sincronizzazione di rete, l'ago magnetico della bussola oscilla con moto armonico ($\pm 18^\circ$); a operazione conclusa si assesta al nord con un micromovimento elastico e il testo passa a "Aggiornato". Con `prefers-reduced-motion`, l'ago è immobile puntato al nord.

---

## 7. Componenti del Sistema

1. **TopBar:** Barra superiore traslucida con `backdrop-filter: blur(20px)` e `env(safe-area-inset-top)`.
2. **TabBar:** Barra di navigazione inferiore traslucida a 5 voci con `env(safe-area-inset-bottom)`.
3. **SearchField:** Ricerca a pillola con lente a tratto sottile e pulsante "cancella" circolare.
4. **SegmentedControl:** Selettore a segmenti a pillola (A→Z, Z→A, Recenti, Vecchi) con capsula scorrevole.
5. **GroupedList & GroupedRow:** Blocco a lista stile iOS con angoli 14px, linea di separazione interna, feedback al tocco e chevron vettoriale.
6. **BottomSheet:** Sheet nativo che sale dal basso con drag handle e blocco scroll del body per login admin e conferme.
7. **Button:**
   - `primary`: pieno azzurro guida con testo bianco.
   - `secondary`: superficie neutra con testo azzurro.
   - `destructive`: rosso per eliminazioni irreversibili.
   - `ghost`: testuale trasparente.
8. **ToggleSwitch:** Interruttore stile iOS (51×31 px) con knob circolare scorrevole e feedback tattile.
9. **TextField:** Campo di testo nativo pulito con label integrata e focus ring azzurro sobrio.
10. **Toast & Banners:** Banner offline discreto e capsule toast non invasivo.

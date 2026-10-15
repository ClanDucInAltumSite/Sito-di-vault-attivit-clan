# Sistema di Design e Specifiche dell'Interfaccia — FASE 1B (FINALE)

Documento di riferimento per il design system, l'esperienza utente e l'architettura visiva del **Vault di Clan (Duc In Altum)**, conforme alle direttive di redesign professionale con anima e identità.

---

## 1. Ricognizione e Analisi di Riferimento

Abbiamo condotto un'analisi comparativa approfondita di cinque applicazioni di riferimento note per chiarezza, leggibilità all'aperto e qualità percepita di classe Apple:
1. **Apple Note:** Gerarchia tipografica calma, liste raggruppate (Grouped Lists) con separatori indentati di 0.5px, zero rumore visivo.
2. **Apple Promemoria:** Iconografia quadrata arrotondata piena a colori funzionali (Settings style), contrasti netti, date tabular-nums.
3. **Apple Libri:** Modalità lettura ad alto contrasto per ambienti esterni/sole, margini generosi, tipografia raffinata.
4. **Apple Impostazioni (iOS Settings):** Navigazione traslucida con `backdrop-filter: blur(20px)`, quadratini arrotondati pieni per ogni voce funzionale.
5. **Canzonieri digitali avanzati:** Posizionamento rigido degli accordi sopra la sillaba, evidenziazione del ritornello con barra laterale, trasposizione istantanea.

### Cosa Rende un'App "da Template" (Eliminato con Rigore)
- Colori primari e secondari saturi sparati ovunque contemporaneamente (giallo, azzurro e rosso nello stesso componente).
- Card tutte uguali con bordini colorati o ombre pesanti che affaticano la vista sotto la luce del sole.
- Uso di emoji come icone di sistema o di navigazione.
- Slogan generici di riempimento ("Benvenuto nel Vault", "Archivio magnifico").
- Texture a tela finte, cuciture simulate o bordi tratteggiati decorativi.
- Scatti e ricalcoli di layout (reflow) provocati da animazioni su proprietà geometriche (`width`, `height`, `margin`, `top`).

### Cosa Rende il Vault di Clan un'App "Apple con Anima e Identità"
- **Superfici Neutre e Profondità Fisica:** Sfondo grigio caldo calmo (Livello 0), card e tessere raggruppate bianche a riposo (Livello 1), barre e fogli traslucidi a sfioramento (Livello 2).
- **Il Logo del Gruppo è il Protagonista Assoluto:** Posizionato al centro sulla Targa Bianca opaca con raggio armonico e ombra morbida che sporge dalla fascia fotografica.
- **Cinque Fotografie e Non Una di Più:** Una sola immagine suggestiva per sezione, ottimizzata in WebP responsive (peso complessivo 486.2 KB, sotto il budget di 500 KB), con velo scrim sfumato tinto del viola del logo (`#462679`).
- **Colore con Funzione (Ispirato al Logo):** L'inchiostro dell'app è il viola profondo del logo anziché il nero generico. L'azzurro guida l'interazione e la selezione. I quadratini pieni identificano cromaticamente le sezioni.
- **Movimento Sobrio e Vettoriale:** Nessuna decorazione statica: l'anima scout vive nel "Sentiero" che si disegna sotto il titolo e nella "Bussola" con ago oscillante durante la sincronizzazione.

---

## 2. Il Logo è il Protagonista

Il logo ufficiale del gruppo scout si trova in `assets/favicon.png` (612×582 px, sfondo trasparente) e contiene il giglio scout racchiuso nella corda con nodo piano, gli archi azzurro, rosso e giallo, la sigla AGESCI e la dicitura **"PONTE SAN GIOVANNI 1"** in **viola scuro profondo**.

### Regole d'Uso Inderogabili
1. **Nessun ritocco, deformazione o ricolorazione:** Il logo non viene ricolorato, ruotato né alterato nei suoi elementi costitutivi.
2. **Sempre su Fondo Chiaro / Targa Bianca:** Poiché la scritta viola "PONTE SAN GIOVANNI 1" scompare su fondi scuri o azzurri, il logo appare **esclusivamente su fondo chiaro**. Nel tema scuro resta racchiuso dentro la sua **Targa Bianca** opaca (`--color-targa-bg: oklch(1 0 0)`).
3. **Area di Rispetto $\ge 12\%$:** Spazio libero minimo attorno all'emblema su tutti i quattro lati.

### Versioni Derivate (per Ritaglio, Senza Ridisegno)
- **`logo-completo.png` (540×543 px):** Contiene l'emblema con giglio e corda + la scritta "PONTE SAN GIOVANNI 1". Utilizzato nella Home all'interno del medaglione a targa e in testata alle anteprime A4 del Centro Stampa.
- **`logo-emblema.png` (540×468 px):** Ritaglio del solo cerchio centrale con nodo e giglio (senza testo). Utilizzato nella Top Bar a 28–32px e negli avatar compatti.
- **Icone PWA e Apple Touch Icon:** Generate su sfondo bianco puro solido (`#FFFFFF`), eliminando qualsiasi alone o sfondo azzurro piatto dei template generati.

---

## 3. Le Cinque Fotografie d'Intestazione

L'app impiega esattamente **cinque fotografie di natura e vita scout**, prive di persone identificabili, selezionate con cura e licenziate CC0 / Unsplash (crediti completi in `docs/CREDITS.md`):
1. **Home (`home.webp`):** Vette montane illuminate dal sole al tramonto (Kalen Emsley).
2. **Giochi (`giochi.webp`):** Ampio prato verde collinare per grandi giochi all'aperto (Michael Shannon).
3. **Bans (`bans.webp`):** Fuoco di bivacco serale con braci ardenti e fiamme vive (Kimon Maritz).
4. **Canti (`canti.webp`):** Chitarra acustica e corde vicino alla luce calda (Wes Hicks).
5. **Calendario (`calendario.webp`):** Sentiero battuto nel bosco immerso nella luce (Luca Bravo).

### Specifiche Tecniche e Budget Rigoroso
- **Formato:** WebP moderno compresso a qualità visiva ottimale (70–75).
- **Responsive Sizes:** Generati tagli a 400w, 800w e 1200w serviti tramite `<picture>` e `<source type="image/webp" srcset="..." sizes="...">`.
- **Budget Totale:** **486.2 KB complessivi** (entro il budget inderogabile di $\le 500\text{ KB}$).
- **Precache PWA:** Incluse nelle `globPatterns` del Service Worker di Workbox per funzionamento offline istantaneo al 100%.
- **Velo Scrim di Leggibilità:** Gradiente verticale da `oklch(0.28 0.10 305 / 0.35)` a `oklch(0.18 0.08 305 / 0.88)`, tinto del viola del logo `#462679`. Il testo sovrapposto risulta sempre a contrasto massimo ($\text{Luminanza} = 1.0$, AAA).
- **Regola di Collocazione:** Le fotografie appaiono **esclusivamente nelle testate**, mai dentro le liste o card dei singoli elementi.

---

## 4. Colore con Funzione (Ispirato al Logo)

Tutti i token cromatici sono formulati nello spazio colore percettivo **OKLCH** in `src/styles/tokens.css`.

| Funzione | Token OKLCH (Tema Chiaro) | Token OKLCH (Tema Scuro) | Note e Contrasto |
| :--- | :--- | :--- | :--- |
| **Inchiostro (Ink)** | `oklch(0.28 0.10 305)` | `oklch(0.96 0.01 305)` | Viola profondo del logo, sostituisce il nero |
| **Inchiostro Display** | `oklch(0.25 0.12 305)` | `oklch(0.98 0.01 305)` | Titoli grandi di testata |
| **Azzurro Interattivo** | `oklch(0.53 0.18 245)` | `oklch(0.68 0.16 240)` | Guida per link, tab attiva, pulsante primario |
| **Giochi (Giallo)** | `oklch(0.83 0.18 85)` | `oklch(0.85 0.17 85)` | Glifo **inchiostro scuro** su giallo ($> 10:1$, AAA) |
| **Bans (Rosso)** | `oklch(0.55 0.22 27)` | `oklch(0.64 0.20 27)` | Glifo bianco a contrasto ($> 4.5:1$, AA) |
| **Canti (Azzurro)** | `oklch(0.53 0.18 245)` | `oklch(0.68 0.16 240)` | Glifo bianco a contrasto ($> 4.5:1$, AA) |
| **Calendario (Blu Notte)**| `oklch(0.42 0.15 255)` | `oklch(0.62 0.15 255)` | Glifo bianco a contrasto ($> 6:1$, AAA) |
| **Stampa / Admin** | `oklch(0.48 0.02 260)` | `oklch(0.70 0.015 260)`| Grigio neutro calmo |
| **Targa Logo (Sfondo)** | `oklch(1 0 0)` | `oklch(1 0 0)` | **Bianco puro opaco** in entrambi i temi |

### Regole Funzionali per Sezione
1. **Canzoniere (Canti):** Il ritornello (`.song-chorus-block`) è contrassegnato con una **barra verticale gialla a sinistra** di 4px (`--color-giochi`) e sfondo giallino tenue (`--color-giochi-tenue`). Gli accordi (`.song-chord`) sono resi in **blu notte scuro in grassetto** (`--color-calendario`) con cifre tabulari.
2. **Calendario:** Chip dedicati per tipo di evento (`riunione`: viola tenue, `uscita`: verde bosco tenue, `scadenza`: rosso tenue, `evento`: azzurro tenue, `altro`: neutro). Data a sinistra in blocco tabellare stile calendario da parete (`.calendar-date-block`), con mese su testatina scura e giorno "oggi" in rosso vivo.
3. **Ricerca:** Testo trovato evidenziato con `.search-highlight` (sfondo giallo chiaro scout, testo inchiostro scuro).
4. **Badge "Nuovo":** Pillola giallino scout con testo inchiostro viola.

---

## 5. Profondità Fisica e Materiali

L'interfaccia adotta un modello fisico a tre livelli:
- **Livello 0 — Sfondo Applicazione:** Sfondo grigio caldo calmo (`oklch(0.975 0.006 80)` in chiaro; grigio-viola molto profondo `oklch(0.14 0.015 305)` in scuro).
- **Livello 1 — Tessere e Card a Riposo:** Superfici bianche opache con bordo sottile (`1px solid var(--color-border)`) e ombra subliminale (`--shadow-rest`). Tessere 2×2 in Home con quadratino colorato 36×36px e grande numero indicatore.
- **Livello 2 — Elementi Sospesi e Traslucidi:** Barre di navigazione superiore e inferiore con effetto vetro `backdrop-filter: blur(20px)`, Targa bianca del logo con ombra morbida a sbalzo (`--shadow-targa`), Bottom Sheet che scorre dal basso con maniglia arrotondata e blocco scroll.

---

## 6. Il Movimento Sobrio e Vettoriale (Il Tocco Scout)

### Regole Tecniche
- Si animano **esclusivamente `transform` e `opacity`** (accelerazione GPU hardware su layer composito, zero reflow/layout shift).
- Curva di accelerazione nativa Apple: `cubic-bezier(0.32, 0.72, 0, 1)`.
- Durate standard: `150ms` (tap e touch feedback), `200ms` (toggle e filtri), `280ms` (transizioni vista e toast), `320ms` (bottom sheet).
- Pieno rispetto per `prefers-reduced-motion: reduce`: disattiva ogni moto e traslazione, preservando solo lievi cambi di opacità.

### I Tre Motivi Scout
1. **La Rivelazione della Targa (`targaReveal`):** All'apertura della Home, il medaglione della targa bianca entra con transizione di scala da `0.96` a `1.0` e opacità progressiva in 550ms.
2. **Il Sentiero (`TheTrail`):** Tracciato vettoriale curvo tratteggiato (`stroke-dasharray: 4 4`) a tratto sottile (1.5px) che simula un cammino cartografico, culminante in un punto di sosta giallo scout (`r="3.5"`). Compare sotto il titolo della Home e negli stati vuoti.
3. **La Bussola (`CompassSync`):** Ghiera con i quattro punti cardinali N E S W e ago magnetico bicolore (blu e neutro). Durante il recupero dati, l'ago oscilla armoniosamente tra $-35^\circ$ e $+40^\circ$; a sincronizzazione conclusa si arresta perfettamente al Nord.

---

## 7. Responsività su 7 Viewport e Accessibilità

La suite di test automatizzati con **Playwright** e **Axe-Core** verifica ad ogni build:
- **7 Viewport Testati con Zero Scroll Orizzontale:**
  1. iPhone SE (320×568)
  2. iPhone 13/14/15 (390×844)
  3. iPhone 15 Pro Max (430×932)
  4. Smartphone Orizzontale (844×390)
  5. iPad Verticale (768×1024)
  6. iPad Orizzontale (1024×768)
  7. Desktop Standard (1440×900)
- **Desktop Layout a 2 Colonne:** A partire da 1024px, la Home si suddivide in colonna sinistra (testata fotografica, targa del logo, titolo Clan Duc In Altum, prossimo evento) e colonna destra (ricerca, tessere 2×2, aggiunti di recente, strumenti).
- **Target Tattili:** Minimo $44\times 44\text{ px}$ per tutti i comandi primari e righe interattive.
- **Supporto Zoom 200%:** Rispetto di WCAG 1.4.4 (Resize text) senza sovrapposizione o rottura di riga.
- **Accessibilità WCAG AA:** 0 violazioni critiche o serie rilevate da Axe-Core su tutte le schermate.

---

## 8. Specifiche Componenti Giochi e Bans (Fase 3)

### 8.1 Barra di Ricerca a Pillola e Ordinamento
- **Pill SearchField (`SearchField`):** Campo di ricerca a capsula con icona lente a sinistra, pulsante cancellazione rapida "clear" a destra e debounce di ~200ms.
- **SegmentedControl a 4 Opzioni:** Esattamente 4 opzioni (`A → Z`, `Z → A`, `Recenti`, `Vecchi`).
- **Persistenza in sessionStorage:** Query cercata e ordinamento selezionato persistono al ritorno dalla vista di dettaglio (`giochi_search`, `giochi_sort`, `bans_search`, `bans_sort`).
- **Evidenziazione XSS-Safe (`HighlightText`):**
  - Nessun ricorso a `innerHTML` né parsing HTML insicuro.
  - Testo suddiviso in Virtual DOM Preact VNodes con wrapping dei match in `<mark class="search-highlight">` (sfondo giallo scout `--color-giochi` e testo inchiostro `--color-giochi-text`).
  - Tolleranza ai typo deterministica: parole $<4$ lettere exact match, $4-7$ lettere Levenshtein $\le 1$, $\ge 8$ lettere Levenshtein $\le 2$.
  - Annunciatore `aria-live="polite"` accessibile per screen reader che dichiara il numero di risultati trovati.

### 8.2 Badge e Schede di Dettaglio
- **Badge "Nuovo":** Contrassegno giallo scout con testo scuro per elementi inseriti da meno di 7 giorni (`created_at < 7 days`).
- **Fogli di Dettaglio (`GiocoDetailSheet`, `BanDetailSheet`):** Presentati in BottomSheet con maniglia Apple, separazione netta tra regole/materiali e testo/note gesti.
- **Placeholder Allegati (Fase 5):** Area riservata a schemi e file PDF predisposta per la successiva fase di sviluppo.

### 8.3 Modalità Lettura Bans per Fuochi Serali (`BanReadingMode`)
- Schermo intero ad altissimo contrasto per consultazione al buio o intorno al fuoco.
- Regolazione della dimensione del carattere da 16px a 36px tramite controlli `A-` e `A+` con preferenza salvata in `localStorage`.
- Riquadro note sui gesti (`note_gesti`) con colore dedicato, icona fiamma e bordo di risalto, per distinguere immediatamente le istruzioni sceniche dalle parole cantate.
- Screen Wake Lock API integrata per impedire lo spegnimento dello schermo durante le animazioni serali, con fallback silenzioso se non supportata.

### 8.4 Amministrazione, Duplicati e Doppia Conferma
- **Gating Visivo Rigoroso:** Senza sessione admin attiva verificata tramite RPC `is_admin()`, nessun pulsante o controllo di creazione/modifica/eliminazione compare nell'interfaccia o nel DOM.
- **Segnalazione Morbida Duplicati:** Se il nome inserito ha una distanza di Levenshtein $\le 2$ da un elemento esistente, compare un avviso visivo in giallo che avvisa l'utente senza bloccare il salvataggio.
- **Eliminazione in Due Passaggi (`DeleteConfirmModal`):** Richiede la digitazione esatta del nome completo dell'elemento per abilitare il pulsante rosso "Elimina".


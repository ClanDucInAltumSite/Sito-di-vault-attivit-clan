# Rapporto di Revisione Grafica - FASE 1B (Redesign Apple-Grade)

**Data:** 14 Ottobre 2026  
**Autore:** Antigravity (Advanced Agentic Coding)  
**Applicazione:** Vault Clan - Duc In Altum  
**Branch:** `main`

---

## 1. Obiettivo e Principi Guida

Rifacimento completo dello strato grafico dell'applicazione, superando l'impostazione "da template generato" e adottando il rigore, la sobrietà e la qualità percepita delle applicazioni native Apple (Note, Promemoria, Libri, Impostazioni), arricchito da un tocco scout discreto, dinamico e vettoriale.

### Elementi Eliminati (Anti-pattern da template)
- **Zero emoji utilizzate come icone**: sostituite al 100% da icone SVG inline a tratto sottile (*Lucide style*, `stroke-width: 1.75`).
- **Nessuna texture, cucitura decorativa o bordo tratteggiato**: rimosse tutte le classi `scout-stitch`.
- **Nessuna card colorata uniforme o gradiente pesante**: transizione completa verso superfici neutre e liste raggruppate (*Grouped Table Views*).
- **Nessun colore al di fuori del file token**: eliminati colori hardcoded.

### Principi Apple Adottati
- **Superfici neutre**: bianco caldo e grigio leggero in tema chiaro; grigio profondo nativo iOS in tema scuro (`oklch(0.15 0.01 260)`).
- **Azzurro come colore guida e unico accento**: pulsante primario, indicatori attivi, link.
- **Giallo solo per micro-evidenziazioni**: testi di ricerca, indicatori secondari, punto viaggiante nel sentiero scout (sempre con testo scuro a contrasto >10:1).
- **Rosso riservato a**: azioni distruttive (elimina) e il tag "Oggi" nel calendario.
- **Barre traslucide**: Top Bar e Tab Bar con `backdrop-filter: blur(20px)` e supporto completo alle Safe Area di iOS (`env(safe-area-inset-*)`).
- **Liste raggruppate (iOS Grouped Views)**: blocchi con intestazione di sezione in maiuscolo discreto, separatori interni hairline (1px), chevron a destra e feedback tattile a scala 0.98.
- **Controlli nativi**: Toggle switch (51×31px con scorrimento fluido), Bottom Sheet a comparsa dal basso con maniglia e trappola del focus, Segmented Control a pillola con evidenziatore di selezione.
- **Tipografia**: Carattere variabile **Inter** self-hosted (`public/fonts/inter-latin.woff2`), con supporto a cifre tabulari (`tabular-nums`) per orari, date e BPM.

---

## 2. I Tre Motivi Scout Vettoriali

1. **Logo Reveal (Home/Avvio)**:
   - Appare all'avvio con una transizione di scala fluida (`scale(0.94) -> scale(1)`) e dissolvenza di 450ms.
   - Circondato da un anello di accento delicato a pulsazione morbida (*halo pulse*).
2. **The Trail (Il Sentiero)**:
   - Tracciato vettoriale SVG sottile ad onda sinusoidale con tratteggio `stroke-dasharray`.
   - Un minuscolo punto giallo caldo (`oklch(0.83 0.18 85)`) si muove lungo il percorso collegando l'intestazione alle sezioni.
3. **Bussola di Sincronizzazione**:
   - Widget bussola con ago bicolore (punta nord accento/giallo, punta sud neutra).
   - Durante la sincronizzazione l'ago oscilla delicatamente tra -35° e +40°, posizionandosi fermo verso il Nord (0°) non appena i dati sono allineati.

---

## 3. Matrice di Verifica Reattiva (7 Viewport)

Tutti i test sono stati eseguiti ed automatizzati tramite **Playwright Chromium** in `test/verify_ui.spec.ts`.

| Dispositivo / Viewport | Risoluzione | Scroll Orizzontale | Touch Target (≥44px) | Esito Test | Screenshot Generato |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **iPhone SE** | 320 × 568 | 0 px (Assente) | Rispetta 44px | **PASS** | `docs/design-review/screenshots/home_iphone_se_light.png` |
| **iPhone 13 / 14 / 15** | 390 × 844 | 0 px (Assente) | Rispetta 44px | **PASS** | `docs/design-review/screenshots/home_iphone_13_15_light.png` |
| **iPhone 15 Pro Max** | 430 × 932 | 0 px (Assente) | Rispetta 44px | **PASS** | `docs/design-review/screenshots/home_iphone_max_light.png` |
| **Smartphone Orizzontale** | 844 × 390 | 0 px (Assente) | Rispetta 44px | **PASS** | `docs/design-review/screenshots/home_phone_landscape_light.png` |
| **iPad Verticale** | 768 × 1024 | 0 px (Assente) | Rispetta 44px | **PASS** | `docs/design-review/screenshots/home_ipad_portrait_light.png` |
| **iPad Orizzontale** | 1024 × 768 | 0 px (Assente) | Rispetta 44px | **PASS** | `docs/design-review/screenshots/home_ipad_landscape_light.png` |
| **Desktop Standard** | 1440 × 900 | 0 px (Assente) | Rispetta 44px | **PASS** | `docs/design-review/screenshots/home_desktop_light.png` |

---

## 4. Risultati Accessibilità & Audit Tecnico

- **Axe-core WCAG 2.1 AA**:
  - Home View: **0 violazioni critiche o serie** (PASS).
  - Design System View (`#/design`): **0 violazioni critiche o serie** (PASS).
- **Ridimensionamento e Zoom 200%**:
  - Test simulato a `fontSize: 200%`: layout preservato, 0 sovrapposizioni e 0 overflow orizzontale (`home_zoom_200.png`).
- **Tema Scuro**:
  - Verificato con `prefers-color-scheme: dark`: contrasti AA mantenuti, superfici profonde senza abbagliamento (`home_iphone_dark.png`, `design_iphone_dark.png`).
- **Zero Reflow**:
  - Nessuna animazione tocca proprietà di layout (`width`, `height`, `margin`, `padding`, `top`, `left`). Tutte usano `transform` e `opacity` con curve iOS `cubic-bezier(0.32, 0.72, 0, 1)`.

---

## 5. Comandi di Verifica

```bash
# Esecuzione test unitari e verifica statica token/font/emoji
npm test

# Esecuzione test reattivo Playwright su tutti i 7 viewport + axe-core
npm run verify:ui

# Verifica compilazione e bundle PWA
npm run build
```
Tutti i comandi terminano con exit code `0`.

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

## FASE 1B — Redesign Completo dell'Interfaccia (Apple-Grade)

- [x] **101. Palette Cromatica OKLCH:**
  - Tutti i colori del design system sono definiti in coordinate OKLCH in `src/styles/tokens.css`.
  - Campionamento reale dal logo (`assets/favicon.png`): Azzurro Guida `oklch(0.53 0.18 245)`, Giallo Scout `oklch(0.83 0.18 85)`, Rosso `oklch(0.55 0.22 27)`.
  - Verifica statica automatica: nessun codice colore HEX o RGB hardcoded nei CSS di stile dei componenti (`test/design_system_static.test.ts`).
- [x] **102. Tipografia Inter Self-Hosted:**
  - Font Inter variabile WOFF2 memorizzato localmente in `public/fonts/inter-latin.woff2` e `inter-latin-ext.woff2`.
  - Caricato con `@font-face` e `font-display: swap` in `tokens.css`.
  - Cifre tabulari (`tabular-nums`) per orari, date e BPM.
- [x] **103. Iconografia Vettoriale Inline (Zero Emoji):**
  - Libreria SVG inline a tratto sottile 1.75px (`src/ui/Icon.tsx`).
  - Rimozione totale di qualsiasi emoji da shell di navigazione, bottoni, badge e modali.
  - Verifica statica automatica: zero caratteri emoji nel codice JSX/TSX.
- [x] **104. Tre Motivi Scout Vettoriali (`src/ui/ScoutMotifs.tsx`):**
  - *Logo Reveal*: dissolvenza e transizione morbida di scala all'avvio con alone d'accento pulsante.
  - *The Trail (Il Sentiero)*: linea SVG curva sinusoidale tratteggiata con punto giallo scout animato.
  - *Bussola di Sincronizzazione*: ago bicolore oscillante durante la sincronizzazione attiva e allineato a Nord (0°) a dati sincronizzati.
- [x] **105. Componenti Nativi Apple:**
  - Liste raggruppate (*iOS Grouped Table Views*) con intestazioni e separatori hairline 1px (`src/ui/GroupedList.tsx`, `src/ui/GroupedRow.tsx`).
  - Bottom Sheet a comparsa dal basso con maniglia e trappola del focus (`src/ui/BottomSheet.tsx`).
  - Toggle Switch iOS nativo 51×31px (`src/ui/ToggleSwitch.tsx`).
  - Segmented Control a pillola con evidenziatore di selezione (`src/ui/SegmentedControl.tsx`).
  - Search pill con pulsante di pulizia rapida e gestione Escape (`src/ui/SearchField.tsx`).
  - Barre traslucide con `backdrop-filter: blur(20px)` e supporto completo alle Safe Area di iOS.
- [x] **106. Suite di Verifica Reattiva Playwright (`npm run verify:ui`):**
  - 7 Viewport testati: iPhone SE (320×568), iPhone 13/14/15 (390×844), iPhone 15 Pro Max (430×932), Smartphone Landscape (844×390), iPad Portrait (768×1024), iPad Landscape (1024×768), Desktop Standard (1440×900).
  - Zero overflow orizzontale su tutti i viewport (`scrollWidth <= clientWidth`).
  - Touch target $\ge 44\times 44\text{ px}$ verificati su bottoni e tab bar.
  - Zoom 200% verificato senza rottura del layout o sovrapposizioni.
  - Audit di accessibilità axe-core WCAG 2.1 AA superato con 0 violazioni critiche/serie.
  - Screenshot salvati in `docs/design-review/screenshots/`.
- [x] **107. Pagina Vetrina Design System:**
  - Raggiungibile su `#/design` con showcase interattivo di tutti i token, bottoni, controlli, motivi scout e toggle live del tema chiaro/scuro.
- [x] **108. Audit Visivo Indipendente:**
  - Ispezione indipendente tramite subagent specializzato con esito positivo (PASS su tutti i 6 punti della checklist).

---

## Comandi di Verifica

```bash
# 1. Esecuzione test unitari e controlli statici (11 test)
npm test

# 2. Esecuzione verifica reattiva e accessibilità Playwright (13 test)
npm run verify:ui

# 3. Compilazione TypeScript e build bundle Vite
npm run build
```

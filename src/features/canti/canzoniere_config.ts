/**
 * ==============================================================================
 * CONFIGURAZIONE TIPOGRAFICA E D'IMPAGINAZIONE CANZONIERE (FASE 9)
 * ==============================================================================
 * Tutti i valori geometrici, tipografici, soglie e colori estratti dal documento
 * Word di riferimento "Strade di coraggio - Canzoniere.docx" e dall'immagine
 * ufficiale di confronto.
 *
 * NOTA DECISIONALE (DECISIONS.md):
 * La dimensione base del corpo è impostata a 11 pt (come nel file Word reale e
 * nell'immagine di riferimento). Le regole descrittive storiche indicavano 10 pt,
 * ma la specifica prevalente del file reale adotta 11 pt (22 dxa in Word).
 */

export interface CanzoniereConfig {
  // Specifiche del foglio di stampa
  page: {
    format: 'A4';
    orientation: 'portrait';
    widthMm: number;
    heightMm: number;
    marginTopMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
    marginRightMm: number;
    contentWidthMm: number;
    contentHeightMm: number;
  };

  // Due colonne di testo
  columns: {
    count: 2;
    widthMm: number; // 8.1 cm
    gapMm: number; // Spazio tra le due colonne (170mm - 2*81mm = 8mm)
    separator: {
      widthPt: number;
      style: 'solid';
      color: string;
    };
  };

  // Tipografia e colori
  typography: {
    fontBody: string;
    fontTitle: string;
    fontArrows: string;
    colorText: string;
    colorTitle: string;
    colorMeta: string;
    colorDivider: string;
    baseSizePt: number; // 11 pt base
    minSizePt: number; // 9 pt minimo (-2 pt)
    maxSizePt: number; // 28 pt massimo per riempimento pagina adattivo
    maxSizePtSuona: number; // 24 pt variante Chi suona
    maxSizePtCanta: number; // 28 pt variante Chi canta
    stepPt: number; // 0.5 pt a gradino
    lineHeight: number; // 1.5 interlinea standard (passo 16.5 pt su 11 pt)
    lineStepPt: number; // 16.5 pt passo esatto tra righe a 11 pt
    arrowBaseSizePt: number; // 17 pt per Nova Mono
    arrowWeight: number;
  };

  // Intestazione del canto
  header: {
    title: {
      sizePt: number; // 22 pt
      weight: number; // Bold 700
      textTransform: 'uppercase';
      marginTopPt: number; // 24 pt
      marginBottomPt: number; // 6 pt
      lineHeight: number; // 1.0
      color: string; // #000000
    };
    author: {
      sizePt: number; // 11 pt
      fontStyle: 'italic';
      marginBottomPt: number; // 4 pt
      lineHeight: number; // 1.2
      color: string; // #4A5568
    };
    params: {
      sizePt: number; // 11 pt
      marginBottomPt: number; // 6 pt
      lineHeight: number; // 1.25
      labelWeight: number; // 700
      separatorTabWidthMm: number; // Spaziatura tabulatore tra i parametri
    };
    divider: {
      heightPt: number; // 1.0 pt
      color: string; // #A0A0A0
      marginTopPt: number; // 4 pt
      marginBottomPt: number; // 10 pt
    };
    page2Header: {
      sizePt: number; // 11 pt
      weight: number; // 700
      marginBottomPt: number; // 8 pt
      borderBottomWidthPt: number; // 0.5 pt
    };
  };

  // Soglie algoritmiche del motore di impaginazione
  pagination: {
    // Sforamento massimo per attivare la riduzione a 10.5/10/9.5/9 pt su canto a pagina singola
    smallOverflowMaxLines: number; // es. <= 8 righe
    smallOverflowMaxPercent: number; // es. <= 15% dell'altezza colonna
    // Vincolo quando un blocco sfora l'intera colonna: almeno 3 righe per parte
    minLinesPerBlockSplit: number;
    // Ultima pagina di un canto multi-pagina: bilanciata e mai con meno di 6 righe
    minLinesLastPage: number;
    // Soglia di riempimento pagina per espansione adattiva verso maxSizePt (88%)
    fillTargetPercent: number;
  };
}

export const CANZONIERE_CONFIG: CanzoniereConfig = {
  page: {
    format: 'A4',
    orientation: 'portrait',
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 12,
    marginBottomMm: 12,
    marginLeftMm: 12,
    marginRightMm: 12,
    contentWidthMm: 186, // 210 - 24 = 186 mm
    contentHeightMm: 273, // 297 - 24 = 273 mm
  },

  columns: {
    count: 2,
    widthMm: 89.5, // 89.5 * 2 + 7 = 186 mm
    gapMm: 7,
    separator: {
      widthPt: 0.75, // Linea verticale sottile tra le due colonne
      style: 'solid',
      color: '#000000',
    },
  },

  typography: {
    fontBody: "'Roboto', system-ui, -apple-system, sans-serif",
    fontTitle: "'Roboto', system-ui, -apple-system, sans-serif",
    fontArrows: "'Nova Mono', monospace",
    colorText: '#2D3748',
    colorTitle: '#000000',
    colorMeta: '#4A5568',
    colorDivider: '#A0A0A0',
    baseSizePt: 11, // Base 11 pt
    minSizePt: 10.0, // Minimo 10.0 pt per mantenere ottima leggibilità da leggio (10.0 - 12.5 pt)
    maxSizePt: 12.5, // Massimo 12.5 pt per armonia tipografica editoriale
    maxSizePtSuona: 12.0, // Variante Chi suona (accordi + testo)
    maxSizePtCanta: 12.5, // Variante Chi canta (solo testo)
    stepPt: 0.5, // Passi di 0,5 pt
    lineHeight: 1.5, // Interlinea standard (passo 16.5 pt su 11 pt)
    lineStepPt: 16.5, // Passo proporzionale esatto a 11 pt
    arrowBaseSizePt: 16, // Nova Mono Bold per frecce (↓ ↑)
    arrowWeight: 700,
  },

  header: {
    title: {
      sizePt: 18,
      weight: 700,
      textTransform: 'uppercase',
      marginTopPt: 0, // Niente margine superiore artificiale a inizio foglio
      marginBottomPt: 2,
      lineHeight: 1.1,
      color: '#000000',
    },
    author: {
      sizePt: 9.5,
      fontStyle: 'italic',
      marginBottomPt: 2,
      lineHeight: 1.2,
      color: '#4A5568',
    },
    params: {
      sizePt: 9,
      marginBottomPt: 3,
      lineHeight: 1.2,
      labelWeight: 700,
      separatorTabWidthMm: 10,
    },
    divider: {
      heightPt: 0.5,
      color: '#A0A0A0',
      marginTopPt: 2,
      marginBottomPt: 5,
    },
    page2Header: {
      sizePt: 9.5,
      weight: 700,
      marginBottomPt: 6,
      borderBottomWidthPt: 0.5,
    },
  },

  pagination: {
    smallOverflowMaxLines: 8,
    smallOverflowMaxPercent: 0.15,
    minLinesPerBlockSplit: 3,
    minLinesLastPage: 6,
    fillTargetPercent: 88,
  },
};

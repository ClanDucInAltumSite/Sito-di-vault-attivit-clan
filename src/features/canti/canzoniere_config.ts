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
    maxSizePt: number; // 13 pt massimo per riempimento pagina
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
    marginTopMm: 10, // Margine superiore 1,0 cm
    marginBottomMm: 20, // Margine inferiore 2,0 cm
    marginLeftMm: 20, // Margine sinistro 2,0 cm
    marginRightMm: 20, // Margine destro 2,0 cm
    contentWidthMm: 170, // 210 - 20 - 20 = 170 mm
    contentHeightMm: 267, // 297 - 10 - 20 = 267 mm
  },

  columns: {
    count: 2,
    widthMm: 81, // Due colonne di 8,1 cm ciascuna
    gapMm: 8, // 170 - (81 * 2) = 8 mm
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
    baseSizePt: 11, // Base 11 pt come nel file di riferimento
    minSizePt: 9, // Riduzione massima -2 pt (fino a 9 pt)
    maxSizePt: 13, // Ingrandimento controllato per evitare vuoti (fino a 13 pt)
    stepPt: 0.5, // Passi di 0,5 pt
    lineHeight: 1.5, // Interlinea del corpo 1.5 (passo 16.5 pt su 11 pt)
    lineStepPt: 16.5, // Passo esatto tra righe a 11 pt
    arrowBaseSizePt: 17, // Nova Mono Bold 17 pt per frecce (↓ ↑)
    arrowWeight: 700,
  },

  header: {
    title: {
      sizePt: 22,
      weight: 700,
      textTransform: 'uppercase',
      marginTopPt: 24, // Spazio sopra 24 pt
      marginBottomPt: 6, // Spazio sotto 6 pt
      lineHeight: 1.0,
      color: '#000000',
    },
    author: {
      sizePt: 11,
      fontStyle: 'italic',
      marginBottomPt: 4,
      lineHeight: 1.2,
      color: '#4A5568',
    },
    params: {
      sizePt: 11,
      marginBottomPt: 6,
      lineHeight: 1.25,
      labelWeight: 700,
      separatorTabWidthMm: 12,
    },
    divider: {
      heightPt: 1.0,
      color: '#A0A0A0',
      marginTopPt: 4,
      marginBottomPt: 10,
    },
    page2Header: {
      sizePt: 11,
      weight: 700,
      marginBottomPt: 8,
      borderBottomWidthPt: 0.5,
    },
  },

  pagination: {
    smallOverflowMaxLines: 8,
    smallOverflowMaxPercent: 0.15,
    minLinesPerBlockSplit: 3,
    minLinesLastPage: 6,
    fillTargetPercent: 88, // Se l'altezza colonna è < 88% dell'area utile, scala font fino a maxSizePt
  },
};

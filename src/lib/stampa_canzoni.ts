// src/lib/stampa_canzoni.ts
// Modulo dedicato alla Stampa del Canzoniere A4:
// - Due varianti: "Chi suona" e "Chi canta"
// - Logica RIT. (intero la prima volta, dalla 2a in poi solo etichetta RIT. in grassetto)
// - Indice a inizio canzoniere per settori (Scout, Esterni, Chiesa, Altre) con numeri di pagina reali
// - Persistenza configurazione dedicata in sessionStorage (chiave: stampa_canzoni)

import { Canto, getDb } from './db';
import {
  layoutCanzoniereSong,
  LayoutSongResult,
  layoutCanzoniereFlow,
  CanzonierePage,
} from '../features/canti/canzoniere_layout';

export const SESSION_STORAGE_CANZONI_KEY = 'stampa_canzoni';

export interface StampaCanzoniConfig {
  selectedCantiIds: string[];
  mode: 'suona' | 'canta';
  layoutMode: 'riempi_pagina' | 'compatta';
  includeIndex: boolean;
  includeCover: boolean;
}

export const DEFAULT_STAMPA_CANZONI_CONFIG: StampaCanzoniConfig = {
  selectedCantiIds: [],
  mode: 'suona',
  layoutMode: 'riempi_pagina',
  includeIndex: true,
  includeCover: false,
};

/**
 * Carica la configurazione di stampa canzoni da sessionStorage (o default).
 * Include una migrazione morbida che ignora ed elimina la vecchia chiave 'stampa_selection'.
 */
export function loadStampaCanzoniConfig(): StampaCanzoniConfig {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { ...DEFAULT_STAMPA_CANZONI_CONFIG };
  }
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_CANZONI_KEY);
    if (!raw) return { ...DEFAULT_STAMPA_CANZONI_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      selectedCantiIds: Array.isArray(parsed.selectedCantiIds) ? parsed.selectedCantiIds : [],
      mode: parsed.mode === 'canta' ? 'canta' : 'suona',
      layoutMode: parsed.layoutMode === 'compatta' ? 'compatta' : 'riempi_pagina',
      includeIndex: parsed.includeIndex !== undefined ? Boolean(parsed.includeIndex) : true,
      includeCover: Boolean(parsed.includeCover),
    };
  } catch (_e) {
    return { ...DEFAULT_STAMPA_CANZONI_CONFIG };
  }
}

/**
 * Salva la configurazione di stampa canzoni in sessionStorage.
 */
export function saveStampaCanzoniConfig(config: StampaCanzoniConfig): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_CANZONI_KEY, JSON.stringify(config));
  } catch (_e) {}
}

// ==============================================================================
// 1. REGOLE RIT. E APPLICAZIONE POLITICA (Chi suona vs Chi canta)
// ==============================================================================

/**
 * Normalizza il testo delle liriche di una strofa o ritornello per il confronto semantico:
 * - minuscolo
 * - rimozione accenti/diacritici
 * - rimozione accordi e direttive
 * - rimozione punteggiatura
 * - spazi multipli collassati
 */
export function normalizeLyricsForComparison(text: string): string {
  if (!text) return '';
  return text
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Verifica se una riga è un artefatto da importazione PDF in testa alla pagina (es. "RIT. / RIT:" o "RIT:")
 * senza alcun testo reale associato.
 */
function isArtifactHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  return /^RIT[.:]?\s*(?:\/\s*RIT[.:]?)?$/i.test(trimmed);
}

/**
 * Verifica se una riga è un'indicazione o commento puramente strumentale
 * (intro, outro, strum, pennata o sequenza di soli accordi).
 */
export function isInstrumentalSequence(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Direttive {comment: intro/strum/outro...}
  if (/^\{(?:comment|c):\s*(?:intro|outro|strum|interludio|stacco|assolo|finale|coda|modulazione)/i.test(trimmed)) {
    return true;
  }

  // Commenti con sole sequenze di accordi o frecce (es. {comment: Fa Do Sol} o {comment: ↓ ↓↑})
  const commentMatch = trimmed.match(/^\{(?:comment|c):\s*(.*?)\}$/i);
  if (commentMatch && commentMatch[1]) {
    const inner = commentMatch[1].trim();
    if (/^[↓↑\s]+$/.test(inner)) return true;
    const tokens = inner.split(/[\s,–-]+/).filter(Boolean);
    const chordsOnly = tokens.every(
      (t) =>
        /^(?:Do|Re|Mi|Fa|Sol|La|Si|[A-G])[#b]?(?:m|min|maj7|maj|7|dim|sus4|4|aug|\/[A-Za-z0-9#b]+)?$/i.test(t) ||
        /^[0-9]+(?:\/[0-9]+)?$/.test(t)
    );
    if (tokens.length > 0 && chordsOnly) return true;
  }

  // Righe tra parentesi nel testo come (intro: Fa Do Sol) o (strum: ...) o (outro: ...) o (modulazione in Si)
  if (/^\((?:intro|outro|strum|interludio|stacco|assolo|finale|coda|modulazione)[\s:].*?\)$/i.test(trimmed)) {
    return true;
  }

  // Righe con sole frecce di pennata (es. (↓ ↓↑ ↑↓↑) o simili)
  if (/^[\(]?[↓↑\s,\-]+[\)]?$/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Verifica se una riga è composta esclusivamente da accordi [Accordo] e spazi.
 */
function isChordOnlyLine(line: string): boolean {
  const withoutDirectives = line.replace(/\{[^}]*\}/g, '').trim();
  if (!withoutDirectives) return false;
  // Rimuovi tutti i blocchi [Accordo]
  const lyricsOnly = withoutDirectives.replace(/\[[^\]]*\]/g, '').trim();
  return lyricsOnly.length === 0;
}

/**
 * Applica la politica del Ritornello e la modalità esecutiva ("Chi suona" vs "Chi canta").
 * Funzione pura: non muta l'oggetto originale.
 *
 * Logica comune:
 * - Il ritornello compare per intero la prima volta.
 * - Dalla seconda volta in poi, se il testo normalizzato è identico al ritornello già stampato,
 *   viene sostituito unicamente dall'etichetta grassetto "RIT.".
 * - Se varia (modulazione, strofa diversa o finale esteso), viene trattato come non ripetuto.
 * - Rimuove gli artefatti da importazione PDF ("RIT. / RIT:" isolati in testa).
 *
 * In "Chi suona":
 * - Mantiene tutti gli accordi sopra il testo.
 * - Mantiene intro, outro e sequenze strumentali.
 *
 * In "Chi canta":
 * - Rimuove tutti gli accordi.
 * - Rimuove le righe di soli accordi e le sequenze strumentali (intro, strum, outro, pennata).
 * - Calcola il testo pulito a ingombro ridotto per far entrare più testo per pagina.
 * - Mantiene i metadati di tempo e ritmo riorganizzati in formato compatto.
 */
export function applyRitRepeatPolicy(song: Canto, mode: 'suona' | 'canta'): Canto;
export function applyRitRepeatPolicy(chordproText: string, mode: 'suona' | 'canta'): string;
export function applyRitRepeatPolicy(
  songOrText: Canto | string,
  mode: 'suona' | 'canta'
): Canto | string {
  const isCantoObject = typeof songOrText !== 'string';
  const originalText = isCantoObject ? (songOrText as Canto).testo_chordpro : (songOrText as string);

  const transformedText = transformChordproText(originalText, mode);

  if (!isCantoObject) {
    return transformedText;
  }

  const canto = songOrText as Canto;
  return {
    ...canto,
    testo_chordpro: transformedText,
    ...(mode === 'canta'
      ? {
          capotasto: null,
          tonalita: null,
        }
      : {}),
  };
}

/**
 * Trasforma il testo ChordPro secondo la modalità e le regole del ritornello.
 * - In "suona": NON sostituisce mai i ritornelli ripetuti con RIT. Mantiene tutti i ritornelli
 *   con testo e accordi completi affinché il chitarrista non debba mai voltare pagina all'indietro.
 *   Se nel testo originale ci sono token "RIT." o "RIT:" isolati, vengono ri-espansi con il testo
 *   e gli accordi del ritornello precedente (o rimossi se orfani/senza ritornello precedente).
 *   Non emette mai etichette o diciture "RIT:" o "RIT." che rubano spazio o creano salti pagina orfani.
 * - In "canta": Mantiene la compattazione salvaspazio ("RIT."), ma deduplica rigorosamente
 *   qualsiasi token consecutivo (es. 'RIT. (x2)' anziché 'RIT.' + 'RIT.').
 */
function transformChordproText(rawText: string, mode: 'suona' | 'canta'): string {
  if (!rawText || !rawText.trim()) return '';

  const rawLines = rawText.replace(/\r\n/g, '\n').split('\n');

  // 1. Rimuovi eventuali artefatti di intestazione in cima al canto (es. riga "RIT. / RIT:" prima del testo reale)
  let startIdx = 0;
  while (startIdx < rawLines.length) {
    const l = rawLines[startIdx];
    if (l !== undefined && (l.trim() === '' || isArtifactHeaderLine(l))) {
      startIdx++;
    } else {
      break;
    }
  }

  const cleanedRawLines = rawLines.slice(startIdx);

  // 2. Raggruppa le righe in blocchi/stanze
  interface StanzaBlock {
    isChorus: boolean;
    isExplicitChorus: boolean; // marcato con {soc} o RIT:
    isComment: boolean;
    lines: string[];
  }

  const blocks: StanzaBlock[] = [];
  let currentBlock: StanzaBlock = {
    isChorus: false,
    isExplicitChorus: false,
    isComment: false,
    lines: [],
  };

  let inSoc = false;

  for (let i = 0; i < cleanedRawLines.length; i++) {
    const line = cleanedRawLines[i]!;
    const trimmed = line.trim();

    // Riconoscimento {soc} e {eoc}
    if (/^\{(?:soc|start_of_chorus)\}/i.test(trimmed)) {
      if (currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        isChorus: true,
        isExplicitChorus: true,
        isComment: false,
        lines: [],
      };
      inSoc = true;
      continue;
    }

    if (/^\{(?:eoc|end_of_chorus)\}/i.test(trimmed)) {
      inSoc = false;
      if (currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        isChorus: false,
        isExplicitChorus: false,
        isComment: false,
        lines: [],
      };
      continue;
    }

    // Direttive di salto o colonna
    if (/^\{(?:nuova_pagina|np|new_page|nuova_colonna|nc|column_break)\}/i.test(trimmed)) {
      if (currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
      }
      blocks.push({
        isChorus: false,
        isExplicitChorus: false,
        isComment: false,
        lines: [line],
      });
      currentBlock = {
        isChorus: false,
        isExplicitChorus: false,
        isComment: false,
        lines: [],
      };
      continue;
    }

    // Commenti isolati {comment: ...}
    if (/^\{(?:comment|c):/i.test(trimmed) && !inSoc) {
      if (currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
      }
      blocks.push({
        isChorus: false,
        isExplicitChorus: false,
        isComment: true,
        lines: [line],
      });
      currentBlock = {
        isChorus: false,
        isExplicitChorus: false,
        isComment: false,
        lines: [],
      };
      continue;
    }

    // Intestazione RIT: o Ritornello: non racchiusa in {soc}
    const isRitHeader = /^RIT:$/i.test(trimmed) || /^Ritornello:$/i.test(trimmed);
    if (isRitHeader && !inSoc) {
      // Controlla se la riga successiva non vuota è il corpo del ritornello o se RIT: è isolato
      let nextIdx = i + 1;
      while (nextIdx < cleanedRawLines.length && cleanedRawLines[nextIdx]!.trim() === '') {
        nextIdx++;
      }
      const nextLine = nextIdx < cleanedRawLines.length ? cleanedRawLines[nextIdx]!.trim() : '';
      const isNextLineContent =
        nextLine !== '' &&
        !/^RIT[.:]?$/i.test(nextLine) &&
        !/^\{(?:soc|eoc|comment|c|nuova_pagina|np|new_page|nuova_colonna|nc|column_break)/i.test(
          nextLine
        );

      if (isNextLineContent) {
        if (currentBlock.lines.length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          isChorus: true,
          isExplicitChorus: true,
          isComment: false,
          lines: [],
        };
        continue;
      } else {
        // È un token isolato RIT: (shorthand)
        if (currentBlock.lines.length > 0) {
          blocks.push(currentBlock);
        }
        blocks.push({
          isChorus: true,
          isExplicitChorus: true,
          isComment: false,
          lines: ['RIT.'],
        });
        currentBlock = {
          isChorus: false,
          isExplicitChorus: false,
          isComment: false,
          lines: [],
        };
        continue;
      }
    }

    // Etichetta già ridotta RIT. o RIT: isolata
    if (/^RIT[.:]?$/i.test(trimmed) && !inSoc) {
      if (currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
      }
      blocks.push({
        isChorus: true,
        isExplicitChorus: true,
        isComment: false,
        lines: ['RIT.'],
      });
      currentBlock = {
        isChorus: false,
        isExplicitChorus: false,
        isComment: false,
        lines: [],
      };
      continue;
    }

    // Riga vuota di separazione
    if (trimmed === '' && !inSoc) {
      if (currentBlock.lines.length > 0) {
        blocks.push(currentBlock);
        currentBlock = {
          isChorus: false,
          isExplicitChorus: false,
          isComment: false,
          lines: [],
        };
      }
      continue;
    }

    currentBlock.lines.push(line);
  }

  if (currentBlock.lines.length > 0) {
    blocks.push(currentBlock);
  }

  // 3. Identifica i ritornelli ed applica la politica specifica per modalità
  const seenChorusLyrics: string[] = [];
  const seenChorusRawLines: string[][] = [];
  const processedBlocks: string[][] = [];

  for (const block of blocks) {
    // 3a. Commenti o direttive
    if (block.isComment) {
      if (mode === 'canta') {
        const line = block.lines[0] || '';
        if (
          isInstrumentalSequence(line) ||
          /^\{(?:comment|c):\s*(?:intro|outro|strum|interludio|stacco|assolo|finale|coda|modulazione)/i.test(
            line.trim()
          )
        ) {
          // In modalità canta eliminiamo commenti strumentali e modulazioni
          continue;
        }
      }
      processedBlocks.push(block.lines);
      continue;
    }

    // 3b. Se è un blocco speciale con solo una direttiva {nuova_pagina} o {nuova_colonna}
    if (
      block.lines.length === 1 &&
      /^\{(?:nuova_pagina|np|new_page|nuova_colonna|nc|column_break)\}/i.test(block.lines[0]?.trim() || '')
    ) {
      processedBlocks.push(block.lines);
      continue;
    }

    // 3c. Se è un'etichetta "RIT." o "RIT:" isolata nel testo sorgente
    if (block.lines.length === 1 && /^RIT[.:]?$/i.test(block.lines[0]?.trim() || '')) {
      if (mode === 'suona') {
        // PER CHI SUONA: riespandi il ritornello precedente con testo e accordi completi!
        if (seenChorusRawLines.length > 0) {
          const prevChorus = seenChorusRawLines[seenChorusRawLines.length - 1]!;
          const cleanPrev = prevChorus.filter((l) => !/^RIT[.:]?$/i.test(l.trim()));
          if (cleanPrev.length > 0) {
            processedBlocks.push(['{soc}', ...cleanPrev, '{eoc}']);
          }
        }
      } else {
        // PER CHI CANTA: valida solo se esiste un ritornello precedente
        if (seenChorusLyrics.length > 0) {
          processedBlocks.push(['RIT.']);
        }
      }
      continue;
    }

    // Estrai il testo puro delle liriche per la comparazione semantica
    const normalizedLyrics = normalizeLyricsForComparison(block.lines.join(' '));

    // Se il blocco è vuoto o artefatto privo di liriche reali, ignoralo
    if (!normalizedLyrics || isArtifactHeaderLine(normalizedLyrics)) {
      continue;
    }

    // Determina se il blocco è un ritornello:
    // - O è esplicitamente marcato con {soc} o RIT:
    // - O coincide esattamente con un ritornello precedentemente registrato in seenChorusLyrics
    const matchesSeenChorus = seenChorusLyrics.includes(normalizedLyrics);
    const isThisChorus = block.isChorus || matchesSeenChorus;

    if (isThisChorus) {
      if (mode === 'suona') {
        // MODALITÀ "CHI SUONA":
        // I ritornelli NON vengono MAI sostituiti con RIT.
        // Ogni ripetizione conserva testo e tutti gli accordi completi.
        // Rimuoviamo qualsiasi etichetta "RIT:" / "RIT." interna al ritornello.
        const cleanLines = block.lines.filter((l) => !/^RIT[.:]?$/i.test(l.trim()));

        if (!matchesSeenChorus) {
          seenChorusLyrics.push(normalizedLyrics);
          seenChorusRawLines.push(cleanLines);
        }

        if (cleanLines.length > 0) {
          processedBlocks.push(['{soc}', ...cleanLines, '{eoc}']);
        }
      } else {
        // MODALITÀ "CHI CANTA":
        if (matchesSeenChorus) {
          // RITORNELLO RIPETUTO: emetti l'etichetta grassetto "RIT."
          processedBlocks.push(['RIT.']);
        } else {
          // PRIMA VOLTA DEL RITORNELLO: memorizza il testo ed emettilo per intero senza accordi
          seenChorusLyrics.push(normalizedLyrics);

          const linesToEmit: string[] = [];
          for (const l of block.lines) {
            if (isInstrumentalSequence(l) || isChordOnlyLine(l)) continue;
            // Rimuovi tutti gli accordi [Accordo]
            const clean = l.replace(/\[[^\]]*\]/g, '');
            if (clean.trim() || clean === '') linesToEmit.push(clean);
          }

          if (linesToEmit.length > 0) {
            const firstLineTrimmed = linesToEmit[0]?.trim() || '';
            const hasInnerRitLabel = /^RIT[.:]?$/i.test(firstLineTrimmed);
            const bodyLines = hasInnerRitLabel ? linesToEmit.slice(1) : linesToEmit;

            processedBlocks.push(['{soc}', ...bodyLines, '{eoc}']);
          }
        }
      }
    } else {
      // 3d. Strofa normale
      const linesToEmit: string[] = [];
      for (const l of block.lines) {
        if (mode === 'canta') {
          if (isInstrumentalSequence(l) || isChordOnlyLine(l)) continue;
          // Rimuovi tutti gli accordi [Accordo]
          const clean = l.replace(/\[[^\]]*\]/g, '');
          linesToEmit.push(clean);
        } else {
          linesToEmit.push(l);
        }
      }

      if (linesToEmit.length > 0 && linesToEmit.some((x) => x.trim())) {
        processedBlocks.push(linesToEmit);
      }
    }
  }

  // 4. Assembla i blocchi separati da riga vuota, con DEDUPLICAZIONE RIGOROSA dei token RIT
  const resultLines: string[] = [];

  for (let i = 0; i < processedBlocks.length; i++) {
    const bLines = processedBlocks[i]!;
    if (bLines.length === 0) continue;

    if (mode === 'canta') {
      // Se il blocco attuale è un'etichetta RIT. (es. ['RIT.'])
      const isCurrentRit =
        bLines.length === 1 && /^RIT[.:]?(\s*\(x\d+\))?$/i.test(bLines[0]?.trim() || '');

      if (isCurrentRit) {
        // Cerca l'ultima riga non vuota già inserita in resultLines
        let lastNonEmptyIdx = -1;
        for (let j = resultLines.length - 1; j >= 0; j--) {
          if (resultLines[j]!.trim() !== '') {
            lastNonEmptyIdx = j;
            break;
          }
        }

        if (lastNonEmptyIdx >= 0) {
          const lastLine = resultLines[lastNonEmptyIdx]!.trim();
          const isPrevRit = /^RIT[.:]?(\s*\(x\d+\))?$/i.test(lastLine);

          if (isPrevRit) {
            // Se la riga precedente era già "RIT.", promuovi a "RIT. (x2)", "RIT. (x3)", ecc.
            const match = lastLine.match(/^RIT[.:]?\s*\(x(\d+)\)$/i);
            if (match && match[1]) {
              const count = parseInt(match[1], 10) + 1;
              resultLines[lastNonEmptyIdx] = `RIT. (x${count})`;
            } else {
              resultLines[lastNonEmptyIdx] = 'RIT. (x2)';
            }
            continue;
          }
        }
      }
    }

    if (resultLines.length > 0) {
      const prevLast = resultLines[resultLines.length - 1]?.trim() || '';
      // Non aggiungere doppia riga vuota
      if (prevLast !== '') {
        resultLines.push('');
      }
    }

    resultLines.push(...bLines);
  }

  // In modalità suona, garantiamo che nessuna riga sia un'etichetta isolata RIT. o RIT: (anche con moltiplicatore)
  if (mode === 'suona') {
    return resultLines
      .filter((l) => !/^RIT[.:]?(\s*\(x\d+\))?$/i.test(l.trim()))
      .join('\n');
  }

  return resultLines.join('\n');
}

// ==============================================================================
// 2. ORDINAMENTO E INDICE PER SETTORI DEL CANZONIERE
// ==============================================================================

export type CanzoniereSectorKey = 'scout' | 'esterni' | 'chiesa' | 'altre';

export interface CanzoniereIndexEntry {
  id: string;
  titolo: string;
  autore: string | null;
  categoria: CanzoniereSectorKey;
  startPage: number;
  pageCount: number;
  otherModePage?: number;
}

export interface CanzoniereSectorGroup {
  key: CanzoniereSectorKey;
  label: string;
  entries: CanzoniereIndexEntry[];
}

export interface CanzoniereIndexPage {
  pageNumber: number;
  isFirstIndexPage: boolean;
  sectors: CanzoniereSectorGroup[];
}

export interface CanzoniereIndexResult {
  hasCover: boolean;
  coverPage: number | null;
  indexPageStart: number;
  indexPageCount: number;
  sectors: CanzoniereSectorGroup[];
  indexPages: CanzoniereIndexPage[];
  totalPages: number;
}

/**
 * Normalizza il titolo per l'ordinamento alfabetico:
 * - ignora articoli iniziali italiani (il, lo, la, i, gli, le, l', un, uno, una)
 * - ignora maiuscole e accenti
 */
export function normalizeTitleForSort(title: string): string {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(?:il|lo|la|i|gli|le|un|uno|una|l')\s+/i, '')
    .replace(/^l'/i, '')
    .trim();
}

/**
 * Mappa la categoria del canto nella chiave del settore canzoniere.
 */
export function getSectorKey(categoria?: string | null): CanzoniereSectorKey {
  if (categoria === 'scout') return 'scout';
  if (categoria === 'esterni') return 'esterni';
  if (categoria === 'chiesa') return 'chiesa';
  return 'altre';
}

/**
 * Etichetta leggibile del settore.
 */
export const SECTOR_LABELS: Record<CanzoniereSectorKey, string> = {
  scout: 'Canzoni scout',
  esterni: 'Canzoni esterne',
  chiesa: 'Canzoni di chiesa',
  altre: 'Altre canzoni',
};

/**
 * Ordina un elenco di canti rigorosamente secondo l'ordine dei 4 settori:
 * 1. Scout
 * 2. Esterni
 * 3. Chiesa
 * 4. Altre
 * E all'interno di ciascun settore, in ordine alfabetico (senza articoli).
 */
export function sortSongsBySector(songs: Canto[]): Canto[] {
  const sectorOrder: Record<CanzoniereSectorKey, number> = {
    scout: 1,
    esterni: 2,
    chiesa: 3,
    altre: 4,
  };

  return [...songs].sort((a, b) => {
    const secA = sectorOrder[getSectorKey(a.categoria)];
    const secB = sectorOrder[getSectorKey(b.categoria)];

    if (secA !== secB) {
      return secA - secB;
    }

    const normA = normalizeTitleForSort(a.titolo);
    const normB = normalizeTitleForSort(b.titolo);
    return normA.localeCompare(normB, 'it');
  });
}

/**
 * Calcola l'Indice del Canzoniere con i numeri di pagina reali DOPO l'impaginazione.
 *
 * Sequenza fogli:
 * - Copertina (se attiva): Pagina 1
 * - Indice (se attivo): Pagina 2 (o Pagina 1 se no copertina), 1 o più pagine
 * - Canzoni nell'ordine dei settori, ognuna con la propria numerazione effettiva
 */
export function calculateCanzoniereIndex(
  songsWithLayout: Array<{ canto: Canto; pageCount: number }>,
  hasCover: boolean,
  includeIndex: boolean,
  otherModePagesMap?: Map<string, number>,
  actualStartPagesMap?: Map<string, number>,
  totalContentPagesCount?: number
): CanzoniereIndexResult {
  // 1. Raggruppa le canzoni per settore
  const grouped: Record<CanzoniereSectorKey, Array<{ canto: Canto; pageCount: number }>> = {
    scout: [],
    esterni: [],
    chiesa: [],
    altre: [],
  };

  for (const item of songsWithLayout) {
    const sKey = getSectorKey(item.canto.categoria);
    grouped[sKey].push(item);
  }

  // Ordina alfabeticamente all'interno di ogni settore
  for (const sKey of ['scout', 'esterni', 'chiesa', 'altre'] as CanzoniereSectorKey[]) {
    grouped[sKey].sort((a, b) => {
      const normA = normalizeTitleForSort(a.canto.titolo);
      const normB = normalizeTitleForSort(b.canto.titolo);
      return normA.localeCompare(normB, 'it');
    });
  }

  // 2. Calcola quante pagine occupa l'indice
  // Circa 34 righe per pagina A4 (1 riga titolo settore + 1 riga voce canto)
  const MAX_ROWS_PER_INDEX_PAGE = 34;
  let totalIndexRows = 0;
  for (const sKey of ['scout', 'esterni', 'chiesa', 'altre'] as CanzoniereSectorKey[]) {
    if (grouped[sKey].length > 0) {
      totalIndexRows += 1 + grouped[sKey].length; // 1 intestazione settore + voci
    }
  }

  let indexPageCount = 0;
  if (includeIndex && songsWithLayout.length > 0) {
    indexPageCount = Math.max(1, Math.ceil(totalIndexRows / MAX_ROWS_PER_INDEX_PAGE));
  }

  const coverPage = hasCover ? 1 : null;
  const indexPageStart = hasCover ? 2 : 1;
  const firstSongPage = (hasCover ? 1 : 0) + indexPageCount + 1;

  let currentPage = firstSongPage;
  const sectorGroups: CanzoniereSectorGroup[] = [];

  const orderedKeys: CanzoniereSectorKey[] = ['scout', 'esterni', 'chiesa', 'altre'];

  for (const sKey of orderedKeys) {
    const items = grouped[sKey];
    if (items.length === 0) continue; // Settori vuoti non vengono mostrati

    const entries: CanzoniereIndexEntry[] = [];
    for (const item of items) {
      const entryStartPage = actualStartPagesMap && actualStartPagesMap.has(item.canto.id)
        ? actualStartPagesMap.get(item.canto.id)!
        : currentPage;

      entries.push({
        id: item.canto.id,
        titolo: item.canto.titolo,
        autore: item.canto.autore,
        categoria: sKey,
        startPage: entryStartPage,
        pageCount: item.pageCount,
        otherModePage: otherModePagesMap ? otherModePagesMap.get(item.canto.id) : undefined,
      });

      if (!actualStartPagesMap) {
        currentPage += item.pageCount;
      }
    }

    sectorGroups.push({
      key: sKey,
      label: SECTOR_LABELS[sKey],
      entries,
    });
  }

  // 3. Costruisci le singole pagine dell'indice suddivise per foglio A4
  const indexPages: CanzoniereIndexPage[] = [];
  if (includeIndex && sectorGroups.length > 0) {
    let currentPageSectors: CanzoniereSectorGroup[] = [];
    let rowsInCurrentPage = 0;

    for (const sec of sectorGroups) {
      let remainingEntries = [...sec.entries];

      while (remainingEntries.length > 0) {
        const rowsAvailable = MAX_ROWS_PER_INDEX_PAGE - rowsInCurrentPage;
        // Se non c'è spazio per almeno il titolo del settore e 1 voce, passa alla nuova pagina
        if (rowsAvailable <= 2 && currentPageSectors.length > 0) {
          indexPages.push({
            pageNumber: indexPageStart + indexPages.length,
            isFirstIndexPage: indexPages.length === 0,
            sectors: currentPageSectors,
          });
          currentPageSectors = [];
          rowsInCurrentPage = 0;
          continue;
        }

        const canTake = Math.min(remainingEntries.length, Math.max(1, rowsAvailable - 1));
        const chunk = remainingEntries.slice(0, canTake);
        remainingEntries = remainingEntries.slice(canTake);

        currentPageSectors.push({
          key: sec.key,
          label: sec.label,
          entries: chunk,
        });

        rowsInCurrentPage += 1 + chunk.length;

        if (rowsInCurrentPage >= MAX_ROWS_PER_INDEX_PAGE && remainingEntries.length > 0) {
          indexPages.push({
            pageNumber: indexPageStart + indexPages.length,
            isFirstIndexPage: indexPages.length === 0,
            sectors: currentPageSectors,
          });
          currentPageSectors = [];
          rowsInCurrentPage = 0;
        }
      }
    }

    if (currentPageSectors.length > 0) {
      indexPages.push({
        pageNumber: indexPageStart + indexPages.length,
        isFirstIndexPage: indexPages.length === 0,
        sectors: currentPageSectors,
      });
    }
  }

  let totalPages = Math.max(1, currentPage - 1);
  if (totalContentPagesCount !== undefined) {
    totalPages = (hasCover ? 1 : 0) + indexPageCount + totalContentPagesCount;
  } else if (actualStartPagesMap && sectorGroups.length > 0) {
    let maxPage = firstSongPage;
    for (const sec of sectorGroups) {
      for (const ent of sec.entries) {
        const lastPage = ent.startPage + Math.max(1, ent.pageCount) - 1;
        if (lastPage > maxPage) maxPage = lastPage;
      }
    }
    totalPages = maxPage;
  }

  return {
    hasCover,
    coverPage,
    indexPageStart,
    indexPageCount,
    sectors: sectorGroups,
    indexPages,
    totalPages,
  };
}

// ==============================================================================
// 3. CARICAMENTO DATI PER LA STAMPA CANZONI
// ==============================================================================

export interface PrintableCanzoniItem {
  canto: Canto;
  appliedCanto: Canto;
  layoutResult: LayoutSongResult;
  pageCount: number;
}

export interface PrintableCanzoniDataset {
  items: PrintableCanzoniItem[];
  pages: CanzonierePage[];
  indexResult: CanzoniereIndexResult;
  hasAnyOverflow: boolean;
}

/**
 * Carica ed elabora l'intero dataset per la stampa del Canzoniere:
 * 1. Recupera i canti da IndexedDB (o da mappa fornita).
 * 2. Li ordina per settore (Scout -> Esterni -> Chiesa -> Altre).
 * 3. Applica la politica RIT. in base a mode ('suona' | 'canta').
 * 4. Calcola il layout A4 continuo a due colonne (layoutCanzoniereFlow).
 * 5. Genera l'indice a inizio canzoniere con numerazione effettiva continua e cross-reference.
 */
export async function loadPrintableCanzoniData(
  config: StampaCanzoniConfig,
  customCantiList?: Canto[]
): Promise<PrintableCanzoniDataset> {
  let allCanti: Canto[] = [];

  if (customCantiList) {
    allCanti = customCantiList;
  } else {
    const db = await getDb();
    allCanti = (await db.getAll('canti')) as Canto[];
  }

  const activeCanti = allCanti.filter((c) => c.deleted_at === null);
  const cantiMap = new Map(activeCanti.map((c) => [c.id, c]));

  // Filtra per ID selezionati
  const selectedCanti: Canto[] = [];
  for (const id of config.selectedCantiIds) {
    const c = cantiMap.get(id);
    if (c) selectedCanti.push(c);
  }

  // 1. Ordina per settore
  const sortedCanti = sortSongsBySector(selectedCanti);

  // 2. Prepara le versioni con politica RIT per modalità attiva e altra modalità
  const appliedCanti = sortedCanti.map((c) => applyRitRepeatPolicy(c, config.mode));
  const otherMode = config.mode === 'suona' ? 'canta' : 'suona';
  const otherAppliedCanti = sortedCanti.map((c) => applyRitRepeatPolicy(c, otherMode));

  // 3. Esegui il layout a flusso continuo per la modalità attiva
  const flowCurrent = layoutCanzoniereFlow(appliedCanti, {
    mode: config.mode,
  });

  // 4. Esegui il layout a flusso continuo per l'altra modalità (per cross-reference)
  const flowOther = layoutCanzoniereFlow(otherAppliedCanti, {
    mode: otherMode,
  });

  // 5. Calcola le pagine dell'indice e gli offset di numerazione
  const MAX_ROWS_PER_INDEX_PAGE = 34;
  const sectorCounts: Record<CanzoniereSectorKey, number> = { scout: 0, esterni: 0, chiesa: 0, altre: 0 };
  for (const c of sortedCanti) {
    sectorCounts[getSectorKey(c.categoria)]++;
  }
  let totalIndexRows = 0;
  for (const sKey of ['scout', 'esterni', 'chiesa', 'altre'] as CanzoniereSectorKey[]) {
    if (sectorCounts[sKey] > 0) {
      totalIndexRows += 1 + sectorCounts[sKey];
    }
  }
  const indexPageCount = (config.includeIndex && sortedCanti.length > 0)
    ? Math.max(1, Math.ceil(totalIndexRows / MAX_ROWS_PER_INDEX_PAGE))
    : 0;

  const pageOffset = (config.includeCover ? 1 : 0) + indexPageCount;
  const otherOffset = (config.includeCover ? 1 : 0) + indexPageCount;

  // 6. Costruisci le mappe di pagina reale iniziale per ciascun canto nel flusso continuo
  const actualStartPagesMap = new Map<string, number>();
  for (const [cantoId, flowPageNum] of flowCurrent.songPageMap.entries()) {
    actualStartPagesMap.set(cantoId, flowPageNum + pageOffset);
  }

  const otherActualStartPagesMap = new Map<string, number>();
  for (const [cantoId, flowPageNum] of flowOther.songPageMap.entries()) {
    otherActualStartPagesMap.set(cantoId, flowPageNum + otherOffset);
  }

  // 7. Calcola per ciascun canto i singoli items e pageCount (per retrocompatibilità)
  const items: PrintableCanzoniItem[] = [];
  for (let i = 0; i < sortedCanti.length; i++) {
    const canto = sortedCanti[i]!;
    const applied = appliedCanti[i]!;
    const layout = layoutCanzoniereSong(applied, {
      mode: config.mode,
      layoutMode: config.layoutMode,
    });
    const realStart = actualStartPagesMap.get(canto.id) || 1;
    layout.pages.forEach((p, pIdx) => {
      p.bookPageNumber = realStart + pIdx;
    });

    items.push({
      canto,
      appliedCanto: applied,
      layoutResult: layout,
      pageCount: layout.declaredPageCount,
    });
  }

  // 8. Calcola l'Indice del Canzoniere sincronizzato con i numeri di pagina reali del flusso continuo
  const songsForIndex = items.map((it) => ({
    canto: it.canto,
    pageCount: it.pageCount,
  }));

  const indexResult = calculateCanzoniereIndex(
    songsForIndex,
    config.includeCover,
    config.includeIndex,
    otherActualStartPagesMap,
    actualStartPagesMap,
    flowCurrent.pages.length
  );

  // 9. Assegna i numeri di pagina libro (bookPageNumber) a ciascuna pagina del flusso continuo
  flowCurrent.pages.forEach((page, pIdx) => {
    page.pageNumber = pIdx + 1;
    page.bookPageNumber = pIdx + 1 + pageOffset;
    page.totalPages = flowCurrent.pages.length + pageOffset;
  });

  return {
    items,
    pages: flowCurrent.pages,
    indexResult,
    hasAnyOverflow: flowCurrent.hasAnyOverflow,
  };
}

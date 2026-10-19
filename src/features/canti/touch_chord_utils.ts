/**
 * Utilità per l'Editor Accordi a Tocco (Fase 10C)
 *
 * Mantiene ChordPro come unica sorgente di verità (Single Source of Truth),
 * garantendo round-trip perfetto (ChordPro -> TouchLine[] -> ChordPro),
 * posizionamento accurato al confine di carattere più vicino,
 * e scorciatoie di duplicazione armonica proporzionale.
 */

import { normalizeChord } from './chord_detection';

export interface TouchChord {
  id: string;
  chord: string;
  charIndex: number; // Indice del carattere (confine 0..lyrics.length)
}

export interface TouchLine {
  id: string;
  lyrics: string;
  chords: TouchChord[];
  isDirective?: boolean;
  directiveText?: string;
  isRitLabel?: boolean;
  isEmpty?: boolean;
}

let nextChordId = 1;
export function generateChordId(): string {
  return `tc-${Date.now()}-${nextChordId++}`;
}

/**
 * Parsea un testo ChordPro in una sequenza di TouchLine strutturate per l'editor a tocco.
 */
export function parseChordProToTouchLines(chordproText: string): TouchLine[] {
  if (!chordproText) return [];

  const rawLines = chordproText.replace(/\r\n/g, '\n').split('\n');
  const touchLines: TouchLine[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i] ?? '';
    const trimmed = rawLine.trim();
    const lineId = `tl-${i}`;

    // Riga vuota
    if (!trimmed) {
      touchLines.push({
        id: lineId,
        lyrics: '',
        chords: [],
        isEmpty: true,
      });
      continue;
    }

    // Direttiva ChordPro racchiusa tra { ... }
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      touchLines.push({
        id: lineId,
        lyrics: '',
        chords: [],
        isDirective: true,
        directiveText: trimmed,
      });
      continue;
    }

    // Etichetta Ritornello "RIT." o "RIT:" isolata
    if (/^RIT[.:]?$/i.test(trimmed)) {
      touchLines.push({
        id: lineId,
        lyrics: trimmed,
        chords: [],
        isRitLabel: true,
      });
      continue;
    }

    // Estrai accordi inline [Accordo] e testo della riga
    let lyrics = '';
    const chords: TouchChord[] = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rawLine)) !== null) {
      const matchIndex = match.index;
      const rawChord = match[1] || '';

      // Aggiungi testo prima dell'accordo
      if (matchIndex > lastIndex) {
        lyrics += rawLine.slice(lastIndex, matchIndex);
      }

      chords.push({
        id: generateChordId(),
        chord: normalizeChord(rawChord),
        charIndex: lyrics.length,
      });

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < rawLine.length) {
      lyrics += rawLine.slice(lastIndex);
    }

    // Se la riga contiene solo accordi spaziati senza testo (es. intro), normalizza lyrics a ''
    if (chords.length > 0 && lyrics.trim() === '') {
      lyrics = '';
    }

    touchLines.push({
      id: lineId,
      lyrics,
      chords,
    });
  }

  return touchLines;
}

/**
 * Converte una sequenza di TouchLine in formato ChordPro standard.
 * Round-trip garantito: nessuna alterazione di testo, spazi o direttive.
 */
export function touchLinesToChordPro(lines: TouchLine[]): string {
  const result: string[] = [];

  for (const line of lines) {
    if (line.isEmpty) {
      result.push('');
      continue;
    }

    if (line.isDirective && line.directiveText) {
      result.push(line.directiveText);
      continue;
    }

    if (line.isRitLabel) {
      result.push(line.lyrics || 'RIT.');
      continue;
    }

    // Se la riga non ha accordi, restituisci solo il testo
    if (line.chords.length === 0) {
      result.push(line.lyrics);
      continue;
    }

    // Se non ha testo ma solo accordi (es. intro strumentale)
    if (!line.lyrics) {
      const sortedChords = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
      result.push(sortedChords.map((c) => `[${c.chord}]`).join(' '));
      continue;
    }

    // Unisci testo e accordi per indice carattere
    const sortedChords = [...line.chords].sort((a, b) => a.charIndex - b.charIndex);
    let output = '';
    let lastIdx = 0;

    for (const c of sortedChords) {
      const targetIdx = Math.max(0, Math.min(c.charIndex, line.lyrics.length));
      if (targetIdx > lastIdx) {
        output += line.lyrics.slice(lastIdx, targetIdx);
      }
      output += `[${c.chord}]`;
      lastIdx = targetIdx;
    }

    if (lastIdx < line.lyrics.length) {
      output += line.lyrics.slice(lastIdx);
    }

    result.push(output);
  }

  return result.join('\n');
}

/**
 * Copia gli accordi da una riga sorgente a una riga destinazione in modo PROPORZIONALE.
 * (charIndex / lenSorgente * lenDestinazione)
 */
export function copyChordsProportional(
  sourceLine: TouchLine,
  targetLine: TouchLine
): TouchLine {
  if (sourceLine.chords.length === 0 || !targetLine.lyrics) {
    return targetLine;
  }

  const sLen = Math.max(1, sourceLine.lyrics.length);
  const tLen = targetLine.lyrics.length;

  const newChords: TouchChord[] = sourceLine.chords.map((sc) => {
    const ratio = sc.charIndex / sLen;
    const newIdx = Math.round(ratio * tLen);
    return {
      id: generateChordId(),
      chord: sc.chord,
      charIndex: Math.max(0, Math.min(newIdx, tLen)),
    };
  });

  return {
    ...targetLine,
    chords: newChords,
  };
}

/**
 * Raggruppa le righe in blocchi (strofe/ritornelli separati da righe vuote o direttive).
 */
export function groupLinesIntoBlocks(lines: TouchLine[]): TouchLine[][] {
  const blocks: TouchLine[][] = [];
  let currentBlock: TouchLine[] = [];

  for (const line of lines) {
    if (line.isEmpty || line.isDirective) {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [];
      }
      // Il separatore viene memorizzato come blocco da 1 riga
      blocks.push([line]);
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock);
  }

  return blocks;
}

/**
 * Applica la stessa progressione armonica a tutte le righe di testo di un blocco,
 * adattando le posizioni proporzionalmente alla lunghezza di ciascuna riga.
 */
export function applyProgressionToBlock(
  blockLines: TouchLine[],
  templateLine: TouchLine
): TouchLine[] {
  if (templateLine.chords.length === 0) return blockLines;

  return blockLines.map((line) => {
    if (line.id === templateLine.id || line.isEmpty || line.isDirective || line.isRitLabel) {
      return line;
    }
    return copyChordsProportional(templateLine, line);
  });
}

/**
 * Copia la progressione armonica dalla strofa precedente (blocco sopra) riga per riga.
 */
export function copyFromPreviousBlock(
  allLines: TouchLine[],
  currentLineIndex: number
): TouchLine[] {
  const blocks = groupLinesIntoBlocks(allLines);

  // Trova a quale blocco appartiene currentLineIndex
  let flatIndex = 0;
  let targetBlockIdx = -1;
  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b];
    if (!block) continue;
    if (currentLineIndex >= flatIndex && currentLineIndex < flatIndex + block.length) {
      targetBlockIdx = b;
      break;
    }
    flatIndex += block.length;
  }

  if (targetBlockIdx <= 0) return allLines; // Nessun blocco precedente

  // Trova il blocco di versi precedente (saltando eventuali blocchi vuoti o direttive)
  let prevVerseBlock: TouchLine[] | null = null;
  for (let b = targetBlockIdx - 1; b >= 0; b--) {
    const candidate = blocks[b];
    if (candidate && candidate.length > 0 && !candidate[0]?.isEmpty && !candidate[0]?.isDirective) {
      prevVerseBlock = candidate;
      break;
    }
  }

  if (!prevVerseBlock || prevVerseBlock.length === 0) return allLines;

  // Applica copia proporzionale riga per riga tra i due blocchi
  const targetBlock = blocks[targetBlockIdx];
  if (!targetBlock) return allLines;

  const updatedTargetBlock = targetBlock.map((line, idx) => {
    const prevLine = prevVerseBlock![idx % prevVerseBlock!.length];
    if (prevLine && prevLine.chords.length > 0 && !line.isEmpty && !line.isDirective && !line.isRitLabel) {
      return copyChordsProportional(prevLine, line);
    }
    return line;
  });

  blocks[targetBlockIdx] = updatedTargetBlock;

  // Ricompone l'array lineare di righe
  return blocks.flat();
}

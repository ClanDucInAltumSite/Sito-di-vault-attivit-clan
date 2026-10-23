/**
 * src/features/canti/image_importer.ts
 * Motore di Analisi e OCR per Immagini di Spartiti e Canzonieri (PNG, JPG, WebP)
 * Converte screenshot di canzonieri (es. Tuttoscout, foto di libretti) in testo ChordPro
 * compattato secondo lo standard del Canzoniere Scout.
 */

import { compactChordProText, normalizeChordName, isChordToken } from './pdf_importer';
import { matchNoiseLine } from './rumore.config';
import { isChordLine } from './chord_detection';

export interface ParsedImageCantoResult {
  titolo: string;
  autore: string | null;
  categoria: 'scout' | 'chiesa' | 'esterni' | null;
  tonalita: string | null;
  misura: string | null;
  tempo_bpm: number | null;
  bpm_testo: string | null;
  ritmo: string | null;
  capotasto: number | null;
  testo_chordpro: string;
  raw_ocr_text: string;
  warnings: Array<{
    tipo: 'info' | 'ocr_warning';
    riga: number;
    testo: string;
    messaggio: string;
  }>;
}

/**
 * Normalizzazione e correzione euristica dei refusi OCR tipici su accordi italiani.
 * Es. 'FR' -> 'FA', '(a' o '1a' -> 'LAm', 'so' o 'Sol.' -> 'SOL'.
 */
export function fixOcrChordLine(line: string): string {
  const tokens = line.split(/(\s+)/);
  const fixed = tokens.map((t) => {
    if (!t.trim()) return t;
    const clean = t.trim().replace(/[.,;:]$/, '');

    // Refusi frequenti OCR su accordi italiani
    if (/^FR$/i.test(clean)) return 'FA';
    if (/^(1a|la-|la\-|lA-|\(a|\[a)$/i.test(clean)) return 'LAm';
    if (/^(so|s0l)$/i.test(clean)) return 'SOL';
    if (/^(mi-|m1-)$/i.test(clean)) return 'MIm';
    if (/^(re-|r3-)$/i.test(clean)) return 'REm';
    if (/^(si-|s1-)$/i.test(clean)) return 'SIm';
    if (/^(do-|d0-)$/i.test(clean)) return 'DOm';
    if (/^(fa-|f4-)$/i.test(clean)) return 'FAm';

    // Se è un accordo valido con trattino o minuscolo, normalizza
    const norm = normalizeChordName(clean);
    if (isChordToken(norm)) {
      return norm;
    }
    return t;
  });

  return fixed.join('');
}

/**
 * Verifica se una riga OCR contiene prevalentemente o unicamente accordi,
 * tabulature o sequenze armoniche da scartare per estrarre solo il testo pulito.
 */
export function isOcrChordLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  // Etichette RIT, strofa o commenti non sono righe di accordi
  if (/^(?:RIT|Ritornello|Coro|Refrain|Strofa|Verse)[\s.:]?/i.test(trimmed)) return false;
  if (/^(?:titolo|autore|tonalità|tempo|ritmo|capotasto|categoria)[:=]/i.test(trimmed)) return false;

  // Intestazioni di intro/strumentale composte solo da accordi
  if (/^(?:intro|strumentale|stacco|outro|finale|bridge)\s*:?\s*(\[?[A-Ga-g0-9#b\-\+/\s|–—\(\)\]]+)$/i.test(trimmed)) {
    return true;
  }

  // Tabulature chitarra (es. e|---2---0---|)
  if (/^[eEaAdDgGbB]?\|[-–—0-9hbp/\s|~xX]+\|?$/.test(trimmed)) return true;

  // Se il detector di accordi rileva la riga come linea di accordi
  if (isChordLine(trimmed, { warnings: [] })) return true;

  // Analisi percentuale token
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const t of tokens) {
    const clean = t.replace(/[.,;:()[\]]/g, '').trim();
    if (!clean) continue;
    if (/^(FR|la-|mi-|re-|si-|so|fa-|do-|sol-|d0|m1|s1|1a)$/i.test(clean)) {
      chordCount++;
    } else {
      const norm = normalizeChordName(clean);
      if (isChordToken(norm)) {
        chordCount++;
      }
    }
  }

  // Se almeno il 50% dei token sono accordi, la riga è musicale
  if (chordCount > 0 && chordCount >= tokens.length * 0.5) {
    return true;
  }

  return false;
}

/**
 * Pulisce una riga di testo rimuovendo accordi tra parentesi quadre o residui di tab.
 */
export function stripChordsFromLyricLine(line: string): string {
  // Rimuovi accordi ChordPro come [DO], [Fa#m], [A], ecc.
  let cleaned = line.replace(/\[[A-Za-z0-9#b\-\+/]+\]/g, '');

  // Rimuovi barre di battuta residue
  cleaned = cleaned.replace(/\s*\|\s*/g, ' ');

  // Normalizza spazi multipli
  return cleaned.replace(/[ \t]+/g, ' ').trim();
}

/**
 * Pulisce il testo OCR grezzo ed estrae ESCLUSIVAMENTE il testo pulito (senza accordi):
 * - Isola il titolo probabile dalla prima riga
 * - Elimina watermark web e diciture copyright
 * - Scarta tutte le righe di accordi e tabulature
 * - Rimuove eventuali accordi tra parentesi quadre
 * - Normalizza i ritornelli (RIT:) e la spaziatura delle strofe
 */
export function processOcrText(
  rawText: string,
  fallbackTitle: string = 'Senza Titolo'
): {
  titolo: string;
  chordProText: string;
  warnings: Array<{ tipo: 'info' | 'ocr_warning'; riga: number; testo: string; messaggio: string }>;
} {
  const warnings: Array<{ tipo: 'info' | 'ocr_warning'; riga: number; testo: string; messaggio: string }> = [];

  // 1. Pulizia preliminare caratteri speciali (NBSP, apostrofi, virgolette) e rimozione righe di rumore
  const cleanedText = rawText
    .replace(/[\u00A0\u202F\u2000-\u200A]/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\t/g, '    ')
    .replace(/[\u2018\u2019\u02BC\u02BB\u00B4`]/g, "'")
    .replace(/[\u201C\u201D\u00AB\u00BB\u201E\u201F]/g, '"');

  const rawLines = cleanedText.split(/\r?\n/).map((l) => l.trimEnd());
  const lines: string[] = [];
  for (const l of rawLines) {
    if (matchNoiseLine(l)) continue;
    lines.push(l);
  }

  // 2. Trova il titolo: prima riga non vuota che non sia un accordo né rumore
  let detectedTitle = '';
  let startIndex = 0;

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const isHdrOrNoise = /^(indice|>|www|copyright|©|\d{4}|canti)/i.test(line);
    const isChordsOnly = isOcrChordLine(line);

    if (!isHdrOrNoise && !isChordsOnly && line.length >= 3 && line.length <= 60) {
      detectedTitle = line.replace(/^[#*>\s]+/, '').replace(/[*#]+$/, '').trim();
      startIndex = i + 1;
      break;
    }
  }

  const finalTitle = detectedTitle || fallbackTitle;

  // 3. Estrai solo il testo delle strofe e ritornelli escludendo le righe di accordi
  const outputLines: string[] = [];
  let prevWasEmpty = false;

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (!prevWasEmpty && outputLines.length > 0) {
        outputLines.push('');
        prevWasEmpty = true;
      }
      continue;
    }

    // Se è una riga di accordi, la scartiamo completamente (richiesta utente per immagini JPG/PNG)
    if (isOcrChordLine(trimmed)) {
      continue;
    }

    // Riconoscimento etichette ritornello
    const ritMatch = trimmed.match(/^(?:RIT|Ritornello|Coro|Refrain)[:.]?\s*(.*)$/i);
    if (ritMatch) {
      outputLines.push('RIT:');
      const restOfLine = ritMatch[1]?.trim();
      if (restOfLine) {
        const cleanRest = stripChordsFromLyricLine(restOfLine);
        if (cleanRest) {
          outputLines.push(cleanRest);
        }
      }
      prevWasEmpty = false;
      continue;
    }

    // Riga di testo normale: rimuovi eventuali accordi inline residui
    const cleanLyric = stripChordsFromLyricLine(trimmed);
    if (cleanLyric) {
      outputLines.push(cleanLyric);
      prevWasEmpty = false;
    }
  }

  // Rimuovi eventuali righe vuote iniziali o finali
  while (outputLines.length > 0 && !outputLines[0]?.trim()) {
    outputLines.shift();
  }
  while (outputLines.length > 0 && !outputLines[outputLines.length - 1]?.trim()) {
    outputLines.pop();
  }

  const rawLyrics = outputLines.join('\n');
  const compacted = compactChordProText(rawLyrics);

  return {
    titolo: finalTitle,
    chordProText: compacted,
    warnings,
  };
}

/**
 * Funzione principale per l'analisi OCR di un file immagine (PNG, JPG, WebP).
 */
export async function parseImageCanto(
  imageSource: File | Blob | string | ArrayBuffer,
  fileName: string = 'scansione.png'
): Promise<ParsedImageCantoResult> {
  const { createWorker } = await import('tesseract.js');

  const baseUrl = typeof window !== 'undefined' ? (import.meta.env.BASE_URL || '/') : '/';
  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

  let worker: any;
  if (isBrowser) {
    worker = await createWorker('ita', 1, {
      workerPath: `${baseUrl}tesseract/worker.min.js`,
      corePath: `${baseUrl}tesseract/tesseract-core.wasm.js`,
      langPath: `${baseUrl}tesseract/`,
    });
  } else {
    // In ambiente Node/Vitest
    worker = await createWorker('ita');
  }

  let sourceToRecognize: any = imageSource;
  if (imageSource instanceof ArrayBuffer) {
    sourceToRecognize = Buffer.from(imageSource);
  }

  const ret = await worker.recognize(sourceToRecognize);
  const rawText = ret.data.text || '';
  await worker.terminate();

  const fallbackTitle = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
  const processed = processOcrText(rawText, fallbackTitle);

  return {
    titolo: processed.titolo,
    autore: null,
    categoria: 'scout',
    tonalita: null,
    misura: null,
    tempo_bpm: null,
    bpm_testo: null,
    ritmo: null,
    capotasto: null,
    testo_chordpro: processed.chordProText,
    raw_ocr_text: rawText,
    warnings: processed.warnings,
  };
}

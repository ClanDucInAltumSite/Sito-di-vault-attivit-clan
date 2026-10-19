/**
 * Modulo di Pulizia e Incolla Intelligente del Canzoniere (Fase 10B)
 *
 * Esegue in sequenza:
 * 1. Normalizzazione caratteri (NBSP, spazi sottili, quote tipografiche, trattini di sillabazione)
 * 2. Rimozione righe di rumore web / copia-incolla (da rumore.config.ts)
 * 3. Conversione etichette ([Ritornello], [Strofa 1], conservando RIT. e RIT: come testo)
 * 4. Unione controllata delle righe spezzate dall'impaginazione
 *
 * Tutte le modifiche sono tracciate singolarmente in oggetti CleanerChange,
 * consentendo all'amministratore di annullare qualsiasi modifica nella schermata di revisione.
 */

import { matchNoiseLine } from './rumore.config';
import { isChordLine } from './chord_detection';

export interface CleanerChange {
  id: string;
  type: 'noise' | 'label' | 'join' | 'hyphen';
  lineIndex: number; // 0-based
  description: string;
  originalText: string;
  appliedText: string;
  enabled: boolean;
}

export interface CleanTextResult {
  cleanedText: string;
  cleanedLines: string[];
  originalLines: string[];
  changes: CleanerChange[];
  warnings: string[];
}

/**
 * Normalizza caratteri speciali, spazi non convenzionali e quote tipografiche.
 */
export function normalizeCharacters(text: string): { normalized: string; changes: CleanerChange[] } {
  const changes: CleanerChange[] = [];

  // 1. Spazi unificati, non separabili e zero-width
  // \u00A0 (NBSP), \u202F (Narrow NBSP), \u2000-\u200A (En/Em spaces), \uFEFF (BOM), \u200B (Zero-width space)
  let result = text
    .replace(/[\u00A0\u202F\u2000-\u200A]/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // 2. Tabulazioni -> 4 spazi per allineamento
  result = result.replace(/\t/g, '    ');

  // 3. Apostrofi tipografici -> apostrofo standard '
  result = result.replace(/[\u2018\u2019\u02BC\u02BB\u00B4`]/g, "'");

  // 4. Virgolette tipografiche -> virgolette standard "
  result = result.replace(/[\u201C\u201D\u00AB\u00BB\u201E\u201F]/g, '"');

  // 5. Trattini di sillabazione a fine riga (es. "corag-\ngio" -> "coraggio")
  const hyphenMatches = [...result.matchAll(/([A-Za-zÀ-ÿ]+)-\r?\n([a-zà-ÿ]+)/g)];
  for (let i = 0; i < hyphenMatches.length; i++) {
    const m = hyphenMatches[i];
    if (m && m[1] && m[2]) {
      changes.push({
        id: `hyphen-${i}`,
        type: 'hyphen',
        lineIndex: -1,
        description: `Unita parola sillabata a fine riga: "${m[1]}-" + "${m[2]}"`,
        originalText: `${m[1]}-\n${m[2]}`,
        appliedText: `${m[1]}${m[2]}`,
        enabled: true,
      });
    }
  }
  result = result.replace(/([A-Za-zÀ-ÿ]+)-\r?\n([a-zà-ÿ]+)/g, '$1$2');

  return { normalized: result, changes };
}

/**
 * Pipeline principale di pulizia del testo incollato.
 */
export function cleanPastedText(rawText: string): CleanTextResult {
  const warnings: string[] = [];
  const { normalized, changes: normChanges } = normalizeCharacters(rawText);
  const originalLines = normalized.split(/\r?\n/);
  const changes: CleanerChange[] = [...normChanges];

  // 1. Filtraggio rumore web e riconoscimento etichette riga per riga
  const intermediateLines: { text: string; originalIndex: number; isNoise: boolean }[] = [];

  for (let i = 0; i < originalLines.length; i++) {
    const line = originalLines[i] ?? '';
    const noiseMatch = matchNoiseLine(line);

    if (noiseMatch) {
      const changeId = `noise-${i}`;
      changes.push({
        id: changeId,
        type: 'noise',
        lineIndex: i,
        description: `Rimossa riga di rumore web: "${line.trim()}" (${noiseMatch.description})`,
        originalText: line,
        appliedText: '',
        enabled: true,
      });
      intermediateLines.push({ text: line, originalIndex: i, isNoise: true });
      continue;
    }

    // Conversione etichette ritornello / strofa
    const trimmed = line.trim();

    // Regola specifica: conservare le sigle "RIT." e "RIT:" come testo quando sono già così
    if (/^RIT[.:]?$/i.test(trimmed)) {
      intermediateLines.push({ text: line, originalIndex: i, isNoise: false });
      continue;
    }

    // Conversione etichette tra parentesi quadre o tonde o con due punti
    let convertedLine = line;
    let labelConverted = false;
    let labelDesc = '';

    if (/^\[?\s*(?:ritornello|rit|chorus)\s*\]?:?$/i.test(trimmed)) {
      convertedLine = 'RIT.';
      labelConverted = true;
      labelDesc = `Convertita etichetta ritornello "${trimmed}" in "RIT."`;
    } else if (/^\(?\s*(?:ritornello|rit|chorus)\s*\)?:?$/i.test(trimmed)) {
      convertedLine = 'RIT.';
      labelConverted = true;
      labelDesc = `Convertita etichetta ritornello "${trimmed}" in "RIT."`;
    } else if (/^[\[\(]?\s*(?:strofa|verse)\s*(\d*)\s*[\]\)]?:?$/i.test(trimmed)) {
      const match = trimmed.match(/\d+/);
      const num = match ? ` ${match[0]}` : '';
      convertedLine = `{comment: Strofa${num}}`;
      labelConverted = true;
      labelDesc = `Convertita etichetta strofa "${trimmed}" in direttiva`;
    } else if (/^[\[\(]?\s*(?:bridge|ponte|intro|finale|outro|coda)\s*[\]\)]?:?$/i.test(trimmed)) {
      const sectionName = trimmed.replace(/[\[\]\(\):]/g, '').trim();
      convertedLine = `{comment: ${sectionName}}`;
      labelConverted = true;
      labelDesc = `Convertita etichetta "${trimmed}" in direttiva di sezione`;
    }

    if (labelConverted) {
      changes.push({
        id: `label-${i}`,
        type: 'label',
        lineIndex: i,
        description: labelDesc,
        originalText: line,
        appliedText: convertedLine,
        enabled: true,
      });
      intermediateLines.push({ text: convertedLine, originalIndex: i, isNoise: false });
    } else {
      intermediateLines.push({ text: line, originalIndex: i, isNoise: false });
    }
  }

  // 2. Unione controllata delle righe spezzate dall'impaginazione
  // Condizioni per unione automatica evidente:
  // - La riga A termina SENZA punteggiatura forte (. ! ? : ; ,)
  // - La riga A non è vuota, non è una riga di accordi e non è una direttiva {comment...} o RIT.
  // - La riga B successiva (non noise) inizia con una lettera minuscola [a-zà-ÿ]
  // - La riga B non ha una riga di accordi direttamente sopra
  const activeLines = intermediateLines.filter((l) => !l.isNoise);
  const joinedLines: string[] = [];

  let joinIdx = 0;
  for (let i = 0; i < activeLines.length; i++) {
    const cur = activeLines[i];
    if (!cur) continue;

    const next = activeLines[i + 1];

    const curTrimmed = cur.text.trim();
    const nextTrimmed = next ? next.text.trim() : '';

    // Se cur o next è una riga di accordi o direttiva o RIT, non è una riga di testo spezzata
    const isCurChords = isChordLine(curTrimmed);
    const isNextChords = next ? isChordLine(nextTrimmed) : false;

    // Controlla se riga cur termina senza punteggiatura
    const endsWithoutPunct =
      curTrimmed.length > 0 &&
      !isCurChords &&
      !isNextChords &&
      !/[.!?:\;,]$/.test(curTrimmed) &&
      !curTrimmed.startsWith('{') &&
      !curTrimmed.startsWith('[') &&
      !/^RIT[.:]?$/i.test(curTrimmed);

    const nextStartsLowercase = nextTrimmed.length > 0 && /^[a-zà-ÿ]/.test(nextTrimmed);
    const nextHasInlineChords = /\[[A-Za-z#b0-9/]+\]/.test(nextTrimmed);

    if (endsWithoutPunct && next && nextStartsLowercase && !nextHasInlineChords && !isNextChords) {
      // Unione evidente!
      const mergedText = `${curTrimmed} ${nextTrimmed}`;
      changes.push({
        id: `join-${joinIdx++}`,
        type: 'join',
        lineIndex: cur.originalIndex,
        description: `Unita riga spezzata: "${curTrimmed.slice(0, 30)}..." con riga successiva`,
        originalText: `${cur.text}\n${next.text}`,
        appliedText: mergedText,
        enabled: true,
      });
      joinedLines.push(mergedText);
      i++; // Salta riga B perché incorporata
    } else {
      // Se finisce senza punteggiatura ma non continua in minuscolo, lasciala e segnala warning
      if (endsWithoutPunct && next && nextTrimmed.length > 0 && !/^[A-ZÀ-Ý]/.test(nextTrimmed)) {
        warnings.push(
          `Possibile riga spezzata (riga ${cur.originalIndex + 1}): "${curTrimmed.slice(0, 35)}..." termina senza punteggiatura.`
        );
      }
      joinedLines.push(cur.text);
    }
  }

  return {
    cleanedText: joinedLines.join('\n'),
    cleanedLines: joinedLines,
    originalLines,
    changes,
    warnings,
  };
}

/**
 * Ricostruisce il testo applicando selettivamente solo le modifiche che hanno `enabled === true`.
 * Utilizzato quando l'utente annulla singolarmente una modifica dalla schermata di revisione.
 */
export function reconstructWithActiveChanges(
  originalLines: string[],
  changes: CleanerChange[]
): string[] {
  // Mappa di modifiche attive per lineIndex o id
  const disabledChanges = new Set(changes.filter((c) => !c.enabled).map((c) => c.id));

  // 1. Applica modifiche riga per riga
  const linesAfterNoiseAndLabel: { text: string; origIdx: number; isNoise: boolean }[] = [];

  for (let i = 0; i < originalLines.length; i++) {
    const orig = originalLines[i] ?? '';
    const noiseChange = changes.find((c) => c.lineIndex === i && c.type === 'noise');
    const labelChange = changes.find((c) => c.lineIndex === i && c.type === 'label');

    if (noiseChange && !disabledChanges.has(noiseChange.id)) {
      // Modifica rumore attiva: rimuovi la riga
      linesAfterNoiseAndLabel.push({ text: orig, origIdx: i, isNoise: true });
    } else if (labelChange && !disabledChanges.has(labelChange.id)) {
      // Modifica etichetta attiva: applica conversione
      linesAfterNoiseAndLabel.push({ text: labelChange.appliedText, origIdx: i, isNoise: false });
    } else {
      // Testo originale intatto
      linesAfterNoiseAndLabel.push({ text: orig, origIdx: i, isNoise: false });
    }
  }

  // 2. Applica unione righe se abilitata
  const active = linesAfterNoiseAndLabel.filter((l) => !l.isNoise);
  const result: string[] = [];

  for (let i = 0; i < active.length; i++) {
    const cur = active[i];
    if (!cur) continue;
    const next = active[i + 1];

    const joinChange = changes.find((c) => c.lineIndex === cur.origIdx && c.type === 'join');
    if (joinChange && !disabledChanges.has(joinChange.id) && next) {
      result.push(joinChange.appliedText);
      i++; // Salta successiva
    } else {
      result.push(cur.text);
    }
  }

  return result;
}

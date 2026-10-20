// test/golden_importer.test.ts
// FASE 12E — Risultati Approvati per l'Importazione (Golden Tests)
// Confronta l'output dei parser PDF e Word con i JSON golden approvati.
// Segnala righe diverse, accordi spostati (distanza in caratteri) e metadati cambiati.

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parsePdfCanto } from '../src/features/canti/pdf_importer';
import { parseDocx } from '../src/features/canti/canzoniere_parser';

const ROOT_DIR = process.cwd();
const SYNTHETIC_DIR = path.join(ROOT_DIR, 'test', 'fixtures', 'synthetic');
const SYNTHETIC_GOLDEN_DIR = path.join(ROOT_DIR, 'test', 'fixtures', 'golden');
const RIFERIMENTI_DIR = path.join(ROOT_DIR, '_riferimenti');
const RIFERIMENTI_GOLDEN_DIR = path.join(RIFERIMENTI_DIR, 'golden');

const IS_APPROVE = process.env.GOLDEN_APPROVE === 'true' || process.argv.includes('--approve');

fs.mkdirSync(SYNTHETIC_GOLDEN_DIR, { recursive: true });
if (fs.existsSync(RIFERIMENTI_DIR)) {
  fs.mkdirSync(RIFERIMENTI_GOLDEN_DIR, { recursive: true });
}

/**
 * Estrae gli accordi con la relativa posizione di colonna all'interno di una riga
 */
function extractChordsWithPositions(line: string): { chord: string; index: number }[] {
  const chords: { chord: string; index: number }[] = [];
  const regex = /\[([A-Za-z0-9#b\-\+\/]+)\]/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    chords.push({ chord: match[1], index: match.index });
  }
  return chords;
}

/**
 * Confronta il risultato attuale con il file golden JSON.
 * Restituisce l'elenco delle differenze dettagliate.
 */
function diffWithGolden(
  actual: any,
  goldenPath: string,
  fileName: string
): { isMatch: boolean; report: string[] } {
  const report: string[] = [];

  if (IS_APPROVE || !fs.existsSync(goldenPath)) {
    fs.writeFileSync(goldenPath, JSON.stringify(actual, null, 2), 'utf8');
    report.push(`[APPROVATO] Salvato golden per ${fileName} in ${goldenPath}`);
    return { isMatch: true, report };
  }

  const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

  // 1. Confronto Metadati
  if (actual.titolo !== golden.titolo) {
    report.push(`Titolo modificato: atteso "${golden.titolo}", attuale "${actual.titolo}"`);
  }
  if (actual.autore !== golden.autore) {
    report.push(`Autore modificato: atteso "${golden.autore}", attuale "${actual.autore}"`);
  }
  if (actual.tonalita !== golden.tonalita) {
    report.push(`Tonalità modificata: attesa "${golden.tonalita}", attuale "${actual.tonalita}"`);
  }
  if (actual.misura !== golden.misura) {
    report.push(`Misura modificata: attesa "${golden.misura}", attuale "${actual.misura}"`);
  }
  if (actual.bpm_testo !== golden.bpm_testo) {
    report.push(`BPM modificato: atteso "${golden.bpm_testo}", attuale "${actual.bpm_testo}"`);
  }

  // 2. Confronto Righe e Accordi
  const maxLines = Math.max(actual.lines.length, golden.lines.length);
  for (let i = 0; i < maxLines; i++) {
    const actLine = actual.lines[i] ?? '<FINE TESTO>';
    const goldLine = golden.lines[i] ?? '<FINE TESTO>';

    if (actLine !== goldLine) {
      // Controlla se la differenza è dovuta a uno spostamento di accordo
      const actChords = extractChordsWithPositions(actLine);
      const goldChords = extractChordsWithPositions(goldLine);

      // Rimuovi gli accordi per vedere se il testo dei versi è identico
      const actText = actLine.replace(/\[[^\]]+\]/g, '');
      const goldText = goldLine.replace(/\[[^\]]+\]/g, '');

      if (actText === goldText && actChords.length > 0 && actChords.length === goldChords.length) {
        for (let c = 0; c < actChords.length; c++) {
          if (actChords[c].chord === goldChords[c].chord && actChords[c].index !== goldChords[c].index) {
            const shift = actChords[c].index - goldChords[c].index;
            report.push(
              `Riga ${i + 1}: Accordo [${actChords[c].chord}] spostato di ${Math.abs(shift)} car ` +
              `(${shift > 0 ? 'a destra' : 'a sinistra'}, da col ${goldChords[c].index} a ${actChords[c].index})`
            );
          }
        }
      } else {
        report.push(`Riga ${i + 1} diversa:\n    Atteso:  "${goldLine}"\n    Attuale: "${actLine}"`);
      }
    }
  }

  // 3. Confronto Avvisi
  if ((actual.warnings || []).length !== (golden.warnings || []).length) {
    report.push(`Numero avvisi modificato: attesi ${(golden.warnings || []).length}, attuali ${(actual.warnings || []).length}`);
  }

  return {
    isMatch: report.length === 0,
    report,
  };
}

describe('FASE 12E — Test Golden Risultati Approvati per Importazione', () => {

  describe('Fixture Sintetiche (sempre eseguite, incluse in CI)', () => {
    it('verifica golden DOCX sintetico (canto_sintetico.docx)', async () => {
      const docxPath = path.join(SYNTHETIC_DIR, 'canto_sintetico.docx');
      expect(fs.existsSync(docxPath)).toBe(true);

      const buffer = fs.readFileSync(docxPath);
      const parsed = await parseDocx(buffer);

      const actualGolden = {
        filename: 'canto_sintetico.docx',
        titolo: parsed.titolo,
        autore: parsed.autore,
        categoria: parsed.categoria,
        tonalita: parsed.tonalita,
        misura: parsed.misura,
        bpm_testo: parsed.bpm_testo,
        lines: parsed.testo_chordpro.split('\n'),
        warnings: parsed.warnings,
      };

      const goldenPath = path.join(SYNTHETIC_GOLDEN_DIR, 'canto_sintetico.docx.golden.json');
      const { isMatch, report } = diffWithGolden(actualGolden, goldenPath, 'canto_sintetico.docx');

      if (!isMatch) {
        console.error('Differenze rilevate su canto_sintetico.docx:\n', report.join('\n'));
      }
      expect(isMatch).toBe(true);
    });

    it('verifica golden PDF stampato dall\'app (canto_sintetico_stampato.pdf)', async () => {
      const pdfPath = path.join(SYNTHETIC_DIR, 'canto_sintetico_stampato.pdf');
      expect(fs.existsSync(pdfPath)).toBe(true);

      const buffer = fs.readFileSync(pdfPath);
      const parsed = await parsePdfCanto(buffer);

      const actualGolden = {
        filename: 'canto_sintetico_stampato.pdf',
        titolo: parsed.titolo,
        autore: parsed.autore,
        categoria: parsed.categoria,
        tonalita: parsed.tonalita,
        misura: parsed.misura,
        bpm_testo: parsed.bpm_testo,
        lines: parsed.testo_chordpro.split('\n'),
        warnings: parsed.warnings,
      };

      const goldenPath = path.join(SYNTHETIC_GOLDEN_DIR, 'canto_sintetico_stampato.pdf.golden.json');
      const { isMatch, report } = diffWithGolden(actualGolden, goldenPath, 'canto_sintetico_stampato.pdf');

      if (!isMatch) {
        console.error('Differenze rilevate su canto_sintetico_stampato.pdf:\n', report.join('\n'));
      }
      expect(isMatch).toBe(true);
    });
  });

  describe('File Privati di Riferimento (_riferimenti/ solo in locale, ignorati da Git)', () => {
    const hasRiferimenti = fs.existsSync(RIFERIMENTI_DIR);

    it('confronta tutti i PDF e DOCX in _riferimenti/ con i golden approvati', async () => {
      if (!hasRiferimenti) {
        console.log('Cartella _riferimenti/ non presente (ambiente CI). Test saltato.');
        return;
      }

      const files = fs.readdirSync(RIFERIMENTI_DIR);
      const testableFiles = files.filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

      console.log(`Trovati ${testableFiles.length} file in _riferimenti/ da verificare.`);

      let totalDiffs = 0;
      for (const file of testableFiles) {
        const filePath = path.join(RIFERIMENTI_DIR, file);
        const buffer = fs.readFileSync(filePath);

        let parsed: any;
        if (file.endsWith('.pdf')) {
          parsed = await parsePdfCanto(buffer);
        } else {
          parsed = await parseDocx(buffer);
        }

        const actualGolden = {
          filename: file,
          titolo: parsed.titolo,
          autore: parsed.autore,
          categoria: parsed.categoria,
          tonalita: parsed.tonalita,
          misura: parsed.misura,
          bpm_testo: parsed.bpm_testo,
          lines: parsed.testo_chordpro.split('\n'),
          warnings: parsed.warnings,
        };

        const goldenPath = path.join(RIFERIMENTI_GOLDEN_DIR, `${file}.golden.json`);
        const { isMatch, report } = diffWithGolden(actualGolden, goldenPath, file);

        if (!isMatch) {
          totalDiffs++;
          console.log(`\n--- DIFFERENZE IN ${file} ---`);
          for (const line of report) {
            console.log(`  ${line}`);
          }
        } else {
          console.log(`[PASS] ${file}: conforme al golden approvato.`);
        }
      }

      expect(totalDiffs).toBe(0);
    });
  });

});

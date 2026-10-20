import { describe, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parsePdfCanto } from '../src/features/canti/pdf_importer';

interface DiffDetail {
  lineNum: number;
  pyLine: string;
  tsLine: string;
  chordShiftDistanceChars?: number;
  note: string;
}

async function analyzeAndCompare(pdfName: string, jsonName?: string) {
  const refDir = path.resolve('_riferimenti');
  const pdfPath = path.join(refDir, pdfName);
  if (!fs.existsSync(pdfPath)) {
    console.log(`[SALTA] File non trovato: ${pdfName}`);
    return;
  }

  const pdfBuf = fs.readFileSync(pdfPath);
  const tsRes = await parsePdfCanto(pdfBuf);

  let pyData: any = null;
  if (jsonName) {
    const jsonPath = path.join(refDir, jsonName);
    if (fs.existsSync(jsonPath)) {
      pyData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))[0];
    }
  }

  console.log('========================================================================');
  console.log(`ANALISI PDF: ${pdfName}`);
  console.log('========================================================================');
  console.log(`Pagine totali: ${tsRes.pageCount}`);
  console.log(`Rilevamento due colonne: ${tsRes.hasColumns ? 'SÌ (2 colonne)' : 'NO (flusso singolo)'}`);
  console.log(`Avvisi generati: ${tsRes.warnings.length}`);
  console.log(`Righe rumore eliminate: ${tsRes.removedNoise.length}`);
  console.log(`Accenti U+FFFD corretti: ${tsRes.accentiCorretti.length}`);

  console.log('\n--- METADATI ESTRATTI ---');
  console.log(`Titolo:     TypeScript = "${tsRes.titolo}" | Python = "${pyData?.titolo ?? 'N/D'}"`);
  console.log(`Autore:     TypeScript = ${JSON.stringify(tsRes.autore)} | Python = "${pyData?.autore ?? 'N/D'}" (Python hardcoded "Canto scout")`);
  console.log(`Tonalità:   TypeScript = ${JSON.stringify(tsRes.tonalita)} | Python = "${pyData?.tonalita ?? 'N/D'}" (Python hardcoded "Do")`);
  console.log(`Misura:     TypeScript = ${JSON.stringify(tsRes.misura)} | Python = "${pyData?.misura ?? 'N/D'}" (Python hardcoded "4/4")`);
  console.log(`BPM:        TypeScript = ${JSON.stringify(tsRes.bpm_testo)} | Python = "${pyData?.bpm_testo ?? 'N/D'}"`);

  if (pyData) {
    const pyLines: string[] = (pyData.testo_chordpro || '').split('\n');
    const tsLines: string[] = tsRes.testo_chordpro.split('\n');

    const maxLines = Math.max(pyLines.length, tsLines.length);
    const diffs: DiffDetail[] = [];

    for (let i = 0; i < maxLines; i++) {
      const p = (pyLines[i] ?? '').trim();
      const t = (tsLines[i] ?? '').trim();

      if (p !== t) {
        let note = '';
        let shiftDist: number | undefined;

        const pNoChords = p.replace(/\[[^\]]+\]/g, '');
        const tNoChords = t.replace(/\[[^\]]+\]/g, '');

        if (p.includes('{comment:') || p.includes('{soc}') || p.includes('{eoc}')) {
          note = 'Python ha inserito direttive artificiali ({comment}/{soc}/{eoc}) assenti nel testo visibile';
        } else if (pNoChords === tNoChords && pNoChords.length > 0) {
          const pChordMatch = p.match(/\[([^\]]+)\]/);
          const tChordMatch = t.match(/\[([^\]]+)\]/);
          const pIndex = pChordMatch ? p.indexOf(pChordMatch[0]) : -1;
          const tIndex = tChordMatch ? t.indexOf(tChordMatch[0]) : -1;
          shiftDist = Math.abs(pIndex - tIndex);
          note = `Accordo [${tChordMatch ? tChordMatch[1] : ''}] riposizionato con regola 1.5 caratteri (distanza: ${shiftDist} car)`;
        } else {
          note = 'Differenza di riga o sequenza colonne';
        }

        diffs.push({
          lineNum: i + 1,
          pyLine: p,
          tsLine: t,
          chordShiftDistanceChars: shiftDist,
          note,
        });
      }
    }

    console.log(`\n--- CONFRONTO RIGHE: ${diffs.length} righe diverse su ${maxLines} ---`);
    for (const d of diffs.slice(0, 15)) {
      console.log(`Riga ${d.lineNum}:`);
      console.log(`  Python:     "${d.pyLine}"`);
      console.log(`  TypeScript: "${d.tsLine}"`);
      console.log(`  Motivo:     ${d.note}`);
    }
    if (diffs.length > 15) {
      console.log(`  ... e altre ${diffs.length - 15} righe.`);
    }
  } else {
    const tsLines: string[] = tsRes.testo_chordpro.split('\n');
    console.log(`\nEstratte ${tsLines.length} righe di testo ChordPro in TypeScript.`);
    console.log('Prime 8 righe:');
    tsLines.slice(0, 8).forEach((l, idx) => console.log(`  ${idx + 1}: "${l}"`));
  }
}

describe('Confronto Completo su tutti i PDF in _riferimenti/', () => {
  const refDir = path.resolve('_riferimenti');
  const hasRef = fs.existsSync(refDir);

  it.skipIf(!hasRef)('esegue e stampa il confronto dettagliato', async () => {
    await analyzeAndCompare('danza_la_vita.pdf', 'danza_la_vita.json');
    console.log('\n\n');
    await analyzeAndCompare('scouting_for_boys.pdf', 'scouting_for_boys.json');
    console.log('\n\n');
    await analyzeAndCompare('Strade di coraggio - Canzoniere - Documenti Google.pdf');
    console.log('\n\n');
    await analyzeAndCompare('Vault Clan - Duc In Altum.pdf');
  }, 30000);
});

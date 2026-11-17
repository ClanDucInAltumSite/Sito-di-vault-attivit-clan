import { test } from '@playwright/test';
import { DEFAULT_PARSED_SONGS } from '../src/data/parsed_songs';
import {
  estimateLineVisualWraps,
  calculateBlockHeightMm,
  groupIntoBlocks,
  parseChordProLine,
} from '../src/features/canti/canzoniere_layout';

test('Confronta altezza matematica stimata vs altezza reale DOM in Chromium', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  // Creiamo nel browser un ambiente di misura identico a @media print
  const comparisons = await page.evaluate((songs) => {
    // Applica stili print
    document.body.setAttribute('data-print', 'canzoni');

    // Crea un container A4 identico alla pagina di stampa
    const pageHost = document.createElement('div');
    pageHost.className = 'canzoniere-page print-song-page';
    pageHost.style.position = 'absolute';
    pageHost.style.top = '0';
    pageHost.style.left = '0';
    pageHost.style.width = '210mm';
    pageHost.style.padding = '12mm';
    pageHost.style.boxSizing = 'border-box';
    pageHost.style.visibility = 'hidden';

    const colContainer = document.createElement('div');
    colContainer.className = 'canzoniere-columns-container is-two-columns';

    const colLeft = document.createElement('div');
    colLeft.className = 'canzoniere-column canzoniere-column-left';

    colContainer.appendChild(colLeft);
    pageHost.appendChild(colContainer);
    document.body.appendChild(pageHost);

    // Mappiamo ogni canzone
    const results: Array<{
      song: string;
      lineComparisons: Array<{
        raw: string;
        lyrics: string;
        isChorus: boolean;
        hasChords: boolean;
        domWraps: number;
        domHeightPx: number;
        domHeightMm: number;
      }>;
    }> = [];

    // Importante: importiamo o simuliamo la funzione CantoLineRenderer DOM
    for (const song of songs) {
      const songResults: (typeof results)[0]['lineComparisons'] = [];
      const lines = song.testo_chordpro.split(/\r?\n/);
      let inChorus = false;

      for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (trimmed === '{soc}') { inChorus = true; continue; }
        if (trimmed === '{eoc}') { inChorus = false; continue; }
        if (!trimmed || trimmed.startsWith('{')) continue;

        // Costruisci il DOM come CantoLineRenderer per modalita 'suona'
        const blockDiv = document.createElement('div');
        blockDiv.className = `canzoniere-block ${inChorus ? 'is-chorus' : ''}`;
        blockDiv.style.fontSize = '11pt';

        // Parsea accordi e testo dalla riga ChordPro
        const chords: Array<{ chord: string; charIndex: number }> = [];
        let lyrics = '';
        let i = 0;
        const clean = rawLine.replace(/\{[^}]*\}/g, '');
        while (i < clean.length) {
          if (clean[i] === '[') {
            const closeIdx = clean.indexOf(']', i);
            if (closeIdx !== -1) {
              chords.push({ chord: clean.slice(i + 1, closeIdx), charIndex: lyrics.length });
              i = closeIdx + 1;
              continue;
            }
          }
          lyrics += clean[i];
          i++;
        }

        const lineDiv = document.createElement('div');
        lineDiv.className = 'canzoniere-line-item canto-screen-line has-chords is-print';
        lineDiv.style.fontSize = '11pt';

        // Mappa accordi per charIndex
        const chordMap = new Map<number, string[]>();
        for (const c of chords) {
          const list = chordMap.get(c.charIndex) || [];
          list.push(c.chord);
          chordMap.set(c.charIndex, list);
        }

        let charIdx = 0;
        while (charIdx < lyrics.length) {
          if (lyrics[charIdx] === ' ') {
            if (chordMap.has(charIdx)) {
              for (const ch of chordMap.get(charIdx)!) {
                const wSpan = document.createElement('span');
                wSpan.className = 'canto-word';
                const uSpan = document.createElement('span');
                uSpan.className = 'canto-unit has-chord is-chord-only';
                const cSpan = document.createElement('span');
                cSpan.className = 'canto-unit-chord song-chord';
                cSpan.textContent = ch;
                const lSpan = document.createElement('span');
                lSpan.className = 'canto-unit-lyric';
                lSpan.textContent = '\u00A0';
                uSpan.appendChild(cSpan);
                uSpan.appendChild(lSpan);
                wSpan.appendChild(uSpan);
                lineDiv.appendChild(wSpan);
              }
            }
            charIdx++;
            continue;
          }

          const wordStart = charIdx;
          while (charIdx < lyrics.length && lyrics[charIdx] !== ' ') {
            charIdx++;
          }
          const wordEnd = charIdx;

          const wordChordIndices: number[] = [];
          for (let pos = wordStart; pos < wordEnd; pos++) {
            if (chordMap.has(pos)) wordChordIndices.push(pos);
          }

          const wSpan = document.createElement('span');
          wSpan.className = 'canto-word';

          if (wordChordIndices.length === 0) {
            const uSpan = document.createElement('span');
            uSpan.className = 'canto-unit';
            const lSpan = document.createElement('span');
            lSpan.className = 'canto-unit-lyric';
            lSpan.textContent = lyrics.slice(wordStart, wordEnd);
            uSpan.appendChild(lSpan);
            wSpan.appendChild(uSpan);
          } else {
            const cutPoints = Array.from(new Set([wordStart, ...wordChordIndices, wordEnd])).sort((a, b) => a - b);
            for (let p = 0; p < cutPoints.length - 1; p++) {
              const pStart = cutPoints[p]!;
              const pEnd = cutPoints[p + 1]!;
              const syl = lyrics.slice(pStart, pEnd);
              const chList = chordMap.get(pStart);
              const uSpan = document.createElement('span');
              uSpan.className = `canto-unit ${chList ? 'has-chord' : ''}`;
              if (chList) {
                const cSpan = document.createElement('span');
                cSpan.className = 'canto-unit-chord song-chord';
                cSpan.textContent = chList[0]!;
                uSpan.appendChild(cSpan);
              }
              const lSpan = document.createElement('span');
              lSpan.className = 'canto-unit-lyric';
              lSpan.textContent = syl || '\u00A0';
              uSpan.appendChild(lSpan);
              wSpan.appendChild(uSpan);
            }
          }
          lineDiv.appendChild(wSpan);
        }

        blockDiv.appendChild(lineDiv);
        colLeft.innerHTML = '';
        colLeft.appendChild(blockDiv);

        const lineRect = lineDiv.getBoundingClientRect();
        const words = Array.from(lineDiv.querySelectorAll('.canto-word'));
        const topOffsets = new Set<number>();
        for (const w of words) {
          const r = w.getBoundingClientRect();
          topOffsets.add(Math.round(r.top / 2) * 2);
        }
        const domWraps = Math.max(1, topOffsets.size);

        songResults.push({
          raw: rawLine,
          lyrics,
          isChorus: inChorus,
          hasChords: chords.length > 0,
          domWraps,
          domHeightPx: lineRect.height,
          domHeightMm: lineRect.height * 0.264583,
        });
      }
      results.push({ song: song.titolo, lineComparisons: songResults });
    }

    document.body.removeChild(pageHost);
    return results;
  }, DEFAULT_PARSED_SONGS);

  console.log('--- CONFRONTO ACCURATEZZA ESTIMATELINEVISUALWRAPS ---');
  let wrapMismatches = 0;
  let heightUnderestimates = 0;

  for (const s of comparisons) {
    for (const l of s.lineComparisons) {
      const parsedSongLine = parseChordProLine(l.raw, 11, 89.5, l.isChorus);
      const estimatedWraps = estimateLineVisualWraps(
        parsedSongLine,
        11,
        89.5,
        l.isChorus,
        'suona'
      );

      // Calcola altezza matematica
      const estimatedPt = estimatedWraps * (11 * 2.14) + 1.5;
      const estimatedMm = estimatedPt * 0.352778;

      if (estimatedWraps !== l.domWraps) {
        wrapMismatches++;
        console.log(
          `[WRAP MISMATCH] Song: "${s.song}" | Chorus: ${l.isChorus} | Est: ${estimatedWraps} vs DOM: ${l.domWraps}`
        );
        console.log(`   Line: "${l.raw}"`);
        console.log(`   DOM Height: ${l.domHeightMm.toFixed(2)} mm vs Est Height: ${estimatedMm.toFixed(2)} mm`);
      } else if (l.domHeightMm > estimatedMm + 0.5) {
        heightUnderestimates++;
        console.log(
          `[HEIGHT UNDERESTIMATE] Song: "${s.song}" | Wraps: ${l.domWraps} | DOM: ${l.domHeightMm.toFixed(2)} mm > Est: ${estimatedMm.toFixed(2)} mm (diff: +${(l.domHeightMm - estimatedMm).toFixed(2)}mm)`
        );
        console.log(`   Line: "${l.raw}"`);
      }
    }
  }

  console.log(`Totale Wrap Mismatches: ${wrapMismatches}`);
  console.log(`Totale Height Underestimates: ${heightUnderestimates}`);
});

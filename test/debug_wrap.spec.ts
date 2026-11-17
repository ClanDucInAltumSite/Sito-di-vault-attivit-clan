import { test } from '@playwright/test';
import { parseLineToScreenWords } from '../src/features/canti/CantoLineRenderer';

test('Debug singola riga per capire perche il DOM wrappa e la stima no', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  const debugInfo = await page.evaluate(() => {
    document.body.setAttribute('data-print', 'canzoni');

    const pageHost = document.createElement('div');
    pageHost.className = 'canzoniere-page print-song-page';
    pageHost.style.position = 'absolute';
    pageHost.style.top = '0';
    pageHost.style.left = '0';
    pageHost.style.width = '186mm';

    const colContainer = document.createElement('div');
    colContainer.className = 'canzoniere-columns-container is-two-columns';

    const colLeft = document.createElement('div');
    colLeft.className = 'canzoniere-column canzoniere-column-left';

    colContainer.appendChild(colLeft);
    pageHost.appendChild(colContainer);
    document.body.appendChild(pageHost);

    // Creiamo il ritornello (.is-chorus)
    const blockDiv = document.createElement('div');
    blockDiv.className = 'canzoniere-block is-chorus';
    blockDiv.style.fontSize = '11pt';

    const lineDiv = document.createElement('div');
    lineDiv.className = 'canzoniere-line-item canto-screen-line has-chords is-print';
    lineDiv.style.fontSize = '11pt';

    // "Se in mezzo alle [Do#m]strade o nella confu[Fa#m]sione"
    // Costruiamo parole come in CantoLineRenderer
    const wordsData = [
      { text: 'Se' },
      { text: 'in' },
      { text: 'mezzo' },
      { text: 'alle' },
      { text: 'strade', chord: 'Do#m' },
      { text: 'o' },
      { text: 'nella' },
      { text: 'confusione', chord: 'Fa#m', chordIdx: 5 }, // confu[Fa#m]sione
    ];

    for (const w of wordsData) {
      const wSpan = document.createElement('span');
      wSpan.className = 'canto-word';
      if (!w.chord) {
        const uSpan = document.createElement('span');
        uSpan.className = 'canto-unit';
        const lSpan = document.createElement('span');
        lSpan.className = 'canto-unit-lyric';
        lSpan.textContent = w.text;
        uSpan.appendChild(lSpan);
        wSpan.appendChild(uSpan);
      } else if (w.chordIdx !== undefined) {
        // confu
        const u1 = document.createElement('span');
        u1.className = 'canto-unit';
        const l1 = document.createElement('span');
        l1.className = 'canto-unit-lyric';
        l1.textContent = w.text.slice(0, w.chordIdx);
        u1.appendChild(l1);
        wSpan.appendChild(u1);
        // [Fa#m]sione
        const u2 = document.createElement('span');
        u2.className = 'canto-unit has-chord';
        const c2 = document.createElement('span');
        c2.className = 'canto-unit-chord song-chord';
        c2.textContent = w.chord;
        const l2 = document.createElement('span');
        l2.className = 'canto-unit-lyric';
        l2.textContent = w.text.slice(w.chordIdx);
        u2.appendChild(c2);
        u2.appendChild(l2);
        wSpan.appendChild(u2);
      } else {
        const uSpan = document.createElement('span');
        uSpan.className = 'canto-unit has-chord';
        const cSpan = document.createElement('span');
        cSpan.className = 'canto-unit-chord song-chord';
        cSpan.textContent = w.chord;
        const lSpan = document.createElement('span');
        lSpan.className = 'canto-unit-lyric';
        lSpan.textContent = w.text;
        uSpan.appendChild(cSpan);
        uSpan.appendChild(lSpan);
        wSpan.appendChild(uSpan);
      }
      lineDiv.appendChild(wSpan);
    }

    blockDiv.appendChild(lineDiv);
    colLeft.appendChild(blockDiv);

    const colRect = colLeft.getBoundingClientRect();
    const blockRect = blockDiv.getBoundingClientRect();
    const lineRect = lineDiv.getBoundingClientRect();
    const words = Array.from(lineDiv.querySelectorAll('.canto-word'));
    const wordRects = words.map((w, idx) => {
      const r = w.getBoundingClientRect();
      const style = window.getComputedStyle(w);
      return {
        text: (w.textContent || '').trim(),
        widthPx: r.width,
        widthPt: r.width * 0.75,
        marginRightPx: style.marginRight,
        leftPx: r.left - blockRect.left,
        topPx: r.top - blockRect.top,
      };
    });

    return {
      colLeftWidthPx: colRect.width,
      colLeftWidthPt: colRect.width * 0.75,
      colLeftWidthMm: colRect.width * 0.264583,
      blockWidthPx: blockRect.width,
      blockWidthPt: blockRect.width * 0.75,
      blockWidthMm: blockRect.width * 0.264583,
      wordRects,
    };
  });

  console.log('--- DEBUG INFO PER LA RIGA ---');
  console.log(`ColLeft width: ${debugInfo.colLeftWidthPx.toFixed(1)}px = ${debugInfo.colLeftWidthPt.toFixed(1)}pt = ${debugInfo.colLeftWidthMm.toFixed(1)}mm`);
  console.log(`Block width: ${debugInfo.blockWidthPx.toFixed(1)}px = ${debugInfo.blockWidthPt.toFixed(1)}pt = ${debugInfo.blockWidthMm.toFixed(1)}mm`);
  let totalCalculatedPt = 0;
  for (const wr of debugInfo.wordRects) {
    console.log(`  Word "${wr.text}": widthPt=${wr.widthPt.toFixed(1)}, mr=${wr.marginRightPx}, leftPx=${wr.leftPx.toFixed(1)}, topPx=${wr.topPx.toFixed(1)}`);
    totalCalculatedPt += wr.widthPt + 3.08; // margin-right
  }
  console.log(`Total line width if 1 line: ${totalCalculatedPt.toFixed(1)} pt vs Block width: ${debugInfo.blockWidthPt.toFixed(1)} pt`);
});

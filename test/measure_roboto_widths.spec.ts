import { test } from '@playwright/test';

test('Misura esatta larghezza caratteri Roboto in Chromium', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(2000);

  const measurements = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Test Roboto regular 11pt = 14.6667px
    ctx.font = '400 14.6667px Roboto, sans-serif';
    const sampleLyrics = "Se in mezzo alle strade o nella confusione un cielo stellato un fuoco e il suo calore";
    const lyricWidthPx = ctx.measureText(sampleLyrics).width;
    const avgLyricCharPx = lyricWidthPx / sampleLyrics.length;
    const avgLyricCharPt = avgLyricCharPx * 0.75;

    // Test Roboto bold 11pt * 0.94 = 13.7867px
    ctx.font = '800 13.7867px Roboto, sans-serif';
    const sampleChords = "Do#m Fa#m Sol#m Lam Sim Reb Dom Mib";
    const chordWidthPx = ctx.measureText(sampleChords).width;
    const avgChordCharPx = chordWidthPx / sampleChords.length;
    const avgChordCharPt = avgChordCharPx * 0.75;

    // Word margin-right: 0.28em * 11pt = 3.08pt
    // Chord padding-right: 0.08em * 11pt * 0.94 = 0.83pt

    return {
      avgLyricCharPt: avgLyricCharPt.toFixed(3),
      ratioLyricToFontSize: (avgLyricCharPt / 11).toFixed(3),
      avgChordCharPt: avgChordCharPt.toFixed(3),
      ratioChordToFontSize: (avgChordCharPt / 11).toFixed(3),
    };
  });

  console.log('MISURE ROBOTO CANVASES:', measurements);
});

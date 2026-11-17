import { test } from '@playwright/test';

test('Verifica font effettivo applicato e larghezza colonna reale in stampa', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(2000);

  // Clicca tutti i checkbox per renderizzare le vere pagine
  const checkboxes = await page.$$('.stampa-song-checkbox');
  for (const cb of checkboxes.slice(0, 5)) {
    if (!(await cb.isChecked())) await cb.click();
  }
  await page.waitForTimeout(1500);

  const fontInfo = await page.evaluate(() => {
    document.body.setAttribute('data-print', 'canzoni');
    const chordSpan = document.querySelector('.canto-unit-chord');
    const lyricSpan = document.querySelector('.canto-unit-lyric');
    const wordSpan = document.querySelector('.canto-word');
    const colLeft = document.querySelector('.canzoniere-column-left');

    return {
      hasChord: Boolean(chordSpan),
      chordFont: chordSpan ? window.getComputedStyle(chordSpan).fontFamily : 'none',
      chordFontSize: chordSpan ? window.getComputedStyle(chordSpan).fontSize : 'none',
      lyricFont: lyricSpan ? window.getComputedStyle(lyricSpan).fontFamily : 'none',
      lyricFontSize: lyricSpan ? window.getComputedStyle(lyricSpan).fontSize : 'none',
      colLeftWidthPx: colLeft ? colLeft.getBoundingClientRect().width : 0,
      colLeftWidthMm: colLeft ? colLeft.getBoundingClientRect().width * 0.264583 : 0,
    };
  });

  console.log('INFO FONT E COLONNA:', fontInfo);
});

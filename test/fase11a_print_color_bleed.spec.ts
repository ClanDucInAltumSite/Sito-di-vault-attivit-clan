import { test, expect } from '@playwright/test';

test.describe('FASE 11A — Regressione: Stili di stampa non devono inquinare le viste a schermo', () => {
  const THEMES = ['dark', 'light'] as const;

  for (const theme of THEMES) {
    test(`I colori calcolati di lettura e dettaglio canti restano identici prima e dopo visita a #/stampa (Tema: ${theme})`, async ({
      page,
    }) => {
      // 1. Inizializza contesto su #/
      await page.goto('#/');
      await page.waitForLoadState('networkidle');

      // 2. Imposta tema e inserisci canto sintetico di test in IndexedDB
      const synthSongData = await page.evaluate(async (selectedTheme) => {
        document.documentElement.setAttribute('data-theme', selectedTheme);
        localStorage.setItem('theme', selectedTheme);

        const DB_NAME = 'vault_scout_db';
        return new Promise<any>((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, 1);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(['canti'], 'readwrite');
            const cStore = tx.objectStore('canti');

            const syntheticSong = [
              '{title: CANTO SINTETICO COLLINA VERDE}',
              '{artist: Autore Sintetico Test}',
              '{tonalita: Sol}',
              '[Sol]Lungo il sentiero sin[Re]tetico cam[Do]miniamo,',
              'questa è una riga pura di solo testo senza accordi,',
              '[Do]mentre la sera scende sul crinale silen[Sol]zioso.',
              '',
              'RIT.',
              '[Sol]Canta con noi la voce [Re]della foresta antica,',
              '[Do]sotto le stelle accese in [Re]mezzo alla radu[Sol]na.',
            ].join('\n');

            const record = {
              id: 'canto-fase11a-color-test',
              titolo: 'CANTO SINTETICO COLLINA VERDE',
              autore: 'Autore Sintetico Test',
              tonalita: 'Sol',
              testo_chordpro: syntheticSong,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              deleted_at: null,
            };

            cStore.put(record);

            tx.oncomplete = () => resolve(record);
            tx.onerror = () => reject(tx.error);
          };
        });
      }, theme);

      // 3. Naviga client-side a #/canti
      await page.evaluate(() => { window.location.hash = '#/canti'; });
      await page.waitForLoadState('networkidle');

      // Attendi che il canto sia presente nell'elenco
      const songItem = page.locator('text=CANTO SINTETICO COLLINA VERDE').first();
      await expect(songItem).toBeVisible({ timeout: 10000 });

      // 4. Apri il dettaglio del canto (CantoDetailSheet) tramite helper
      await page.evaluate((song) => {
        if ((window as any).__openCantoDetail) {
          (window as any).__openCantoDetail(song);
        }
      }, synthSongData);

      const detailSheet = page.locator('.ios-sheet-container').first();
      await expect(detailSheet).toBeVisible({ timeout: 5000 });

      // Registra colori calcolati del DETTAGLIO
      const detailColorsBefore = await page.evaluate(() => {
        const titleEl = document.querySelector('.ios-sheet-title');
        const sheetEl = document.querySelector('.ios-sheet-container');
        const lineEl = document.querySelector('.ios-sheet-container .canzoniere-line-item');
        const chordEl = document.querySelector('.ios-sheet-container .canzoniere-chord-badge');

        return {
          titleColor: titleEl ? window.getComputedStyle(titleEl).color : '',
          backgroundColor: sheetEl ? window.getComputedStyle(sheetEl).backgroundColor : '',
          textColor: lineEl ? window.getComputedStyle(lineEl).color : '',
          chordColor: chordEl ? window.getComputedStyle(chordEl).color : '',
        };
      });

      console.log(`[FASE 11A - ${theme}] Dettaglio Before:`, detailColorsBefore);
      expect(detailColorsBefore.titleColor).not.toBe('');
      expect(detailColorsBefore.textColor).not.toBe('');
      expect(detailColorsBefore.chordColor).not.toBe('');

      // 5. Apri la Modalità Lettura a tutto schermo dal pulsante del Dettaglio
      const readingModeBtn = page.locator('button:has-text("Modalità Lettura")').first();
      await expect(readingModeBtn).toBeVisible({ timeout: 5000 });
      await readingModeBtn.click();

      const readingScrollable = page.locator('.canto-reading-scrollable').first();
      await expect(readingScrollable).toBeVisible({ timeout: 5000 });

      // Registra colori calcolati della LETTURA
      const readingColorsBefore = await page.evaluate(() => {
        const titleEl = document.querySelector('.song-title-display');
        const scrollableEl = document.querySelector('.canto-reading-scrollable');
        const lineEl = document.querySelector('.canto-reading-scrollable .canzoniere-line-item');
        const chordEl = document.querySelector('.canto-reading-scrollable .canzoniere-chord-badge');

        return {
          titleColor: titleEl ? window.getComputedStyle(titleEl).color : '',
          backgroundColor: scrollableEl ? window.getComputedStyle(scrollableEl).backgroundColor : '',
          textColor: lineEl ? window.getComputedStyle(lineEl).color : '',
          chordColor: chordEl ? window.getComputedStyle(chordEl).color : '',
        };
      });

      console.log(`[FASE 11A - ${theme}] Lettura Before:`, readingColorsBefore);
      expect(readingColorsBefore.titleColor).not.toBe('');
      expect(readingColorsBefore.textColor).not.toBe('');
      expect(readingColorsBefore.chordColor).not.toBe('');

      // Chiudi la modalità lettura
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);

      // Chiudi il dettaglio sheet se ancora aperto
      const closeSheetBtn = page.locator('.ios-sheet-close-btn').first();
      if (await closeSheetBtn.isVisible()) {
        await closeSheetBtn.click();
        await page.waitForTimeout(200);
      }

      // 6. Configura selezione per la stampa e naviga client-side a #/stampa
      await page.evaluate(() => {
        const config = {
          selectedGiochiIds: [],
          selectedBansIds: [],
          selectedCantiIds: ['canto-fase11a-color-test'],
          includeImages: false,
          includeCoverAndIndex: false,
        };
        sessionStorage.setItem('stampa_selection', JSON.stringify(config));
        window.location.hash = '#/stampa';
      });

      // Attendi che l'anteprima di stampa sia generata e montata
      await expect(page.locator('.canzoniere-page').first()).toBeAttached({ timeout: 15000 });

      // 7. Emula media: print e torna a screen
      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(300);
      await page.emulateMedia({ media: 'screen' });
      await page.waitForTimeout(300);

      // 8. Torna client-side al canto (#/canti)
      await page.evaluate(() => {
        window.location.hash = '#/canti';
      });

      // Attendi che il canto sia presente nell'elenco
      const songItemAfter = page.locator('text=CANTO SINTETICO COLLINA VERDE').first();
      await expect(songItemAfter).toBeVisible({ timeout: 10000 });

      // Riapri il Dettaglio
      await page.evaluate((song) => {
        if ((window as any).__openCantoDetail) {
          (window as any).__openCantoDetail(song);
        }
      }, synthSongData);

      await expect(page.locator('.ios-sheet-container').first()).toBeVisible({ timeout: 5000 });

      // Verifica colori del DETTAGLIO post-stampa
      const detailColorsAfter = await page.evaluate(() => {
        const titleEl = document.querySelector('.ios-sheet-title');
        const sheetEl = document.querySelector('.ios-sheet-container');
        const lineEl = document.querySelector('.ios-sheet-container .canzoniere-line-item');
        const chordEl = document.querySelector('.ios-sheet-container .canzoniere-chord-badge');

        return {
          titleColor: titleEl ? window.getComputedStyle(titleEl).color : '',
          backgroundColor: sheetEl ? window.getComputedStyle(sheetEl).backgroundColor : '',
          textColor: lineEl ? window.getComputedStyle(lineEl).color : '',
          chordColor: chordEl ? window.getComputedStyle(chordEl).color : '',
        };
      });

      console.log(`[FASE 11A - ${theme}] Dettaglio After:`, detailColorsAfter);
      expect(detailColorsAfter.titleColor).toBe(detailColorsBefore.titleColor);
      expect(detailColorsAfter.backgroundColor).toBe(detailColorsBefore.backgroundColor);
      expect(detailColorsAfter.textColor).toBe(detailColorsBefore.textColor);
      expect(detailColorsAfter.chordColor).toBe(detailColorsBefore.chordColor);

      // 9. Riapri la Modalità Lettura dal dettaglio
      const readingModeBtnAfter = page.locator('button:has-text("Modalità Lettura")').first();
      await readingModeBtnAfter.click();
      await expect(page.locator('.canto-reading-scrollable').first()).toBeVisible({ timeout: 5000 });

      // Verifica colori della LETTURA post-stampa
      const readingColorsAfter = await page.evaluate(() => {
        const titleEl = document.querySelector('.song-title-display');
        const scrollableEl = document.querySelector('.canto-reading-scrollable');
        const lineEl = document.querySelector('.canto-reading-scrollable .canzoniere-line-item');
        const chordEl = document.querySelector('.canto-reading-scrollable .canzoniere-chord-badge');

        return {
          titleColor: titleEl ? window.getComputedStyle(titleEl).color : '',
          backgroundColor: scrollableEl ? window.getComputedStyle(scrollableEl).backgroundColor : '',
          textColor: lineEl ? window.getComputedStyle(lineEl).color : '',
          chordColor: chordEl ? window.getComputedStyle(chordEl).color : '',
        };
      });

      console.log(`[FASE 11A - ${theme}] Lettura After:`, readingColorsAfter);
      expect(readingColorsAfter.titleColor).toBe(readingColorsBefore.titleColor);
      expect(readingColorsAfter.backgroundColor).toBe(readingColorsBefore.backgroundColor);
      expect(readingColorsAfter.textColor).toBe(readingColorsBefore.textColor);
      expect(readingColorsAfter.chordColor).toBe(readingColorsBefore.chordColor);

      // 10. Ripeti verifica dopo una chiamata a window.print()
      await page.evaluate(() => {
        const realPrint = window.print;
        window.print = () => {};
        window.print();
        window.print = realPrint;
      });

      const readingColorsAfterPrintCall = await page.evaluate(() => {
        const titleEl = document.querySelector('.song-title-display');
        const scrollableEl = document.querySelector('.canto-reading-scrollable');
        const lineEl = document.querySelector('.canto-reading-scrollable .canzoniere-line-item');
        const chordEl = document.querySelector('.canto-reading-scrollable .canzoniere-chord-badge');

        return {
          titleColor: titleEl ? window.getComputedStyle(titleEl).color : '',
          backgroundColor: scrollableEl ? window.getComputedStyle(scrollableEl).backgroundColor : '',
          textColor: lineEl ? window.getComputedStyle(lineEl).color : '',
          chordColor: chordEl ? window.getComputedStyle(chordEl).color : '',
        };
      });

      expect(readingColorsAfterPrintCall.titleColor).toBe(readingColorsBefore.titleColor);
      expect(readingColorsAfterPrintCall.backgroundColor).toBe(readingColorsBefore.backgroundColor);
      expect(readingColorsAfterPrintCall.textColor).toBe(readingColorsBefore.textColor);
      expect(readingColorsAfterPrintCall.chordColor).toBe(readingColorsBefore.chordColor);
    });
  }
});

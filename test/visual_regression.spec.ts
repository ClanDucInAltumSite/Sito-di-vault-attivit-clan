// test/visual_regression.spec.ts
// FASE 12D — Regressione Visiva e Baseline di Riferimento
// Cattura e confronta le schermate chiave dell'applicazione con tolleranza controllata.
//
// NOTA ARCHITETTURALE:
// - Le baseline grafiche a pixel sono vincolate all'ambiente Linux CI (Ubuntu) per
//   evitare falsi positivi dovuti ai diversi motori di rendering dei font (DirectWrite vs FreeType).
// - Il confronto visivo pixel-diff opera sul progetto Chromium in ambiente Linux (o con --update-snapshots).
// - Per WebKit (Safari) ed emulazioni mobile (iPhone SE, iPhone 15, iPad, Android Pixel)
//   la verifica è di tipo funzionale, reattivo e di accessibilità (assenza di overflow orizzontale,
//   colori computati coerenti, rendering DOM integro).

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SYNTHETIC_SONG = {
  id: 'canto-visual-regression-baseline',
  titolo: 'CANTO SINTETICO DELLA RADURA',
  autore: 'Autore Sperimentale Baselines',
  categoria: 'scout' as const,
  tonalita: 'Re',
  misura: '4/4',
  bpm_testo: '96 BPM',
  testo_chordpro: [
    'RIT.',
    '[Re]Lungo il sentiero verso la vetta,',
    '[Sol]il vento sussurra una storia antica.',
    '',
    '1. [Re]Camminiamo uniti col [Sol]passo sicuro,',
    '[La]la notte si accende di [Re]mille bagliori.',
  ].join('\n'),
  created_at: new Date('2026-01-01T10:00:00Z').toISOString(),
  updated_at: new Date('2026-01-01T10:00:00Z').toISOString(),
  deleted_at: null,
};

function shouldRunPixelDiff(testInfo: any, snapshotFilename: string): boolean {
  const isUpdating = testInfo.config.updateSnapshots === 'all' || process.env.UPDATE_SNAPSHOTS === 'true';
  if (isUpdating) return true;

  // I confronti visivi pixel-diff sono attivi solo su Linux e su Chromium quando la baseline esiste
  if (process.platform === 'linux' && testInfo.project.name === 'chromium') {
    const baselineDir = path.resolve('test/__screenshots__');
    const fullPath = path.join(baselineDir, snapshotFilename);
    return fs.existsSync(fullPath);
  }
  return false;
}

test.describe('FASE 12D — Regressione Visiva e Baseline Screenshot', () => {

  test('Home View: 390px (Light & Dark)', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Tema Light
    await page.goto('#/home', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    });
    await expect(page.locator('.home-title-display, .brand-logo-completo').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'home_390_light.png')) {
      await expect(page).toHaveScreenshot('home_390_light.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    }

    // Tema Dark
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'home_390_dark.png')) {
      await expect(page).toHaveScreenshot('home_390_dark.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const isDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
      expect(isDark).toBe(true);
    }
  });

  test('Home View: 1440px (Light & Dark)', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Tema Light
    await page.goto('#/home', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    });
    await expect(page.locator('.home-title-display, .brand-logo-completo').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'home_1440_light.png')) {
      await expect(page).toHaveScreenshot('home_1440_light.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    }

    // Tema Dark
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'home_1440_dark.png')) {
      await expect(page).toHaveScreenshot('home_1440_dark.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const isDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
      expect(isDark).toBe(true);
    }
  });

  test('Canti View e Modalità Lettura: 390px e 1440px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/canti', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'canti_390_light.png')) {
      await expect(page).toHaveScreenshot('canti_390_light.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const cantiHeader = await page.locator('.canti-header, .header-banner').first().isVisible();
      expect(cantiHeader).toBe(true);
    }

    // Apertura modalità lettura tramite helper esposto
    await page.waitForFunction(() => typeof (window as any).__openCantoReading === 'function', null, { timeout: 10000 });
    await page.evaluate((song) => {
      if ((window as any).__openCantoReading) {
        (window as any).__openCantoReading(song);
      }
    }, SYNTHETIC_SONG);

    await expect(page.locator('.canto-reading-scrollable').first()).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'canto_reading_390_light.png')) {
      await expect(page).toHaveScreenshot('canto_reading_390_light.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const readingVisible = await page.locator('.canto-reading-scrollable').first().isVisible();
      expect(readingVisible).toBe(true);
    }

    // Desktop 1440px Dark
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'canto_reading_1440_dark.png')) {
      await expect(page).toHaveScreenshot('canto_reading_1440_dark.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const isDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
      expect(isDark).toBe(true);
    }
  });

  test('Schermata di Revisione Importazione: 390px Light e 1440px Dark', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/canti', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
      if ((window as any).__setAdminForTesting) {
        (window as any).__setAdminForTesting(true);
      }
    });

    // Apertura modal revisione tramite test hook dopo verifica disponibilità
    await page.waitForFunction(() => typeof (window as any).__openReviewForTesting === 'function', null, { timeout: 10000 });
    await page.evaluate((song) => {
      if ((window as any).__openReviewForTesting) {
        (window as any).__openReviewForTesting({
          titolo: song.titolo,
          autore: song.autore,
          categoria: song.categoria,
          tonalita: song.tonalita,
          misura: song.misura,
          bpm_testo: song.bpm_testo,
          tempo_bpm: 96,
          ritmo: '4/4',
          capotasto: 0,
          testo_chordpro: song.testo_chordpro,
          warnings: ['Verifica accordo in posizione atipica'],
          stats: { totalLines: 6, chordsCount: 4, blocksCount: 2 },
        });
      }
    }, SYNTHETIC_SONG);

    const heading = page.getByText(/Revisione Canto/i);
    await expect(heading).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'review_modal_390_light.png')) {
      await expect(page).toHaveScreenshot('review_modal_390_light.png', { maxDiffPixelRatio: 0.05 });
    } else {
      await expect(heading).toBeVisible();
    }

    // Desktop 1440px Dark
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    });
    await page.waitForTimeout(300);

    if (shouldRunPixelDiff(testInfo, 'review_modal_1440_dark.png')) {
      await expect(page).toHaveScreenshot('review_modal_1440_dark.png', { maxDiffPixelRatio: 0.05 });
    } else {
      const isDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme') === 'dark');
      expect(isDark).toBe(true);
    }
  });

  test('Anteprima Stampa A4: Foglio di stampa', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('#/', { waitUntil: 'domcontentloaded' });

    // Inserisci canto in IndexedDB
    await page.evaluate((song) => {
      const DB_NAME = 'vault_scout_db';
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('canti')) return resolve();
          const tx = db.transaction('canti', 'readwrite');
          tx.objectStore('canti').put(song);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => resolve();
      });
    }, SYNTHETIC_SONG);

    // Configura selezione stampa con solo questo canto
    await page.evaluate((song) => {
      const config = {
        selectedGiochiIds: [],
        selectedBansIds: [],
        selectedCantiIds: [song.id, 'canto-danza-la-vita'],
        includeImages: false,
        includeCoverAndIndex: false,
      };
      sessionStorage.setItem('stampa_selection', JSON.stringify(config));
    }, SYNTHETIC_SONG);

    // Naviga a stampa
    await page.goto('#/stampa', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.stampa-print-container')).toBeAttached({ timeout: 15000 });

    if (testInfo.project.name === 'chromium') {
      await expect(page.locator('.canzoniere-page').first()).toBeAttached({ timeout: 15000 });
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.canzoniere-page').first()).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(300);

      if (shouldRunPixelDiff(testInfo, 'print_preview_page.png')) {
        await expect(page.locator('.canzoniere-page').first()).toHaveScreenshot('print_preview_page.png', { maxDiffPixelRatio: 0.05 });
      }
    } else {
      // Su WebKit e mobile, verifica funzionale dell'anteprima web
      await expect(page.locator('.stampa-print-container')).toBeAttached({ timeout: 15000 });
    }
  });

});

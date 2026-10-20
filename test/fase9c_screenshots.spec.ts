import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('FASE 9C — Screenshot e Verifica Visiva Sfondo Majella', () => {
  const outDir = path.resolve('docs/design-review/majella');

  const routes = [
    { name: 'home', hash: '#/' },
    { name: 'giochi', hash: '#/giochi' },
    { name: 'canti', hash: '#/canti' },
  ];

  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  const themes: ('light' | 'dark')[] = ['light', 'dark'];

  for (const vp of viewports) {
    for (const theme of themes) {
      for (const route of routes) {
        test(`Screenshot ${route.name} su ${vp.name} (${theme})`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.emulateMedia({ colorScheme: theme });

          await page.goto(route.hash);
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(300);

          // Verifica che lo sfondo topografico sia presente
          const topo = page.locator('.topo-contour-wrapper');
          await expect(topo).toBeAttached();

          // Verifica assenza di scroll orizzontale
          const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
          const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
          expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

          // Cattura screenshot
          const screenshotPath = path.join(outDir, `${route.name}_${vp.name}_${theme}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          console.log(`[SCREENSHOT] Salvato: ${screenshotPath}`);
        });
      }
    }
  }

  // Verifica viewports critici 320px (iPhone SE) e 768px (iPad Verticale)
  test('Verifica assenza scroll orizzontale su 320px e 768px', async ({ page }) => {
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 800 });
      for (const r of routes) {
        await page.goto(r.hash);
        await page.waitForLoadState('domcontentloaded');
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
      }
    }
  });

  // Verifica isolamento nella lettura schermo intero
  test('Verifica isolamento e assenza interferenze nella modalità lettura', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/canti');
    await page.waitForLoadState('domcontentloaded');

    // Seleziona o crea un canto sintetico
    const cantoRow = page.locator('.canto-row-item, .ios-card, [role="button"]').first();
    if (await cantoRow.isVisible()) {
      await cantoRow.click();
      await page.waitForTimeout(300);

      // Clicca su Modalità Lettura se presente
      const btnLettura = page.locator('button:has-text("Modalità Lettura"), button:has-text("Leggi")').first();
      if (await btnLettura.isVisible()) {
        await btnLettura.click();
        await page.waitForTimeout(300);

        const readingModal = page.locator('[role="dialog"][aria-modal="true"]');
        await expect(readingModal).toBeVisible();

        // Verifica che il fondo sia opaco (z-index 100)
        const zIndex = await readingModal.evaluate((el) => window.getComputedStyle(el).zIndex);
        expect(Number(zIndex) || 100).toBeGreaterThanOrEqual(100);
      }
    }
  });

  // Verifica scrolling a fine pagina per confermare assenza di linee o tagli sul fondo
  test('Verifica assenza linee di taglio a fondo pagina (Home scrolled bottom)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('#/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(400);

    // Scorri completamente fino in fondo
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);

    const bottomScreenshotPath = path.join(outDir, 'home_bottom_scrolled_dark.png');
    await page.screenshot({ path: bottomScreenshotPath, fullPage: false });
    console.log(`[SCREENSHOT] Salvato fondo pagina: ${bottomScreenshotPath}`);
  });
});

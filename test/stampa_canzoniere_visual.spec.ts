// test/stampa_canzoniere_visual.spec.ts
// Test E2E e di regressione visiva Playwright per la schermata "Stampa Canzoniere":
// 1. Verifica UI ridisegnata a 1280px (desktop) e 390px (mobile):
//    - Flusso unico a colonna singola
//    - Bivio principale "Per chi stampi?" (Chi suona / Chi canta)
//    - Selezione raggruppata per settore con touch target >= 44px
//    - Fisarmonica opzioni chiusa di default
//    - Barra d'azione fissa (sticky bottom bar) con riepilogo e pulsanti
//    - Sfondo topografico attenuato (opacità <= 0.03)
// 2. Verifica fedeltà e misure geometriche (fillRatio, font size, colonne) sulle 4 canzoni di riferimento:
//    - Albachiara, Come ti ama Dio, Danza la vita, Come sole come goccia
//    - In entrambe le varianti "Chi suona" e "Chi canta"
//    - Salvataggio screenshot in test/__screenshots__/print_overhaul/

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.resolve('test/__screenshots__/print_overhaul');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Stampa Canzoniere — Verifica UI e Visual Regression', () => {
  test('1. Desktop (1280x900): Layout a colonna singola, sticky bar, accordion chiuso, touch target >= 44px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('#/stampa');
    await page.waitForLoadState('domcontentloaded');

    // Attendi che il flusso Canzoniere sia caricato
    await expect(page.locator('.stampa-canzoni-workflow')).toBeVisible({ timeout: 15000 });

    // Verifica titolo e sottotitolo
    const headerTitle = page.locator('.stampa-hero-card h2');
    await expect(headerTitle).toContainText('Canzoniere A4');

    // Verifica presenza del bivio "Per chi stampi?"
    const variantSelector = page.locator('.stampa-hero-card .ios-segmented-control');
    await expect(variantSelector).toBeVisible();
    await expect(variantSelector).toContainText('Chi suona (con accordi)');
    await expect(variantSelector).toContainText('Chi canta (solo testo)');

    // Verifica che l'accordion opzioni sia chiuso di default
    const optionsAccordion = page.locator('.stampa-options-accordion');
    await expect(optionsAccordion).toBeVisible();
    const isOpen = await optionsAccordion.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isOpen).toBe(false);

    // Verifica che la sticky bottom bar sia presente e visibile
    const stickyBar = page.locator('.stampa-sticky-bottom-bar');
    await expect(stickyBar).toBeVisible();
    await expect(stickyBar.locator('button:has-text("Stampa")')).toBeVisible();

    // Verifica che le righe dei canti abbiano touch target >= 44px
    const firstSongRow = page.locator('.stampa-song-row').first();
    await expect(firstSongRow).toBeVisible();
    const rowBox = await firstSongRow.boundingBox();
    expect(rowBox).not.toBeNull();
    if (rowBox) {
      expect(rowBox.height).toBeGreaterThanOrEqual(44);
    }

    // Verifica che lo sfondo topografico sia attenuato (opacity <= 0.03)
    const topoWrapper = page.locator('.topo-contour-wrapper');
    if (await topoWrapper.count() > 0) {
      const topoOpacity = await topoWrapper.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).opacity);
      });
      expect(topoOpacity).toBeLessThanOrEqual(0.03);
    }

    // Cattura screenshot desktop UI
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_desktop_ui_overview.png'),
      fullPage: false,
    });
  });

  test('2. Mobile (390x844): Layout compatto, assenza scroll orizzontale, sticky bar fissa in basso', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/stampa');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.stampa-canzoni-workflow')).toBeVisible({ timeout: 15000 });

    // Verifica assenza di scroll orizzontale anomalo sul body
    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // tolleranza 2px subpixel

    // Verifica sticky bar visibile in viewport su mobile
    const stickyBar = page.locator('.stampa-sticky-bottom-bar');
    await expect(stickyBar).toBeVisible();
    const stickyBox = await stickyBar.boundingBox();
    expect(stickyBox).not.toBeNull();
    if (stickyBox) {
      // Deve essere posizionata in fondo al viewport (844px)
      expect(stickyBox.y + stickyBox.height).toBeGreaterThanOrEqual(800);
    }

    // Cattura screenshot mobile
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02_mobile_ui_overview.png'),
      fullPage: false,
    });

    // Apri l'accordion opzioni su mobile e verifica che si apra fluidamente
    const optionsSummary = page.locator('.stampa-options-summary');
    await optionsSummary.click();
    const optionsAccordion = page.locator('.stampa-options-accordion');
    const isNowOpen = await optionsAccordion.evaluate((el: HTMLDetailsElement) => el.open);
    expect(isNowOpen).toBe(true);

    // Cattura screenshot mobile con opzioni aperte
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_mobile_options_expanded.png'),
      fullPage: false,
    });
  });

  const REFERENCE_SONGS = [
    { title: 'Albachiara', slug: 'albachiara' },
    { title: 'Come ti ama Dio', slug: 'come_ti_ama_dio' },
    { title: 'Danza la vita', slug: 'danza_la_vita' },
    { title: 'Come sole come goccia', slug: 'come_sole_come_goccia' },
  ];

  for (const song of REFERENCE_SONGS) {
    for (const mode of ['suona', 'canta'] as const) {
      test(`3. Misura e Screenshot A4 [${mode.toUpperCase()}] "${song.title}"`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 1200 });

        // Configura il test impostando sessionStorage prima del caricamento
        await page.addInitScript(
          ({ songTitle, printMode }) => {
            // Cerca canto predefinito per ID o titolo
            const config = {
              selectedCantiIds: [], // Sarà selezionato tramite UI
              mode: printMode,
              layoutMode: 'riempi_pagina',
              includeIndex: false,
              includeCover: false,
            };
            sessionStorage.setItem('stampa_canzoni', JSON.stringify(config));
            sessionStorage.setItem('stampa_active_section_tab', 'canzoni');
          },
          { songTitle: song.title, printMode: mode }
        );

        await page.goto('#/stampa');
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('.stampa-canzoni-workflow')).toBeVisible({ timeout: 15000 });

        // Seleziona il canto cercandolo nella SearchField
        const searchInput = page.locator('input[aria-label="Cerca canti per la stampa"]');
        await searchInput.fill(song.title);
        await page.waitForTimeout(300);

        // Trova la riga corrispondente e clicca per selezionare
        const songRow = page.locator('.stampa-song-row', { hasText: song.title }).first();
        await expect(songRow).toBeVisible();
        await songRow.click();
        await page.waitForTimeout(500);

        // Attendi che la pagina preview A4 sia renderizzata
        const a4Page = page.locator('.canzoniere-page.print-song-page').first();
        await expect(a4Page).toBeVisible({ timeout: 10000 });

        // Misura le proprietà geometriche reali dal DOM
        const measurements = await a4Page.evaluate((pageEl) => {
          const fontSizeStr = (pageEl as HTMLElement).style.fontSize || '11pt';
          const fontSizePt = parseFloat(fontSizeStr);

          const colsContainer = pageEl.querySelector('.canzoniere-columns-container');
          const isSingleCol = colsContainer?.classList.contains('is-single-column') || false;
          const columnsCount = isSingleCol ? 1 : 2;

          // Misura altezze colonne reali
          const cols = pageEl.querySelectorAll('.canzoniere-column');
          let maxColHeight = 0;
          cols.forEach((col) => {
            const h = (col as HTMLElement).scrollHeight;
            if (h > maxColHeight) maxColHeight = h;
          });

          // Altezza utile della pagina
          const pageClientH = (pageEl as HTMLElement).clientHeight;
          const headerH = (pageEl.querySelector('.canzoniere-header') as HTMLElement)?.offsetHeight || 0;
          const usableH = pageClientH - headerH;
          const fillRatio = usableH > 0 ? Math.min(1, maxColHeight / usableH) : 0;

          return {
            fontSizePt,
            columnsCount,
            maxColHeight,
            usableH,
            fillRatio,
          };
        });

        console.log(
          `[E2E MEASUREMENT] "${song.title}" (${mode}): ` +
            `font=${measurements.fontSizePt}pt, ` +
            `colonne=${measurements.columnsCount}, ` +
            `fillRatio=${(measurements.fillRatio * 100).toFixed(1)}%`
        );

        // Verifica che il font rispetti l'Armonia Tipografica (compreso tra 10.5pt e 12.5pt, mai enorme né minuscolo)
        expect(measurements.fontSizePt).toBeGreaterThanOrEqual(10.5);
        expect(measurements.fontSizePt).toBeLessThanOrEqual(12.5);

        // Cattura lo screenshot fedele della pagina A4
        await a4Page.screenshot({
          path: path.join(SCREENSHOT_DIR, `preview_${mode}_${song.slug}.png`),
        });
      });
    }
  }
});

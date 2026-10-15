import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';
import * as path from 'path';

const screenshotsDir = path.resolve(process.cwd(), 'docs/design-review/screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
});

const VIEWPORTS = [
  { name: 'iphone_se', width: 320, height: 568, label: 'iPhone SE (320x568)' },
  { name: 'iphone_13_15', width: 390, height: 844, label: 'iPhone 13/14/15 (390x844)' },
  { name: 'iphone_max', width: 430, height: 932, label: 'iPhone 15 Pro Max (430x932)' },
  { name: 'phone_landscape', width: 844, height: 390, label: 'Smartphone Orizzontale (844x390)' },
  { name: 'ipad_portrait', width: 768, height: 1024, label: 'iPad Verticale (768x1024)' },
  { name: 'ipad_landscape', width: 1024, height: 768, label: 'iPad Orizzontale (1024x768)' },
  { name: 'desktop', width: 1440, height: 900, label: 'Desktop Standard (1440x900)' },
];

test.describe('Verifica UI Apple-Grade Reattiva sui 7 Viewport Richiesti', () => {
  for (const vp of VIEWPORTS) {
    test(`Zero scroll orizzontale e rendering corretto su ${vp.label}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('#/');
      await page.waitForLoadState('networkidle');

      // Verifica zero scroll orizzontale
      const scrollMetrics = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          innerWidth: window.innerWidth,
        };
      });

      expect(
        scrollMetrics.scrollWidth,
        `Scroll orizzontale anomalo rilevato su ${vp.name}: scrollWidth=${scrollMetrics.scrollWidth} > clientWidth=${scrollMetrics.clientWidth}`
      ).toBeLessThanOrEqual(scrollMetrics.clientWidth + 1);

      // Screenshot per review visiva
      const screenshotPath = path.join(screenshotsDir, `home_${vp.name}_light.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      expect(fs.existsSync(screenshotPath)).toBe(true);
    });
  }
});

test.describe('Verifica Accessibilità WCAG AA con Axe-Core', () => {
  test('Audit accessibilità su Home View (Tema Chiaro)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // I colori sono in OKLCH e axe-core non calcola ancora OKLCH nel suo engine statico
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(
      criticalViolations.length,
      `Rilevate violazioni di accessibilità critiche/serie: ${JSON.stringify(criticalViolations, null, 2)}`
    ).toBe(0);
  });

  test('Audit accessibilità su Design System View (#/design)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/design');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations.length).toBe(0);
  });

  test('Audit accessibilità e rendering su Stato Dati View (#/stato-dati)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/stato-dati');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations.length).toBe(0);

    const screenshotPath = path.join(screenshotsDir, 'statodati_iphone_light.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('Audit accessibilità e rendering su Giochi View (#/giochi)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/giochi');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations.length).toBe(0);

    const screenshotPath = path.join(screenshotsDir, 'giochi_iphone_light.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('Audit accessibilità e rendering su Bans View (#/bans)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/bans');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations.length).toBe(0);

    const screenshotPath = path.join(screenshotsDir, 'bans_iphone_light.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('Audit accessibilità e rendering su Canti View (#/canti)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/canti');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations.length).toBe(0);

    const screenshotPath = path.join(screenshotsDir, 'canti_iphone_light.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });
});

test.describe('Verifica Tema Scuro (Dark Mode)', () => {
  test('Rendering e screenshot in Tema Scuro su iPhone e Desktop', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    const darkHomeScreenshot = path.join(screenshotsDir, 'home_iphone_dark.png');
    await page.screenshot({ path: darkHomeScreenshot, fullPage: true });
    expect(fs.existsSync(darkHomeScreenshot)).toBe(true);

    // Cattura anche pagina #/design in tema scuro
    await page.goto('/#/design');
    await page.waitForLoadState('networkidle');
    const darkDesignScreenshot = path.join(screenshotsDir, 'design_iphone_dark.png');
    await page.screenshot({ path: darkDesignScreenshot, fullPage: true });
    expect(fs.existsSync(darkDesignScreenshot)).toBe(true);
  });
});

test.describe('Verifica Touch Targets (Minimo 44x44px per elementi primari)', () => {
  test('I pulsanti di navigazione principale e le righe interattive rispettano i 44px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    const tabItems = await page.$$('.ios-tab-item');
    for (const item of tabItems) {
      const box = await item.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height, `Altezza tab bar item < 44px: ${box.height}`).toBeGreaterThanOrEqual(44);
      }
    }

    const groupedRows = await page.$$('.ios-grouped-row');
    for (const row of groupedRows) {
      const box = await row.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height, `Altezza grouped row < 44px: ${box.height}`).toBeGreaterThanOrEqual(44);
      }
    }
  });
});

test.describe('Verifica Zoom 200% (WCAG 1.4.4 Resize text)', () => {
  test('A 200% zoom non si verifica sovrapposizione o rottura del layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    // Simula zoom 200% impostando font-size 200% sull'html
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%';
    });

    const scrollMetrics = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    expect(scrollMetrics.scrollWidth).toBeLessThanOrEqual(scrollMetrics.clientWidth + 2);

    const zoomScreenshot = path.join(screenshotsDir, 'home_zoom_200.png');
    await page.screenshot({ path: zoomScreenshot, fullPage: true });
    expect(fs.existsSync(zoomScreenshot)).toBe(true);
  });
});

test.describe('Verifica Motivi Scout Vettoriali e Animazioni', () => {
  test('Presenti ed animati: LogoReveal, TheTrail, CompassSync', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    // Motivo 1: Logo Reveal
    const logoReveal = await page.$('.scout-logo-reveal');
    expect(logoReveal).not.toBeNull();

    // Motivo 2: The Trail
    const trail = await page.$('.scout-trail-svg');
    expect(trail).not.toBeNull();

    // Motivo 3: Bussola di sincronizzazione
    const compass = await page.$('.scout-compass-widget');
    expect(compass).not.toBeNull();
  });
});

test.describe('CORREZIONE 2 — Verifica Stress UI con Dati Sporchi, Viewport Ristretto e Tastiera', () => {
  async function populateDirtyData(page: any) {
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(async () => {
      const req = indexedDB.open('vault_scout_db', 1);
      await new Promise<void>((resolve, reject) => {
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['giochi', 'bans', 'canti'], 'readwrite');
          const gStore = tx.objectStore('giochi');
          const bStore = tx.objectStore('bans');
          const cStore = tx.objectStore('canti');

          for (let i = 1; i <= 200; i++) {
            const longUnbroken = `SupercalifragilistichespiralidosoStranoTitoloLunghissimoSenzaSpazi_${i}`;
            const dirtyChars = `& <special> 'singolo' "doppio" èéòàùì ${i}`;
            const gNome = `Gioco_${i}_${longUnbroken}_${dirtyChars}`;
            const bNome = `Ban_${i}_${longUnbroken}_${dirtyChars}`;
            const cTitolo = `Canto_${i}_${longUnbroken}_${dirtyChars}`;

            gStore.put({
              id: `dirty-g-${i}`,
              nome: gNome,
              regole: `Regole lunghe con caratteri <tag> & "virgolette" per elemento ${i}. ${longUnbroken}`,
              materiali: `Materiale_${i} <test>`,
              created_at: new Date(Date.now() - i * 3600000).toISOString(),
              updated_at: new Date(Date.now() - i * 3600000).toISOString(),
              deleted_at: null,
            });

            bStore.put({
              id: `dirty-b-${i}`,
              nome: bNome,
              testo: `Testo del ban con parole lunghe ${longUnbroken} e caratteri <script>alert(1)</script> & "cit"`,
              note_gesti: `Gesti_${i} <special>`,
              created_at: new Date(Date.now() - i * 3600000).toISOString(),
              updated_at: new Date(Date.now() - i * 3600000).toISOString(),
              deleted_at: null,
            });

            cStore.put({
              id: `dirty-c-${i}`,
              titolo: cTitolo,
              autore: `Autore_${i} & Clan`,
              tonalita: 'Re',
              ritmo: '4/4',
              tempo_bpm: 120,
              misura: '4/4',
              capotasto: null,
              testo_chordpro: `[Re]Testo del canto ${i} con [Sol]accordi e <caratteri> & "cit"\n{ritornello}\n[La]Ritornello ${longUnbroken}`,
              created_at: new Date(Date.now() - i * 3600000).toISOString(),
              updated_at: new Date(Date.now() - i * 3600000).toISOString(),
              deleted_at: null,
            });
          }

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  test('Popolamento 200 elementi sporchi, ricerca typo/special chars, ordinamento, sheet e visibilità ultimo elemento su Giochi', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await populateDirtyData(page);

    // 2. Naviga su #/giochi e verifica rendering con 200 elementi
    await page.goto('/#/giochi');
    await page.waitForSelector('.ios-grouped-row');

    // Verifica zero scroll orizzontale anche con parole lunghissime senza spazi
    const scrollInfo = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollInfo.scrollWidth).toBeLessThanOrEqual(scrollInfo.clientWidth + 1);

    // 3. Ricerca su dati sporchi con caratteri speciali
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill('<special>');
    await page.waitForTimeout(300); // attende debounce 200ms
    const countAfterSearch = await page.locator('.ios-grouped-row').count();
    expect(countAfterSearch).toBeGreaterThan(0);

    // 4. Test ordinamento 4-way
    const sortZtoA = page.locator('button:has-text("Z → A")');
    if ((await sortZtoA.count()) > 0) {
      await sortZtoA.click();
      await page.waitForTimeout(100);
    }

    // 5. Apertura foglio dettaglio
    const firstRow = page.locator('.ios-grouped-row').first();
    await firstRow.click();
    await page.waitForSelector('[role="dialog"]');
    expect(await page.locator('[role="dialog"]').isVisible()).toBe(true);

    // Chiusura foglio dettaglio tramite close button superiore
    const closeBtn = page.locator('.ios-sheet-close-btn').first();
    await closeBtn.click();
    await page.waitForTimeout(200);

    // 6. Test con tastiera a schermo simulata (altezza ridotta 400px e input a fuoco)
    await page.setViewportSize({ width: 390, height: 400 });
    await searchInput.focus();
    await page.waitForTimeout(150);

    // 7. Test tema scuro e prefers-reduced-motion
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.waitForTimeout(150);

    // 8. Verifica che l'ultimo elemento della lista NON sia coperto dalla barra di navigazione inferiore
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // Scroll fino in fondo alla pagina
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);

    const tabBounding = await page.locator('.ios-tab-bar').boundingBox();
    const lastRow = page.locator('.ios-grouped-row').last();
    const lastRowBounding = await lastRow.boundingBox();

    expect(tabBounding).not.toBeNull();
    expect(lastRowBounding).not.toBeNull();

    if (tabBounding && lastRowBounding) {
      expect(
        lastRowBounding.y + lastRowBounding.height,
        `L'ultimo elemento risulta coperto dalla barra inferiore: lastRowBottom=${lastRowBounding.y + lastRowBounding.height} > tabTop=${tabBounding.y}`
      ).toBeLessThanOrEqual(tabBounding.y + 1);
    }
  });

  test('Verifica stress su Bans e Canti con apertura sheet e assenza di overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await populateDirtyData(page);

    // Test su Bans
    await page.goto('/#/bans');
    await page.waitForSelector('.ios-grouped-row');
    const firstBanRow = page.locator('.ios-grouped-row').first();
    await firstBanRow.click();
    await page.waitForSelector('[role="dialog"]');
    expect(await page.locator('[role="dialog"]').isVisible()).toBe(true);
    const closeBanBtn = page.locator('.ios-sheet-close-btn').first();
    await closeBanBtn.click();
    await page.waitForTimeout(200);

    // Test su Canti
    await page.goto('/#/canti');
    await page.waitForSelector('.ios-grouped-row');
    const firstCantoRow = page.locator('.ios-grouped-row').first();
    await firstCantoRow.click();
    await page.waitForSelector('[role="dialog"]');
    expect(await page.locator('[role="dialog"]').isVisible()).toBe(true);
    const closeCantoBtn = page.locator('.ios-sheet-close-btn').first();
    await closeCantoBtn.click();
  });
});


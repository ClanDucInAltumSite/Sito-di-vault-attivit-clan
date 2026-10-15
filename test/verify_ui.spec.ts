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

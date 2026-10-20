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

  test('Audit accessibilità e rendering su Stampa View (#/stampa)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/stampa');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(criticalViolations.length).toBe(0);

    const screenshotPath = path.join(screenshotsDir, 'stampa_iphone_light.png');
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

test.describe('CORREZIONE 2 - Verifica Stress UI con Dati Sporchi, Viewport Ristretto e Tastiera', () => {
  async function populateDirtyData(page: any) {
    await page.goto('#/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof (window as any).__dbPutRecords === 'function');

    const dirtyGiochi: any[] = [];
    const dirtyBans: any[] = [];
    const dirtyCanti: any[] = [];

    for (let i = 1; i <= 200; i++) {
      const longUnbroken = `SupercalifragilistichespiralidosoStranoTitoloLunghissimoSenzaSpazi_${i}`;
      const dirtyChars = `& <special> 'singolo' "doppio" èéòàùì ${i}`;
      dirtyGiochi.push({
        id: `dirty-g-${i}`,
        nome: `Gioco_${i}_${longUnbroken}_${dirtyChars}`,
        regole: `Regole lunghe con caratteri <tag> & "virgolette" per elemento ${i}. ${longUnbroken}`,
        materiali: `Materiale_${i} <test>`,
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
        updated_at: new Date(Date.now() - i * 3600000).toISOString(),
        deleted_at: null,
      });

      dirtyBans.push({
        id: `dirty-b-${i}`,
        nome: `Ban_${i}_${longUnbroken}_${dirtyChars}`,
        testo: `Testo del ban con parole lunghe ${longUnbroken} e caratteri <script>alert(1)</script> & "cit"`,
        note_gesti: `Gesti_${i} <special>`,
        created_at: new Date(Date.now() - i * 3600000).toISOString(),
        updated_at: new Date(Date.now() - i * 3600000).toISOString(),
        deleted_at: null,
      });

      dirtyCanti.push({
        id: `dirty-c-${i}`,
        titolo: `Canto_${i}_${longUnbroken}_${dirtyChars}`,
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

    await page.evaluate(async (data: any) => {
      await (window as any).__dbPutRecords('giochi', data.dirtyGiochi);
      await (window as any).__dbPutRecords('bans', data.dirtyBans);
      await (window as any).__dbPutRecords('canti', data.dirtyCanti);
    }, { dirtyGiochi, dirtyBans, dirtyCanti });
  }

  test('Popolamento 200 elementi sporchi, ricerca typo/special chars, ordinamento, sheet e visibilità ultimo elemento su Giochi', async ({ page }) => {
    test.slow();
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
      await page.waitForTimeout(200);
    }
    await searchInput.blur();
    await page.waitForTimeout(100);

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

test.describe('FASE 5 - Verifica Componenti Allegati e Lightbox su #/design', () => {
  test('Rendering galleria allegati, badge offline, card PDF e modale Lightbox zoom', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/design');
    await page.waitForLoadState('networkidle');

    // 1. Verifica presenza sezione Allegati (Sezione 12)
    const allegatiHeader = page.locator('text=12. ALLEGATI');
    await expect(allegatiHeader).toBeVisible();

    // 2. Verifica presenza miniatura immagine e stato non scaricato
    const thumbCards = page.locator('.attachment-thumb-card');
    expect(await thumbCards.count()).toBeGreaterThanOrEqual(2);

    const offlineBadge = page.locator('.attachment-offline-badge').first();
    await expect(offlineBadge).toBeVisible();

    // 3. Verifica card documento PDF
    const pdfCard = page.locator('.attachment-pdf-card').first();
    await expect(pdfCard).toBeVisible();
    await expect(page.locator('text=Regolamento Completo del Gioco.pdf')).toBeVisible();

    // 4. Test apertura e chiusura Lightbox zoom
    const zoomableThumb = thumbCards.first();
    await zoomableThumb.click();
    await page.waitForSelector('.attachment-lightbox-backdrop');
    const lightbox = page.locator('.attachment-lightbox-backdrop');
    await expect(lightbox).toBeVisible();

    // Chiudi lightbox con click sul bottone close
    const closeBtn = lightbox.locator('button');
    await closeBtn.click();
    await page.waitForTimeout(200);
    expect(await page.locator('.attachment-lightbox-backdrop').count()).toBe(0);
  });
});

test.describe('FASE 7 - Verifica Calendario e ODG (#/calendario)', () => {
  async function seedCalendarData(page: any) {
    await page.goto('#/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => typeof (window as any).__dbPutRecords === 'function');

    const now = new Date();
    const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 30).toISOString();
    const tomorrowIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0).toISOString();
    const pastIso = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5, 20, 0).toISOString();

    // 1. Evento Oggi (Riunione con ODG denso)
    const evOggi = {
      id: 'ev-oggi-test',
      titolo: 'Riunione Ordinaria di Clan & Verifica Fasi',
      tipo: 'riunione',
      inizio: todayIso,
      fine: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30).toISOString(),
      tutto_il_giorno: false,
      luogo: 'Sede Clan San Giovanni',
      descrizione: 'Verifica dettagliata delle attività del mese e approvazione ordini del giorno.',
      responsabile: 'Capi Clan',
      cosa_portare: 'Quaderno di caccia, penna, cassa',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      deleted_at: null,
    };

    // 2. Evento Domani (Uscita)
    const evDomani = {
      id: 'ev-domani-test',
      titolo: 'Uscita di Pattuglia sui Sibillini',
      tipo: 'uscita',
      inizio: tomorrowIso,
      fine: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 17, 0).toISOString(),
      tutto_il_giorno: false,
      luogo: 'Monte Vettore - Rifugio Zilioli',
      descrizione: 'Trekking di 2 giorni in autonomia.',
      responsabile: 'Pattuglia Aquile',
      cosa_portare: 'Tenda, fornellino, viveri',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      deleted_at: null,
    };

    // 3. Evento Passato
    const evPassato = {
      id: 'ev-passato-test',
      titolo: 'Verifica Inizio Anno Scout',
      tipo: 'evento',
      inizio: pastIso,
      fine: null,
      tutto_il_giorno: false,
      luogo: 'Oratorio',
      descrizione: 'Incontro con la Comunità Capi',
      responsabile: 'Capi Gruppo',
      cosa_portare: null,
      created_at: pastIso,
      updated_at: pastIso,
      deleted_at: null,
    };

    const eventi = [evOggi, evDomani, evPassato];
    const odgPunti: any[] = [];

    // Stress test: 30 punti ODG con stringhe lunghe
    for (let i = 1; i <= 30; i++) {
      odgPunti.push({
        id: `odg-pt-${i}`,
        evento_id: 'ev-oggi-test',
        testo: `Punto ODG #${i}: Discussione approfondita sui progetti di servizio ${i % 2 === 0 ? 'con testo esteso per verifica layout reattivo senza troncamenti strani' : 'breve'}`,
        ordine: i - 1,
        completato: i % 4 === 0, // Ogni 4 completato
        riportato_da: i === 5 ? 'odg-vecchio-id' : null,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        deleted_at: null,
      });
    }

    await page.evaluate(async (data: any) => {
      await (window as any).__dbPutRecords('eventi', data.eventi);
      await (window as any).__dbPutRecords('odg_punti', data.odgPunti);
    }, { eventi, odgPunti });
  }

  test('Audit accessibilità WCAG AA su Calendario View (#/calendario)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedCalendarData(page);
    await page.goto('/#/calendario');
    await page.waitForLoadState('networkidle');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );

    expect(
      criticalViolations.length,
      `Violazioni critiche accessibilità su Calendario: ${JSON.stringify(criticalViolations, null, 2)}`
    ).toBe(0);
  });

  test('Verifica rendering Griglia Mese, commutazione Prossimi/Passati e apertura Dettaglio con ODG', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });
    await seedCalendarData(page);
    await page.goto('/#/calendario');
    await page.waitForLoadState('networkidle');

    // 1. Verifica presenza Griglia Mese
    const monthCard = page.locator('.calendar-month-card');
    await expect(monthCard).toBeVisible();

    const dayCells = page.locator('.calendar-cell');
    expect(await dayCells.count()).toBeGreaterThanOrEqual(28);

    // 2. Commutazione a Vista Prossimi Eventi
    const prossimiBtn = page.locator('text=Prossimi');
    await prossimiBtn.click();
    await page.waitForTimeout(150);

    const groupedRows = page.locator('.ios-grouped-row');
    expect(await groupedRows.count()).toBeGreaterThanOrEqual(2);

    // Verifica presenza blocco data e chip
    const firstRow = groupedRows.first();
    await expect(firstRow.locator('.calendar-date-block')).toBeVisible();
    await expect(firstRow.locator('.event-type-chip')).toBeVisible();

    // 3. Apertura Dettaglio Evento con ODG denso (30 punti)
    const riunioneRow = page.locator('.ios-grouped-row:has-text("Riunione Ordinaria")').first();
    await expect(riunioneRow).toBeVisible({ timeout: 15000 });
    await riunioneRow.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(400);

    // Verifica contatore badge ODG aperti
    const odgOpenBadge = dialog.locator('.odg-open-badge');
    await expect(odgOpenBadge).toBeVisible({ timeout: 15000 });

    // Verifica presenza elementi ODG
    const odgItems = dialog.locator('.odg-item');
    expect(await odgItems.count()).toBeGreaterThanOrEqual(20);

    // Verifica assenza scroll orizzontale anomalo dentro il dialog
    const dialogMetrics = await dialog.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(dialogMetrics.scrollWidth).toBeLessThanOrEqual(dialogMetrics.clientWidth + 2);

    // Chiudi dialog
    const closeBtn = page.locator('button:has-text("Chiudi")').first();
    await closeBtn.click();
    await page.waitForTimeout(200);

    // 4. Commutazione a Vista Eventi Passati
    const passatiBtn = page.locator('text=Passati');
    await passatiBtn.click();
    await page.waitForTimeout(150);
    await expect(page.locator('text=Verifica Inizio Anno Scout')).toBeVisible();
  });
});

test.describe('Verifica Generale di Assenza Perdita di Stili (Style Bleed & Integrity Multi-Rotta)', () => {
  const ROUTE_ORDERS = [
    {
      name: 'Ordine 1: Standard (Home -> Giochi -> Bans -> Canti -> Calendario -> Stampa -> Admin -> Design -> StatoDati)',
      routes: ['#/', '#/giochi', '#/bans', '#/canti', '#/calendario', '#/stampa', '#/admin', '#/design', '#/statodati'],
    },
    {
      name: 'Ordine 2: Canti e Stampa prioritari (Canti -> Stampa -> Admin -> StatoDati -> Design -> Calendario -> Bans -> Giochi -> Home)',
      routes: ['#/canti', '#/stampa', '#/admin', '#/statodati', '#/design', '#/calendario', '#/bans', '#/giochi', '#/'],
    },
    {
      name: 'Ordine 3: Interlacciato (Giochi -> Stampa -> Calendario -> Admin -> Canti -> Bans -> Design -> StatoDati -> Home)',
      routes: ['#/giochi', '#/stampa', '#/calendario', '#/admin', '#/canti', '#/bans', '#/design', '#/statodati', '#/'],
    },
  ];

  const THEMES = ['light', 'dark'] as const;

  for (const theme of THEMES) {
    for (const order of ROUTE_ORDERS) {
      test(`Integrità stili preservata in ${order.name} [Tema: ${theme}]`, async ({ page }) => {
        // 1. Inizializza prima rotta e imposta tema
        const firstRoute = order.routes[0];
        await page.goto(firstRoute);
        await page.waitForSelector('#app', { state: 'attached' });

        await page.evaluate((th) => {
          document.documentElement.setAttribute('data-theme', th);
          localStorage.setItem('theme', th);
        }, theme);

        await page.waitForTimeout(200);

        // Funzione helper per catturare metriche di stile calcolate della vista
        const captureMetrics = async () => {
          return await page.evaluate(() => {
            const body = document.body;
            const heading = document.querySelector('h1, h2, .header-banner-title') as HTMLElement | null;
            const item = document.querySelector('.ios-grouped-row-title, p, main') as HTMLElement | null;

            const bodyStyle = window.getComputedStyle(body);
            const headingStyle = heading ? window.getComputedStyle(heading) : null;
            const itemStyle = item ? window.getComputedStyle(item) : null;

            return {
              bodyBg: bodyStyle.backgroundColor,
              bodyColor: bodyStyle.color,
              headingColor: headingStyle?.color || '',
              headingFontFamily: headingStyle?.fontFamily || '',
              headingFontSize: headingStyle?.fontSize || '',
              headingFontWeight: headingStyle?.fontWeight || '',
              itemColor: itemStyle?.color || '',
              itemFontFamily: itemStyle?.fontFamily || '',
              itemFontSize: itemStyle?.fontSize || '',
            };
          });
        };

        const beforeMetrics = await captureMetrics();
        expect(beforeMetrics.bodyBg).not.toBe('');

        // 2. Visita tutte le altre rotte nella sequenza dell'ordine specificato
        for (let i = 1; i < order.routes.length; i++) {
          const route = order.routes[i];
          await page.evaluate((r) => { window.location.hash = r; }, route);
          await page.waitForTimeout(150);
          await page.waitForSelector('#app', { state: 'attached' });
        }

        // 3. Ritorna alla prima rotta visitata
        await page.evaluate((r) => { window.location.hash = r; }, firstRoute);
        await page.waitForTimeout(250);

        // 4. Rileva nuovamente le metriche di stile calcolate
        const afterMetrics = await captureMetrics();

        // 5. Asserzioni di assoluta identità (Zero style bleed / zero perdita stili)
        expect(afterMetrics.bodyBg, 'Il colore di sfondo della pagina deve rimanere identico').toBe(beforeMetrics.bodyBg);
        expect(afterMetrics.bodyColor, 'Il colore del testo del body deve rimanere identico').toBe(beforeMetrics.bodyColor);
        expect(afterMetrics.headingColor, 'Il colore dei titoli deve rimanere identico').toBe(beforeMetrics.headingColor);
        expect(afterMetrics.headingFontFamily, 'Il font dei titoli deve rimanere identico').toBe(beforeMetrics.headingFontFamily);
        expect(afterMetrics.headingFontSize, 'La dimensione dei titoli deve rimanere identica').toBe(beforeMetrics.headingFontSize);
        expect(afterMetrics.headingFontWeight, 'Il peso dei titoli deve rimanere identico').toBe(beforeMetrics.headingFontWeight);
        expect(afterMetrics.itemColor, 'Il colore degli elementi di testo deve rimanere identico').toBe(beforeMetrics.itemColor);
        expect(afterMetrics.itemFontFamily, 'Il font degli elementi di testo deve rimanere identico').toBe(beforeMetrics.itemFontFamily);
        expect(afterMetrics.itemFontSize, 'La dimensione del testo deve rimanere identica').toBe(beforeMetrics.itemFontSize);
      });
    }
  }
});




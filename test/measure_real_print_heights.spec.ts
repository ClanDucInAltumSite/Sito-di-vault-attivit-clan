import { test } from '@playwright/test';

test('Measure exact rendered heights on Page 10 in Chromium (canta and suona)', async ({ page }) => {
  for (const testMode of ['canta', 'suona'] as const) {
    await page.goto('#/stampa');
    await page.waitForTimeout(1000);

    await page.evaluate((m) => {
      const raw = sessionStorage.getItem('stampa_canzoni');
      const cfg = raw ? JSON.parse(raw) : {};
      cfg.mode = m;
      cfg.layoutMode = 'riempi_pagina';
      cfg.includeIndex = true;
      cfg.includeCover = false;
      sessionStorage.setItem('stampa_canzoni', JSON.stringify(cfg));
    }, testMode);

    await page.reload();
    await page.waitForTimeout(1000);

    const checkboxes = await page.$$('.stampa-song-checkbox');
    for (const cb of checkboxes) {
      const isChecked = await cb.isChecked();
      if (!isChecked) await cb.click();
    }
    await page.waitForTimeout(2000);

    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.body.setAttribute('data-print', 'canzoni'));

    const measurements = await page.evaluate(() => {
      const pxToMm = 25.4 / 96;
      const pages = Array.from(document.querySelectorAll('.canzoniere-page'));
      if (!pages.length) return { error: 'No pages' };
      const p10 = pages[Math.min(9, pages.length - 1)] as HTMLElement;
      const p10Rect = p10.getBoundingClientRect();
      const leftCol = p10.querySelector('.canzoniere-column:first-child') as HTMLElement;
      const rightCol = p10.querySelector('.canzoniere-column:last-child') as HTMLElement;
      const leftRect = leftCol?.getBoundingClientRect();
      const rightRect = rightCol?.getBoundingClientRect();

      const getItems = (col: HTMLElement | null) => {
        if (!col) return [];
        return Array.from(col.children).map(c => {
          const r = (c as HTMLElement).getBoundingClientRect();
          const text = (c as HTMLElement).innerText || '';
          return {
            tag: c.tagName,
            className: c.className,
            firstLine: text.split('\n')[0]?.slice(0, 35),
            lastLine: text.split('\n').filter(Boolean).slice(-1)[0]?.slice(0, 35),
            heightMm: r.height * pxToMm,
          };
        });
      };

      return {
        totalPages: pages.length,
        p10HeightMm: p10Rect.height * pxToMm,
        leftColHeightMm: leftRect ? leftRect.height * pxToMm : 0,
        rightColHeightMm: rightRect ? rightRect.height * pxToMm : 0,
        leftItems: getItems(leftCol),
        rightItems: getItems(rightCol),
      };
    });

    console.log(`\n=== REAL MEASUREMENTS IN CHROMIUM PRINT MEDIA (${testMode.toUpperCase()}) ===`);
    console.log('Left Column Rendered Height:', measurements.leftColHeightMm?.toFixed(1), 'mm');
    measurements.leftItems?.forEach((it, i) => {
      console.log(`  L[${i}] ${it.firstLine} -> ${it.lastLine} | h=${it.heightMm?.toFixed(1)}mm (${it.className})`);
    });
    console.log('Right Column Rendered Height:', measurements.rightColHeightMm?.toFixed(1), 'mm');
    measurements.rightItems?.forEach((it, i) => {
      console.log(`  R[${i}] ${it.firstLine} -> ${it.lastLine} | h=${it.heightMm?.toFixed(1)}mm (${it.className})`);
    });
  }
});

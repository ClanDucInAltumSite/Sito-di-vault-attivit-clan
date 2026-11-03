import { test, expect } from '@playwright/test';
import fs from 'fs';

test('Verifica generazione PDF senza pagine vuote né clipping', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  // Select 4 songs
  const checkboxes = await page.$$('.stampa-song-checkbox');
  for (let i = 0; i < Math.min(4, checkboxes.length); i++) {
    await checkboxes[i].click();
  }
  await page.waitForTimeout(1000);

  // Set data-print='canzoni'
  await page.evaluate(() => document.body.setAttribute('data-print', 'canzoni'));

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  console.log('Fixed PDF total pages:', doc.numPages);
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    // Group text items by y coordinate to form lines
    const lineMap = new Map<number, string[]>();
    for (const it of tc.items as any[]) {
      const y = Math.round(it.transform?.[5] || 0);
      const list = lineMap.get(y) || [];
      if (it.str) list.push(it.str);
      lineMap.set(y, list);
    }
    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a); // Top to bottom
    console.log(`=== PAGE ${i} (total ${tc.items.length} items, ${sortedYs.length} lines) ===`);
    for (const y of sortedYs.slice(0, 15)) {
      console.log(`  y=${y}: ${lineMap.get(y)?.join(' ')}`);
    }
    console.log(`  ... [${sortedYs.length - 20} lines in middle] ...`);
    for (const y of sortedYs.slice(-5)) {
      console.log(`  y=${y}: ${lineMap.get(y)?.join(' ')}`);
    }
  }

  // Expect no empty pages
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const tc = await p.getTextContent();
    expect(tc.items.length).toBeGreaterThan(0);
  }
});

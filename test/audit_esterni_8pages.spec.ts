import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('Misura clearance e layout reale per Canzoni Esterne e Tutti i Canti', async ({ page }) => {
  test.setTimeout(90000);

  await page.goto('#/stampa');
  await page.waitForTimeout(1500);

  // Imposta modalita suona
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stampa_canzoni');
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.mode = 'suona';
    cfg.layoutMode = 'riempi_pagina';
    cfg.includeIndex = false;
    cfg.includeCover = false;
    sessionStorage.setItem('stampa_canzoni', JSON.stringify(cfg));
  });

  await page.reload();
  await page.waitForTimeout(1000);

  // Deseleziona tutto prima
  const checkboxes = await page.$$('.stampa-song-checkbox');
  for (const cb of checkboxes) {
    if (await cb.isChecked()) {
      await cb.click();
    }
  }

  // Seleziona solo le canzoni esterne
  // Nel DOM ogni checkbox ha accanto il titolo o categoria
  await page.evaluate(() => {
    const songItems = Array.from(document.querySelectorAll('.stampa-song-item'));
    for (const item of songItems) {
      const text = item.textContent || '';
      // Canzoni esterne
      const isEsterna = text.includes('Aglio e Olio') ||
        text.includes('Albachiara') ||
        text.includes('I cento passi') ||
        text.includes('Destri') ||
        text.includes('Il gatto e la volpe') ||
        text.includes('Riptide') ||
        text.includes('Se piovesse il tuo nome') ||
        text.includes('Wonderwall');
      const cb = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (cb && isEsterna && !cb.checked) {
        cb.click();
      }
    }
  });

  await page.waitForTimeout(2000);

  // Prepara body per print canzoni
  await page.evaluate(() => document.body.setAttribute('data-print', 'canzoni'));

  // Genera PDF per le 8 canzoni esterne
  const pdfBuf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  fs.writeFileSync('scratch/esterni_8pages.pdf', pdfBuf);
  console.log('Generato scratch/esterni_8pages.pdf:', pdfBuf.length, 'bytes');

  // Ora misuriamo elemento per elemento in Chromium!
  const audit = await page.evaluate(() => {
    const pages = Array.from(document.querySelectorAll('.canzoniere-page'));
    return pages.map((p, pIdx) => {
      const pRect = p.getBoundingClientRect();
      const colLeft = p.querySelector('.canzoniere-col-left');
      const colRight = p.querySelector('.canzoniere-col-right');
      const footer = p.querySelector('.canzoniere-page-footer');

      const colLeftRect = colLeft ? colLeft.getBoundingClientRect() : null;
      const colRightRect = colRight ? colRight.getBoundingClientRect() : null;
      const footerRect = footer ? footer.getBoundingClientRect() : null;

      // Trova l'elemento piu basso nella colonna sinistra e destra
      let maxBottomLeft = colLeftRect ? colLeftRect.top : 0;
      let lowestElemLeft = '';
      if (colLeft) {
        const allDesc = Array.from(colLeft.querySelectorAll('*'));
        for (const el of allDesc) {
          const r = el.getBoundingClientRect();
          if (r.bottom > maxBottomLeft && r.height > 0) {
            maxBottomLeft = r.bottom;
            lowestElemLeft = `${el.tagName}.${el.className} [${(el.textContent || '').trim().slice(0, 30)}]`;
          }
        }
      }

      let maxBottomRight = colRightRect ? colRightRect.top : 0;
      let lowestElemRight = '';
      if (colRight) {
        const allDesc = Array.from(colRight.querySelectorAll('*'));
        for (const el of allDesc) {
          const r = el.getBoundingClientRect();
          if (r.bottom > maxBottomRight && r.height > 0) {
            maxBottomRight = r.bottom;
            lowestElemRight = `${el.tagName}.${el.className} [${(el.textContent || '').trim().slice(0, 30)}]`;
          }
        }
      }

      // Card boundary
      const cardBottom = pRect.bottom;
      const cardHeightMm = pRect.height * 0.264583;

      // mm dal fondo della card
      const clearanceLeftMm = (cardBottom - maxBottomLeft) * 0.264583;
      const clearanceRightMm = (cardBottom - maxBottomRight) * 0.264583;

      // Overflow se il contenuto sfora la card (o il footer)
      const footerTop = footerRect ? footerRect.top : cardBottom;
      const clearanceLeftToFooterMm = (footerTop - maxBottomLeft) * 0.264583;
      const clearanceRightToFooterMm = (footerTop - maxBottomRight) * 0.264583;

      return {
        pageNum: pIdx + 1,
        cardHeightMm: cardHeightMm.toFixed(2),
        clearanceLeftMm: clearanceLeftMm.toFixed(2),
        clearanceRightMm: clearanceRightMm.toFixed(2),
        clearanceLeftToFooterMm: clearanceLeftToFooterMm.toFixed(2),
        clearanceRightToFooterMm: clearanceRightToFooterMm.toFixed(2),
        lowestElemLeft,
        lowestElemRight,
      };
    });
  });

  console.log('--- DETTAGLIO CLEARANCE PAGINE ESTERNE (8 CANZONI) ---');
  for (const row of audit) {
    console.log(
      `PAGINA ${row.pageNum}: Card ${row.cardHeightMm}mm | ColLeft clearance to footer: ${row.clearanceLeftToFooterMm}mm | ColRight clearance to footer: ${row.clearanceRightToFooterMm}mm`
    );
    if (parseFloat(row.clearanceLeftToFooterMm) < 0) {
      console.log(`  -> OVERFLOW COLONNA SINISTRA: ${row.clearanceLeftToFooterMm}mm! Lowest: ${row.lowestElemLeft}`);
    }
    if (parseFloat(row.clearanceRightToFooterMm) < 0) {
      console.log(`  -> OVERFLOW COLONNA DESTRA: ${row.clearanceRightToFooterMm}mm! Lowest: ${row.lowestElemRight}`);
    }
  }
});

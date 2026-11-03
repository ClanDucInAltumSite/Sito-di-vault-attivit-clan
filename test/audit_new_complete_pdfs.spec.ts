import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

async function auditPdf(filePath: string, label: string) {
  const buf = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: buf });
  const res = await parser.getText();
  console.log('==================================================');
  console.log('AUDIT REPORT: ' + label + ' (' + filePath + ')');
  console.log('Total Pages: ' + res.pages.length);
  console.log('==================================================');

  let totalIssues = 0;

  for (let pIdx = 0; pIdx < res.pages.length; pIdx++) {
    const p = res.pages[pIdx];
    const lines = p.text.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const pageNum = pIdx + 1;
    const issues: string[] = [];

    // Top starts with orphan RIT
    if (/^RIT[.:]?$/i.test(lines[0] || '')) {
      issues.push('Page starts with orphan RIT: ' + lines.slice(0, 3).join(' | '));
    }

    // Multiple consecutive RIT
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^RIT[.:]?$/i.test(lines[i]) && /^RIT[.:]?$/i.test(lines[i + 1])) {
        issues.push('Consecutive RIT at lines ' + (i + 1) + '-' + (i + 2) + ': [' + lines[i] + ', ' + lines[i + 1] + ']');
      }
    }

    // Very short page (low fill, except index)
    if (lines.length < 25 && pageNum > 1 && pageNum === res.pages.length) {
      issues.push('Very few lines on final page (' + lines.length + ' lines)');
    }

    console.log(
      'PAGE ' + pageNum + ': lines=' + lines.length + (issues.length ? ' [ISSUES: ' + issues.length + ']' : ' [OK]')
    );
    if (issues.length > 0) {
      totalIssues += issues.length;
      issues.forEach((iss) => console.log('   -> ' + iss));
    }
    console.log('   Preview top 3: ' + JSON.stringify(lines.slice(0, 3)));
    console.log('   Preview btm 3: ' + JSON.stringify(lines.slice(-3)));
  }

  return { totalPages: res.pages.length, totalIssues };
}

test('Audit completo PDF reali per Chi suona e Chi canta', async ({ page }) => {
  test.setTimeout(90000);

  // 1. CHI SUONA
  await page.goto('#/stampa');
  await page.waitForTimeout(1500);

  // Seleziona tutti i canti ed imposta modalita suona
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stampa_canzoni');
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.mode = 'suona';
    cfg.layoutMode = 'riempi_pagina';
    cfg.includeIndex = true;
    cfg.includeCover = false;
    sessionStorage.setItem('stampa_canzoni', JSON.stringify(cfg));
  });

  // Ricarica per applicare configurazione
  await page.reload();
  await page.waitForTimeout(1000);

  // Seleziona tutti i checkbox
  const checkboxes = await page.$$('.stampa-song-checkbox');
  for (const cb of checkboxes) {
    const isChecked = await cb.isChecked();
    if (!isChecked) {
      await cb.click();
    }
  }
  await page.waitForTimeout(2000);

  // Prepara body per print canzoni
  await page.evaluate(() => document.body.setAttribute('data-print', 'canzoni'));

  const pdfSuonaPath = path.resolve('scratch/new_suona.pdf');
  const pdfSuonaBuf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  fs.writeFileSync(pdfSuonaPath, pdfSuonaBuf);
  console.log('Generato new_suona.pdf:', pdfSuonaBuf.length, 'bytes');

  // 2. CHI CANTA
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stampa_canzoni');
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.mode = 'canta';
    sessionStorage.setItem('stampa_canzoni', JSON.stringify(cfg));
  });
  await page.reload();
  await page.waitForTimeout(1000);

  // Assicurati che tutti i canti siano selezionati
  const checkboxesCanta = await page.$$('.stampa-song-checkbox');
  for (const cb of checkboxesCanta) {
    const isChecked = await cb.isChecked();
    if (!isChecked) {
      await cb.click();
    }
  }
  await page.waitForTimeout(2000);

  await page.evaluate(() => document.body.setAttribute('data-print', 'canzoni'));

  const pdfCantaPath = path.resolve('scratch/new_canta.pdf');
  const pdfCantaBuf = await page.pdf({
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  fs.writeFileSync(pdfCantaPath, pdfCantaBuf);
  console.log('Generato new_canta.pdf:', pdfCantaBuf.length, 'bytes');

  // AUDIT ENTRAMBI I PDF
  const auditSuona = await auditPdf(pdfSuonaPath, 'CHI SUONA (con accordi)');
  const auditCanta = await auditPdf(pdfCantaPath, 'CHI CANTA (solo testo)');

  expect(auditSuona.totalIssues).toBe(0);
  expect(auditCanta.totalIssues).toBe(0);
});

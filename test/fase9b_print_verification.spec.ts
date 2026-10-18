import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('FASE 9B — Verifica Finale Stampa PDF, Font Incorporati e Geometria Reale', () => {
  test('Verifica PDF: Roboto e Nova Mono incorporati, 0 Arial, 0 Consolas, geometria 16.5 pt e zero direttive', async ({
    page,
  }) => {
    // 1. Inizializza contesto
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    // 2. Inserimento Canto Sintetico di Prova con frecce ritmo, accordi su sillaba e direttive
    await page.evaluate(async () => {
      const DB_NAME = 'vault_scout_db';
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['canti'], 'readwrite');
          const cStore = tx.objectStore('canti');

          // Canto sintetico con struttura rappresentativa del canzoniere:
          // - frecce Nova Mono (↓ ↑ ↓↑)
          // - accordi su sillabe a metà parola ("cam[Re]mino")
          // - righe senza accordi
          // - direttiva {nuova_colonna} che deve essere invisibile
          // - etichetta RIT.
          const songChordPro = [
            '{title: CANTO DEL SENTIERO LUMINOSO}',
            '{artist: Autore di Prova}',
            '{tempo: 4/4}',
            '{bpm: circa 92–94}',
            '{ritmo: Giù, Giù-Su (↓ ↑ ↓↑)}',
            '{capotasto: 2}',
            '[Do]Lungo la strada ma[Sol]estra noi pro[Lam]seguiamo,',
            'questa è una riga pura di solo testo senza accordi,',
            'in un lungo cam[Re]mino verso il crinale al tramonto.',
            '',
            'RIT.',
            '[Do]Guarda la cima che [Sol]brilla nel cielo sereno,',
            '[Fa]tutti uniti in cam[Sol]mino can[Do]tiamo.',
            '',
            '{nuova_colonna}',
            '[Lam]Seconda colonna che [Mim]apre la nuova strofa,',
            '[Fa]sotto le stelle che [Sol]vegliano il nostro bivacco.',
            'Ed il vento leggero accarezza i nostri pensieri.',
            '',
            'RIT.',
            '[Do]Guarda la cima che [Sol]brilla nel cielo sereno,',
            '[Fa]tutti uniti in cam[Sol]mino can[Do]tiamo.',
          ].join('\n');

          cStore.put({
            id: 'canto-fase9b-test',
            titolo: 'CANTO DEL SENTIERO LUMINOSO',
            autore: 'Autore di Prova',
            tonalita: 'Do',
            ritmo: 'Giù, Giù-Su (↓ ↑ ↓↑)',
            tempo_bpm: 94,
            bpm_testo: 'circa 92–94',
            misura: '4/4',
            capotasto: 2,
            testo_chordpro: songChordPro,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    });

    // 3. Configura selezione per la stampa con solo questo canto, senza copertina né indice
    await page.evaluate(() => {
      const config = {
        selectedGiochiIds: [],
        selectedBansIds: [],
        selectedCantiIds: ['canto-fase9b-test'],
        includeImages: false,
        includeCoverAndIndex: false,
      };
      sessionStorage.setItem('stampa_selection', JSON.stringify(config));
    });

    // 4. Naviga a #/stampa
    await page.goto('#/stampa');
    await page.waitForLoadState('networkidle');

    // Attendi che il contenitore di stampa e la pagina del canzoniere siano montati nel DOM
    const printContainer = page.locator('.stampa-print-container');
    await expect(printContainer).toBeAttached({ timeout: 15000 });
    await expect(page.locator('.canzoniere-page').first()).toBeAttached({ timeout: 15000 });

    // 5. Attiva modalità @media print: rende visibile il foglio A4 e nasconde i controlli a schermo
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.canzoniere-page').first()).toBeVisible({ timeout: 10000 });

    // 6. Attendi che i font del Canzoniere siano caricati in pagina
    await page.evaluate(async () => {
      if (document.fonts) {
        await Promise.all([
          document.fonts.load('400 11pt Roboto'),
          document.fonts.load('italic 11pt Roboto'),
          document.fonts.load('700 11pt Roboto'),
          document.fonts.load('700 22pt Roboto'),
          document.fonts.load('400 17pt "Nova Mono"'),
          document.fonts.load('700 17pt "Nova Mono"'),
          document.fonts.ready,
        ]);
      }
    });

    // 7. Genera PDF reale con Chromium
    const pdfDir = path.resolve(process.cwd(), 'docs/design-review/print');
    const pdfPath = path.join(pdfDir, 'fase9b_canto_verification.pdf');

    const pdfBuffer = await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        bottom: '0mm',
        left: '0mm',
        right: '0mm',
      },
    });

    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(2000);

    // 8. Verifica binaria dei font incorporati nel PDF generato da Chromium
    const pdfString = pdfBuffer.toString('latin1');
    const baseFontMatches = pdfString.match(/\/BaseFont\s*\/([^\s\/]+)/g) || [];
    console.log('[FASE 9B] BaseFont nel PDF generato:', baseFontMatches);

    // Deve incorporare Roboto
    const hasRoboto = baseFontMatches.some((f) => f.includes('Roboto'));
    expect(hasRoboto, 'Il PDF stampato deve incorporare il font Roboto').toBe(true);

    // Deve incorporare Nova Mono (per le frecce ritmo ↓ ↑)
    const hasNovaMono = baseFontMatches.some((f) => f.includes('NovaMono') || f.includes('Nova Mono'));
    expect(hasNovaMono, 'Il PDF stampato deve incorporare il font Nova Mono').toBe(true);

    // NON deve contenere font di fallback (0 Arial e 0 Consolas)
    const hasArial = baseFontMatches.some((f) => f.includes('Arial'));
    const hasConsolas = baseFontMatches.some((f) => f.includes('Consolas'));
    expect(hasArial, 'Il PDF non deve contenere Arial (trovato fallback)').toBe(false);
    expect(hasConsolas, 'Il PDF non deve contenere Consolas (trovato fallback)').toBe(false);

    // 9. Verifica dell'invisibilità delle direttive
    const bodyText = await page.locator('.canzoniere-page').first().innerText();
    expect(bodyText).not.toContain('{nuova_colonna}');
    expect(bodyText).not.toContain('{nc}');
    expect(bodyText).not.toContain('{nuova_pagina}');
    expect(bodyText).not.toContain('{np}');
    expect(bodyText).not.toContain('{title:');
    expect(bodyText).not.toContain('{ritmo:');

    // 10. Verifica dei parametri d'intestazione: BPM testuale esatto e frecce ritmo
    expect(bodyText).toContain('circa 92–94');
    expect(bodyText).toContain('Capotasto: 2');

    // Verifica glifi frecce renderizzati con la classe Nova Mono
    const arrowGlyphs = page.locator('.canzoniere-arrow-glyph');
    await expect(arrowGlyphs.first()).toBeVisible();
    const allArrows = (await arrowGlyphs.allInnerTexts()).join(' ');
    expect(allArrows).toContain('↓');
    expect(allArrows).toContain('↑');

    // 11. Verifica ancoraggio accordi a larghezza zero e integrità sillaba
    const chordAnchor = page.locator('.canzoniere-chord-anchor').first();
    await expect(chordAnchor).toBeAttached();
    const anchorWidth = await chordAnchor.evaluate((el) => el.getBoundingClientRect().width);
    expect(anchorWidth).toBeLessThanOrEqual(1); // zero-width inline anchor

    const chordBadge = page.locator('.canzoniere-chord-badge').first();
    await expect(chordBadge).toBeVisible();

    // Verifica che "cammino" con accordo a metà parola contenga le due parti sillabiche cam e mino
    const camminoLine = page.locator('.canzoniere-line-item', { hasText: 'crinale' }).first();
    await expect(camminoLine).toBeVisible();
    const camminoText = await camminoLine.innerText();
    expect(camminoText).toContain('cam');
    expect(camminoText).toContain('mino');
    expect(camminoText).toContain('crinale');

    // 12. Verifica geometria: riga senza accordi non ha margin-top elevato
    const lineWithoutChords = page.locator('.canzoniere-line-item:not(.has-chords)').first();
    await expect(lineWithoutChords).toBeVisible();
    const noChordMargin = await lineWithoutChords.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).marginTop);
    });
    expect(noChordMargin).toBeLessThanOrEqual(4); // Non deve riservare spazio vuoto per accordi inesistenti

    // Riga con accordi ha spazio sopra per gli accordi (~16.5 pt / ~22 px)
    const lineWithChords = page.locator('.canzoniere-line-item.has-chords').first();
    await expect(lineWithChords).toBeVisible();
    const chordMargin = await lineWithChords.evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).marginTop);
    });
    expect(chordMargin).toBeGreaterThanOrEqual(18); // ~1.5em su font 11 pt (≈ 22px)

    // 13. Salva screenshot rasterizzato ad alta fedeltà A4 del canto di verifica
    const pagePaper = page.locator('.canzoniere-page').first();
    const sampleImgPath = path.join(pdfDir, 'fase9b_canto_sample.png');
    await pagePaper.screenshot({ path: sampleImgPath });
    expect(fs.existsSync(sampleImgPath)).toBe(true);
    console.log('[FASE 9B] Screenshot del canto verificato salvato in:', sampleImgPath);
  });
});

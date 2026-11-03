import { test } from '@playwright/test';

test('Debug exact songs and layout in browser', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  const debugInfo = await page.evaluate(async () => {
    const raw = sessionStorage.getItem('stampa_canzoni');
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.mode = 'canta';
    sessionStorage.setItem('stampa_canzoni', JSON.stringify(cfg));

    // Get the songs from the window / DB
    const { getCanti } = await import('/src/lib/db.ts');
    const { loadPrintableCanzoniData, applyRitRepeatPolicy, sortSongsBySector } = await import('/src/lib/stampa_canzoni.ts');
    const { layoutCanzoniereFlow } = await import('/src/features/canti/canzoniere_layout.ts');
    const { DEFAULT_PARSED_SONGS, DANZA_LA_VITA_PARSED } = await import('/src/data/parsed_songs.ts');

    const dbCanti = await getCanti(false);
    console.log('Browser dbCanti count:', dbCanti.length);

    const enriched = dbCanti.map((c: any) => {
      if (
        c.id === DANZA_LA_VITA_PARSED.id &&
        (!c.testo_chordpro.includes('Cammina sulle [Fa]orme') ||
          c.testo_chordpro.includes('cuor. Danza assieme a no----------------oi!'))
      ) {
        return { ...c, ...DANZA_LA_VITA_PARSED };
      }
      return c;
    });
    for (const defSong of DEFAULT_PARSED_SONGS) {
      const idx = enriched.findIndex(
        (c: any) => c.id === defSong.id || c.titolo.toLowerCase() === defSong.titolo.toLowerCase()
      );
      if (idx === -1) {
        enriched.push(defSong);
      } else {
        const existing = enriched[idx];
        if (existing && !existing.testo_chordpro && defSong.testo_chordpro) {
          enriched[idx] = { ...existing, ...defSong };
        }
      }
    }

    const sorted = sortSongsBySector(enriched);
    const applied = sorted.map((s: any) => applyRitRepeatPolicy(s, 'canta'));
    const flowRes = layoutCanzoniereFlow(applied, { mode: 'canta', layoutMode: 'riempi_pagina' });

    return {
      dbCount: dbCanti.length,
      enrichedCount: enriched.length,
      flowPagesCount: flowRes.pages.length,
      songs: sorted.map((s: any) => ({ id: s.id, titolo: s.titolo, lines: s.testo_chordpro.split('\n').length })),
      pagesSummary: flowRes.pages.map((p: any, idx: number) => ({
        p: idx + 1,
        leftH: p.leftColumn.totalHeightMm,
        leftLines: p.leftColumn.linesCount,
        rightH: p.rightColumn.totalHeightMm,
        rightLines: p.rightColumn.linesCount,
        firstTitle: p.leftColumn.blocks.find((b: any) => b.type === 'header')?.header?.title,
      })),
    };
  });

  console.log('Browser debug result:');
  console.log('Enriched count:', debugInfo.enrichedCount);
  console.log('Flow pages count:', debugInfo.flowPagesCount);
  console.log('Pages summary:');
  debugInfo.pagesSummary.forEach((p: any) => {
    console.log(`Page ${p.p}: Left=${p.leftH.toFixed(1)}mm (${p.leftLines} lines), Right=${p.rightH.toFixed(1)}mm (${p.rightLines} lines) | FirstTitle: ${p.firstTitle}`);
  });
});

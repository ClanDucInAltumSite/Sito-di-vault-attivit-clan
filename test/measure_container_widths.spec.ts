import { test } from '@playwright/test';

test('Misura esatta larghezze container in Chromium print layout', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);
  await page.emulateMedia({ media: 'print' });

  const res = await page.evaluate(() => {
    document.body.setAttribute('data-print', 'canzoni');

    // Trova le vere pagine renderizzate dall'applicazione
    const appPages = Array.from(document.querySelectorAll('.canzoniere-page'));
    if (appPages.length > 0) {
      const p = appPages[0]!;
      const colL = p.querySelector('.canzoniere-column-left');
      const colR = p.querySelector('.canzoniere-column-right');
      const block = p.querySelector('.canzoniere-block');
      const chorusBlock = p.querySelector('.canzoniere-block.is-chorus');
      return {
        type: 'real_app_page',
        pageWidth: p.getBoundingClientRect().width * 0.264583,
        colLWidth: colL ? colL.getBoundingClientRect().width * 0.264583 : 0,
        colLClientWidth: colL ? colL.clientWidth * 0.264583 : 0,
        colRWidth: colR ? colR.getBoundingClientRect().width * 0.264583 : 0,
        blockWidth: block ? block.getBoundingClientRect().width * 0.264583 : 0,
        chorusWidth: chorusBlock ? chorusBlock.getBoundingClientRect().width * 0.264583 : 0,
      };
    }

    // Se non ci sono pagine, simuliamo
    const host = document.createElement('div');
    host.className = 'stampa-print-container stampa-print-container-canzoni';
    const card = document.createElement('div');
    card.className = 'stampa-a4-sheet-card';
    const p = document.createElement('div');
    p.className = 'canzoniere-page print-song-page';
    const cols = document.createElement('div');
    cols.className = 'canzoniere-columns-container is-two-columns';
    const colL = document.createElement('div');
    colL.className = 'canzoniere-column canzoniere-column-left';
    const colR = document.createElement('div');
    colR.className = 'canzoniere-column canzoniere-column-right';
    
    cols.appendChild(colL);
    cols.appendChild(colR);
    p.appendChild(cols);
    card.appendChild(p);
    host.appendChild(card);
    document.body.appendChild(host);

    const r = {
      type: 'simulated_card',
      cardWidthMm: card.getBoundingClientRect().width * 0.264583,
      pageWidthMm: p.getBoundingClientRect().width * 0.264583,
      colLWidthMm: colL.getBoundingClientRect().width * 0.264583,
      colLClientWidthMm: colL.clientWidth * 0.264583,
      colRWidthMm: colR.getBoundingClientRect().width * 0.264583,
    };
    document.body.removeChild(host);
    return r;
  });

  console.log('RISULTATO MISURA LARGHEZZE:', res);
});

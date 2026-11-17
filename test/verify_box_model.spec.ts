import { test } from '@playwright/test';

test('Verifica larghezze esatte box model', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  const res = await page.evaluate(() => {
    document.body.setAttribute('data-print', 'canzoni');

    const pageHost = document.createElement('div');
    pageHost.className = 'canzoniere-page print-song-page';
    pageHost.style.position = 'absolute';
    pageHost.style.top = '0';
    pageHost.style.left = '0';
    pageHost.style.width = '186mm';

    const colContainer = document.createElement('div');
    colContainer.className = 'canzoniere-columns-container is-two-columns';

    const colLeft = document.createElement('div');
    colLeft.className = 'canzoniere-column canzoniere-column-left';

    const colRight = document.createElement('div');
    colRight.className = 'canzoniere-column canzoniere-column-right';

    colContainer.appendChild(colLeft);
    colContainer.appendChild(colRight);
    pageHost.appendChild(colContainer);
    document.body.appendChild(pageHost);

    const r = {
      pageHostWidthPx: pageHost.getBoundingClientRect().width,
      pageHostWidthMm: pageHost.getBoundingClientRect().width * 0.264583,
      colContainerWidthPx: colContainer.getBoundingClientRect().width,
      colContainerWidthMm: colContainer.getBoundingClientRect().width * 0.264583,
      colLeftWidthPx: colLeft.getBoundingClientRect().width,
      colLeftWidthMm: colLeft.getBoundingClientRect().width * 0.264583,
      colLeftPaddingRightPx: window.getComputedStyle(colLeft).paddingRight,
      colLeftContentWidthMm: (colLeft.getBoundingClientRect().width - parseFloat(window.getComputedStyle(colLeft).paddingRight)) * 0.264583,
      colRightWidthMm: colRight.getBoundingClientRect().width * 0.264583,
    };
    document.body.removeChild(pageHost);
    return r;
  });

  console.log('BOX MODEL MISURATO:', res);
});

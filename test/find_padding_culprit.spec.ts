import { test } from '@playwright/test';

test('Chi applica 12mm di padding su pageHost o colContainer?', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  const styles = await page.evaluate(() => {
    document.body.setAttribute('data-print', 'canzoni');

    const pageHost = document.createElement('div');
    pageHost.className = 'canzoniere-page print-song-page';
    pageHost.style.position = 'absolute';
    pageHost.style.top = '0';
    pageHost.style.left = '0';
    pageHost.style.width = '186mm';

    const colContainer = document.createElement('div');
    colContainer.className = 'canzoniere-columns-container is-two-columns';

    pageHost.appendChild(colContainer);
    document.body.appendChild(pageHost);

    const sHost = window.getComputedStyle(pageHost);
    const sCols = window.getComputedStyle(colContainer);

    const r = {
      pageHostPadding: `${sHost.paddingTop} ${sHost.paddingRight} ${sHost.paddingBottom} ${sHost.paddingLeft}`,
      pageHostMargin: `${sHost.marginTop} ${sHost.marginRight} ${sHost.marginBottom} ${sHost.marginLeft}`,
      colContainerPadding: `${sCols.paddingTop} ${sCols.paddingRight} ${sCols.paddingBottom} ${sCols.paddingLeft}`,
      colContainerMargin: `${sCols.marginTop} ${sCols.marginRight} ${sCols.marginBottom} ${sCols.marginLeft}`,
    };
    document.body.removeChild(pageHost);
    return r;
  });

  console.log('PADDING E MARGINI REALI:', styles);
});

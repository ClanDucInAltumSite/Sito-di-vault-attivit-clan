import { test } from '@playwright/test';

test('Dump browser layout for canta', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1500);

  // Set canta mode
  await page.evaluate(() => {
    const raw = sessionStorage.getItem('stampa_canzoni');
    const cfg = raw ? JSON.parse(raw) : {};
    cfg.mode = 'canta';
    sessionStorage.setItem('stampa_canzoni', JSON.stringify(cfg));
  });
  await page.reload();
  await page.waitForTimeout(1000);

  // Select all checkboxes
  const checkboxesCanta = await page.$$('.stampa-song-checkbox');
  for (const cb of checkboxesCanta) {
    const isChecked = await cb.isChecked();
    if (!isChecked) await cb.click();
  }
  await page.waitForTimeout(2000);

  // Extract layout info from page
  const debugInfo = await page.evaluate(() => {
    // Look at the rendered pages in the DOM
    const printPages = Array.from(document.querySelectorAll('.canzoniere-page'));
    return printPages.map((p, idx) => {
      const leftCol = p.querySelector('.canzoniere-column:first-child');
      const rightCol = p.querySelector('.canzoniere-column:last-child');
      
      const getColText = (col: Element | null) => {
        if (!col) return [];
        return Array.from(col.children).map(c => {
          const isHdr = c.classList.contains('canzoniere-block-header');
          const isBlk = c.classList.contains('canzoniere-block');
          const text = (c as HTMLElement).innerText || '';
          return { isHdr, isBlk, textFirstLine: text.split('\n')[0], textLastLine: text.split('\n').filter(Boolean).slice(-1)[0], heightPx: (c as HTMLElement).offsetHeight };
        });
      };

      return {
        pageNum: idx + 1,
        left: getColText(leftCol),
        right: getColText(rightCol)
      };
    });
  });

  console.log('DOM printPages count:', debugInfo.length);
  // Print DOM page 9 (index 8, book page 10)
  console.log('\n=== DOM PAGE 9 (Book page 10) ===');
  console.log('LEFT:');
  debugInfo[8]?.left.forEach(b => console.log('  ', b.isHdr ? '[HDR]' : '[BLK]', b.heightPx + 'px', b.textFirstLine, '->', b.textLastLine));
  console.log('RIGHT:');
  debugInfo[8]?.right.forEach(b => console.log('  ', b.isHdr ? '[HDR]' : '[BLK]', b.heightPx + 'px', b.textFirstLine, '->', b.textLastLine));

  console.log('\n=== DOM PAGE 10 (Book page 11) ===');
  console.log('LEFT:');
  debugInfo[9]?.left.forEach(b => console.log('  ', b.isHdr ? '[HDR]' : '[BLK]', b.heightPx + 'px', b.textFirstLine, '->', b.textLastLine));
  console.log('RIGHT:');
  debugInfo[9]?.right.forEach(b => console.log('  ', b.isHdr ? '[HDR]' : '[BLK]', b.heightPx + 'px', b.textFirstLine, '->', b.textLastLine));
});

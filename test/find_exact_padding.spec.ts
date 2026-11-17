import { test } from '@playwright/test';

test('Trova esattamente la proprieta che setta padding', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  const res = await page.evaluate(() => {
    document.body.setAttribute('data-print', 'canzoni');
    const p = document.createElement('div');
    p.className = 'canzoniere-page print-song-page';
    document.body.appendChild(p);

    const s = window.getComputedStyle(p);
    const result: string[] = [];

    // Check all CSS rules
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule instanceof CSSStyleRule) {
            if (p.matches(rule.selectorText)) {
              if (rule.style.paddingTop || rule.style.padding) {
                result.push(`${rule.selectorText} -> pt:${rule.style.paddingTop}, p:${rule.style.padding}`);
              }
            }
          }
        }
      } catch(e) {}
    }
    document.body.removeChild(p);
    return { computed: s.padding, matchedRules: result };
  });

  console.log('RISULTATO PADDING:', res);
});

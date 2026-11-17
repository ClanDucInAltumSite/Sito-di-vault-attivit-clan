import { test } from '@playwright/test';

test('Quale regola CSS imposta padding su canzoniere-page?', async ({ page }) => {
  await page.goto('#/stampa');
  await page.waitForTimeout(1000);

  const matched = await page.evaluate(() => {
    document.body.setAttribute('data-print', 'canzoni');
    const p = document.createElement('div');
    p.className = 'canzoniere-page print-song-page';
    document.body.appendChild(p);

    const rules: string[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule instanceof CSSStyleRule) {
            if (p.matches(rule.selectorText) && rule.style.padding) {
              rules.push(`${rule.selectorText} { padding: ${rule.style.padding} } from ${sheet.href || 'inline'}`);
            }
          }
        }
      } catch (e) {}
    }
    document.body.removeChild(p);
    return rules;
  });

  console.log('REGOLE CSS PADDING TROVATE:', matched);
});

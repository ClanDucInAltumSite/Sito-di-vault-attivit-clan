import { test, expect } from '@playwright/test';

test.describe('Modalità Lettura con Auto-Scroll sincronizzato al Beat (Mobile)', () => {
  test('Apre un canto in modalità lettura su mobile e verifica dock di scorrimento automatico', async ({ page }) => {
    // Simula iPhone 13/14 (390 x 844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('#/canti');
    await page.waitForLoadState('networkidle');

    console.log('Passo 1: apertura canto');
    const songItem = page.locator('button:has-text("STRADE DI CORAGGIO"), button:has-text("Strade di coraggio")').first();
    await expect(songItem).toBeVisible({ timeout: 10000 });
    await songItem.click();

    console.log('Passo 2: verifica readingTitle');
    const readingTitle = page.locator('h1.song-title-display');
    await expect(readingTitle).toBeVisible({ timeout: 5000 });

    console.log('Passo 3: toggle Auto-scroll');
    const autoScrollToggle = page.locator('button:has-text("Auto-scroll")').first();
    await expect(autoScrollToggle).toBeVisible();
    await autoScrollToggle.click();

    console.log('Passo 4: verifica Auto-scroll On');
    await expect(page.locator('button:has-text("Auto-scroll On")')).toBeVisible();

    console.log('Passo 5: verifica dock');
    const dock = page.locator('.reading-autoscroll-dock');
    await expect(dock).toBeVisible();

    console.log('Passo 6: attesa scorrimento');
    await page.waitForTimeout(1000);
    const scrollTop = await page.evaluate(() => {
      const el = document.getElementById('reading-mode-scroll-container');
      return el ? el.scrollTop : -1;
    });
    console.log('ScrollTop attuale:', scrollTop);

    console.log('Passo 7: click pausa');
    const pauseBtn = dock.locator('button:has-text("Pausa")');
    await expect(pauseBtn).toBeVisible();
    await pauseBtn.click({ force: true });

    console.log('Passo 8: verifica riprendi');
    const resumeBtn = dock.locator('button:has-text("Riprendi")');
    await expect(resumeBtn).toBeVisible({ timeout: 3000 });

    console.log('Passo 9: rewind');
    const rewindBtn = dock.locator('button[aria-label="Torna all\'inizio del canto"]');
    await rewindBtn.click({ force: true });
    await page.waitForTimeout(200);

    const scrollTopAfterRewind = await page.evaluate(() => {
      const el = document.getElementById('reading-mode-scroll-container');
      return el ? el.scrollTop : -1;
    });
    console.log('ScrollTop dopo rewind:', scrollTopAfterRewind);
    expect(scrollTopAfterRewind).toBe(0);

    console.log('Passo 10: chiusura reading mode');
    const backBtn = page.locator('button[aria-label="Torna all\'elenco dei canti"]');
    await backBtn.click();
    await expect(readingTitle).not.toBeVisible();
    console.log('Test completato con successo!');
  });
});

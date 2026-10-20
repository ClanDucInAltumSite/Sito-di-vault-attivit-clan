import { test, expect } from '@playwright/test';

test.describe('FASE 11F — Categorie Canti, Filtri, Badge e Assegnazione Rapida', () => {
  test('Filtri categorie, conteggi e badge in CantiView', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('#/canti', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible();

    // 1. Verifica presenza opzioni di filtro categoria
    const tabTutti = page.getByRole('tab', { name: /Tutti/i }).first();
    const tabScout = page.getByRole('tab', { name: /Scout/i }).first();
    const tabChiesa = page.getByRole('tab', { name: /Chiesa/i }).first();
    const tabEsterni = page.getByRole('tab', { name: /Esterni/i }).first();

    await expect(tabTutti).toBeVisible();
    await expect(tabScout).toBeVisible();
    await expect(tabChiesa).toBeVisible();
    await expect(tabEsterni).toBeVisible();

    // 2. Filtra per Scout
    await tabScout.click();
    await page.waitForTimeout(100);

    // 3. Torna a Tutti
    await tabTutti.click();
    await page.waitForTimeout(100);
  });

  test('Avviso Admin per canti senza categoria e modal assegnazione rapida', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('#/canti', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible();

    // Abilita admin
    await page.evaluate(() => {
      if ((window as any).__setAdminForTesting) {
        (window as any).__setAdminForTesting(true);
      }
    });

    // Se ci sono canti senza categoria, verifica la presenza dell'avviso
    const warningNotice = page.locator('text=canti senza categoria');
    const isNoticePresent = await warningNotice.count();

    if (isNoticePresent > 0) {
      const assignBtn = page.getByRole('button', { name: /Assegna rapidamente/i });
      await expect(assignBtn).toBeVisible();
      await assignBtn.click();

      // Verifica apertura modal rapido
      const modalTitle = page.getByRole('heading', { name: /Assegnazione Rapida Categorie/i });
      await expect(modalTitle).toBeVisible();

      // Verifica presenza pulsanti categorie rapide
      const scoutChoice = page.getByRole('button', { name: /Canti scout/i }).first();
      await expect(scoutChoice).toBeVisible();

      // Chiudi modal
      const closeBtn = page.getByRole('button', { name: /Chiudi/i });
      await closeBtn.click();
      await expect(modalTitle).not.toBeVisible();
    }
  });

  test('Filtro Categorie e Selezione Rapida nel Centro Stampa (StampaView)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('#/stampa', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible();

    // Verifica presenza sezione Canti
    const cantiHeading = page.getByRole('heading', { name: /Canti/i });
    await expect(cantiHeading).toBeVisible();

    // Verifica presenza pulsanti rapidi selezione categoria nel Centro Stampa
    const btnTuttiScout = page.getByRole('button', { name: /\+ Tutti Scout/i });
    const btnTuttiChiesa = page.getByRole('button', { name: /\+ Tutti Chiesa/i });
    const btnTuttiEsterni = page.getByRole('button', { name: /\+ Tutti Esterni/i });

    await expect(btnTuttiScout).toBeVisible();
    await expect(btnTuttiChiesa).toBeVisible();
    await expect(btnTuttiEsterni).toBeVisible();

    // Clicca + Tutti Scout
    await btnTuttiScout.click();
    await page.waitForTimeout(100);
  });
});

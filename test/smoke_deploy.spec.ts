// test/smoke_deploy.spec.ts
// FASE 12G — Test di fumo sul sito pubblicato in produzione
// Naviga su tutte le rotte principali e verifica l'assenza di errori in console o risorse 404

import { test, expect } from '@playwright/test';

const TARGET_URL = process.env.DEPLOY_SMOKE_URL || 'http://127.0.0.1:4173/Sito-di-vault-attivit-clan/';

test.describe('FASE 12G — Test di Fumo Post-Deploy sul Sito Pubblicato', () => {

  test('Verifica risorse statiche critiche (HTTP 200)', async ({ request }) => {
    const assetsToCheck = [
      '',
      'manifest.webmanifest',
      'favicon.png',
      'fonts/inter-latin.woff2',
      'icons/icon-192x192.png',
      'photos/home-800.webp',
      'photos/canti-800.webp',
    ];

    for (const asset of assetsToCheck) {
      const url = new URL(asset, TARGET_URL.endsWith('/') ? TARGET_URL : TARGET_URL + '/').toString();
      const res = await request.get(url);
      expect(res.status(), `Risorsa ${url} deve restituire HTTP 200`).toBe(200);
    }
  });

  test('Navigazione completa su tutte le rotte con zero errori in console', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: Error[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Ignora eventuali warning del service worker in anteprima locale
        if (!text.includes('favicon') && !text.includes('ServiceWorker')) {
          consoleErrors.push(text);
        }
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const routes = [
      '#/home',
      '#/giochi',
      '#/bans',
      '#/canti',
      '#/calendario',
      '#/stampa',
    ];

    for (const r of routes) {
      const fullUrl = new URL(r, TARGET_URL.endsWith('/') ? TARGET_URL : TARGET_URL + '/').toString();
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.container').first()).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(300);
    }

    expect(pageErrors, 'Nessun errore fatale JavaScript deve essere lanciato a runtime').toEqual([]);
    expect(consoleErrors, 'Nessun errore bloccante in console durante la navigazione').toEqual([]);
  });

});

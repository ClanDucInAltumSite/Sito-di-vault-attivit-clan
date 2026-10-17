import { chromium } from 'playwright';
import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 4173;
const BASE_PATH = '/Sito-di-vault-attivit-clan/';
const URL = `http://127.0.0.1:${PORT}${BASE_PATH}`;

function waitServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(URL, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server non disponibile su ${URL} dopo ${timeoutMs}ms`));
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

async function main() {
  const outDir = path.resolve('docs/design-review/showcase');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('[1/4] Avvio server Vite Preview su porta', PORT);
  const previewProc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    shell: true,
    stdio: 'ignore',
  });

  try {
    await waitServer();
    console.log('✓ Server Preview pronto');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 950 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    // Mock autenticazione Supabase
    await page.route('**/rest/v1/rpc/is_admin*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'true',
      });
    });

    await page.route('**/auth/v1/user*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-uuid-test',
          email: 'capoclan@scout.local',
          aud: 'authenticated',
          role: 'authenticated',
        }),
      });
    });

    await page.addInitScript(() => {
      const now = Math.floor(Date.now() / 1000);
      const session = {
        access_token: 'fake-jwt-token',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: now + 3600,
        refresh_token: 'fake-refresh',
        user: {
          id: 'admin-uuid-test',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'capoclan@scout.local',
        },
      };
      localStorage.setItem('sb-lpeiyzwccedtqjbficjo-auth-token', JSON.stringify(session));
      localStorage.setItem('sb-auth-token', JSON.stringify(session));
    });

    console.log('[2/4] Navigazione a #/canti e popolamento DB...');
    await page.goto(`${URL}#/canti`);
    await page.waitForLoadState('networkidle');

    await page.evaluate(async () => {
      const DB_NAME = 'vault_scout_db';
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['canti'], 'readwrite');
          const cStore = tx.objectStore('canti');

          cStore.put({
            id: 'showcase-1',
            titolo: 'CANTO DEL TRAMONTO SUI SIBILLINI',
            autore: 'Clan Duc In Altum',
            tonalita: 'La',
            ritmo: 'Giù, Giù-Su, Su-Giù-Su (↓  ↓↓  ↑↓↑)',
            tempo_bpm: 94,
            bpm_testo: 'circa 92-94',
            misura: '4/4',
            capotasto: 2,
            testo_chordpro:
              '{title: CANTO DEL TRAMONTO SUI SIBILLINI}\n' +
              '{subtitle: Clan Duc In Altum}\n' +
              '[La]Rosso è il cielo sulle [Re]alte vette,\n' +
              '[Mi]scendono le ombre [La]giù nella valle.\n' +
              '[Fa#m]La nostra tenda è già [Do#m]piantata,\n' +
              '[Re]la lunga strada è or[Mi]mai terminata.\n\n' +
              '{soc}\n' +
              'RIT.\n' +
              '[La]Resta con noi Si[Re]gnore la sera,\n' +
              '[Mi]sale dai cuori una [La]preghiera.\n' +
              '{eoc}\n\n' +
              '[La]Brillano le prime [Re]stelle d\'argento,\n' +
              '[Mi]porta la pace il [La]respiro del vento.\n' +
              '[Fa#m]Veglia sui passi del [Do#m]nostro cammino,\n' +
              '[Re]fino alla luce del [Mi]nuovo mattino.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          tx.oncomplete = () => resolve(true);
        };
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // 1. Screenshot Canti View con bottone Importa
    console.log('[3/4] Cattura schermate Canti & Import...');
    await page.screenshot({ path: path.join(outDir, '01_canti_view_admin.png') });

    // 2. Modale importazione (.docx)
    const importBtn = page.locator('button:has-text("Importa")');
    if (await importBtn.isVisible()) {
      await importBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, '02_modal_import_docx.png') });

      // Tab 2: Incolla Testo
      const tabIncolla = page.locator('button:has-text("Incolla Testo")');
      if (await tabIncolla.isVisible()) {
        await tabIncolla.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outDir, '03_modal_import_incolla.png') });
      }

      // Tab 3: Da Foto / PDF (Prompt AI)
      const tabAi = page.locator('button:has-text("Da Foto / PDF")');
      if (await tabAi.isVisible()) {
        await tabAi.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(outDir, '04_modal_import_ai_prompt.png') });
      }

      // Chiudi modale
      const closeBtn = page.locator('button:has-text("Annulla")').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
      await page.waitForTimeout(300);
    }

    await browser.close();
    console.log('✓ Tutti gli screenshot vetrina completati con successo in docs/design-review/showcase/');
  } finally {
    previewProc.kill();
  }
}

main().catch(console.error);

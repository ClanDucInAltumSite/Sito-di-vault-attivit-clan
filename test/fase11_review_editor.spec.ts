import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\Utente\\.gemini\\antigravity\\brain\\adc46dfe-e4e7-4d5e-af33-63b1b4f2a5b7';
const DESIGN_REVIEW_DIR = path.resolve('docs/design-review/fase11');

test.beforeAll(() => {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }
  if (!fs.existsSync(DESIGN_REVIEW_DIR)) {
    fs.mkdirSync(DESIGN_REVIEW_DIR, { recursive: true });
  }
});

const VIEWPORTS = [
  { name: '390', width: 390, height: 844, label: 'Mobile (390x844)' },
  { name: '768', width: 768, height: 1024, label: 'Tablet (768x1024)' },
  { name: '1440', width: 1440, height: 900, label: 'Desktop (1440x900)' },
];

const SYNTHETIC_LONG_SONG = `{title: Canto della Promessa e della Strada Sintetico}
{subtitle: Categoria Scout}

[Do]Dinanzi a voi [Fa]prometto con [Sol]tutto il cuore
[Lam]fedeltà alla [Fa]legge e al [Sol]Creatore.
[Do]Sulla mia parola [Fa]di scout e [Sol]della via,
[Lam]offro il mio [Fa]servizio con [Sol]allegria.

{soc}
[Fa]Scout per sempre [Sol]nella via,
[Do]con la gioia [Lam]in compagnia.
[Fa]Guarda lontano, [Sol]guarda in alto,
[Do]la parola [Lam]data è un patto.
{eoc}

[Do]La la la [Fa]cammina il viandante [Sol]nel sentiero,
[Lam]cerca la [Fa]traccia del [Sol]guerriero.
[Do]Verso la vetta [Fa]candida e [Sol]serena,
[Lam]ogni fatica [Fa]è valsa la [Sol]pena.

{soc}
[Fa]Scout per sempre [Sol]nella via,
[Do]con la gioia [Lam]in compagnia.
[Fa]Guarda lontano, [Sol]guarda in alto,
[Do]la parola [Lam]data è un patto.
{eoc}

[Do]Il fuoco della sera [Fa]riscalda [Sol]la radura,
[Lam]il sonno scende [Fa]dolce e senza [Sol]paura.
[Do]Alba vermiglia [Fa]spunta all'o[Sol]rizzonte,
[Lam]nuovo cammino [Fa]sulle creste [Sol]del monte.

{soc}
[Fa]Scout per sempre [Sol]nella via,
[Do]con la gioia [Lam]in compagnia.
[Fa]Guarda lontano, [Sol]guarda in alto,
[Do]la parola [Lam]data è un patto.
{eoc}
`;

const SYNTHETIC_IMPORTED_DATA = {
  titolo: 'Canto della Promessa e della Strada Sintetico',
  categoria: 'scout' as const,
  autore: 'Reparto Stella Polare (Sintetico)',
  tonalita: 'Do',
  misura: '4/4',
  bpm_testo: 'circa 94',
  ritmo: '↓ ↑ ↓↑',
  capotasto: 2,
  origine: 'import_pdf' as const,
  nota_fonte: 'Canzoniere di Reparto Sintetico 2026',
  testo_chordpro: SYNTHETIC_LONG_SONG,
  warnings: [
    { riga: 11, messaggio: 'Riga ambigua con parole simili a note ("La la la"). Verificare accordi.' },
    { riga: 27, messaggio: 'Accordo oltre il bordo riga riallineato alla fine del verso.' },
  ],
  removedNoise: [
    { id: 'noise-1', numeroPagina: 1, rigaOriginale: 'https://canzonieresintetico.example.org', motivo: 'URL rilevato' },
    { id: 'noise-2', numeroPagina: 1, rigaOriginale: 'Pagina 1 di 2', motivo: 'Numero pagina' },
  ],
};

test.describe('FASE 11D — Schermata di Revisione Grande e Editor A4', () => {
  for (const vp of VIEWPORTS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`Screenshot e layout reattivo a ${vp.width}px in tema ${theme} (canto lungo, avvisi, altre info)`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto('#/canti', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.container').first()).toBeVisible();

        // Imposta tema e permessi admin
        await page.evaluate((th) => {
          document.documentElement.setAttribute('data-theme', th);
          localStorage.setItem('theme', th);
          if ((window as any).__setAdminForTesting) {
            (window as any).__setAdminForTesting(true);
          }
        }, theme);

        // Apri la modale di revisione con il dataset sintetico completo (canto lungo, avvisi, noise)
        await page.evaluate((data) => {
          if ((window as any).__openReviewForTesting) {
            (window as any).__openReviewForTesting(data);
          }
        }, SYNTHETIC_IMPORTED_DATA);

        // Verifica apertura modale revisione
        const heading = page.getByText(/Revisione Canto/i);
        await expect(heading).toBeVisible();

        // Apri la sezione "Altre informazioni" per includerla nello screenshot
        const detailsToggle = page.getByRole('button', { name: /Altre informazioni/i });
        await expect(detailsToggle).toBeVisible();
        await detailsToggle.click();

        // Verifica che i campi aggiuntivi siano visibili
        await expect(page.getByText('Autore / Evento')).toBeVisible();

        // Verifica che il cassetto degli avvisi sia visibile con gli avvisi di prova
        await expect(page.getByText(/Avvisi di Importazione/i)).toBeVisible();
        await expect(page.getByText(/Riga ambigua con parole simili a note/i)).toBeVisible();

        // Su mobile (390px) verifica presenza tab
        if (vp.width <= 767) {
          const tabTesto = page.getByRole('button', { name: /Testo ChordPro/i });
          const tabAnteprima = page.getByRole('button', { name: /Anteprima A4/i });
          await expect(tabTesto).toBeVisible();
          await expect(tabAnteprima).toBeVisible();
        } else {
          // Su desktop/tablet verifica che l'anteprima sia visibile insieme all'editor
          const previewContainer = page.locator('.canto-review-panel-preview');
          await expect(previewContainer).toBeVisible();
        }

        // Verifica assenza scroll orizzontale
        const scrollMetrics = await page.evaluate(() => {
          return {
            docScroll: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
            bodyScroll: document.body.scrollWidth <= document.body.clientWidth + 1,
          };
        });
        expect(scrollMetrics.docScroll).toBe(true);
        expect(scrollMetrics.bodyScroll).toBe(true);

        // Breve pausa per stabilizzare il rendering visivo
        await page.waitForTimeout(300);

        // Cattura screenshot e salvalo sia in docs/design-review/fase11/ che in ARTIFACT_DIR
        const reviewPath = path.join(DESIGN_REVIEW_DIR, `fase11_review_${vp.name}_${theme}.png`);
        await page.screenshot({ path: reviewPath, fullPage: true });
        expect(fs.existsSync(reviewPath)).toBe(true);

        const artifactPath = path.join(ARTIFACT_DIR, `fase11_review_${vp.name}_${theme}.png`);
        fs.copyFileSync(reviewPath, artifactPath);
        expect(fs.existsSync(artifactPath)).toBe(true);
      });
    }
  }

  test('Validazione Titolo e Categoria obbligatori, toolbar e inserimento accordi', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('#/canti', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible();

    await page.evaluate(() => {
      if ((window as any).__setAdminForTesting) {
        (window as any).__setAdminForTesting(true);
      }
    });

    const emptyBtn = page.getByRole('button', { name: /Nuovo canto vuoto/i });
    await emptyBtn.click();

    // 1. Verifica campi obbligatori
    const titleInput = page.getByPlaceholder(/Titolo del canto \(obbligatorio\)\*/i);
    const saveBtn = page.getByRole('button', { name: /Salva nel canzoniere/i });
    
    // Con titolo vuoto il pulsante deve essere disabilitato
    await expect(saveBtn).toBeDisabled();

    await titleInput.fill('Alba sul Fiume Sintetico');
    // Con solo titolo compilato ma senza categoria, il salvataggio deve restare disabilitato
    await expect(saveBtn).toBeDisabled();

    // Seleziona categoria obbligatoria (Fase 11F)
    const categorySelect = page.getByLabel(/Categoria del canto/i);
    await categorySelect.selectOption('scout');

    // Con titolo e categoria compilati, il pulsante si abilita
    await expect(saveBtn).toBeEnabled();

    // 2. Sezione "Altre informazioni" richiudibile
    const detailsToggle = page.getByRole('button', { name: /Altre informazioni/i });
    await expect(detailsToggle).toBeVisible();
    await detailsToggle.click();

    // Verifica presenza campi aggiuntivi
    await expect(page.getByText('Autore / Evento')).toBeVisible();
    await expect(page.locator('label', { hasText: 'Tonalità' })).toBeVisible();
    await expect(page.getByText('BPM (Testo)')).toBeVisible();
    await expect(page.getByText('Ritmo / Pennata')).toBeVisible();
    await expect(page.getByText('Capotasto')).toBeVisible();
    await expect(page.getByText('Origine')).toBeVisible();
    await expect(page.getByText('Nota Fonte')).toBeVisible();

    // 3. Toolbar accordi rapidi
    const textarea = page.locator('textarea');
    await textarea.fill('Sui monti e valli');
    await textarea.focus();
    
    // Clicca accordo rapido "Do"
    const doBtn = page.getByRole('button', { name: 'Do', exact: true });
    await doBtn.click();

    const currentText = await textarea.inputValue();
    expect(currentText).toContain('[Do]');

    // 4. Regolazione dimensione font
    const fontPlusBtn = page.getByTitle('Aumenta dimensione carattere');
    const fontMinusBtn = page.getByTitle('Riduci dimensione carattere');
    await expect(page.getByText('14px')).toBeVisible();
    await fontPlusBtn.click();
    await expect(page.getByText('15px')).toBeVisible();
    await fontMinusBtn.click();
    await expect(page.getByText('14px')).toBeVisible();
  });

  test('Salvataggio e ripristino bozza automatica IndexedDB', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('#/canti', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible();

    await page.evaluate(() => {
      if ((window as any).__setAdminForTesting) {
        (window as any).__setAdminForTesting(true);
      }
    });

    const emptyBtn = page.getByRole('button', { name: /Nuovo canto vuoto/i });
    await emptyBtn.click();

    const titleInput = page.getByPlaceholder(/Titolo del canto \(obbligatorio\)\*/i);
    await titleInput.fill('Bozza di Prova Salvataggio');

    const textarea = page.locator('textarea');
    await textarea.fill('[Sol]Testo bozza con accordi automatici salvati in indexeddb');

    // Attendi l'auto-save periodico verificando la comparsa della notifica
    await expect(page.getByText(/Bozza salvata alle/i)).toBeVisible({ timeout: 6000 });

    // Ricarica la pagina (simula chiusura browser o refresh accidentale)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.container').first()).toBeVisible();

    await page.evaluate(() => {
      if ((window as any).__setAdminForTesting) {
        (window as any).__setAdminForTesting(true);
      }
    });

    // Riapri con "Nuovo canto vuoto"
    const emptyBtnReloaded = page.getByRole('button', { name: /Nuovo canto vuoto/i });
    await emptyBtnReloaded.click();

    // Deve comparire il prompt per riprendere o eliminare la bozza da IndexedDB
    const draftPrompt = page.getByText(/Bozza locale trovata/i);
    await expect(draftPrompt).toBeVisible({ timeout: 5000 });

    const resumeBtn = page.getByRole('button', { name: /Riprendi bozza/i });
    await expect(resumeBtn).toBeVisible();
    await resumeBtn.click();

    // Il titolo e il testo devono essere ripristinati
    const titleInputReloaded = page.getByPlaceholder(/Titolo del canto \(obbligatorio\)\*/i);
    const textareaReloaded = page.locator('textarea');
    await expect(titleInputReloaded).toHaveValue('Bozza di Prova Salvataggio');
    await expect(textareaReloaded).toHaveValue('[Sol]Testo bozza con accordi automatici salvati in indexeddb');
  });
});

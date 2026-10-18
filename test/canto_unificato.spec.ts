import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Verifica Sistema Unificato Canti (Fase 9)', () => {
  test('Flusso completo: creazione unificata con 3 tab, frecce ritmo, estrazione IA e modali lettura', async ({
    page,
  }) => {
    // 1. Naviga alla sezione Canti e abilita sessione Admin
    await page.goto('#/canti');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      if ((window as any).__setAdminForTesting) {
        (window as any).__setAdminForTesting(true);
      }
    });

    // 3. Verifica barra admin: esiste solo un pulsante "Nuovo Canto"
    const nuovoCantoBtn = page.getByRole('button', { name: 'Nuovo Canto' });
    await expect(nuovoCantoBtn).toBeVisible();

    // Non deve esserci un pulsante separato "Importa"
    const importaBtn = page.getByRole('button', { name: 'Importa' });
    await expect(importaBtn).toHaveCount(0);

    // 4. Apri modale Nuovo Canto
    await nuovoCantoBtn.click();
    await expect(page.getByRole('heading', { name: 'Nuovo Canto' })).toBeVisible();

    // Verifica la presenza del SegmentedControl con i 3 ingressi
    await expect(page.getByRole('tab', { name: '1. Scrivi a mano' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '2. Da Word (.docx)' })).toBeVisible();
    await expect(page.getByRole('tab', { name: '3. Con IA' })).toBeVisible();

    // Screenshot Tab 1 iniziale (apertura Nuovo Canto con SegmentedControl e campi)
    const artifactDir = 'C:\\Users\\Utente\\.gemini\\antigravity\\brain\\adc46dfe-e4e7-4d5e-af33-63b1b4f2a5b7';
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_canto_tab1_editor.png') });

    // 5. Test Tab 1: Keypad frecce ritmo e pulsanti rapidi accordi
    const ritmoInput = page.locator('#canto-ritmo');
    await expect(ritmoInput).toBeVisible();

    await page.getByRole('button', { name: '↓ Giù' }).click();
    await page.getByRole('button', { name: '↑ Su' }).click();
    await page.getByRole('button', { name: '↓↑ Giù-Su' }).click();
    await expect(ritmoInput).toHaveValue('↓ ↑ ↓↑');

    // Test pulsanti rapidi textarea: + [Accordo] e + RIT.
    const chordproArea = page.locator('#canto-testo-chordpro');
    await chordproArea.fill('');
    await page.getByRole('button', { name: '+ [Accordo]' }).click();
    expect(await chordproArea.inputValue()).toContain('[Do]');

    await chordproArea.fill('');
    await page.getByRole('button', { name: '+ RIT.' }).click();
    expect(await chordproArea.inputValue()).toContain('RIT.');

    // 6. Test Tab 2: Da Word (.docx)
    await page.getByRole('tab', { name: '2. Da Word (.docx)' }).click();
    await expect(page.getByText('Tocca per selezionare il file Word (.docx)')).toBeVisible();
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_canto_tab2_word.png') });

    // 7. Test Tab 3: Con IA
    await page.getByRole('tab', { name: '3. Con IA' }).click();
    await expect(page.getByText('Come digitalizzare con l\'Intelligenza Artificiale')).toBeVisible();

    // Copia prompt
    const copyPromptBtn = page.getByRole('button', { name: /Copia Prompt per l'AI/i });
    await copyPromptBtn.click();
    await expect(page.getByText('Prompt pronto! Ora incollalo nell\'AI')).toBeVisible();

    // Simula risposta formattata fornita dall'IA
    const mockAiResponse = `TITOLO: CANTO DEL FALÒ SINTETICO
AUTORE: Clan Duc In Altum
TEMPO: 4/4
BPM: circa 96-98
RITMO: Giù, Giù-Su (↓ ↓↑)
CAPOTASTO: 2
---
[Do]Nel mezzo della notte [Sol]si alza una fiamma
[Fa]che riscalda il nostro [Sol]cammino.

RIT.
[Do]Canta con gioia, [Sol]scout della strada
[Fa]verso la meta [Sol]proseguiamo [Do]insieme.`;

    await page.locator('#ai-pasted-response').fill(mockAiResponse);
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_canto_tab3_ai.png') });

    // Clicca "Estrai Canto e Modifica"
    await page.getByRole('button', { name: 'Estrai Canto e Modifica' }).click();

    // Deve tornare a Tab 1 con tutti i campi compilati!
    await expect(page.locator('#canto-titolo')).toHaveValue('CANTO DEL FALÒ SINTETICO');
    await expect(page.locator('#canto-autore')).toHaveValue('Clan Duc In Altum');
    await expect(page.locator('#canto-misura')).toHaveValue('4/4');
    await expect(page.locator('#canto-bpm-testo')).toHaveValue('circa 96-98');
    await expect(page.locator('#canto-ritmo')).toHaveValue('Giù, Giù-Su (↓ ↓↑)');
    await expect(page.locator('#canto-capotasto')).toHaveValue('2');
    await expect(page.getByText('Canto digitalizzato con IA estratto con successo!')).toBeVisible();

    // Chiudi il form di creazione
    await page.getByRole('button', { name: 'Annulla' }).click();

    // 8. Popolamento IndexedDB per verificare Modalità Lettura e transizioni senza dipendere da rete live
    await page.evaluate(async () => {
      const DB_NAME = 'vault_scout_db';
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['canti'], 'readwrite');
          const cStore = tx.objectStore('canti');
          cStore.put({
            id: 'test-canto-sintetico-1',
            titolo: 'CANTO DEL FALÒ SINTETICO',
            autore: 'Clan Duc In Altum',
            tonalita: 'Do',
            ritmo: 'Giù, Giù-Su (↓ ↓↑)',
            tempo_bpm: 96,
            bpm_testo: 'circa 96-98',
            misura: '4/4',
            capotasto: 2,
            testo_chordpro: `[Do]Nel mezzo della notte [Sol]si alza una fiamma\n[Fa]che riscalda il nostro [Sol]cammino.\n\nRIT.\n[Do]Canta con gioia, [Sol]scout della strada\n[Fa]verso la meta [Sol]proseguiamo [Do]insieme.`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      if ((window as any).__setAdminForTesting) {
        (window as any).__setAdminForTesting(true);
      }
    });

    await expect(page.getByText('CANTO DEL FALÒ SINTETICO')).toBeVisible();

    // 9. Clicca sul canto nella lista per aprire la Modalità Lettura
    await page.getByText('CANTO DEL FALÒ SINTETICO').first().click();

    // Verifica che CantoReadingMode sia aperta e che abbia la classe per la scrollbar elegante
    const readingMain = page.locator('main.canto-reading-scrollable');
    await expect(readingMain).toBeVisible();
    await page.screenshot({ path: path.join(artifactDir, 'screenshot_canto_reading_mode.png') });

    // 10. Clicca "Modifica" dalla Modalità Lettura
    // Deve chiudere CantoReadingMode e aprire subito il form di modifica in primo piano!
    const editBtn = page.getByRole('button', { name: 'Modifica' });
    await editBtn.click();

    await expect(readingMain).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Modifica Canto' })).toBeVisible();
    await expect(page.locator('#canto-titolo')).toHaveValue('CANTO DEL FALÒ SINTETICO');

    // Chiudi il form di modifica
    await page.getByRole('button', { name: 'Annulla' }).click();

    // 11. Riapri la modalità lettura e testa "Elimina"
    await page.getByText('CANTO DEL FALÒ SINTETICO').first().click();
    await expect(readingMain).toBeVisible();

    const deleteBtn = page.getByRole('button', { name: 'Elimina' });
    await deleteBtn.click();

    // Deve chiudere CantoReadingMode e aprire il modale di conferma eliminazione in primo piano!
    await expect(readingMain).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conferma eliminazione' })).toBeVisible();
    await page.getByRole('button', { name: 'Annulla' }).click();
  });
});

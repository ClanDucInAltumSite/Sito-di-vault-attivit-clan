import { test, expect } from '@playwright/test';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

test.describe('FASE 6 — Verifica Reale della Generazione PDF e Impaginazione A4 (@media print)', () => {
  test('Genera un PDF A4 reale e valida conteggio pagine, flusso continuo, salto pagina canti, 40 accordi, caratteri speciali e assenza di pagine bianche', async ({
    page,
  }) => {
    // 1. Naviga alla home per inizializzare il contesto e il database
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    // 2. Popolamento IndexedDB con dati di prova controllati per la stampa
    await page.evaluate(async () => {
      const DB_NAME = 'vault_scout_db';
      return new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['giochi', 'bans', 'canti', 'eventi', 'odg_punti'], 'readwrite');
          const gStore = tx.objectStore('giochi');
          const bStore = tx.objectStore('bans');
          const cStore = tx.objectStore('canti');
          const eStore = tx.objectStore('eventi');
          const pStore = tx.objectStore('odg_punti');

          // Giochi: 2 brevi (<600 caratteri) con caratteri speciali, 1 lungo (>=600 caratteri)
          gStore.put({
            id: 'test-g-1',
            nome: 'Roverino al Buio <Speciale & Rapido>',
            materiali: '1 cerchio di corda "Roverino" & torce',
            regole: "I giocatori formano un cerchio. Si passano il cerchio al buio senza toccare l'avversario.",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          gStore.put({
            id: 'test-g-2',
            nome: "Palla Scalpo 'Veloce'",
            materiali: 'Fazzolettoni scout per tutti i partecipanti',
            regole: 'Ogni giocatore indossa un fazzolettone sui pantaloni. Vince chi raccoglie più scalpi.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          gStore.put({
            id: 'test-g-3',
            nome: 'Grande Gioco Strategico dell\'Aquila Reale "Extra Long"',
            materiali: 'Mappa topografica IGM 1:25000, bussola, bandiere, messaggi cifrati, pergamena di clan',
            regole:
              'Le pattuglie devono conquistare i quattro presidi nemici. ' +
              'Ogni presidio è difeso da custodi che pongono enigmi di orientamento e nodi. '.repeat(8) +
              'Il punteggio finale determina la vittoria della pattuglia.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // Bans: 2 con note sui gesti e caratteri speciali
          bStore.put({
            id: 'test-b-1',
            nome: 'Il Coccodrillo <Animato & Spassoso>',
            note_gesti: 'Battere le mani sul petto e mimare le fauci del coccodrillo "Gnam Gnam"',
            testo: 'C\'era un coccodrillo ed un orango tango, due piccoli serpenti e l\'aquila reale.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          bStore.put({
            id: 'test-b-2',
            nome: "La Danza del Serpente 'Strisciante'",
            note_gesti: 'Formare una fila indiana passando sotto le gambe dell\'ultimo della fila',
            testo: 'Sei tu quel pezzo della mia coda che ho perso tanto tempo fa?',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // Canti:
          // 1. Canto a 1 pagina con caratteri speciali
          cStore.put({
            id: 'test-c-1',
            titolo: 'Canto della Promessa <Chiaro & Puro>',
            autore: 'Baden Powell & Clan',
            tonalita: 'Re',
            ritmo: '4/4',
            tempo_bpm: 100,
            misura: '4/4',
            capotasto: null,
            testo_chordpro:
              '{title: Canto della Promessa <Chiaro & Puro>}\n' +
              '[Re]Dinanzi a voi [Sol]prometto sul mio o[La]nore\n' +
              '[Sim]di fare del mio [Fa#m]meglio per ser[Sol]vire Dio e la [La]Patria\n' +
              '{ritornello}\n' +
              '[Re]La mia parola [Sol]è fedeltà,\n' +
              '[La]la legge scout la mia [Re]guida sarà.\n' +
              '{end_of_chorus}',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // 2. Canto a 2 pagine con direttiva {nuova_pagina}
          cStore.put({
            id: 'test-c-2',
            titolo: 'Al Fuoco di Bivacco',
            autore: 'Tradizione Scout',
            tonalita: 'Mi',
            ritmo: '3/4',
            tempo_bpm: 90,
            misura: '3/4',
            capotasto: null,
            testo_chordpro:
              '{title: Al Fuoco di Bivacco}\n' +
              '[Mi]Scende la sera ed il [La]fuoco si ac[Mi]cende,\n' +
              '[Si7]fiamme che salgono al [Mi]cielo sereno.\n' +
              '[La]Cantano i cuori la [Mi]gioia d\'amar,\n' +
              '[Si7]sotto le stelle ci [Mi]piace sognar.\n' +
              '{nuova_pagina}\n' +
              '{ritornello}\n' +
              '[Mi]Fiamma che brilli, [La]fiamma che [Mi]scaldi,\n' +
              '[Si7]veglia sui nostri sonni [Mi]tranquilli.\n' +
              '{end_of_chorus}\n' +
              '[Mi]Quando l\'aurora il [La]cielo inar[Mi]genterà,\n' +
              '[Si7]un nuovo giorno con [Mi]noi nascerà.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // 3. Canto con linea contenente 40 accordi (stress test impaginazione accordi su testo)
          const fortyChords = Array(40).fill('[Sol]').join('');
          cStore.put({
            id: 'test-c-3',
            titolo: 'Canto Accordi Multipli 40x',
            autore: 'Autore Sperimentale',
            tonalita: 'Sol',
            ritmo: '4/4',
            tempo_bpm: 120,
            misura: '4/4',
            capotasto: null,
            testo_chordpro:
              '{title: Canto Accordi Multipli 40x}\n' +
              `${fortyChords}Camminiamo sulla strada maestra senza fermarci mai.\n` +
              '[Do]Ogni passo è un [Re]canto di liber[Sol]tà.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // Evento e ODG (preparatorio per Fase 7)
          eStore.put({
            id: 'test-ev-1',
            titolo: 'Uscita dei Passaggi sui Sibillini',
            tipo: 'uscita',
            inizio: '2026-10-25T08:00:00Z',
            fine: '2026-10-26T18:00:00Z',
            tutto_il_giorno: true,
            luogo: 'Rifugio Sibillini & Montemonaco',
            descrizione: 'Uscita annuale di apertura con cerimonia dei passaggi novizi.',
            responsabile: 'Capi Clan',
            cosa_portare: 'Zaino completo, sacco a pelo pesante, gavetta e torcia',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          pStore.put({
            id: 'test-p-1',
            evento_id: 'test-ev-1',
            testo: 'Verifica della Carta di Clan & Obiettivi dell\'anno',
            ordine: 1,
            completato: false,
            riportato_da: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          pStore.put({
            id: 'test-p-2',
            evento_id: 'test-ev-1',
            testo: 'Pianificazione Route Invernale: date, itinerario e budget "stimato"',
            ordine: 2,
            completato: false,
            riportato_da: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
    });

    // 3. Configura la selezione in sessionStorage: include tutti gli elementi + copertina e indice
    await page.evaluate(() => {
      const config = {
        selectedGiochiIds: ['test-g-1', 'test-g-2', 'test-g-3'],
        selectedBansIds: ['test-b-1', 'test-b-2'],
        selectedCantiIds: ['test-c-1', 'test-c-2', 'test-c-3'],
        includeImages: false,
        includeCoverAndIndex: true,
      };
      sessionStorage.setItem('stampa_selection', JSON.stringify(config));
    });

    // 4. Ricarica la pagina per applicare la configurazione e attendi il rendering completo
    await page.goto('#/stampa');
    await page.waitForLoadState('networkidle');

    // Attendi che il contenitore di stampa contenga gli elementi selezionati
    await page.waitForSelector('.print-cover-page');
    await page.waitForSelector('.print-index-page');
    await page.waitForSelector('.print-continuous');
    await page.waitForSelector('.print-song-page');

    // 5. Emula @media print
    await page.emulateMedia({ media: 'print' });

    // 6. Genera il file PDF A4 reale con Playwright
    const pdfDir = path.resolve(process.cwd(), 'docs/design-review');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    const pdfPath = path.join(pdfDir, 'fascicolo_test_fase6.pdf');

    const pdfBuffer = await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        bottom: '15mm',
        left: '12mm',
        right: '12mm',
      },
    });

    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(5000);

    // 7. Analizza il PDF reale estratto con PDFParse
    const parser = new PDFParse({ data: pdfBuffer });
    const info = await parser.getInfo();
    const textResult = await parser.getText();
    await parser.destroy();

    const fullPdfText = textResult.text;

    console.log(`[STAMPA TEST] info.total = ${info.total}`);
    textResult.pages.forEach((pg, i) => {
      console.log(`--- PAGE ${i + 1} (${pg.text.length} chars) ---`);
      console.log(pg.text.slice(0, 150));
    });

    expect(
      info.total,
      `Il PDF generato deve contenere almeno 5 pagine (trovate ${info.total})`
    ).toBeGreaterThanOrEqual(5);

    // B) Verifica Presenza Copertina e Indice
    expect(fullPdfText).toContain('Clan Duc In Altum');
    expect(fullPdfText).toContain('Fascicolo delle Attività e Canzoniere');
    expect(fullPdfText).toContain('Indice dei Contenuti');

    // C) Verifica Flusso Continuo di Giochi e Bans
    expect(fullPdfText).toContain('Roverino al Buio <Speciale & Rapido>');
    expect(fullPdfText).toContain("Palla Scalpo 'Veloce'");
    expect(fullPdfText).toContain('Grande Gioco Strategico dell\'Aquila Reale "Extra Long"');
    expect(fullPdfText).toContain('Il Coccodrillo <Animato & Spassoso>');
    expect(fullPdfText).toContain("La Danza del Serpente 'Strisciante'");

    // D) Verifica Canto su 2 pagine e Intestazione Ridotta ("2/2")
    expect(fullPdfText).toContain('Al Fuoco di Bivacco');
    // La pagina 2 deve avere l'intestazione ridotta con 2/2
    expect(fullPdfText).toMatch(/Al Fuoco di Bivacco[\s\S]*?2\/2/);
    expect(fullPdfText).toContain('Fiamma che brilli');
    expect(fullPdfText).toContain('veglia sui nostri sonni');

    // E) Verifica Linea con 40 Accordi
    expect(fullPdfText).toContain('Canto Accordi Multipli 40x');
    expect(fullPdfText).toContain('Camminiamo sulla strada maestra');
    // Verifica che gli accordi Sol siano presenti
    expect(fullPdfText).toContain('Sol');

    // F) Verifica Preservazione Caratteri Speciali (< & " ') senza escape distorto
    expect(fullPdfText).toContain('<Speciale & Rapido>');
    expect(fullPdfText).toContain('"Roverino"');
    expect(fullPdfText).toContain("l'avversario");
    expect(fullPdfText).toContain("'Veloce'");
    expect(fullPdfText).toContain('"Extra Long"');
    expect(fullPdfText).toContain('<Animato & Spassoso>');
    expect(fullPdfText).toContain('"Gnam Gnam"');

    // G) Verifica Assenza Totale di Pagine Bianche
    // Ogni pagina deve avere testo effettivo significativo (> 20 caratteri)
    expect(textResult.pages.length).toBe(info.total);
    textResult.pages.forEach((pg, index) => {
      const trimmed = pg.text.trim();
      expect(
        trimmed.length,
        `Pagina ${index + 1} del PDF risulta bianca o vuota (caratteri: ${trimmed.length})`
      ).toBeGreaterThan(20);
    });
  });
});

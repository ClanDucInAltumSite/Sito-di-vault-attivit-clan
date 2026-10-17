import { test, expect } from '@playwright/test';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import * as path from 'path';

test.describe('FASE 6 - Verifica Reale della Generazione PDF, Indice Verificato e Overflow Misurato (@media print)', () => {
  test('Genera PDF A4 reale, valida indice con numeri veri, overflow misurato, 5 canti, bans, gioco lungo 3500+ caratteri e rasterizza PNG', async ({
    page,
  }) => {
    // 1. Naviga alla home per inizializzare il contesto e il database
    await page.goto('#/');
    await page.waitForLoadState('networkidle');

    // 2. Popolamento IndexedDB con dati controllati per la Fase 6 (Correzioni 1, 2, 3)
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

          // GIOCHI:
          // 1. Breve con caratteri speciali (<600 caratteri)
          gStore.put({
            id: 'test-g-1',
            nome: 'Roverino al Buio <Speciale & Rapido>',
            materiali: '1 cerchio di corda "Roverino" & torce',
            regole: "I giocatori formano un cerchio. Si passano il cerchio al buio senza toccare l'avversario.",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // 2. Breve (<600 caratteri)
          gStore.put({
            id: 'test-g-2',
            nome: "Palla Scalpo 'Veloce'",
            materiali: 'Fazzolettoni scout per tutti i partecipanti',
            regole: 'Ogni giocatore indossa un fazzolettone sui pantaloni. Vince chi raccoglie più scalpi.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // 3. Gioco Molto Lungo (almeno 3500 caratteri) che scorre su più pagine
          const regoleLungoParte1 =
            'OBIETTIVO DEL GIOCO:\n' +
            'Le quattro pattuglie del Clan devono conquistare i presidi strategici della valle dei Sibillini (Presidio Nord, Presidio Sud, Passo del Vento, Bosco dei Faggi). ' +
            'Ciascun presidio è difeso da custodi che pongono enigmi cartografici su carta IGM 1:25.000, nodi strutturali di pionieristica e segnalazioni ottiche Morse.\n\n' +
            'FASE 1 - AVVICINAMENTO E PATTUGLIAMENTO SILENZIOSO:\n' +
            'Ogni pattuglia parte da una quota nota con azimuth assegnato e deve muoversi evitando le pattuglie di interdizione. ' +
            'Se una pattuglia viene illuminata dalla torcia di un custode a distanza inferiore a dieci metri, deve dichiarare il proprio nome scout e arretrare di cento metri verso il punto di sosta precedente. ' +
            'Il silenzio assoluto durante il cammino nel sottobosco è vincolante per non allertare le sentinelle avversarie posizionate lungo la cresta rocciosa.\n\n' +
            'FASE 2 - COSTRUZIONI DI PIONIERISTICA E NODI:\n' +
            'Raggiunto il primo presidio, i componenti devono realizzare un tripode per il teodolite da campo utilizzando tre pali di castagno da due metri e una legatura quadra con cordino di canapa da sei millimetri. ' +
            'Inoltre, ciascun rover e scolta deve eseguire individualmente un nodo parlato con chiave di bloccaggio e un nodo a otto ripassato per l\'assicurazione in cordata. ' +
            'I custodi verificano la tenuta statica prima di consegnare la mappa con le coordinate azimutali del secondo presidio.\n\n' +
            'FASE 3 - DECIFRAZIONE E TRASMISSIONE MORSE:\n' +
            'La pergamena ottenuta contiene un messaggio cifrato mediante cifrario di Cesare con scostamento da ricavare dall\'altitudine della vetta. ' +
            'Una volta decifrato il testo segreto ("LA FIAMMA VIGILA SUL CAMMINO DEL CLAN"), la pattuglia accende una lanterna schermata e trasmette il messaggio mediante segnali luminosi a punti e linee verso la stazione radio centrale situata a fondovalle.\n\n' +
            'FASE 4 - IL PONTE SUL TORRENTE E IL RECUPERO DELLA CARTA DI CLAN:\n' +
            'L\'ultima prova richiede il guado controllato del torrente montano mediante un ponte di corda alla marinara con fune portante tesa tra due faggi monumentali. ' +
            'Ciascun membro della pattuglia attraversa il passaggio in sicurezza agganciato con longe e moschettone con ghiera a vite.\n\n';

          const regoleLungoParte2 =
            'PUNTEGGI E REGOLAMENTO DI VITTORIA:\n' +
            '- Conquista di ogni presidio entro i tempi limite prefissati: 250 punti per postazione.\n' +
            '- Correttezza tecnica delle legature e dei nodi senza rilievi dei custodi: 150 punti.\n' +
            '- Trasmissione Morse priva di errori di decodifica: 100 punti bonus.\n' +
            '- Spirito di clan, rispetto ambientale rigoroso (Leave No Trace, nessun ramo spezzato, pulizia totale del sentiero): 200 punti.\n\n' +
            'SICUREZZA E PROTOCOLLI DI EMERGENZA:\n' +
            'Tutti i partecipanti devono indossare calzature da montagna a caviglia alta, giacca a vento impermeabile ad alta visibilità, portare fischietto alpino di emergenza, ' +
            'lampada frontale con batterie di ricambio cariche, telo termico di alluminio dorato e borraccia con almeno un litro e mezzo di acqua potabile. ' +
            'In caso di temporale improvviso o nebbia fitta sui crinali, tre fischi lunghi consecutivi da parte dei capi clan ordinano l\'interruzione immediata del gioco ' +
            'e la convergenza di tutte le pattuglie verso il rifugio del campo base lungo la mulattiera maestra principale segnata dal CAI con bandierine bianco-rosse.';

          const regoleLungoTotale = regoleLungoParte1 + regoleLungoParte2; // ~3700 caratteri

          gStore.put({
            id: 'test-g-3',
            nome: 'Grande Gioco dei Pionieri della Valle "Extra Long"',
            materiali: 'Mappa IGM 1:25.000, bussola prismatica, corde statiche da 10mm, torce, legname, pergamena cifrata',
            regole: regoleLungoTotale,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // BANS:
          // 1. Ban con note sui gesti e caratteri speciali
          bStore.put({
            id: 'test-b-1',
            nome: 'Il Grande Re del Fuoco <Animato & Fiammeggiante>',
            note_gesti: 'Battere ritmicamente le mani sul petto, allargare le braccia a semicerchio e gridare con enfasi "Whoosh!" mimando la fiamma viva.',
            testo: 'C\'era una volta il grande re del fuoco che cavalcava sul monte ardente insieme alle scintille dorate.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // 2. Ban con note sui gesti
          bStore.put({
            id: 'test-b-2',
            nome: "L'Orso Ballerino e il Lupo 'Astuto'",
            note_gesti: 'Camminare a passo pesante a quattro zampe, poi alzarsi di scatto ululando verso la luna con mani a megafono.',
            testo: 'Nella radura del bosco innevato balla l\'orso bruno col mantello fatato.',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // CANTI (Almeno 5 canti di lunghezze diverse):
          // Canto 1: Breve 1 pagina (~12 righe, entra a 12pt)
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

          // Canto 2: 2 Pagine con direttiva {nuova_pagina} ed intestazione ridotta
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

          // Canto 3: Medio 1 pagina (~20 righe)
          cStore.put({
            id: 'test-c-3',
            titolo: 'Canto del Tramonto sui Sibillini',
            autore: 'Clan Duc In Altum',
            tonalita: 'La',
            ritmo: '4/4',
            tempo_bpm: 85,
            misura: '4/4',
            capotasto: 2,
            testo_chordpro:
              '{title: Canto del Tramonto sui Sibillini}\n' +
              '[La]Rosso è il cielo sulle [Re]alte vette,\n' +
              '[Mi]scendono le ombre [La]giù nella valle.\n' +
              '[F#m]La nostra tenda [C#m]è già piantata,\n' +
              '[D]la lunga strada [E]è ormai terminata.\n' +
              '{ritornello}\n' +
              '[A]Resta con noi [D]Signore la sera,\n' +
              '[E]sale dai cuori [A]una preghiera.\n' +
              '{end_of_chorus}',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // Canto 4: Linea con 40 Accordi (stress test impaginazione accordi e sillabe)
          const fortyChords = Array(40).fill('[Sol]').join('');
          cStore.put({
            id: 'test-c-4',
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

          // Canto 5: Canto Troppo Lungo per 1 Pagina (oltre 65 righe, deve scatenare l'avviso di overflow)
          const strofeTroppoLunghe = Array.from(
            { length: 55 },
            (_, i) => `[Re]Strofa numero ${i + 1} con tante parole e accordi per testare [Sol]l'overflow verticale [La]sulla pagina A4.`
          ).join('\n');
          const ritornelloLungo = Array.from(
            { length: 12 },
            (_, i) => `[Re]Ritornello riga ${i + 1} che sfora [Sol]la capienza utile del foglio.`
          ).join('\n');

          cStore.put({
            id: 'test-c-5',
            titolo: "Canto Infinito del Bivacco 'Senza Fine'",
            autore: 'Cantautore Prolifico',
            tonalita: 'Re',
            ritmo: '4/4',
            tempo_bpm: 110,
            misura: '4/4',
            capotasto: null,
            testo_chordpro:
              '{title: Canto Infinito del Bivacco \'Senza Fine\'}\n' +
              strofeTroppoLunghe +
              '\n{ritornello}\n' +
              ritornelloLungo +
              '\n{end_of_chorus}',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
          });

          // Evento e ODG
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
            testo: "Verifica della Carta di Clan & Obiettivi dell'anno",
            ordine: 1,
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
        selectedCantiIds: ['test-c-1', 'test-c-2', 'test-c-3', 'test-c-4', 'test-c-5'],
        includeImages: false,
        includeCoverAndIndex: true,
      };
      sessionStorage.setItem('stampa_selection', JSON.stringify(config));
    });

    // 4. Naviga a #/stampa e attendi il rendering completo
    await page.goto('#/stampa');
    await page.waitForLoadState('networkidle');

    // =========================================================================
    // CORREZIONE 2 - VERIFICA OVERFLOW MISURATO E AVVISO
    // =========================================================================
    // Il Canto 5 è troppo lungo per 1 pagina: deve comparire l'avviso di overflow globale a schermo!
    const overflowBanner = page.locator('.stampa-overflow-alert').first();
    await expect(overflowBanner).toBeVisible();
    const bannerText = await overflowBanner.textContent();
    expect(bannerText).toContain("Questa pagina non entra");
    expect(bannerText).toContain("superano l'altezza A4");

    // =========================================================================
    // GENERAZIONE PDF A4 REALE CON PLAYWRIGHT E PARSING BINARIO
    // Single source of truth per i margini: @page CSS (10mm top, 20mm lati, 20mm fondo)
    // =========================================================================
    await page.emulateMedia({ media: 'print' });

    const pdfDir = path.resolve(process.cwd(), 'docs/design-review');
    const pdfPath = path.join(pdfDir, 'fascicolo_test_fase6.pdf');

    const pdfBuffer = await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '0mm',
        bottom: '0mm',
        left: '0mm',
        right: '0mm',
      },
    });

    expect(fs.existsSync(pdfPath)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(5000);

    // =========================================================================
    // RASTERIZZAZIONE PNG DELLE SCHEDE A4 PER ISPEZIONE VISIVA
    // Ciascuna scheda viene rasterizzata con geometria esatta A4 (210mm x 297mm)
    // =========================================================================
    await page.addStyleTag({
      content: `
        .stampa-preview-paper, .canzoniere-page {
          width: 210mm !important;
          max-width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 auto 20mm auto !important;
          padding: 10mm 20mm 20mm 20mm !important;
          box-sizing: border-box !important;
          background: white !important;
        }
        .canzoniere-columns-container, .canzoniere-header, .canzoniere-page2-header {
          width: 100% !important;
          max-width: 100% !important;
          margin: 0 !important;
        }
      `,
    });

    const printDir = path.resolve(process.cwd(), 'docs/design-review/print');
    if (!fs.existsSync(printDir)) {
      fs.mkdirSync(printDir, { recursive: true });
    }

    const previewPapers = page.locator('.stampa-preview-paper');
    const paperCount = await previewPapers.count();
    console.log(`[RASTERIZE] Trovate ${paperCount} schede di anteprima da salvare in PNG (formato esatto A4)`);

    for (let i = 0; i < paperCount; i++) {
      const paper = previewPapers.nth(i);
      const outPath = path.join(printDir, `page_${i + 1}.png`);
      await paper.screenshot({ path: outPath });
    }
    expect(paperCount).toBeGreaterThanOrEqual(7);

    const parser = new PDFParse({ data: pdfBuffer });
    const info = await parser.getInfo();
    const textResult = await parser.getText();
    await parser.destroy();

    const fullPdfText = textResult.text;
    console.log(`[STAMPA TEST] Totale pagine PDF estratte: ${info.total}`);

    textResult.pages.forEach((pg, i) => {
      console.log(`--- PDF PAGE ${i + 1} (${pg.text.length} chars) ---`);
      console.log(pg.text.slice(0, 140));
    });

    // =========================================================================
    // CORREZIONE 1 - VERIFICA INDICE CON NUMERI VERI RISPETTO ALLE PAGINE DEL PDF
    // =========================================================================
    // Estraiamo la pagina 2 (Indice dei Contenuti)
    const indexPageText = textResult.pages[1].text;
    expect(indexPageText).toContain('Indice dei Contenuti');

    // Definiamo i titoli attesi e verifichiamo la corrispondenza con la pagina reale del PDF
    const titlesToCheck = [
      { titlePart: 'Roverino al Buio', fullTitle: 'Roverino al Buio <Speciale & Rapido>' },
      { titlePart: 'Palla Scalpo', fullTitle: "Palla Scalpo 'Veloce'" },
      { titlePart: 'Grande Gioco dei Pionieri', fullTitle: 'Grande Gioco dei Pionieri della Valle "Extra Long"' },
      { titlePart: 'Il Grande Re del Fuoco', fullTitle: 'Il Grande Re del Fuoco <Animato & Fiammeggiante>' },
      { titlePart: "L'Orso Ballerino", fullTitle: "L'Orso Ballerino e il Lupo 'Astuto'" },
      { titlePart: 'Canto della Promessa', fullTitle: 'Canto della Promessa <Chiaro & Puro>' },
      { titlePart: 'Al Fuoco di Bivacco', fullTitle: 'Al Fuoco di Bivacco' },
      { titlePart: 'Canto del Tramonto', fullTitle: 'Canto del Tramonto sui Sibillini' },
      { titlePart: 'Canto Accordi Multipli 40x', fullTitle: 'Canto Accordi Multipli 40x' },
      { titlePart: 'Canto Infinito del Bivacco', fullTitle: "Canto Infinito del Bivacco 'Senza Fine'" },
    ];

    for (const item of titlesToCheck) {
      // 1. Trova nella pagina dell'indice il numero associato a questo titolo
      const regex = new RegExp(`${item.titlePart}[^\\n\\d]*?(\\d+)`, 'i');
      const match = indexPageText.match(regex);
      expect(
        match,
        `Il titolo "${item.titlePart}" deve comparire nell'indice con un numero di pagina`
      ).toBeTruthy();

      const declaredPageNum = parseInt(match![1], 10);
      expect(declaredPageNum).toBeGreaterThanOrEqual(3);

      // 2. Verifica che il titolo compaia ESATTAMENTE nel testo estratto di quella pagina reale del PDF!
      const actualPageText = textResult.pages[declaredPageNum - 1].text;
      expect(
        actualPageText.toLowerCase(),
        `Il titolo "${item.titlePart}" è dichiarato a pag. ${declaredPageNum} nell'indice ma compare altrove nel PDF!`
      ).toContain(item.titlePart.toLowerCase());
    }

    // =========================================================================
    // CORREZIONE 3 - VERIFICHE DI INTEGRITÀ DEL PDF
    // =========================================================================
    // A) Gioco lungo di 3500+ caratteri scorre su più pagine senza troncare
    expect(fullPdfText).toContain('Grande Gioco dei Pionieri della Valle');
    expect(fullPdfText).toContain('FASE 4 - IL PONTE SUL TORRENTE');
    expect(fullPdfText).toContain('PUNTEGGI E REGOLAMENTO DI VITTORIA');
    expect(fullPdfText).toContain('SICUREZZA E PROTOCOLLI DI EMERGENZA');

    // B) 2 Bans con note sui gesti consecutivi
    expect(fullPdfText).toContain('Il Grande Re del Fuoco <Animato & Fiammeggiante>');
    expect(fullPdfText).toContain('mimando la fiamma viva');
    expect(fullPdfText).toContain("L'Orso Ballerino e il Lupo 'Astuto'");
    expect(fullPdfText).toContain('alzarsi di scatto ululando verso la luna');

    // C) Canto con 40 accordi sopra le sillabe
    expect(fullPdfText).toContain('Canto Accordi Multipli 40x');
    expect(fullPdfText).toContain('Camminiamo sulla strada maestra');
    expect(fullPdfText).toContain('Sol');

    // D) Canto a 2 pagine con testata ridotta ("2/2")
    expect(fullPdfText).toMatch(/Al Fuoco di Bivacco[\s\S]*?2\/2/);
    expect(fullPdfText).toContain('Fiamma che brilli');

    // E) Caratteri speciali preservati senza entità HTML grezze
    expect(fullPdfText).toContain('<Speciale & Rapido>');
    expect(fullPdfText).toContain('"Roverino"');
    expect(fullPdfText).toContain("l'avversario");
    expect(fullPdfText).toContain("'Veloce'");
    expect(fullPdfText).toContain('"Extra Long"');
    expect(fullPdfText).toContain('<Animato & Fiammeggiante>');
    expect(fullPdfText).toContain("L'Orso Ballerino");
    expect(fullPdfText).toContain("'Astuto'");
    expect(fullPdfText).toContain("'Senza Fine'");

    // F) Nessuna pagina bianca o quasi vuota (almeno 30 caratteri su ogni pagina del PDF)
    textResult.pages.forEach((pg, idx) => {
      const charCount = pg.text.trim().length;
      expect(
        charCount,
        `La pagina ${idx + 1} del PDF è vuota o quasi vuota (${charCount} caratteri)`
      ).toBeGreaterThan(30);
    });
  });
});

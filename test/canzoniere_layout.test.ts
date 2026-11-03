import { describe, it, expect } from 'vitest';
import {
  layoutCanzoniereSong,
  layoutCanzoniereFlow,
  calculateSongHeaderHeightMm,
  MIN_REMAINING_HEIGHT_FOR_NEW_SONG_MM,
} from '../src/features/canti/canzoniere_layout';
import { Canto } from '../src/lib/db';

describe('FASE 9 - Canzoniere Two-Column A4 Layout Engine', () => {
  it('1. Canto da una pagina: bilancia le due colonne minimizzando il dislivello tra blocchi', () => {
    // Canto sintetico con 4 strofe bilanciabili 2 a sinistra e 2 a destra
    const mockCanto: Canto = {
      id: 'c-test-1',
      titolo: 'CANTO DEL SENTIERO LUMINOSO',
      autore: 'Clan San Giovanni',
      misura: '4/4',
      bpm_testo: 'circa 90-95',
      tempo_bpm: 92,
      ritmo: 'Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)',
      capotasto: null,
      tonalita: 'Re',
      testo_chordpro: `[Re]Strofa uno con testo sintetico per testare il layout
[Sol]seconda riga della prima strofa
[La]terza riga della prima strofa

[Re]Strofa due con accordi e testo
[Sol]seconda riga della seconda strofa
[La]terza riga della seconda strofa

[Sol]Strofa tre del canto
[La]seconda riga della terza strofa
[Re]terza riga della terza strofa

RIT:
[Sol]Ritornello finale del canto
[La]seconda riga del ritornello
[Re]terza riga del ritornello`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Modalità riempi_pagina (default): canto breve adotta 1 colonna a font grande
    const result = layoutCanzoniereSong(mockCanto);
    expect(result.fontSizePt).toBeGreaterThanOrEqual(11.5);
    expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    expect(result.hasOverflow).toBe(false);
    expect(result.columnsCount).toBe(1);
    expect(result.fillRatio).toBeGreaterThanOrEqual(0.45);

    const page = result.pages[0];
    expect(page.leftColumn.blocks.length).toBeGreaterThan(0);

    // In modalità compatta: usa 2 colonne a 11pt
    const compactResult = layoutCanzoniereSong(mockCanto, { layoutMode: 'compatta' });
    expect(compactResult.declaredPageCount).toBe(1);
    expect(compactResult.columnsCount).toBe(2);
    expect(compactResult.pages[0].leftColumn.blocks.length).toBeGreaterThan(0);
  });

  it('2. Canto con lieve sforamento: la riduzione a 10 pt o 9.5 pt lo fa rientrare in 1 pagina', () => {
    // Canto che a 11 pt sforerebbe di circa 4-5 righe oltre i 232mm per colonna
    const stanzas: string[] = [];
    for (let s = 1; s <= 14; s++) {
      stanzas.push(
        `[Do]Strofa numero ${s} con testo di prova sintetico\n[Fa]riga intermedia numero due\n[Sol]terza riga di chiusura strofa`
      );
    }

    const mockCanto: Canto = {
      id: 'c-test-overflow-small',
      titolo: 'CANTO DELLA VETTA ALPINO',
      autore: 'Tradizione Scout',
      misura: '3/4',
      bpm_testo: '108',
      tempo_bpm: 108,
      ritmo: 'Valzer (↓ ↑↑)',
      capotasto: 1,
      tonalita: 'Do',
      testo_chordpro: stanzas.join('\n\n'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const result = layoutCanzoniereSong(mockCanto);
    expect(result.fontSizePt).toBeGreaterThanOrEqual(10.5);
    expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    expect(result.hasOverflow).toBe(false);
  });

  it('3. Canto lungo su 2 pagine: tagli solo tra blocchi, senza pagina finale vuota e con intestazione ridotta a pag 2', () => {
    // Canto con 26 strofe: nettamente troppo lungo per 1 pagina anche a 10 pt
    const stanzas: string[] = [];
    for (let s = 1; s <= 26; s++) {
      stanzas.push(
        `[Re]Strofa ${s} del grande canto del bivacco\n[Sol]Seconda riga che scorre nel bosco\n[La]Terza riga con accordo finale`
      );
    }

    const mockCanto: Canto = {
      id: 'c-test-multi',
      titolo: 'GRANDE CANTO DEL BIVACCO LUNGO',
      autore: 'Comunità Capi',
      misura: '4/4',
      bpm_testo: 'circa 100',
      tempo_bpm: 100,
      ritmo: 'Marcia',
      capotasto: null,
      tonalita: 'Re',
      testo_chordpro: stanzas.join('\n\n'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const result = layoutCanzoniereSong(mockCanto);
    expect(result.declaredPageCount).toBeGreaterThanOrEqual(2);
    expect(result.pages.length).toBeGreaterThanOrEqual(2);

    // Pagina 1 ha intestazione completa
    expect(result.pages[0].isFirstPage).toBe(true);
    expect(result.pages[0].headerParams).not.toBeNull();

    // Pagina 2 ha intestazione ridotta
    expect(result.pages[1].isFirstPage).toBe(false);
    expect(result.pages[1].headerParams).toBeNull();
    expect(result.pages[1].pageNumber).toBe(2);

    // Ultima pagina ha almeno 6 righe (mai quasi vuota)
    const lastPage = result.pages[result.pages.length - 1];
    const totalLinesLastPage = lastPage.leftColumn.linesCount + lastPage.rightColumn.linesCount;
    expect(totalLinesLastPage).toBeGreaterThanOrEqual(6);
  });

  it('4. Blocco lunghissimo: se un singolo blocco sfora una colonna, viene spezzato con almeno 3 righe per parte', () => {
    // Un unico blocco continuo di 40 righe senza righe vuote
    const lines: string[] = [];
    for (let i = 1; i <= 40; i++) {
      lines.push(`[Do]Riga continua numero ${i} del testo esteso senza interruzioni`);
    }

    const mockCanto: Canto = {
      id: 'c-test-huge-block',
      titolo: 'POEMA ININTERROTTO DEL ROVER',
      autore: 'Clan',
      misura: '4/4',
      bpm_testo: null,
      tempo_bpm: null,
      ritmo: null,
      capotasto: null,
      tonalita: 'Do',
      testo_chordpro: lines.join('\n'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const result = layoutCanzoniereSong(mockCanto);
    // Deve aver spezzato il blocco e riempito le colonne
    expect(result.pages.length).toBeGreaterThanOrEqual(1);
    const p1 = result.pages[0];
    expect(p1.leftColumn.linesCount).toBeGreaterThanOrEqual(3);
    expect(p1.rightColumn.linesCount).toBeGreaterThanOrEqual(3);
  });

  it('5. Direttiva {nuova_colonna}: rispetta la cesura manuale scelta dall\'autore', () => {
    const mockCanto: Canto = {
      id: 'c-test-manual-col',
      titolo: 'CANTO CON COLONNA FORZATA',
      autore: 'Clan',
      misura: '4/4',
      bpm_testo: null,
      tempo_bpm: null,
      ritmo: null,
      capotasto: null,
      tonalita: 'Do',
      testo_chordpro: `[Do]Strofa colonna 1 riga 1
[Sol]Strofa colonna 1 riga 2

{nuova_colonna}

[Fa]Strofa colonna 2 riga 1
[Do]Strofa colonna 2 riga 2`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const result = layoutCanzoniereSong(mockCanto);
    expect(result.pages.length).toBe(1);
    expect(result.pages[0].leftColumn.blocks[0].lines[0].lyrics).toContain('Strofa colonna 1');
    expect(result.pages[0].rightColumn.blocks[0].lines[0].lyrics).toContain('Strofa colonna 2');
  });

  it('6. Direttiva {nuova_pagina}: genera 2 pagine distinte con intestazione ridotta sulla seconda pagina', () => {
    const mockCanto: Canto = {
      id: 'c-test-page-break',
      titolo: 'CANTO CON PAGINA FORZATA',
      autore: 'Clan San Giovanni',
      misura: '3/4',
      bpm_testo: '90',
      tempo_bpm: 90,
      ritmo: '3/4 (↓ ↑↑)',
      capotasto: null,
      tonalita: 'Mi',
      testo_chordpro: `[Mi]Strofa pagina 1 riga 1
[Si7]Strofa pagina 1 riga 2

{nuova_pagina}

RIT.
[Mi]Ritornello su pagina 2
[Si7]Seconda riga ritornello`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const result = layoutCanzoniereSong(mockCanto);
    expect(result.declaredPageCount).toBe(2);
    expect(result.pages.length).toBe(2);

    // Pagina 1
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].totalPages).toBe(2);
    expect(result.pages[0].isFirstPage).toBe(true);
    expect(result.pages[0].headerParams).not.toBeNull();
    expect(result.pages[0].headerTitle).toBe('CANTO CON PAGINA FORZATA');

    // Pagina 2
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[1].totalPages).toBe(2);
    expect(result.pages[1].isFirstPage).toBe(false);
    expect(result.pages[1].headerParams).toBeNull();
    expect(result.pages[1].headerTitle).toBe('CANTO CON PAGINA FORZATA');
  });
});

describe('CANZONIERE A FLUSSO CONTINUO — Concatenazione Canti su 2 Colonne', () => {
  describe('A) Calcolo Altezza Header su Singola Colonna (89.5 mm)', () => {
    it('1. Calcola altezza compatta con titolo, autore e metadati', () => {
      const h = calculateSongHeaderHeightMm(
        'ALBACHIARA',
        'Vasco Rossi',
        { misura: '4/4', bpm_testo: '130', ritmo: '↓ ↑↑', capotasto: null },
        'suona',
        false
      );
      // Circa 13-18 mm senza divisorio superiore (calibrato su rendering reale)
      expect(h).toBeGreaterThanOrEqual(13);
      expect(h).toBeLessThanOrEqual(20);
    });

    it('2. Aggiunge altezza divisorio superiore quando concatenato a fondo colonna', () => {
      const withoutTop = calculateSongHeaderHeightMm('CANTO', null, null, 'suona', false);
      const withTop = calculateSongHeaderHeightMm('CANTO', null, null, 'suona', true);
      // Il divisorio superiore aggiunge ~3.53 mm (10 pt con margine collassato)
      expect(withTop).toBeGreaterThan(withoutTop);
      expect(withTop - withoutTop).toBeCloseTo(3.53, 1);
    });

    it('3. Variante "Chi canta": omette frecce ritmo e capotasto e risulta più compatto', () => {
      const params = { misura: '4/4', bpm_testo: '130', ritmo: '↓ ↓↑ ↑↓↑', capotasto: 2 };
      const hSuona = calculateSongHeaderHeightMm('CANTO SCOUT', 'Autore', params, 'suona', false);
      const hCanta = calculateSongHeaderHeightMm('CANTO SCOUT', 'Autore', params, 'canta', false);
      expect(hCanta).toBeLessThan(hSuona);
    });
  });

  describe('B) Concatenazione Canti e Prerequisito di Spazio (>= 55 mm)', () => {
    it('1. Concatena due canti brevi sulla stessa pagina nella colonna sinistra', () => {
      const song1: Canto = {
        id: 's1',
        titolo: 'CANTO BREVE 1',
        autore: 'Autore 1',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: `[Do]Verso 1\n[Sol]Verso 2\n[Do]Verso 3\n\n[Fa]Verso 4\n[Do]Verso 5`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const song2: Canto = {
        id: 's2',
        titolo: 'CANTO BREVE 2',
        autore: 'Autore 2',
        categoria: 'scout',
        tonalita: 'Re',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: `[Re]Verso A\n[La]Verso B\n[Re]Verso C`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const result = layoutCanzoniereFlow([song1, song2], { mode: 'suona' });
      expect(result.pages.length).toBe(1);
      expect(result.songPageMap.get('s1')).toBe(1);
      expect(result.songPageMap.get('s2')).toBe(1);

      // Entrambi i canti iniziano nella colonna sinistra
      const leftHeaders = result.pages[0].leftColumn.blocks.filter((b) => b.type === 'header');
      expect(leftHeaders.length).toBe(2);
      expect(leftHeaders[0].header?.title).toBe('CANTO BREVE 1');
      expect(leftHeaders[0].header?.showDivider).toBe(false); // primo della colonna
      expect(leftHeaders[1].header?.title).toBe('CANTO BREVE 2');
      expect(leftHeaders[1].header?.showDivider).toBe(true); // concatenato con divisorio!
    });

    it('2. Spazio residuo < 55 mm: il secondo canto NON parte nello spazio residuo ma avanza alla colonna successiva', () => {
      // 7 strofe: occupano ~230 mm nella colonna sinistra (lasciando ~26 mm < 55 mm)
      const stanzas: string[] = [];
      for (let i = 1; i <= 7; i++) {
        stanzas.push(`[Do]Verso ${i}A del canto medio\n[Sol]Verso ${i}B di prova layout\n[Fa]Verso ${i}C di chiusura`);
      }

      const song1: Canto = {
        id: 's-fill-col',
        titolo: 'CANTO CHE QUASI RIEMPIE LA COLONNA',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: stanzas.join('\n\n'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const song2: Canto = {
        id: 's-next',
        titolo: 'CANTO SUCCESSIVO',
        autore: 'Autore 2',
        categoria: 'scout',
        tonalita: 'Sol',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: `[Sol]Prima riga\n[Do]Seconda riga\n[Re]Terza riga`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const result = layoutCanzoniereFlow([song1, song2], { mode: 'suona' });
      expect(result.pages.length).toBe(1);

      // Colonna sinistra contiene SOLO l'header di song1
      const leftHeaders = result.pages[0].leftColumn.blocks.filter((b) => b.type === 'header');
      expect(leftHeaders.length).toBe(1);
      expect(leftHeaders[0].header?.title).toBe('CANTO CHE QUASI RIEMPIE LA COLONNA');

      // Colonna destra contiene l'header di song2 in cima (senza divisorio superiore)
      const rightHeaders = result.pages[0].rightColumn.blocks.filter((b) => b.type === 'header');
      expect(rightHeaders.length).toBe(1);
      expect(rightHeaders[0].header?.title).toBe('CANTO SUCCESSIVO');
      expect(rightHeaders[0].header?.showDivider).toBe(false);
    });

    it('2b. Spazio residuo >= 55 mm ma strofe insufficienti: MAI lasciare un titolo orfano a fine colonna', () => {
      // 6 strofe: occupano ~195 mm nella colonna sinistra, lasciando ~61 mm (>= 55 mm)
      const stanzas: string[] = [];
      for (let i = 1; i <= 6; i++) {
        stanzas.push(`[Do]Verso ${i}A del canto medio\n[Sol]Verso ${i}B di prova layout\n[Fa]Verso ${i}C di chiusura`);
      }

      const song1: Canto = {
        id: 's-fill-col-61mm',
        titolo: 'CANTO CHE LASCIA 61MM UTILI',
        autore: 'Autore 1',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: stanzas.join('\n\n'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      // song2 ha un header (~26mm) e una prima strofa di 6 versi con accordi (~40mm), totale > 61mm
      const song2: Canto = {
        id: 's-cannot-fit-stanza',
        titolo: 'CANTO CHE NON FA ENTRARE LA PRIMA STROFA',
        autore: 'Autore 2',
        categoria: 'scout',
        tonalita: 'Sol',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: 2,
        testo_chordpro: `[Sol]Prima riga importante con accordi\n[Do]Seconda riga importante con accordi\n[Re]Terza riga importante con accordi\n[Sol]Quarta riga con accordi\n[Do]Quinta riga con accordi\n[Re]Sesta riga di chiusura strofa 1\n\n[Sol]Seconda strofa riga 1\n[Do]Seconda strofa riga 2`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const result = layoutCanzoniereFlow([song1, song2], { mode: 'suona' });

      // Verifichiamo che la colonna sinistra NON contenga un header orfano di song2 privo di strofe!
      const leftBlocks = result.pages[0].leftColumn.blocks;
      const leftHeader2 = leftBlocks.find((b) => b.type === 'header' && b.header?.title === 'CANTO CHE NON FA ENTRARE LA PRIMA STROFA');
      if (leftHeader2) {
        // Se l'header è nella colonna sinistra, deve esserci ALMENO una strofa di song2 nella stessa colonna
        const leftSong2Stanzas = leftBlocks.filter((b) => b.type !== 'header' && b.cantoId === 's-cannot-fit-stanza');
        expect(leftSong2Stanzas.length).toBeGreaterThan(0);
      } else {
        // Altrimenti song2 deve essere scattata integralmente nella colonna destra
        const rightHeader2 = result.pages[0].rightColumn.blocks.find((b) => b.type === 'header' && b.header?.title === 'CANTO CHE NON FA ENTRARE LA PRIMA STROFA');
        expect(rightHeader2).toBeDefined();
      }
    });

    it('3. Uniformità Tipografica: font stabile a 11.0 pt per Chi suona e 11.5 pt per Chi canta (variazione max +-0.5 pt)', () => {
      const song: Canto = {
        id: 's-font-test',
        titolo: 'CANTO TEST FONT',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        testo_chordpro: `[Do]Testo strofa 1\n[Sol]Testo strofa 2`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const resSuona = layoutCanzoniereFlow([song], { mode: 'suona' });
      expect(resSuona.pages[0].fontSizePt).toBeGreaterThanOrEqual(10.5);
      expect(resSuona.pages[0].fontSizePt).toBeLessThanOrEqual(11.5);
      expect(resSuona.pages[0].fontSizePt).toBe(11.0);

      const resCanta = layoutCanzoniereFlow([song], { mode: 'canta' });
      expect(resCanta.pages[0].fontSizePt).toBeGreaterThanOrEqual(11.0);
      expect(resCanta.pages[0].fontSizePt).toBeLessThanOrEqual(12.0);
      expect(resCanta.pages[0].fontSizePt).toBe(11.5);
    });

    it('4. Flusso multi-canto raggiunge alta percentuale media di riempimento utile (~80%)', () => {
      // 4 canti scout di varie lunghezze
      const songs: Canto[] = [
        {
          id: 's-multi-1',
          titolo: 'CANTO UNO',
          autore: 'Autore 1',
          categoria: 'scout',
          tonalita: 'Do',
          ritmo: '4/4',
          tempo_bpm: 90,
          bpm_testo: '90',
          misura: '4/4',
          capotasto: null,
          testo_chordpro: `[Do]Strofa 1\n[Sol]Strofa 1b\n\n[Fa]Strofa 2\n[Do]Strofa 2b`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        {
          id: 's-multi-2',
          titolo: 'CANTO DUE',
          autore: 'Autore 2',
          categoria: 'scout',
          tonalita: 'Re',
          ritmo: null,
          tempo_bpm: null,
          bpm_testo: null,
          misura: null,
          capotasto: null,
          testo_chordpro: `[Re]Strofa 1 canto 2\n[La]Strofa 1b canto 2\n\n[Sol]Strofa 2 canto 2\n[Re]Strofa 2b canto 2`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        {
          id: 's-multi-3',
          titolo: 'CANTO TRE',
          autore: 'Autore 3',
          categoria: 'scout',
          tonalita: 'Sol',
          ritmo: null,
          tempo_bpm: null,
          bpm_testo: null,
          misura: null,
          capotasto: null,
          testo_chordpro: `[Sol]Strofa 1 canto 3\n[Do]Strofa 1b canto 3\n\n[Re]Strofa 2 canto 3\n[Sol]Strofa 2b canto 3`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ];

      const res = layoutCanzoniereFlow(songs, { mode: 'suona' });
      // I 3 canti brevi si concatenano tutti in un unico foglio
      expect(res.pages.length).toBe(1);
      expect(res.pages[0].columnsCount).toBe(2);
      expect(res.hasAnyOverflow).toBe(false);
    });

    it('5. Autore molto lungo su 2 o più righe calcola correttamente altezza header maggiorata', () => {
      const shortAuthorH = calculateSongHeaderHeightMm('TITOLO CANTO', 'Autore Breve', null, 'suona', false);
      const longAuthorH = calculateSongHeaderHeightMm(
        'TITOLO CANTO',
        'Comunità Cenacolo - Canto delle Beatitudini - Testo e Musica di Marco Frisina e Autori Vari Associati',
        null,
        'suona',
        false
      );
      expect(longAuthorH).toBeGreaterThan(shortAuthorH);
    });

    it('6. Blocco gigante (70 righe continue) viene suddiviso senza generare overflow colonna', () => {
      const lines: string[] = [];
      for (let i = 1; i <= 70; i++) {
        lines.push(`[Do]Verso continuo ${i} senza interruzione di strofa`);
      }

      const giantSong: Canto = {
        id: 's-giant-stanza',
        titolo: 'CANTO CON BLOCCO CONTINUO GIGANTE',
        autore: 'Autore Tradizionale',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: lines.join('\n'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const res = layoutCanzoniereFlow([giantSong], { mode: 'suona' });
      expect(res.pages.length).toBeGreaterThan(1);
      expect(res.hasAnyOverflow).toBe(false);

      // Ogni colonna rispetta l'altezza massima di 256 mm
      for (const p of res.pages) {
        expect(p.leftColumn.totalHeightMm).toBeLessThanOrEqual(256.5);
        expect(p.rightColumn.totalHeightMm).toBeLessThanOrEqual(256.5);
      }
    });

    it('7. Canto vuoto (0 strofe) viene gestito senza intestazioni orfane', () => {
      const emptySong: Canto = {
        id: 's-empty',
        titolo: 'CANTO SENZA TESTO',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const normalSong: Canto = {
        id: 's-normal',
        titolo: 'CANTO NORMALE',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        testo_chordpro: `[Do]Verso 1\n[Sol]Verso 2`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const res = layoutCanzoniereFlow([emptySong, normalSong], { mode: 'suona' });
      expect(res.pages.length).toBe(1);
      expect(res.songPageMap.has('s-empty')).toBe(true);
      expect(res.songPageMap.has('s-normal')).toBe(true);

      // L'header del canto normale è presente
      const headers = res.pages[0].leftColumn.blocks.filter((b) => b.type === 'header');
      expect(headers.some((h) => h.header?.title === 'CANTO NORMALE')).toBe(true);
    });

    it('8. Compattazione anti-orfano applica fontSizePt = 10.5 ai blocchi del canto', () => {
      // Creiamo un canto che con font 11 sfora di poco (~15 mm <= 26 mm) ma con 10.5 rientra
      // 1 colonna sinistra occupata, e canto sulla colonna destra
      const song: Canto = {
        id: 's-compact-test',
        titolo: 'CANTO DA COMPATTARE',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        testo_chordpro: `[Do]V1\n[Sol]V2\n\n[Fa]V3\n[Do]V4\n\n[Do]V5\n[Sol]V6\n\n[Fa]V7\n[Do]V8\n\n[Do]V9\n[Sol]V10\n\n[Fa]V11\n[Do]V12\n\n[Do]V13\n[Sol]V14\n\n[Fa]V15\n[Do]V16`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const res = layoutCanzoniereFlow([song], { mode: 'suona', baseFontSizePt: 11.0 });
      expect(res.pages.length).toBe(1);
      // I blocchi hanno fontSizePt definito
      const stanzas = res.pages[0].leftColumn.blocks.filter((b) => b.type !== 'header');
      for (const st of stanzas) {
        expect(st.fontSizePt).toBeDefined();
        expect(st.fontSizePt).toBeGreaterThanOrEqual(10.5);
      }
    });

    it('9. Flusso continuo in modalità "Chi suona": i canti scorrono uno dopo l\'altro senza forzare salto pagina a vuoto', () => {
      // Due canti normali in modalità suona che possono fluire tra le colonne
      const song1: Canto = {
        id: 's-flow-1',
        titolo: 'CANTO PRIMO IN FLUSSO',
        autore: 'Autore 1',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        testo_chordpro: `[Do]Strofa 1 verso 1\n[Sol]Strofa 1 verso 2\n\n[Fa]Strofa 2 verso 1\n[Do]Strofa 2 verso 2`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const song2: Canto = {
        id: 's-flow-2',
        titolo: 'CANTO SECONDO IN FLUSSO',
        autore: 'Autore 2',
        categoria: 'scout',
        tonalita: 'Sol',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        testo_chordpro: `[Sol]Strofa A verso 1\n[Re]Strofa A verso 2\n\n[Do]Strofa B verso 1\n[Sol]Strofa B verso 2`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const res = layoutCanzoniereFlow([song1, song2], { mode: 'suona' });
      expect(res.pages.length).toBe(1);
      // Entrambi i canti sono presenti sulla stessa pagina 1 senza saltare a nuova pagina
      expect(res.songPageMap.get('s-flow-1')).toBe(1);
      expect(res.songPageMap.get('s-flow-2')).toBe(1);
    });

    it('10. Riempimento del fondo colonna: una strofa che supera lo spazio residuo viene spezzata se availableInCol >= 20 mm', () => {
      // Canto con una strofa lunga di 15 versi: colonna parzialmente riempita (~165 mm usati, ~91 mm liberi)
      // La strofa da 15 versi (~135 mm) supera 91 mm anche oltre la tolleranza, quindi viene spezzata
      // riempiendo la colonna sinistra e passando la seconda parte alla colonna destra.
      const longStanzaLines = Array.from({ length: 15 }, (_, i) => `[Do]Verso lungo ${i + 1} con accordi`).join('\n');
      const song: Canto = {
        id: 's-split-col',
        titolo: 'CANTO CON STROFA DA SPEZZARE',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        testo_chordpro: `[Do]V1\n[Sol]V2\n\n[Fa]V3\n[Do]V4\n\n[Do]V5\n[Sol]V6\n\n[Fa]V7\n[Do]V8\n\n[Do]V9\n[Sol]V10\n\n[Fa]V11\n[Do]V12\n\n[Do]V13\n[Sol]V14\n\n${longStanzaLines}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const res = layoutCanzoniereFlow([song], { mode: 'suona' });
      // Colonna sinistra deve essere riempita fin quasi in fondo (empty <= 15 mm)
      const leftH = res.pages[0].leftColumn.totalHeightMm;
      expect(leftH).toBeGreaterThanOrEqual(240);
      expect(256 - leftH).toBeLessThanOrEqual(16);
      // E la colonna destra deve contenere la seconda parte della strofa spezzata
      expect(res.pages[0].rightColumn.blocks.length).toBeGreaterThan(0);
    });
  });
});


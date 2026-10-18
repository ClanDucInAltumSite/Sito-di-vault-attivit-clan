import { describe, it, expect } from 'vitest';
import { layoutCanzoniereSong } from '../src/features/canti/canzoniere_layout';
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

    const result = layoutCanzoniereSong(mockCanto);
    expect(result.declaredPageCount).toBe(1);
    expect(result.fontSizePt).toBeGreaterThanOrEqual(11); // Scala tra 11 e 13 pt per riempire la pagina ed evitare vuoti
    expect(result.fontSizePt).toBeLessThanOrEqual(13);
    expect(result.hasOverflow).toBe(false);

    const page = result.pages[0];
    expect(page.leftColumn.blocks.length).toBeGreaterThan(0);
    expect(page.rightColumn.blocks.length).toBeGreaterThan(0);
    // Le due colonne devono essere bilanciate (dislivello contenuto)
    const diffMm = Math.abs(page.leftColumn.totalHeightMm - page.rightColumn.totalHeightMm);
    expect(diffMm).toBeLessThan(40);
  });

  it('2. Canto con lieve sforamento: la riduzione a 10 pt o 9.5 pt lo fa rientrare in 1 pagina', () => {
    // Canto che a 11 pt sforerebbe di circa 4-5 righe oltre i 232mm per colonna
    const stanzas: string[] = [];
    for (let s = 1; s <= 9; s++) {
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
    // Deve essere rientrato in 1 pagina grazie allo step-down (tra 9 e 10.5 pt)
    expect(result.declaredPageCount).toBe(1);
    expect(result.fontSizePt).toBeLessThan(11);
    expect(result.fontSizePt).toBeGreaterThanOrEqual(9);
    expect(result.hasOverflow).toBe(false);
  });

  it('3. Canto lungo su 2 pagine: tagli solo tra blocchi, senza pagina finale vuota e con intestazione ridotta a pag 2', () => {
    // Canto con 18 strofe: nettamente troppo lungo per 1 pagina anche a 9 pt
    const stanzas: string[] = [];
    for (let s = 1; s <= 18; s++) {
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

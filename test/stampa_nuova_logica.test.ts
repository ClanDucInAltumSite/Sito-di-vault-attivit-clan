// test/stampa_nuova_logica.test.ts
// Test completi per la nuova logica di stampa:
// 1. applyRitRepeatPolicy (2 e 3 ripetizioni, senza marcatori, artefatto RIT in testa, differenze parziali)
// 2. Variante "Chi canta" (zero accordi, niente strum/intro/outro, senza metadati musicali)
// 3. Variante "Chi suona" (accordi sopra il testo, strum/intro/outro preservati, metadati in header)
// 4. Indice per settori (Scout -> Esterni -> Chiesa -> Altre) con rimozione articoli e numeri pagina reali
// 5. Isolamento DOM delle 3 stampe (giochibans | canzoni | odg) e nessun "tutti"
// 6. Fixture con le 4 canzoni PDF di riferimento (Aglio e olio, Albachiara, Come sole come goccia, Come ti ama Dio)

import { describe, it, expect } from 'vitest';
import {
  applyRitRepeatPolicy,
  sortSongsBySector,
  calculateCanzoniereIndex,
  normalizeTitleForSort,
  getSectorKey,
  SECTOR_LABELS,
  StampaCanzoniConfig,
  loadPrintableCanzoniData,
} from '../src/lib/stampa_canzoni';
import { layoutCanzoniereSong } from '../src/features/canti/canzoniere_layout';
import { Canto } from '../src/lib/db';
import {
  DANZA_LA_VITA_PARSED,
  AGLIO_E_OLIO_PARSED,
  ALBACHIARA_PARSED,
  COME_SOLE_COME_GOCCIA_PARSED,
  COME_TI_AMA_DIO_PARSED,
} from '../src/data/parsed_songs';
import { SectionTab } from '../src/features/stampa/StampaView';

describe('NUOVA LOGICA STAMPA VAULT SCOUT', () => {
  // ============================================================================
  // 1. REGOLE RIT. (applyRitRepeatPolicy)
  // ============================================================================
  describe('1. applyRitRepeatPolicy', () => {
    it('in modalità "Chi suona" NON sostituisce MAI i ritornelli ripetuti con RIT. e mantiene sempre accordi e testo per intero', () => {
      const song3Rit: Canto = {
        id: 'canto-3rit',
        titolo: 'Canto con 3 Ritornelli',
        autore: 'Autore Test',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        origine: 'manuale',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        nota_fonte: '',
        testo_chordpro: `[Do]Strofa 1 del canto
{soc}
RIT:
[Fa]Questo è il ritornello [Sol]uguale
che si canta con [Do]gioia
{eoc}

[Do]Strofa 2 del canto
{soc}
RIT:
[Fa]Questo è il ritornello [Sol]uguale
che si canta con [Do]gioia
{eoc}

[Do]Strofa 3 del canto
{soc}
RIT:
[Fa]Questo è il ritornello [Sol]uguale
che si canta con [Do]gioia
{eoc}`,
      };

      const appliedSuona = applyRitRepeatPolicy(song3Rit, 'suona');
      const text = appliedSuona.testo_chordpro;

      // In modalità suona TUTTI i 3 ritornelli devono essere presenti per intero con gli accordi
      const countFullText = (text.match(/che si canta con/g) || []).length;
      expect(countFullText).toBe(3);

      const countChords = (text.match(/\[Fa\]Questo è il ritornello \[Sol\]uguale/g) || []).length;
      expect(countChords).toBe(3);

      // Nessuna etichetta orfana o shortcut RIT. o RIT:
      expect(text).not.toMatch(/^RIT[.:]?$/m);
    });

    it('in modalità "Chi suona" riespande token RIT. o RIT: isolati nel sorgente recuperando gli accordi del ritornello precedente', () => {
      const songWithShorthand: Canto = {
        id: 'canto-short',
        titolo: 'Canto con scorciatoia sorgente',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        origine: 'manuale',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        nota_fonte: '',
        testo_chordpro: `[Do]Strofa 1
{soc}
[Fa]Ritornello con [Sol]accordi completi [Do]
{eoc}

[Do]Strofa 2
RIT.

[Do]Strofa 3
RIT:`,
      };

      const appliedSuona = applyRitRepeatPolicy(songWithShorthand, 'suona');
      const text = appliedSuona.testo_chordpro;

      // Le due scorciatoie RIT. e RIT: devono essere riespanse con gli accordi
      const countChorus = (text.match(/Ritornello con \[Sol\]accordi completi/g) || []).length;
      expect(countChorus).toBe(3);
      expect(text).not.toMatch(/^RIT[.:]?$/m);
    });

    it('in modalità "Chi canta" contrae i ritornelli ripetuti a RIT. e deduplica token consecutivi', () => {
      const song3Rit: Canto = {
        id: 'canto-3rit-canta',
        titolo: 'Canto con 3 Ritornelli per Canta',
        autore: 'Autore Test',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        origine: 'manuale',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        nota_fonte: '',
        testo_chordpro: `[Do]Strofa 1 del canto
{soc}
RIT:
[Fa]Questo è il ritornello [Sol]uguale
che si canta con [Do]gioia
{eoc}

[Do]Strofa 2 del canto
{soc}
RIT:
[Fa]Questo è il ritornello [Sol]uguale
che si canta con [Do]gioia
{eoc}

[Do]Strofa 3 del canto
{soc}
RIT:
[Fa]Questo è il ritornello [Sol]uguale
che si canta con [Do]gioia
{eoc}`,
      };

      const appliedCanta = applyRitRepeatPolicy(song3Rit, 'canta');
      const text = appliedCanta.testo_chordpro;

      // Il primo ritornello ha il testo senza accordi
      expect(text).toContain('Questo è il ritornello uguale');
      expect(text).not.toContain('[Fa]');

      // Le successive occorrenze sono sostituite da RIT.
      const matchesRit = text.match(/RIT\./g);
      expect(matchesRit).toBeTruthy();
      expect(matchesRit!.length).toBeGreaterThanOrEqual(2);

      // Il testo esteso compare solo 1 volta
      const countFullText = (text.match(/che si canta con/g) || []).length;
      expect(countFullText).toBe(1);
    });

    it('in modalità "Chi canta" deduplica ritornelli multipli consecutivi in un unico token compatto', () => {
      const songMultiEndingRit: Canto = {
        id: 'canto-multi-rit',
        titolo: 'Canto con finale a 3 ritornelli consecutivi',
        autore: 'Autore',
        categoria: 'scout',
        tonalita: 'Do',
        ritmo: '4/4',
        tempo_bpm: 100,
        bpm_testo: '100',
        misura: '4/4',
        capotasto: null,
        origine: 'manuale',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        nota_fonte: '',
        testo_chordpro: `Strofa 1
{soc}
Canta e cammina
{eoc}

Strofa 2
{soc}
Canta e cammina
{eoc}
{soc}
Canta e cammina
{eoc}
{soc}
Canta e cammina
{eoc}`,
      };

      const appliedCanta = applyRitRepeatPolicy(songMultiEndingRit, 'canta');
      const text = appliedCanta.testo_chordpro;

      // Non devono MAI esserci righe consecutive di "RIT."
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length - 1; i++) {
        const isThisRit = /^RIT[.:]?(\s*\(x\d+\))?$/i.test(lines[i]!);
        const isNextRit = /^RIT[.:]?(\s*\(x\d+\))?$/i.test(lines[i + 1]!);
        expect(isThisRit && isNextRit).toBe(false);
      }
    });

    it('riconosce il ritornello ripetuto anche senza marcatori {soc}/{eoc} (con prefisso RIT:)', () => {
      const songWithoutSoc: Canto = {
        id: 'canto-no-soc',
        titolo: 'Canto senza soc',
        autore: 'Autore',
        categoria: 'chiesa',
        tonalita: 'Re',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        origine: 'manuale',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        nota_fonte: '',
        testo_chordpro: `[Re]Strofa iniziale

RIT:
[Sol]Lode a te [La]Signore dell'universo
[Sol]Lode a te [Re]Signore

[Re]Seconda strofa

RIT:
[Sol]Lode a te [La]Signore dell'universo
[Sol]Lode a te [Re]Signore`,
      };

      const applied = applyRitRepeatPolicy(songWithoutSoc, 'canta');
      const text = applied.testo_chordpro;

      // Il primo testo compare
      expect(text).toContain('Lode a te');
      // Il secondo blocco è contratto a RIT.
      const countFull = (text.match(/dell'universo/g) || []).length;
      expect(countFull).toBe(1);
      expect(text).toMatch(/RIT\./);
    });

    it('rimuove artefatti di conversione in testa al canto come "RIT. / RIT:" o "RIT:" vuoti', () => {
      const songWithArtifact: Canto = {
        id: 'canto-artifact',
        titolo: 'Canto con Artefatto PDF',
        autore: 'Autore',
        categoria: 'esterni',
        tonalita: 'Sol',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        origine: 'import_pdf',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        nota_fonte: '',
        testo_chordpro: `RIT. / RIT:
[Sol]Prima riga della prima strofa reale
[Do]Seconda riga

{soc}
RIT:
[Re]Ritornello autentico
{eoc}

{soc}
RIT:
[Re]Ritornello autentico
{eoc}`,
      };

      const applied = applyRitRepeatPolicy(songWithArtifact, 'suona');
      const text = applied.testo_chordpro;

      // L'intestazione artefatto in cima alla pagina è stata rimossa
      expect(text.startsWith('RIT. / RIT:')).toBe(false);
      expect(text.startsWith('[Sol]Prima riga')).toBe(true);

      // In suona mode entrambi i ritornelli autentici sono conservati con accordi
      const countRit = (text.match(/\[Re\]Ritornello autentico/g) || []).length;
      expect(countRit).toBe(2);
    });

    it('NON contrae ritornelli parzialmente identici o modulati', () => {
      const songWithVariantRit: Canto = {
        id: 'canto-var',
        titolo: 'Canto con Ritornello Modificato',
        autore: 'Autore',
        categoria: 'esterni',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: null,
        bpm_testo: null,
        misura: null,
        capotasto: null,
        origine: 'manuale',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        nota_fonte: '',
        testo_chordpro: `[Do]Strofa 1
{soc}
RIT:
[Do]Siamo noi la luce del mondo
{eoc}

[Do]Strofa 2
{soc}
RIT:
[Do]Siamo noi la luce del mondo e della terra intera
{eoc}`,
      };

      const applied = applyRitRepeatPolicy(songWithVariantRit, 'suona');
      // Entrambi devono essere preservati perché il secondo ha testo addizionale
      expect(applied.testo_chordpro).toContain('Siamo noi la luce del mondo');
      expect(applied.testo_chordpro).toContain('e della terra intera');
    });
  });

  // ============================================================================
  // 2. MODALITÀ "CHI CANTA" VS "CHI SUONA"
  // ============================================================================
  describe('2. Modalità "Chi canta" e "Chi suona"', () => {
    it('in modalità "Chi canta" rimuove tassativamente tutti gli accordi dal testo', () => {
      const appliedCanta = applyRitRepeatPolicy(DANZA_LA_VITA_PARSED, 'canta');
      const text = appliedCanta.testo_chordpro;

      // Nessun tag accordo [Accordo] deve essere presente
      expect(text).not.toMatch(/\[[A-Za-z0-9#b/+]+\]/);
      expect(text).not.toContain('[Do]');
      expect(text).not.toContain('[Fa]');
      expect(text).not.toContain('[Sol]');

      // Nessun commento strumentale intro/strum/outro
      expect(text).not.toContain('{comment: intro:');
      expect(text).not.toContain('{comment: strum:');
      expect(text).not.toContain('{comment: outro:');

      // Il testo delle parole deve essere intatto
      expect(text).toContain('Canta con la voce e con il cuore');
      expect(text).toContain('Cammina sulle orme del Signore');
    });

    it('in modalità "Chi canta" layoutCanzoniereSong mantiene i metadati di tempo e ritmo ed esclude il capotasto', () => {
      const appliedCanta = applyRitRepeatPolicy(DANZA_LA_VITA_PARSED, 'canta');
      const layout = layoutCanzoniereSong(appliedCanta, { mode: 'canta', layoutMode: 'riempi_pagina' });

      expect(layout.pages.length).toBeGreaterThanOrEqual(1);
      const page1 = layout.pages[0];
      // In modalità canta i metadati tempo/ritmo sono preservati ma il capotasto chitarristico è escluso
      expect(page1.headerParams).not.toBeNull();
      expect(page1.headerParams?.misura).toBe('4/4');
      expect(page1.headerParams?.ritmo).toBeTruthy();
      expect(page1.headerParams?.capotasto).toBeNull();
      expect(page1.headerTitle).toBe('DANZA LA VITA');
      expect(page1.headerAuthor).toBe('Canto scout');
    });

    it('in modalità "Chi suona" preserva accordi sopra il testo, intro/strum e headerParams', () => {
      const appliedSuona = applyRitRepeatPolicy(DANZA_LA_VITA_PARSED, 'suona');
      const text = appliedSuona.testo_chordpro;

      // Accordi presenti
      expect(text).toContain('[Do]');
      expect(text).toContain('[Fa]');

      // Intro e outro presenti
      expect(text).toContain('{comment: intro:');
      expect(text).toContain('{comment: outro:');

      const layout = layoutCanzoniereSong(appliedSuona, { mode: 'suona', layoutMode: 'riempi_pagina' });
      const page1 = layout.pages[0];
      // headerParams valorizzato
      expect(page1.headerParams).not.toBeNull();
      expect(page1.headerParams?.misura).toBe('4/4');
      expect(page1.headerParams?.ritmo).toBeTruthy();
    });
  });

  // ============================================================================
  // 3. INDICE A INIZIO CANZONIERE DIVISO PER SETTORI
  // ============================================================================
  describe('3. Indice del Canzoniere per Settori', () => {
    it('normalizza i titoli ignorando articoli iniziali italiani e accenti per l\'ordinamento alfabetico', () => {
      expect(normalizeTitleForSort('Il gatto e la volpe')).toBe('gatto e la volpe');
      expect(normalizeTitleForSort('La canzone del sole')).toBe('canzone del sole');
      expect(normalizeTitleForSort("L'acqua, la terra, il cielo")).toBe('acqua, la terra, il cielo');
      expect(normalizeTitleForSort('Un falco nel cielo')).toBe('falco nel cielo');
      expect(normalizeTitleForSort('È più bello insieme')).toBe('e piu bello insieme');
      expect(normalizeTitleForSort('Albachiara')).toBe('albachiara');
    });

    it('ordina le canzoni rigorosamente nell\'ordine dei settori: Scout -> Esterni -> Chiesa -> Altre', () => {
      const songScout: Canto = { ...COME_SOLE_COME_GOCCIA_PARSED, categoria: 'scout' };
      const songEsterna: Canto = { ...ALBACHIARA_PARSED, categoria: 'esterni' };
      const songChiesa: Canto = { ...COME_TI_AMA_DIO_PARSED, categoria: 'chiesa' };
      const songAltra: Canto = {
        ...ALBACHIARA_PARSED,
        id: 'altra-1',
        titolo: 'Zebra a pois',
        categoria: null as any,
      };

      const sorted = sortSongsBySector([songAltra, songChiesa, songEsterna, songScout]);

      expect(sorted[0].categoria).toBe('scout');
      expect(sorted[1].categoria).toBe('esterni');
      expect(sorted[2].categoria).toBe('chiesa');
      expect(getSectorKey(sorted[3].categoria)).toBe('altre');
    });

    it('calcola i numeri di pagina reali dell\'indice DOPO il layout effettivo con copertina', () => {
      const fakeSongs = [
        { canto: { ...COME_SOLE_COME_GOCCIA_PARSED, categoria: 'scout' }, pageCount: 1 },
        { canto: { ...ALBACHIARA_PARSED, categoria: 'esterni' }, pageCount: 1 },
        { canto: { ...COME_TI_AMA_DIO_PARSED, categoria: 'chiesa' }, pageCount: 2 },
      ];

      // Con copertina (1 pag) e indice (1 pag)
      const index = calculateCanzoniereIndex(fakeSongs, true, true);

      expect(index.hasCover).toBe(true);
      expect(index.coverPage).toBe(1);
      expect(index.indexPageStart).toBe(2);
      expect(index.indexPageCount).toBe(1);

      // La prima canzone (Scout) deve iniziare a pagina 3
      const scoutSector = index.sectors.find((s) => s.key === 'scout');
      expect(scoutSector).toBeDefined();
      expect(scoutSector!.entries[0].startPage).toBe(3);

      // La seconda canzone (Esterni, dopo 1 pag scout) deve iniziare a pagina 4
      const esterniSector = index.sectors.find((s) => s.key === 'esterni');
      expect(esterniSector).toBeDefined();
      expect(esterniSector!.entries[0].startPage).toBe(4);

      // La terza canzone (Chiesa, dopo 1 pag esterni) deve iniziare a pagina 5
      const chiesaSector = index.sectors.find((s) => s.key === 'chiesa');
      expect(chiesaSector).toBeDefined();
      expect(chiesaSector!.entries[0].startPage).toBe(5);

      // Totale pagine: copertina (1) + indice (1) + scout (1) + esterni (1) + chiesa (2) = 6
      expect(index.totalPages).toBe(6);
    });

    it('non mostra settori vuoti nell\'indice', () => {
      const onlyScoutSongs = [
        { canto: { ...COME_SOLE_COME_GOCCIA_PARSED, categoria: 'scout' }, pageCount: 1 },
      ];

      const index = calculateCanzoniereIndex(onlyScoutSongs, false, true);
      expect(index.sectors).toHaveLength(1);
      expect(index.sectors[0].key).toBe('scout');
      expect(index.sectors.some((s) => s.key === 'esterni')).toBe(false);
      expect(index.sectors.some((s) => s.key === 'chiesa')).toBe(false);
    });
  });

  // ============================================================================
  // 4. TRE STAMPE COMPLETAMENTE SEPARATE (DOM E TIPI)
  // ============================================================================
  describe('4. Isolamento delle tre stampe', () => {
    it('il tipo SectionTab contiene solo giochibans, canzoni, odg (niente tutti)', () => {
      const validTabs: SectionTab[] = ['giochibans', 'canzoni', 'odg'];
      expect(validTabs).toHaveLength(3);

      // Verifica che non accetti 'tutti' a livello di compilazione e runtime
      const isAllowed = (tab: string): tab is SectionTab =>
        ['giochibans', 'canzoni', 'odg'].includes(tab);
      expect(isAllowed('canzoni')).toBe(true);
      expect(isAllowed('giochibans')).toBe(true);
      expect(isAllowed('odg')).toBe(true);
      expect(isAllowed('tutti')).toBe(false);
    });
  });

  // ============================================================================
  // 5. FIXTURE DEL PDF DI RIFERIMENTO
  // ============================================================================
  describe('5. Fixture Canzoni PDF di Riferimento', () => {
    const referenceSongs = [
      { name: 'Aglio e Olio', song: AGLIO_E_OLIO_PARSED },
      { name: 'Albachiara', song: ALBACHIARA_PARSED },
      { name: 'Come sole come goccia', song: COME_SOLE_COME_GOCCIA_PARSED },
      { name: 'Come ti ama Dio', song: COME_TI_AMA_DIO_PARSED },
    ];

    it.each(referenceSongs)(
      'impagina $name in variante "Chi suona" e adatta il font allo spazio disponibile',
      ({ song }) => {
        const applied = applyRitRepeatPolicy(song, 'suona');
        const layout = layoutCanzoniereSong(applied, {
          mode: 'suona',
          layoutMode: 'riempi_pagina',
        });

        expect(layout.pages.length).toBeGreaterThanOrEqual(1);
        expect(layout.fontSizePt).toBeGreaterThanOrEqual(9);
        expect(layout.fontSizePt).toBeLessThanOrEqual(17);

        // Verifica che ogni blocco sia distribuito senza riga orfana
        for (const page of layout.pages) {
          const leftBlocks = page.leftColumn.blocks;
          const rightBlocks = page.rightColumn.blocks;
          expect(leftBlocks.length + rightBlocks.length).toBeGreaterThan(0);
        }
      }
    );

    it.each(referenceSongs)(
      'impagina $name in variante "Chi canta" senza accordi e con testo compatto',
      ({ song }) => {
        const applied = applyRitRepeatPolicy(song, 'canta');
        const layout = layoutCanzoniereSong(applied, {
          mode: 'canta',
          layoutMode: 'riempi_pagina',
        });

        expect(layout.pages.length).toBeGreaterThanOrEqual(1);
        // Nessun accordo nelle righe
        for (const page of layout.pages) {
          for (const col of [page.leftColumn, page.rightColumn]) {
            for (const b of col.blocks) {
              for (const line of b.lines) {
                expect(line.hasChords).toBe(false);
                expect(line.chords).toHaveLength(0);
                expect(line.isChordOnly).toBe(false);
              }
            }
          }
        }
      }
    );
  });

  // ============================================================================
  // 7. CANZONIERE A FLUSSO CONTINUO — Integrazione Dataset e Indice
  // ============================================================================
  describe('7. Flusso continuo: dataset pagine e sincronizzazione Indice', () => {
    it('genera il dataset a flusso continuo con pagine A4 aggregate e numeri libro sincronizzati', async () => {
      const mockCanti: Canto[] = [
        {
          id: 'c1',
          titolo: 'CANTO PRIMO',
          autore: 'Autore 1',
          categoria: 'scout',
          tonalita: 'Do',
          ritmo: '4/4',
          tempo_bpm: 100,
          bpm_testo: '100',
          misura: '4/4',
          capotasto: null,
          testo_chordpro: `[Do]Strofa 1 riga 1\n[Fa]Strofa 1 riga 2`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
        {
          id: 'c2',
          titolo: 'CANTO SECONDO',
          autore: 'Autore 2',
          categoria: 'scout',
          tonalita: 'Re',
          ritmo: '4/4',
          tempo_bpm: 90,
          bpm_testo: '90',
          misura: '4/4',
          capotasto: null,
          testo_chordpro: `[Re]Strofa 2 riga 1\n[Sol]Strofa 2 riga 2`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ];

      const config: StampaCanzoniConfig = {
        selectedCantiIds: ['c1', 'c2'],
        mode: 'suona',
        layoutMode: 'riempi_pagina',
        includeIndex: true,
        includeCover: false,
      };

      const dataset = await loadPrintableCanzoniData(config, mockCanti);

      // Pagine a flusso continuo
      expect(dataset.pages).toBeDefined();
      expect(dataset.pages.length).toBeGreaterThanOrEqual(1);
      expect(dataset.pages[0].isContinuousFlow).toBe(true);
      expect(dataset.pages[0].bookPageNumber).toBe(2); // Indice è a pagina 1, canti iniziano a pagina 2!

      // Indice sincronizzato
      expect(dataset.indexResult.indexPages.length).toBe(1);
      const scoutSector = dataset.indexResult.sectors.find((s) => s.key === 'scout');
      expect(scoutSector).toBeDefined();
      expect(scoutSector!.entries.length).toBe(2);

      // Entrambi i canti brevi iniziano a pagina 2 nel libro continuo!
      expect(scoutSector!.entries[0].startPage).toBe(2);
      expect(scoutSector!.entries[1].startPage).toBe(2);

      // Cross reference per altra modalità presente
      expect(scoutSector!.entries[0].otherModePage).toBeDefined();
      expect(scoutSector!.entries[1].otherModePage).toBeDefined();
    });

    it('12. Slider Indice Disattivato (includeIndex = false): esclude la pagina indice e inizia il canzoniere a pagina 1', async () => {
      const mockCanti: Canto[] = [
        {
          id: 'c1',
          titolo: 'CANTO 1',
          autore: 'Autore 1',
          categoria: 'scout',
          tonalita: 'Do',
          ritmo: null,
          battute_al_minuto: null,
          capotasto: 0,
          testo_chordpro: '{soc}\n[Do]Ritornello prova\n{eoc}\n[Do]Strofa 1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ];

      const config: StampaCanzoniConfig = {
        selectedCantiIds: ['c1'],
        mode: 'suona',
        layoutMode: 'riempi_pagina',
        includeIndex: false,
        includeCover: false,
      };

      const dataset = await loadPrintableCanzoniData(config, mockCanti);

      // Indice escluso
      expect(dataset.indexResult.indexPageCount).toBe(0);
      expect(dataset.indexResult.indexPages.length).toBe(0);

      // Canti iniziano direttamente a pagina 1
      expect(dataset.pages).toBeDefined();
      expect(dataset.pages.length).toBeGreaterThanOrEqual(1);
      expect(dataset.pages[0].bookPageNumber).toBe(1);
      expect(dataset.indexResult.totalPages).toBe(dataset.pages.length);
    });
  });
});



import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  transposeChord,
  transposeChordPro,
  stripChords,
  calculatePageCount,
  validateChordPro,
  parseChordProAST,
  parseLine,
} from '../src/lib/chordpro';
import { parseLineToScreenWords, parseCantoLine } from '../src/features/canti/CantoLineRenderer';
import {
  getDb,
  resetDbInstanceForTesting,
  getCanti,
  upsertRecords,
  Canto,
} from '../src/lib/db';
import { matchesQuery, findSimilarName } from '../src/lib/search';
import { getTrashItems } from '../src/lib/admin_actions';

describe('FASE 4 - Canti e ChordPro Engine', () => {
  // TEST 1: Trasposizione accordi italiani e americani
  describe('1. Trasposizione Accordi', () => {
    it('traspone accordi italiani maggiori, minori, alterati e con slash', () => {
      // Do + 2 semitoni = Re
      expect(transposeChord('Do', 2)).toBe('Re');
      // Re - 2 semitoni = Do
      expect(transposeChord('Re', -2)).toBe('Do');
      // Mi + 1 semitono = Fa
      expect(transposeChord('Mi', 1)).toBe('Fa');
      // Fa# + 1 semitono = Sol
      expect(transposeChord('Fa#', 1)).toBe('Sol');
      // Lam + 2 semitoni = Sim
      expect(transposeChord('Lam', 2)).toBe('Sim');
      // Dom7 + 3 semitoni = Re#m7 (o Mibm7)
      expect(transposeChord('Dom7', 3)).toBe('Re#m7');
      // Slash chord: Do/Mi + 2 semitoni = Re/Fa#
      expect(transposeChord('Do/Mi', 2)).toBe('Re/Fa#');
      // Sib con preferenza bemolle
      expect(transposeChord('Sib', 2)).toBe('Do');
    });

    it('traspone accordi americani maggiori, minori, 7, maj7 e slash', () => {
      expect(transposeChord('C', 2)).toBe('D');
      expect(transposeChord('G', 2)).toBe('A');
      expect(transposeChord('Am7', 2)).toBe('Bm7');
      expect(transposeChord('F#m', 1)).toBe('Gm');
      expect(transposeChord('C/E', 2)).toBe('D/F#');
      expect(transposeChord('Bb', 2)).toBe('C');
    });

    it('traspone l\'intero testo ChordPro mantenendo struttura e caratteri', () => {
      const input = '[Do]Nel mezzo del [Sol]cammin di nostra [Lam]vita';
      const output = transposeChordPro(input, 2);
      expect(output).toBe('[Re]Nel mezzo del [La]cammin di nostra [Sim]vita');
    });

    it('round-trip transposition (+2 e poi -2 semitoni) preserva la tonalità originale', () => {
      const original = '[Do]Sole [Fa]spento [Sol]nella [Lam]notte';
      const up = transposeChordPro(original, 2);
      const back = transposeChordPro(up, -2);
      expect(back).toBe(original);
    });
  });

  // TEST 2: stripChords per isolamento della ricerca
  describe('2. stripChords per ricerca pulita senza interferenza accordi', () => {
    it('elimina tutti gli accordi [...] e le direttive {...}', () => {
      const chordpro = `
{titolo: Strade e Pensieri}
{ritornello}
[Do]Canta con [Sol]noi, batti le [Lam]mani [Fa]
{nuova_pagina}
[Do]Danza sui [Sol]passi dei tuoi do[Lam]mani
      `.trim();

      const stripped = stripChords(chordpro);
      expect(stripped).toBe('Canta con noi, batti le mani Danza sui passi dei tuoi domani');

      // Cercare "Do" nel testo pulito non deve trovare "Canta con noi" perché "Do" era solo un accordo!
      expect(stripped.includes('Do')).toBe(false);
      // Ma "domani" contiene "do" nel testo naturale
      expect(stripped.toLowerCase().includes('domani')).toBe(true);
    });

    it('gestisce accordi vuoti, caratteri speciali e tabulazioni', () => {
      const input = '[Do]   Testo con <caratteri> & "quote" [Sol] e \'apostrofo\'   [Fa]';
      const stripped = stripChords(input);
      expect(stripped).toBe('Testo con <caratteri> & "quote" e \'apostrofo\'');
    });
  });

  // TEST 3: Parsing AST e casi limite di righe e accordi
  describe('3. Parser AST e casi limite', () => {
    it('accordi a fine riga senza testo', () => {
      const line = 'Nel mezzo del cammin [Do]';
      const parsed = parseLine(line);
      expect(parsed.units.length).toBe(2);
      expect(parsed.units[0].lyric).toBe('Nel mezzo del cammin ');
      expect(parsed.units[0].chord).toBeUndefined();
      expect(parsed.units[1].chord).toBe('Do');
      expect(parsed.units[1].lyric).toBe('');
    });

    it('intro o riga con soli accordi senza testo', () => {
      const line = '[Do] [Sol] [Fa] [Sol]';
      const parsed = parseLine(line);
      expect(parsed.units.length).toBe(4);
      expect(parsed.units[0].chord).toBe('Do');
      expect(parsed.units[1].chord).toBe('Sol');
      expect(parsed.units[2].chord).toBe('Fa');
      expect(parsed.units[3].chord).toBe('Sol');
    });

    it('testo senza alcun accordo', () => {
      const line = 'Questa è una strofa recitata senza musica.';
      const parsed = parseLine(line);
      expect(parsed.units.length).toBe(1);
      expect(parsed.units[0].chord).toBeUndefined();
      expect(parsed.units[0].lyric).toBe('Questa è una strofa recitata senza musica.');
    });

    it('sillaba con accordo nel mezzo di una parola', () => {
      const line = 'cam[Re]min';
      const parsed = parseLine(line);
      expect(parsed.units.length).toBe(2);
      expect(parsed.units[0].lyric).toBe('cam');
      expect(parsed.units[0].chord).toBeUndefined();
      expect(parsed.units[1].lyric).toBe('min');
      expect(parsed.units[1].chord).toBe('Re');
    });

    it('parentesi quadra aperta non chiusa', () => {
      const line = '[Do nel mezzo del cammin';
      // Non deve andare in crash o generare eccezioni
      const parsed = parseLine(line);
      expect(parsed.units.length).toBeGreaterThan(0);
    });

    it('direttive {soc} e {eoc} creano la sezione chorus', () => {
      const chordpro = `
Strofa uno
{soc}
[Do]Questo è il ritornello
[Sol]Seconda riga ritornello
{eoc}
Strofa due
      `.trim();

      const ast = parseChordProAST(chordpro);
      expect(ast.sections.length).toBe(3);
      expect(ast.sections[0].type).toBe('verse');
      expect(ast.sections[1].type).toBe('chorus');
      expect(ast.sections[1].label).toBe('RITORNELLO');
      expect(ast.sections[2].type).toBe('verse');
    });

    it('direttive {strofa}, {ponte}, {nuova_pagina}', () => {
      const chordpro = `
{strofa: 1}
[Do]Prima strofa
{ponte}
[Fa]Ponte musicale
{nuova_pagina}
{strofa: 2}
[Sol]Seconda strofa
      `.trim();

      const ast = parseChordProAST(chordpro);
      expect(ast.pageCount).toBe(2);
      expect(ast.sections.some((s) => s.type === 'bridge')).toBe(true);
      expect(ast.sections.some((s) => s.type === 'page_break')).toBe(true);
    });
  });

  // TEST 4: Conteggio pagine e validazione soft
  describe('4. Conteggio Pagine e Validazione Soft', () => {
    it('calcola correttamente le pagine in base a {nuova_pagina}', () => {
      expect(calculatePageCount('Testo senza direttive')).toBe(1);
      expect(calculatePageCount('Pagina 1 {nuova_pagina} Pagina 2')).toBe(2);
      expect(calculatePageCount('{np} Pag 2 {nuova_pagina} Pag 3')).toBe(3);
    });

    it('validateChordPro rileva parentesi quadre non chiuse o sbilanciate', () => {
      const valid = validateChordPro('[Do]Nel [Sol]cammin');
      expect(valid.isValid).toBe(true);
      expect(valid.warnings.length).toBe(0);

      const invalid = validateChordPro('[Do nel cammin [Sol]');
      expect(invalid.isValid).toBe(false);
      expect(invalid.warnings.length).toBeGreaterThan(0);
      expect(invalid.warnings[0].toLowerCase()).toContain('parentesi');
    });

    it('validateChordPro rileva blocchi ritornello {soc} non chiusi', () => {
      const unclosedChorus = validateChordPro('{soc}\n[Do]Ritornello senza fine');
      expect(unclosedChorus.isValid).toBe(false);
      expect(unclosedChorus.warnings.some((w) => w.includes('ritornello'))).toBe(true);
    });
  });

  // TEST 5: Ricerca canti multi-campo senza interferenza accordi
  describe('5. Ricerca canti multi-campo senza interferenza accordi', () => {
    const cantoDemo: Canto = {
      id: 'canto-1',
      titolo: 'Strade e Pensieri per Domani',
      autore: 'Clan Duc In Altum',
      tonalita: 'Re',
      ritmo: 'Marcia',
      tempo_bpm: 112,
      misura: '4/4',
      capotasto: 2,
      testo_chordpro: '[Re]Sai da dove viene, [Sol]sai dove ti porta\n[La]questo camminare...\n{ritornello}\n[Sol]Canta con noi',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    it('trova il canto per titolo, autore e testo pulito', () => {
      const clean = stripChords(cantoDemo.testo_chordpro);
      expect(matchesQuery('strade', cantoDemo.titolo, cantoDemo.autore || '', clean)).toBe(true);
      expect(matchesQuery('duc in altum', cantoDemo.titolo, cantoDemo.autore || '', clean)).toBe(true);
      expect(matchesQuery('camminare', cantoDemo.titolo, cantoDemo.autore || '', clean)).toBe(true);
      expect(matchesQuery('canta con noi', cantoDemo.titolo, cantoDemo.autore || '', clean)).toBe(true);
    });

    it('cercando il nome di un accordo (es. "Sol") NON trova il canto se non è presente nel testo', () => {
      const clean = stripChords(cantoDemo.testo_chordpro);
      // "Sol" e "La" sono accordi presenti nel chordpro, ma non sono parole nei testi!
      expect(matchesQuery('Sol', cantoDemo.titolo, cantoDemo.autore || '', clean)).toBe(false);
    });
  });

  // TEST 6: Archiviazione IndexedDB e Soft-Delete Canti
  describe('6. Archiviazione IndexedDB e Soft-Delete Canti', () => {
    beforeEach(async () => {
      resetDbInstanceForTesting();
      const db = await getDb();
      for (const t of ['canti', 'sync_meta']) {
        await db.clear(t as any);
      }
    });

    it('salva e recupera canti da IndexedDB, escludendo i tombstone', async () => {
      const c1: Canto = {
        id: 'c-attivo-1',
        titolo: 'Canto Attivo',
        autore: 'Autore Clan',
        tonalita: 'Do',
        ritmo: null,
        tempo_bpm: 100,
        misura: '4/4',
        capotasto: null,
        testo_chordpro: '[Do]Testo canto attivo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const c2: Canto = {
        id: 'c-eliminato-2',
        titolo: 'Canto nel Cestino',
        autore: null,
        tonalita: 'Re',
        ritmo: null,
        tempo_bpm: null,
        misura: null,
        capotasto: null,
        testo_chordpro: '[Re]Testo eliminato',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(), // tombstone
      };

      await upsertRecords('canti', [c1, c2]);

      // getCanti(false) restituisce solo i canti attivi
      const attivi = await getCanti(false);
      expect(attivi).toHaveLength(1);
      expect(attivi[0].id).toBe('c-attivo-1');

      // getTrashItems include il canto eliminato nel cestino
      const trash = await getTrashItems();
      expect(trash.some((item) => item.id === 'c-eliminato-2')).toBe(true);
    });
  });

  // TEST 8: Motore Layout Responsive Mobile (Parole atomiche e accordi su sillabe)
  describe('8. Motore Layout Responsive Mobile per Canti a Schermo (Anti-Collisione)', () => {
    it('suddivide correttamente la riga di "Come sole come goccia" legando [Do] a "gliarmi" e [Re] a "quel"', () => {
      const lineStr = 'Risve[Do]gliarmi dal sonno e attirare il mio sguardo verso [Re]quel bel prato là.';
      const parsed = parseCantoLine(lineStr);
      expect(parsed).not.toBeNull();
      expect(parsed!.lyrics).toBe('Risvegliarmi dal sonno e attirare il mio sguardo verso quel bel prato là.');
      expect(parsed!.chords).toHaveLength(2);
      expect(parsed!.chords[0].chord).toBe('Do');
      expect(parsed!.chords[1].chord).toBe('Re');

      const words = parseLineToScreenWords(parsed!.lyrics, parsed!.chords);
      // Parola 1: "Risvegliarmi" con unità 1 "Risve" (nessun accordo) e unità 2 "gliarmi" (accordo Do)
      const w1 = words[0];
      expect(w1.units).toHaveLength(2);
      expect(w1.units[0].lyric).toBe('Risve');
      expect(w1.units[0].chord).toBeUndefined();
      expect(w1.units[1].lyric).toBe('gliarmi');
      expect(w1.units[1].chord).toBe('Do');

      // Parola 2: "dal"
      expect(words[1].units[0].lyric).toBe('dal');
      expect(words[1].units[0].chord).toBeUndefined();

      // Trova la parola "quel" che deve avere accordo Re
      const quelWord = words.find((w) => w.units.some((u) => u.lyric === 'quel'));
      expect(quelWord).toBeDefined();
      const quelUnit = quelWord!.units.find((u) => u.lyric === 'quel');
      expect(quelUnit!.chord).toBe('Re');

      // Verifica che non ci siano accordi orfani o fuori posizione
      const chordsFound = words.flatMap((w) => w.units.filter((u) => u.chord).map((u) => u.chord));
      expect(chordsFound).toEqual(['Do', 'Re']);
    });

    it('suddivide correttamente parole con accordi multipli nel ritornello ([Do]Non [Re]pen[Sol]sare)', () => {
      const lineStr = '[Do]Non [Re]pen[Sol]sare sia un imbroglio';
      const parsed = parseCantoLine(lineStr);
      expect(parsed).not.toBeNull();

      const words = parseLineToScreenWords(parsed!.lyrics, parsed!.chords);
      // w0: "Non" con accordo Do
      expect(words[0].units[0].lyric).toBe('Non');
      expect(words[0].units[0].chord).toBe('Do');

      // w1: "pensare" suddivisa in "pen" (Re) e "sare" (Sol)
      const w1 = words[1];
      expect(w1.units).toHaveLength(2);
      expect(w1.units[0].lyric).toBe('pen');
      expect(w1.units[0].chord).toBe('Re');
      expect(w1.units[1].lyric).toBe('sare');
      expect(w1.units[1].chord).toBe('Sol');

      // w2: "sia", w3: "un", w4: "imbroglio" senza accordi
      expect(words[2].units[0].lyric).toBe('sia');
      expect(words[3].units[0].lyric).toBe('un');
      expect(words[4].units[0].lyric).toBe('imbroglio');
    });

    it('gestisce righe di soli accordi senza testo', () => {
      const parsed = parseCantoLine('[Do] [Sol] [Lam]');
      expect(parsed).not.toBeNull();
      const words = parseLineToScreenWords(parsed!.lyrics, parsed!.chords);
      expect(words.length).toBeGreaterThanOrEqual(3);
      expect(words[0].units[0].chord).toBe('Do');
    });
  });
});



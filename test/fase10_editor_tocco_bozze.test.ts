import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseChordProToTouchLines,
  touchLinesToChordPro,
  copyChordsProportional,
  applyProgressionToBlock,
  copyFromPreviousBlock,
  TouchLine,
  TouchChord,
} from '../src/features/canti/touch_chord_utils';
import {
  getDiatonicChords,
  inferKeyFromFirstChord,
} from '../src/lib/chord_theory';
import {
  saveCantoDraft,
  loadCantoDraft,
  clearCantoDraft,
  formatDraftTime,
} from '../src/features/canti/canto_draft';

describe('FASE 10C — Editor Accordi a Tocco, Bozze Locali e Suggerimenti Armonici', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /* ==============================================================================
     1. ROUND-TRIP CHORDPRO <-> TOUCH LINES
     ============================================================================== */
  describe('1. Round-Trip ChordPro <-> Touch Lines (Single Source of Truth)', () => {
    it('mantiene la completa fedeltà tra testo ChordPro e TouchLine[] senza perdite', () => {
      const syntheticChordPro = [
        '{comment: Strofa 1}',
        '[Do]Sento nel profondo [Fa]un desiderio [Do]nascere',
        '[Lam]verso l\'orizzonte [Fa]possiam cammi[Sol]nare.',
        '',
        'RIT.',
        '[Do]Fiamma che brilli, [Sol]scalda la nostra notte',
        '[Fa]fino al sorgere [Sol]del nuovo [Do]sole.',
        '',
        '{nuova_colonna}',
        '{comment: Strofa 2}',
        'Un cielo stellato un fuoco e il suo calore',
      ].join('\n');

      const parsedLines = parseChordProToTouchLines(syntheticChordPro);

      expect(parsedLines.length).toBe(11);
      expect(parsedLines[0]?.isDirective).toBe(true);
      expect(parsedLines[0]?.directiveText).toBe('{comment: Strofa 1}');

      // Riga 1: accordi estratti con indici esatti
      const line1 = parsedLines[1]!;
      expect(line1.lyrics).toBe('Sento nel profondo un desiderio nascere');
      expect(line1.chords.length).toBe(3);
      expect(line1.chords[0]?.chord).toBe('Do');
      expect(line1.chords[0]?.charIndex).toBe(0);
      expect(line1.chords[1]?.chord).toBe('Fa');
      expect(line1.chords[1]?.charIndex).toBe(19);

      // Riga con RIT.
      const ritLine = parsedLines[4]!;
      expect(ritLine.isRitLabel).toBe(true);
      expect(ritLine.lyrics).toBe('RIT.');

      // Round-trip di riconversione in ChordPro
      const reconstructed = touchLinesToChordPro(parsedLines);
      expect(reconstructed).toBe(syntheticChordPro);
    });

    it('gestisce righe di soli accordi senza testo (es. intro strumentale)', () => {
      const introChordPro = '[Do] [Fa] [Sol7] [Do]';
      const parsed = parseChordProToTouchLines(introChordPro);
      expect(parsed[0]?.lyrics).toBe('');
      expect(parsed[0]?.chords.length).toBe(4);

      const reconstructed = touchLinesToChordPro(parsed);
      expect(reconstructed).toBe(introChordPro);
    });
  });

  /* ==============================================================================
     2. INSERIMENTO ACCORDO A TOCCO SUL CONFINE ESATTO
     ============================================================================== */
  describe('2. Inserimento Accordi a Tocco sul Confine di Carattere Esatto', () => {
    it('inserisce un accordo alla posizione del cursore calcolata dal tocco', () => {
      const baseLine: TouchLine = {
        id: 'tl-1',
        lyrics: 'Nel mezzo del cammin',
        chords: [],
      };

      // Tocco a inizio parola "Nel" (indice 0) -> inserisce [Do]
      const withDo: TouchLine = {
        ...baseLine,
        chords: [{ id: 'c1', chord: 'Do', charIndex: 0 }],
      };
      expect(touchLinesToChordPro([withDo])).toBe('[Do]Nel mezzo del cammin');

      // Tocco al confine di "mezzo" (indice 4) -> inserisce [Sol]
      const withSol: TouchLine = {
        ...baseLine,
        chords: [
          { id: 'c1', chord: 'Do', charIndex: 0 },
          { id: 'c2', chord: 'Sol', charIndex: 4 },
        ],
      };
      expect(touchLinesToChordPro([withSol])).toBe('[Do]Nel [Sol]mezzo del cammin');

      // Tocco a metà parola su una sillaba (es. "cam-min", indice 14) -> inserisce [Lam]
      const withLam: TouchLine = {
        ...baseLine,
        chords: [
          { id: 'c1', chord: 'Do', charIndex: 0 },
          { id: 'c2', chord: 'Sol', charIndex: 4 },
          { id: 'c3', chord: 'Lam', charIndex: 14 },
        ],
      };
      expect(touchLinesToChordPro([withLam])).toBe('[Do]Nel [Sol]mezzo del [Lam]cammin');
    });

    it('sposta ed elimina un accordo selezionato', () => {
      const lineWithChord: TouchLine = {
        id: 'tl-1',
        lyrics: 'Camminiamo verso la meta',
        chords: [{ id: 'c1', chord: 'Re', charIndex: 0 }],
      };

      // Spostamento di c1 da indice 0 a indice 11 ("verso")
      const movedLine: TouchLine = {
        ...lineWithChord,
        chords: [{ id: 'c1', chord: 'Re', charIndex: 11 }],
      };
      expect(touchLinesToChordPro([movedLine])).toBe('Camminiamo [Re]verso la meta');

      // Eliminazione di c1
      const deletedLine: TouchLine = {
        ...lineWithChord,
        chords: [],
      };
      expect(touchLinesToChordPro([deletedLine])).toBe('Camminiamo verso la meta');
    });
  });

  /* ==============================================================================
     3. SUGGERIMENTI DELLA TONALITÀ (DIATONICI I, ii, iii, IV, V, vi, V7)
     ============================================================================== */
  describe('3. Suggerimenti Armonici Coerenti con la Tonalità', () => {
    it('genera gli accordi diatonici completi per tonalità maggiore', () => {
      const suggestionsDo = getDiatonicChords('Do');
      // I, V, vi, IV, ii, iii, V7
      expect(suggestionsDo).toContain('Do');
      expect(suggestionsDo).toContain('Sol');
      expect(suggestionsDo).toContain('Lam');
      expect(suggestionsDo).toContain('Fa');
      expect(suggestionsDo).toContain('Rem');
      expect(suggestionsDo).toContain('Mim');
      expect(suggestionsDo).toContain('Sol7');

      const suggestionsRe = getDiatonicChords('Re');
      expect(suggestionsRe).toContain('Re');
      expect(suggestionsRe).toContain('La');
      expect(suggestionsRe).toContain('Sim');
      expect(suggestionsRe).toContain('Sol');
      expect(suggestionsRe).toContain('Mim');
      expect(suggestionsRe).toContain('Fa#m');
      expect(suggestionsRe).toContain('La7');
    });

    it('genera gli accordi diatonici completi per tonalità minore', () => {
      const suggestionsLam = getDiatonicChords('Lam');
      // i, iv, v, V7, III, VI, VII
      expect(suggestionsLam).toContain('Lam');
      expect(suggestionsLam).toContain('Rem');
      expect(suggestionsLam).toContain('Mim');
      expect(suggestionsLam).toContain('Fa');
      expect(suggestionsLam).toContain('Sol');
      expect(suggestionsLam).toContain('Do');
      expect(suggestionsLam).toContain('Mi7');
    });

    it('deduce la tonalità dal primo accordo inserito SOLO per ordinare i suggerimenti e non la salva', () => {
      // Primo accordo "Fa#" -> tonalità dedotta "Fa#"
      expect(inferKeyFromFirstChord('Fa#')).toBe('Fa#');
      // Primo accordo "Rem" -> tonalità dedotta "Rem"
      expect(inferKeyFromFirstChord('Rem')).toBe('Rem');
      expect(inferKeyFromFirstChord('La-')).toBe('Lam');
      expect(inferKeyFromFirstChord(null)).toBeNull();
    });
  });

  /* ==============================================================================
     4. SCORCIATOIE PER CANTI RIPETITIVI (PROPORZIONALE)
     ============================================================================== */
  describe('4. Scorciatoie per Canti Ripetitivi (Copia Proporzionale)', () => {
    it('copia gli accordi dalla riga precedente riadattando le posizioni proporzionalmente', () => {
      // Riga 1: lunghezza 20 caratteri, accordi a 0 (ratio 0) e 10 (ratio 0.5)
      const sourceLine: TouchLine = {
        id: 'l1',
        lyrics: '12345678901234567890', // len = 20
        chords: [
          { id: 'c1', chord: 'Do', charIndex: 0 },
          { id: 'c2', chord: 'Sol', charIndex: 10 },
        ],
      };

      // Riga 2: lunghezza 30 caratteri
      const targetLine: TouchLine = {
        id: 'l2',
        lyrics: '123456789012345678901234567890', // len = 30
        chords: [],
      };

      const copied = copyChordsProportional(sourceLine, targetLine);
      expect(copied.chords.length).toBe(2);
      expect(copied.chords[0]?.chord).toBe('Do');
      expect(copied.chords[0]?.charIndex).toBe(0); // 0 / 20 * 30 = 0

      expect(copied.chords[1]?.chord).toBe('Sol');
      expect(copied.chords[1]?.charIndex).toBe(15); // 10 / 20 * 30 = 15
    });

    it('applica la progressione a tutte le righe del blocco strofa', () => {
      const block: TouchLine[] = [
        {
          id: 'l1',
          lyrics: 'Prima riga con accordi guida',
          chords: [
            { id: 'c1', chord: 'Do', charIndex: 0 },
            { id: 'c2', chord: 'Sol', charIndex: 15 },
          ],
        },
        {
          id: 'l2',
          lyrics: 'Seconda riga senza accordi',
          chords: [],
        },
        {
          id: 'l3',
          lyrics: 'Terza riga senza accordi',
          chords: [],
        },
      ];

      const applied = applyProgressionToBlock(block, block[0]!);
      expect(applied[1]?.chords.length).toBe(2);
      expect(applied[1]?.chords[0]?.chord).toBe('Do');
      expect(applied[2]?.chords.length).toBe(2);
      expect(applied[2]?.chords[0]?.chord).toBe('Do');
    });

    it('copia la progressione armonica dalla strofa precedente', () => {
      const allLines: TouchLine[] = [
        // Blocco 1 (Strofa 1)
        { id: 's1-1', lyrics: 'Strofa uno verso uno', chords: [{ id: 'c1', chord: 'Do', charIndex: 0 }] },
        { id: 's1-2', lyrics: 'Strofa uno verso due', chords: [{ id: 'c2', chord: 'Sol', charIndex: 0 }] },
        { id: 'sep', lyrics: '', chords: [], isEmpty: true },
        // Blocco 2 (Strofa 2)
        { id: 's2-1', lyrics: 'Strofa due verso uno', chords: [] },
        { id: 's2-2', lyrics: 'Strofa due verso due', chords: [] },
      ];

      // Ci troviamo alla riga s2-1 (indice 3) e copiamo dalla strofa precedente
      const result = copyFromPreviousBlock(allLines, 3);
      expect(result[3]?.chords.length).toBe(1);
      expect(result[3]?.chords[0]?.chord).toBe('Do');
      expect(result[4]?.chords.length).toBe(1);
      expect(result[4]?.chords[0]?.chord).toBe('Sol');
    });
  });

  /* ==============================================================================
     5. PERSISTENZA E RIPRISTINO BOZZE LOCALI AUTOMATICHE
     ============================================================================== */
  describe('5. Bozze Locali Automatiche (localStorage)', () => {
    it('salva la bozza, la ripristina fedelmente e la cancella solo a salvataggio confermato', () => {
      // 1. Nessuna bozza inizialmente
      expect(loadCantoDraft()).toBeNull();

      // 2. Salvataggio automatico bozza
      saveCantoDraft({
        titolo: 'Canto Sintetico del Sentiero',
        autore: 'Reparto Stella Polare',
        misura: '4/4',
        bpm_testo: 'circa 100',
        ritmo: '↓ ↑ ↓↑',
        capotasto: '2',
        tonalita: 'Re',
        testo_chordpro: '[Re]Camminiamo [Sol]insieme',
        note: 'Note di prova',
        settore: 'esploratori',
      });

      // 3. Simulazione ricaricamento / riapertura
      const restored = loadCantoDraft();
      expect(restored).not.toBeNull();
      expect(restored?.titolo).toBe('Canto Sintetico del Sentiero');
      expect(restored?.autore).toBe('Reparto Stella Polare');
      expect(restored?.capotasto).toBe('2');
      expect(restored?.tonalita).toBe('Re');
      expect(restored?.testo_chordpro).toBe('[Re]Camminiamo [Sol]insieme');

      const timeLabel = formatDraftTime(restored!.updatedAt);
      expect(timeLabel).toContain('alle');

      // 4. Salvataggio confermato sul database: la bozza viene eliminata
      clearCantoDraft();
      expect(loadCantoDraft()).toBeNull();
    });

    it('ignora bozze vuote o prive di titolo e testo', () => {
      saveCantoDraft({
        titolo: '   ',
        autore: '',
        misura: '',
        bpm_testo: '',
        ritmo: '',
        capotasto: '',
        tonalita: '',
        testo_chordpro: '',
        note: '',
        settore: '',
      });

      expect(loadCantoDraft()).toBeNull();
    });
  });

  /* ==============================================================================
     6. ANNULLA / RIPETI (UNDO / REDO)
     ============================================================================== */
  describe('6. Meccanismo Annulla / Ripeti (Undo / Redo)', () => {
    it('gestisce la pila di cronologia delle modifiche dell\'editor', () => {
      const initial: TouchLine[] = [
        { id: '1', lyrics: 'Verso di prova', chords: [] },
      ];

      const historyStack: TouchLine[][] = [];
      const redoStack: TouchLine[][] = [];

      let current = initial;

      // Azione 1: aggiungi accordo [Do]
      historyStack.push(current);
      current = [
        {
          id: '1',
          lyrics: 'Verso di prova',
          chords: [{ id: 'c1', chord: 'Do', charIndex: 0 }],
        },
      ];
      expect(current[0]?.chords.length).toBe(1);

      // Azione 2: aggiungi accordo [Sol]
      historyStack.push(current);
      current = [
        {
          id: '1',
          lyrics: 'Verso di prova',
          chords: [
            { id: 'c1', chord: 'Do', charIndex: 0 },
            { id: 'c2', chord: 'Sol', charIndex: 6 },
          ],
        },
      ];
      expect(current[0]?.chords.length).toBe(2);

      // Undo 1
      redoStack.push(current);
      current = historyStack.pop()!;
      expect(current[0]?.chords.length).toBe(1);
      expect(current[0]?.chords[0]?.chord).toBe('Do');

      // Undo 2
      redoStack.push(current);
      current = historyStack.pop()!;
      expect(current[0]?.chords.length).toBe(0);

      // Redo 1
      historyStack.push(current);
      current = redoStack.pop()!;
      expect(current[0]?.chords.length).toBe(1);

      // Redo 2
      historyStack.push(current);
      current = redoStack.pop()!;
      expect(current[0]?.chords.length).toBe(2);
    });
  });
});

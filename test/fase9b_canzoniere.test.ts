import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseChordProAST, stripChords, calculatePageCount } from '../src/lib/chordpro';
import { parseCantoLine, CantoLineData } from '../src/features/canti/CantoLineRenderer';
import { layoutCanzoniereSong, calculateBlockHeightMm } from '../src/features/canti/canzoniere_layout';
import { CANZONIERE_CONFIG } from '../src/features/canti/canzoniere_config';
import { alignChordsOverLyrics, parsePastedText } from '../src/features/canti/canzoniere_parser';
import { saveCanto } from '../src/lib/admin_actions';
import { supabase } from '../src/lib/supabase';
import { Canto } from '../src/lib/db';

describe('FASE 9B — Test Suite Rigorosa Canzoniere (Accordi, Stampa, Lettura, Modulo)', () => {
  /* ==============================================================================
     1. INVISIBILITÀ DELLE DIRETTIVE CHORDPRO
     ============================================================================== */
  describe('1. Direttive invisibili nel testo e nel renderer', () => {
    it('elimina {nuova_colonna}, {nc}, {nuova_pagina}, {np} e qualsiasi {...} sconosciuta dal testo', () => {
      const chordproWithDirectives = `
{title: Canto Sintetico Alpha}
{artist: Autore Immaginario}
{tempo: 4/4}
{bpm: 100}
[Do]Prima riga di prova
{nuova_colonna}
[Sol]Seconda riga colonna destra
{nc}
{nuova_pagina}
{np}
{unknown_custom_tag}
[Re]Terza riga pagina due
`.trim();

      const ast = parseChordProAST(chordproWithDirectives);
      // Le direttive di pagina o colonna non devono mai produrre una riga di testo
      for (const section of ast.sections) {
        for (const line of section.lines) {
          for (const u of line.units) {
            expect(u.lyric).not.toContain('{nuova_colonna}');
            expect(u.lyric).not.toContain('{nc}');
            expect(u.lyric).not.toContain('{nuova_pagina}');
            expect(u.lyric).not.toContain('{np}');
            expect(u.lyric).not.toContain('{title:');
            expect(u.lyric).not.toContain('{artist:');
            expect(u.lyric).not.toContain('{unknown_custom_tag}');
          }
        }
      }

      // stripChords deve rimuovere tutte le graffe
      const stripped = stripChords(chordproWithDirectives);
      expect(stripped).not.toContain('{');
      expect(stripped).not.toContain('}');
      expect(stripped).toContain('Prima riga di prova');
      expect(stripped).toContain('Seconda riga colonna destra');
      expect(stripped).toContain('Terza riga pagina due');
    });

    it('parseCantoLine ritorna null per righe direttive isolate', () => {
      expect(parseCantoLine('{nuova_colonna}')).toBeNull();
      expect(parseCantoLine('{nc}')).toBeNull();
      expect(parseCantoLine('{nuova_pagina}')).toBeNull();
      expect(parseCantoLine('{custom_directive}')).toBeNull();
    });
  });

  /* ==============================================================================
     2. RENDERER ACCORDI UNIFICATO (ANCORE A LARGHEZZA ZERO)
     ============================================================================== */
  describe('2. Renderer accordi unificato a larghezza zero', () => {
    it('ancora gli accordi all indice esatto del carattere senza alterare il testo', () => {
      const parsed = parseCantoLine('[Do]Camminando [Sol]lungo il [Lam]sentiero');
      expect(parsed).not.toBeNull();
      expect(parsed!.lyrics).toBe('Camminando lungo il sentiero');
      expect(parsed!.hasChords).toBe(true);
      expect(parsed!.chords).toEqual([
        { chord: 'Do', charIndex: 0 },
        { chord: 'Sol', charIndex: 11 },
        { chord: 'Lam', charIndex: 20 },
      ]);
    });

    it('le righe senza accordi non riservano spazio sopra (hasChords = false)', () => {
      const parsed = parseCantoLine('Questa è una riga priva di accordi musicali');
      expect(parsed).not.toBeNull();
      expect(parsed!.hasChords).toBe(false);
      expect(parsed!.chords).toHaveLength(0);
      expect(parsed!.lyrics).toBe('Questa è una riga priva di accordi musicali');
    });

    it('riconosce le etichette RIT. e RIT: come etichette formattate', () => {
      const rit1 = parseCantoLine('RIT.');
      const rit2 = parseCantoLine('RIT:');
      const rit3 = parseCantoLine('rit.');

      expect(rit1?.isRitLabel).toBe(true);
      expect(rit2?.isRitLabel).toBe(true);
      expect(rit3?.isRitLabel).toBe(true);
    });

    it('gestisce righe di soli accordi (es. stacco strumentale)', () => {
      const parsed = parseCantoLine('[Do]  [Sol]  [Lam]');
      expect(parsed).not.toBeNull();
      expect(parsed!.isChordOnly).toBe(true);
      expect(parsed!.chords).toHaveLength(3);
    });
  });

  /* ==============================================================================
     3. GEOMETRIA IDENTICA AL RIFERIMENTO (PASSO 16.5 pt E FILL 88%)
     ============================================================================== */
  describe('3. Geometria di impaginazione A4 identica al riferimento', () => {
    it('il passo delle righe (line step) a 11 pt con lineHeight 1.5 è esattamente 16.5 pt', () => {
      const ptToMm = 0.352778;
      const step11Pt = 11 * CANZONIERE_CONFIG.typography.lineHeight;
      expect(step11Pt).toBe(16.5);

      // Una riga con accordi vale esattamente 2 passi (33 pt)
      // Una riga senza accordi vale esattamente 1 passo (16.5 pt)
      // Uno spazio tra blocchi vale esattamente 1 passo (16.5 pt)
      const linesWithChords = [
        { raw: '[Do]Testo', isRitLabel: false, isChordOnly: false, lyrics: 'Testo', chords: [{ chord: 'Do', charIndex: 0 }], hasChords: true },
        { raw: 'Testo solo', isRitLabel: false, isChordOnly: false, lyrics: 'Testo solo', chords: [], hasChords: false },
      ];

      const blockHeightMm = calculateBlockHeightMm(linesWithChords, 11, CANZONIERE_CONFIG);
      // 2 passi + 1 passo + 1 passo (gap) = 4 passi = 4 * 16.5 pt = 66 pt
      const expectedMm = 66 * ptToMm;
      expect(Math.abs(blockHeightMm - expectedMm)).toBeLessThan(0.01);
    });

    it('step-up scala fino a maxSizePt (13 pt) per canti a 1 pagina con altezza < 88%', () => {
      const syntheticShortSong: Canto = {
        id: 'canto_short_synth',
        titolo: 'CANTO BREVE SINTETICO',
        autore: 'Autore Fittizio',
        misura: '4/4',
        bpm_testo: '100',
        tempo_bpm: 100,
        ritmo: 'Giù (↓)',
        capotasto: null,
        tonalita: null,
        testo_chordpro: `
[Do]Prima strofa sintetica molto breve
[Sol]Seconda riga sintetica
[Lam]Terza riga sintetica

RIT.
[Fa]Ritornello breve sintetico
[Do]Seconda riga ritornello
`.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const result = layoutCanzoniereSong(syntheticShortSong, CANZONIERE_CONFIG);
      expect(result.pages).toHaveLength(1);
      // Il font deve essere scalato oltre gli 11 pt base fino a 12.5 o 13 pt per riempire il foglio
      expect(result.fontSizePt).toBeGreaterThan(11);
      expect(result.fontSizePt).toBeLessThanOrEqual(13);
    });

    it('impostando maxSizePt = baseSizePt (11 pt) lo scaling è disattivato', () => {
      const configNoScale = {
        ...CANZONIERE_CONFIG,
        typography: {
          ...CANZONIERE_CONFIG.typography,
          maxSizePt: 11, // disattiva step-up
        },
      };

      const syntheticShortSong: Canto = {
        id: 'canto_short_noscale',
        titolo: 'CANTO SINTETICO SENZA SCALING',
        autore: null,
        misura: null,
        bpm_testo: null,
        tempo_bpm: null,
        ritmo: null,
        capotasto: null,
        tonalita: null,
        testo_chordpro: `[Do]Testo sintetico riga uno\n[Sol]Testo sintetico riga due`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const result = layoutCanzoniereSong(syntheticShortSong, configNoScale);
      expect(result.pages).toHaveLength(1);
      expect(result.fontSizePt).toBe(11);
    });
  });

  /* ==============================================================================
     4. IMPORTAZIONE: ACCORDI SULLA SILLABA E TONALITÀ NON INVENTATA
     ============================================================================== */
  describe('4. Regole importatore: accordi su sillaba e tonalità non inventata', () => {
    it('accordi a metà parola non saltano a inizio parola', () => {
      const chordLine = '            SOL';
      const lyricsLine = 'verso camminare insieme';
      const merged = alignChordsOverLyrics(chordLine, lyricsLine, false);
      expect(merged).toContain('c[SOL]amminare');
      expect(merged).not.toContain('[SOL]camminare');
    });

    it('parsePastedText NON deduce la tonalità dal primo accordo se non dichiarata esplicitamente', () => {
      const pastedWithoutExplicitKey = `
TITOLO: Canto Senza Tonalita Dichiarata
AUTORE: Autore di Test
TEMPO: 4/4
BPM: circa 92-94
---
[Do]Nel mezzo del [Sol]cammin di nostra [Lam]vita
[Fa]mi ritrovai per una selva oscura
`.trim();

      const parsed = parsePastedText(pastedWithoutExplicitKey);
      expect(parsed.titolo).toBe('Canto Senza Tonalita Dichiarata');
      expect(parsed.bpm_testo).toBe('circa 92-94');
      // La tonalità DEVE essere null perché non c'era "TONALITÀ:" nell'intestazione
      expect(parsed.tonalita).toBeNull();
    });

    it('parsePastedText estrae la tonalità se dichiarata esplicitamente', () => {
      const pastedWithExplicitKey = `
TITOLO: Canto Con Tonalita Esplicita
TONALITÀ: Re minore
TEMPO: 3/4
BPM: 108
---
[Rem]Canto sintetico con accordi
`.trim();

      const parsed = parsePastedText(pastedWithExplicitKey);
      expect(parsed.tonalita).toBe('Re minore');
    });
  });

  /* ==============================================================================
     5. GESTIONE BPM E SALVATAGGIO DIRETTO
     ============================================================================== */
  describe('5. Gestione BPM esatta e rifiuto perdita dati', () => {
    it('saveCanto solleva errore bloccante se bpm_testo non esiste sul database (migrazione 0006 mancante)', async () => {
      // Mock navigator.onLine = true
      vi.stubGlobal('navigator', { onLine: true });

      // Simula fallimento Supabase con PGRST204 (colonna non esistente)
      const spy = vi.spyOn(supabase, 'from').mockReturnValue({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { message: "Could not find the 'bpm_testo' column of 'canti' in the schema cache", code: 'PGRST204' },
            }),
          }),
        }),
      } as any);

      try {
        await saveCanto({
          titolo: 'Canto Test Fallback',
          bpm_testo: 'circa 92-94',
          testo_chordpro: '[Do]Test',
        });
        // Se non lancia eccezione, fallisce
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.message).toContain('Migrazione 0006 non applicata: salvataggio annullato');
      } finally {
        spy.mockRestore();
        vi.unstubAllGlobals();
      }
    });
  });
});

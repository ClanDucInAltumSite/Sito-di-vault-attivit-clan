import { describe, it, expect } from 'vitest';
import {
  ALBACHIARA_PARSED,
  COME_TI_AMA_DIO_PARSED,
  DANZA_LA_VITA_PARSED,
  COME_SOLE_COME_GOCCIA_PARSED,
  AGLIO_E_OLIO_PARSED,
  E_LA_STRADA_SI_APRE_PARSED,
  WONDERWALL_PARSED,
  STRADE_DI_CORAGGIO_PARSED,
  I_CENTO_PASSI_PARSED,
  SE_PIOVESSE_IL_TUO_NOME_PARSED,
  SCOUTING_FOR_BOYS_PARSED,
  TRA_BOSCHI_E_PRATI_PARSED,
  DEFAULT_PARSED_SONGS,
} from '../src/data/parsed_songs';
import { layoutCanzoniereSong } from '../src/features/canti/canzoniere_layout';
import { joinContinuationLines } from '../src/features/canti/canzoniere_cleaner';
import { applyRitRepeatPolicy } from '../src/lib/stampa_canzoni';

describe('FASE 11A - Canzoniere Adaptive Fill, Continuation Lines & Ritornelli', () => {
  describe('B) joinContinuationLines (Unione righe spezzate da importazione PDF)', () => {
    it('1. Unisce righe che iniziano con lettera minuscola', () => {
      const broken = `[Do]felice per[Lam]ché esisti e co[Fa]sì io posso [Sol]darti il meglio di\nme.`;
      const cleaned = joinContinuationLines(broken);
      expect(cleaned).toContain(`il meglio di me.`);
      expect(cleaned.split('\n').length).toBe(1);
    });

    it('2. Unisce parentesi aperte su più righe e continuazioni con accordi', () => {
      const broken = `[Do]Canta come [Fa]cantano i viand[Do]anti,\n[Fa](canta come cantano i viandanti)`;
      const cleaned = joinContinuationLines(broken);
      expect(cleaned).toContain(`[Fa](canta come cantano i viandanti)`);
    });

    it('3. Non unisce versi distinti che iniziano con lettera maiuscola', () => {
      const text = `[Do]Io vorrei sa[Lam]perti amare [Fa]come [Sol]Dio\n[Do]che ti prende per [Lam]mano ma ti [Fa]lascia anche an[Sol]dare.`;
      const cleaned = joinContinuationLines(text);
      expect(cleaned.split('\n').length).toBe(2);
    });
  });

  describe('D) applyRitRepeatPolicy (Etichette RIT. singole e ritornelli ripetuti)', () => {
    it('1. In modalità canta elimina duplicati producendo una singola etichetta pulita', () => {
      const songText = `{soc}\nRIT:\n[Do]Danza la vita al ritmo dello spirito\n{eoc}\n\n{soc}\nRIT:\n[Do]Danza la vita al ritmo dello spirito\n{eoc}`;
      const transformed = applyRitRepeatPolicy(songText, 'canta');

      // Prima occorrenza: testo per intero; seconda occorrenza: solo etichetta RIT.
      expect(transformed).not.toContain('RIT. RIT:');
      expect(transformed).not.toContain('RIT: RIT.');

      const lines = transformed.split('\n').map((l) => l.trim()).filter(Boolean);
      expect(lines).toContain('RIT.');
    });

    it('2. In modalità canta il ritornello ripetuto di Albachiara diventa RIT. dalla 2a volta, mentre in suona resta per intero con accordi', () => {
      const transformedCanta = applyRitRepeatPolicy(ALBACHIARA_PARSED, 'canta');
      const linesCanta = transformedCanta.testo_chordpro.split('\n');

      // In canta: "Ti vesti svogliatamente..." compare per intero solo 1 volta; la 2a volta diventa RIT.
      const tiVestiCountCanta = linesCanta.filter((l) => l.includes('Ti vesti')).length;
      expect(tiVestiCountCanta).toBe(1);
      expect(transformedCanta.testo_chordpro).toContain('RIT.');

      // In suona: TUTTI i ritornelli sono conservati per intero con gli accordi per non voltare pagina indietro
      const transformedSuona = applyRitRepeatPolicy(ALBACHIARA_PARSED, 'suona');
      const linesSuona = transformedSuona.testo_chordpro.split('\n');
      const tiVestiCountSuona = linesSuona.filter((l) => l.includes('Ti vesti')).length;
      expect(tiVestiCountSuona).toBe(2);
      expect(transformedSuona.testo_chordpro).not.toMatch(/^RIT[.:]?$/m);
    });

    it('3. Variante "Chi canta": rimuove tutti gli accordi, intro, outro e sequenze strumentali', () => {
      const transformed = applyRitRepeatPolicy(DANZA_LA_VITA_PARSED, 'canta');

      expect(transformed.testo_chordpro).not.toContain('[Do]');
      expect(transformed.testo_chordpro).not.toContain('[Fa]');
      expect(transformed.testo_chordpro).not.toContain('intro:');
      expect(transformed.testo_chordpro).not.toContain('strum:');
      expect(transformed.testo_chordpro).not.toContain('outro:');
    });
  });

  describe('C) Correzione dati Danza la Vita', () => {
    it('1. Il ritornello ha le righe nell\'ordine corretto e senza duplicazioni corrotte', () => {
      const text = DANZA_LA_VITA_PARSED.testo_chordpro;
      expect(text).toContain('Danza la [Fa]vita al [Sol]ritmo dello [Do]spirito');
      expect(text).toContain('Spirito [Fa]che [Sol]riempi i nostri [Do]cuor');
      expect(text).toContain('danza [Fa]assieme a [Sol]no----[Do]oi!');

      // Assicura che non ci sia lo spezzone corrotto "cuor. Danza assieme a noi"
      expect(text).not.toContain('cuor. Danza assieme a');
    });
  });

  describe('A) Armonia Tipografica e Layout (Font stabile 10.5 - 12.5 pt e 1 pagina garantita)', () => {
    it('1. "Albachiara" - Variante Chi suona (con accordi)', () => {
      const applied = applyRitRepeatPolicy(ALBACHIARA_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.columnsCount).toBe(2);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.5);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('2. "Albachiara" - Variante Chi canta (solo testo)', () => {
      const applied = applyRitRepeatPolicy(ALBACHIARA_PARSED, 'canta');
      const result = layoutCanzoniereSong(applied, { mode: 'canta', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.5);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('3. "Come ti ama Dio" - Variante Chi suona', () => {
      const applied = applyRitRepeatPolicy(COME_TI_AMA_DIO_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.columnsCount).toBe(1);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(11);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('4. "Come ti ama Dio" - Variante Chi canta', () => {
      const applied = applyRitRepeatPolicy(COME_TI_AMA_DIO_PARSED, 'canta');
      const result = layoutCanzoniereSong(applied, { mode: 'canta', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.columnsCount).toBe(1);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(11.5);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('5. "Danza la vita" - Variante Chi suona', () => {
      const applied = applyRitRepeatPolicy(DANZA_LA_VITA_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.columnsCount).toBe(2);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.5);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('6. "Danza la vita" - Variante Chi canta', () => {
      const applied = applyRitRepeatPolicy(DANZA_LA_VITA_PARSED, 'canta');
      const result = layoutCanzoniereSong(applied, { mode: 'canta', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(11);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('7. "Come sole come goccia" - Variante Chi suona', () => {
      const applied = applyRitRepeatPolicy(COME_SOLE_COME_GOCCIA_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.columnsCount).toBe(2);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.5);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('8. "Aglio e Olio" - Priorità 1 pagina garantita in modalità canta e impaginazione ordinata senza overflow in suona', () => {
      const appliedCanta = applyRitRepeatPolicy(AGLIO_E_OLIO_PARSED, 'canta');
      const resultCanta = layoutCanzoniereSong(appliedCanta, { mode: 'canta', layoutMode: 'riempi_pagina' });

      expect(resultCanta.declaredPageCount).toBe(1);
      expect(resultCanta.hasOverflow).toBe(false);
      expect(resultCanta.pages.length).toBe(1);

      const appliedSuona = applyRitRepeatPolicy(AGLIO_E_OLIO_PARSED, 'suona');
      const resultSuona = layoutCanzoniereSong(appliedSuona, { mode: 'suona', layoutMode: 'riempi_pagina' });
      // In modalità suona tutti i 3 ritornelli estesi con accordi vengono stampati completi senza overflow
      expect(resultSuona.hasOverflow).toBe(false);
      expect(resultSuona.pages.length).toBeLessThanOrEqual(2);
    });

    it('9. "E la strada si apre" - Priorità 1 pagina garantita con fill elevato (>= 70%)', () => {
      const applied = applyRitRepeatPolicy(E_LA_STRADA_SI_APRE_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fillRatio).toBeGreaterThanOrEqual(0.70);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.0);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('10. "Wonderwall" - Priorità 1 pagina garantita con fill elevato (>= 70%)', () => {
      const applied = applyRitRepeatPolicy(WONDERWALL_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fillRatio).toBeGreaterThanOrEqual(0.70);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.0);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('11. "Strade di coraggio" - Priorità 1 pagina garantita con fill elevato (>= 70%)', () => {
      const applied = applyRitRepeatPolicy(STRADE_DI_CORAGGIO_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fillRatio).toBeGreaterThanOrEqual(0.70);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.0);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('12. "I cento passi" - Priorità 1 pagina garantita con fill elevato (>= 70%)', () => {
      const applied = applyRitRepeatPolicy(I_CENTO_PASSI_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fillRatio).toBeGreaterThanOrEqual(0.70);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.0);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('13. "Se piovesse il tuo nome" - Priorità 1 pagina garantita con fill elevato (>= 70%)', () => {
      const applied = applyRitRepeatPolicy(SE_PIOVESSE_IL_TUO_NOME_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fillRatio).toBeGreaterThanOrEqual(0.70);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(10.0);
      expect(result.fontSizePt).toBeLessThanOrEqual(12.5);
    });

    it('14. "Scouting For Boys" - Bilanciamento equilibrato multi-pagina (nessuna pagina semivuota al 25%)', () => {
      const applied = applyRitRepeatPolicy(SCOUTING_FOR_BOYS_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(2);
      expect(result.hasOverflow).toBe(false);
      expect(result.pages.length).toBe(2);
      // Entrambe le pagine devono avere entrambe le colonne popolate e fill >= 65%
      for (const page of result.pages) {
        expect(page.fillRatio).toBeGreaterThanOrEqual(0.65);
        expect(page.leftColumn.totalHeightMm).toBeGreaterThan(50);
        expect(page.rightColumn.totalHeightMm).toBeGreaterThan(50);
      }
    });

    it('15. "Tra boschi e prati" - Impaginazione pulita a 1 colonna a tutta larghezza', () => {
      const applied = applyRitRepeatPolicy(TRA_BOSCHI_E_PRATI_PARSED, 'suona');
      const result = layoutCanzoniereSong(applied, { mode: 'suona', layoutMode: 'riempi_pagina' });

      expect(result.declaredPageCount).toBe(1);
      expect(result.columnsCount).toBe(1);
      expect(result.hasOverflow).toBe(false);
      expect(result.fillRatio).toBeGreaterThanOrEqual(0.70);
      expect(result.fontSizePt).toBeGreaterThanOrEqual(11.0);
    });

    it('16. Controllo globale: nessun canto genera pagine di continuazione semivuote (< 40%)', () => {
      for (const song of DEFAULT_PARSED_SONGS) {
        for (const mode of ['suona', 'canta'] as const) {
          const applied = applyRitRepeatPolicy(song, mode);
          const result = layoutCanzoniereSong(applied, { mode, layoutMode: 'riempi_pagina' });
          expect(result.hasOverflow).toBe(false);
          if (result.pages.length > 1) {
            for (let i = 1; i < result.pages.length; i++) {
              const continuationPage = result.pages[i]!;
              // Nessuna pagina di continuazione deve essere sotto il 40% (elimina il 25-35% spillover)
              expect(continuationPage.fillRatio).toBeGreaterThanOrEqual(0.40);
            }
          }
        }
      }
    });
  });
});

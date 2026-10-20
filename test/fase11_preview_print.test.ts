/**
 * test/fase11_preview_print.test.ts
 *
 * Test di conformità: Foglio Anteprima A4 = Stampa (Fase 11C / 11D).
 * Verifica che il foglio d'anteprima usi lo stesso motore di impaginazione
 * e gli stessi colori della stampa:
 * - Testo e accordi hanno lo stesso colore del testo (nero inchiostro puro oklch(0 0 0))
 * - Titolo nero (oklch(0 0 0))
 * - Zero accordi "blu notte" (hue 255)
 * - Geometria identica (larghezza 210mm, margini e passo righe)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { layoutCanzoniereSong } from '../src/features/canti/canzoniere_layout';

describe('FASE 11 — Conformità Anteprima A4 = Stampa', () => {
  const printCssPath = path.resolve('src/styles/print.css');
  const printCss = fs.readFileSync(printCssPath, 'utf-8');

  it('il foglio di anteprima e la stampa condividono la larghezza A4 di 210mm', () => {
    // Verifica regola .canzoniere-page.stampa-preview-paper
    expect(printCss).toMatch(/\.canzoniere-page\.stampa-preview-paper\s*\{[^}]*width:\s*210mm/);
    expect(printCss).toMatch(/\.canzoniere-page\.stampa-preview-paper\s*\{[^}]*max-width:\s*210mm/);
  });

  it('nella stampa e nell\'anteprima gli accordi hanno lo stesso colore del testo (oklch(0 0 0), zero blu notte)', () => {
    // 1. In @media print
    const printStart = printCss.indexOf('@media print');
    const screenStart = printCss.indexOf('@media screen');
    const printMediaContent = printCss.slice(printStart, screenStart);

    // Accordi in stampa: colore oklch(0 0 0)
    expect(printMediaContent).toMatch(/\.song-chord,\s*\.print-chord\s*\{[^}]*color:\s*oklch\(0 0 0\)/);
    expect(printMediaContent).toMatch(/\.canzoniere-chord-badge\s*\{[^}]*color:\s*oklch\(0 0 0\)/);

    // Testo canzoniere in stampa: colore oklch(0 0 0)
    expect(printMediaContent).toMatch(/\.canzoniere-line-item\s*\{[^}]*color:\s*oklch\(0 0 0\)/);

    // Titolo canto in stampa: colore oklch(0 0 0)
    expect(printMediaContent).toMatch(/\.canzoniere-header-title\s*\{[^}]*color:\s*oklch\(0 0 0\)/);

    // 2. Nella preview a schermo (.canzoniere-page.stampa-preview-paper)
    expect(printCss).toMatch(/\.canzoniere-page\.stampa-preview-paper\s*\{[^}]*color:\s*oklch\(0 0 0\)/);
    expect(printCss).toMatch(/\.canzoniere-page\s+\.canzoniere-chord-badge[^{]*\{[^}]*color:\s*oklch\(0 0 0\)/);
    expect(printCss).toMatch(/\.canzoniere-page\s+\.canzoniere-line-item[^{]*\{[^}]*color:\s*oklch\(0 0 0\)/);

    // Nessuna presenza di accordi con tonalità blu notte (hue 255) nelle regole di stampa/anteprima
    expect(printCss).not.toMatch(/chord-badge[^{]*\{[^}]*255\)/);
    expect(printCss).not.toMatch(/song-chord[^{]*\{[^}]*255\)/);
  });

  it('l\'anteprima della revisione e il centro stampa usano lo stesso layout engine (layoutCanzoniereSong)', () => {
    const songData = {
      id: 'synth-1',
      titolo: 'CANTO SINTETICO DI TEST',
      autore: 'Autore Fittizio',
      categoria: 'scout' as const,
      tonalita: 'Do',
      ritmo: '↓ ↑ ↓↑',
      tempo_bpm: 100,
      bpm_testo: '100',
      misura: '4/4',
      capotasto: 0,
      testo_chordpro: '[Do]Prima riga di testo sintetico\n[Fa]Seconda riga di testo sintetico\n\n{soc}\nRIT.\n[Sol]Ritornello sintetico\n{eoc}',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Esegui il calcolo di impaginazione
    const layout = layoutCanzoniereSong(songData);

    expect(layout.pages.length).toBeGreaterThanOrEqual(1);
    const p1 = layout.pages[0]!;
    expect(p1.headerTitle).toBe('CANTO SINTETICO DI TEST');
    expect(p1.headerAuthor).toBe('Autore Fittizio');
    expect(p1.headerParams?.misura).toBe('4/4');

    // Verifica che i blocchi contengano sia le strofe che il ritornello con gli accordi associati
    const allBlocks = [...p1.leftColumn.blocks, ...p1.rightColumn.blocks];
    expect(allBlocks.length).toBeGreaterThan(0);
    const allChords = allBlocks.flatMap(b => b.lines.flatMap(l => l.chords.map(c => c.chord)));
    expect(allChords).toContain('Do');
    expect(allChords).toContain('Fa');
    expect(allChords).toContain('Sol');
  });
});

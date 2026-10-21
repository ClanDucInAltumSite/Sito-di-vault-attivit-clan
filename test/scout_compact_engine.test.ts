import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parsePdfCanto } from '../src/features/canti/pdf_importer';

describe('Scout Compacting Engine Official Tests', () => {
  it('E LA STRADA SI APRE: compacts from 5 pages to clean single scout page', async () => {
    const pdfPath = path.resolve('Riferimenti_PDF&Immagini/E LA STRADA SI APRE Accordi 100% Corretti -Canti Scout.pdf');
    if (!fs.existsSync(pdfPath)) return;

    const buf = fs.readFileSync(pdfPath);
    const res = await parsePdfCanto(buf, { compactScout: true });

    expect(res.titolo).toBe('E LA STRADA SI APRE');
    expect(res.autore).toBe('Canti Scout');

    // Strofa 1 must contain chords
    expect(res.testo_chordpro).toContain('[Fa#m]Raggio che [Mi]buca le [La]nubi');

    // Strofa 2 must NOT contain chords (standard scout compacting)
    expect(res.testo_chordpro).toContain('Attimo che segue attimo\nun salto nel tempo,');
    expect(res.testo_chordpro).not.toContain('[Fa#m]Attimo');

    // First chorus labeled RIT:
    expect(res.testo_chordpro).toContain('RIT:\nChe la strada [La]si apre,');

    // Subsequent chorus collapsed to RIT.
    expect(res.testo_chordpro).toContain('\nRIT.\n');

    // No web disclaimers
    expect(res.testo_chordpro).not.toContain('GENERATO SU ACCORDI E SPARTITI');
    expect(res.testo_chordpro).not.toContain('USO DIDATTICO');
    expect(res.testo_chordpro).not.toContain('INTERPRETAZIONI PERSONALI');
  });

  it('ALBACHIARA: removes noise, keeps chords on verse 1, collapses repeated verse to RIT.', async () => {
    const pdfPath = path.resolve('Riferimenti_PDF&Immagini/ALBACHIARA Accordi 100% Corretti -Vasco Rossi.pdf');
    if (!fs.existsSync(pdfPath)) return;

    const buf = fs.readFileSync(pdfPath);
    const res = await parsePdfCanto(buf, { compactScout: true });

    expect(res.titolo).toBe('ALBACHIARA');
    expect(res.autore).toBe('Vasco Rossi');
    expect(res.testo_chordpro).toContain('[Fa] [Do] [Sol]');
    expect(res.testo_chordpro).toContain('[Do]Respiri piano per non [Sol]far rumore');
    expect(res.testo_chordpro).toContain('\nRIT.\n');
    expect(res.testo_chordpro).not.toContain('WARNER CHAPPELL');
    expect(res.testo_chordpro).not.toContain('ACCORDIESPARTITI');
  });

  it('CENTOPASSI: extracts title and author from hyphenated header, removes noise and compacts', async () => {
    const pdfPath = path.resolve('Riferimenti_PDF&Immagini/modena centopassi.pdf');
    if (!fs.existsSync(pdfPath)) return;

    const buf = fs.readFileSync(pdfPath);
    const res = await parsePdfCanto(buf, { compactScout: true });

    expect(res.titolo).toBe('Centopassi');
    expect(res.autore).toBe('Modena City Ramblers');
    expect(res.testo_chordpro).toContain('[Mim]');
    expect(res.testo_chordpro).not.toContain('TestoeAccordi');
  });
});

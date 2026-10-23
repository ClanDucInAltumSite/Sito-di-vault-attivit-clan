import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parsePdfCanto, compactChordProText } from '../src/features/canti/pdf_importer';

describe('Scout Compacting Engine Official Tests', () => {
  it('E LA STRADA SI APRE: compacts from 5 pages to clean single scout page', async () => {
    const pdfPath = path.resolve('Riferimenti_PDF&Immagini/E LA STRADA SI APRE Accordi 100% Corretti -Canti Scout.pdf');
    if (!fs.existsSync(pdfPath)) return;

    const buf = fs.readFileSync(pdfPath);
    const res = await parsePdfCanto(buf, { compactScout: true });

    expect(res.titolo).toBe('E LA STRADA SI APRE');
    expect(res.autore).toBe('Canti Scout');

    // Strofa 1 must contain chords
    expect(res.testo_chordpro).toContain('[FA#m]Raggio che [MI]buca le [LA]nubi');

    // Strofa 2 must NOT contain chords (standard scout compacting)
    expect(res.testo_chordpro).toContain('Attimo che segue attimo\nun salto nel tempo,');
    expect(res.testo_chordpro).not.toContain('[FA#m]Attimo');

    // First chorus labeled RIT:
    expect(res.testo_chordpro).toContain('RIT:\nChe la strada [LA]si apre,');

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
    expect(res.testo_chordpro).toContain('{comment: intro: FA DO SOL}');
    expect(res.testo_chordpro).toContain('[DO]Respiri piano per non [SOL]far rumore');
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
    expect(res.testo_chordpro).toContain('[MIm]');
    expect(res.testo_chordpro).not.toContain('TestoeAccordi');
  });

  it('RE DEI RE: test subsequence chorus detection', async () => {
    const pdfPath = path.resolve('Riferimenti_PDF&Immagini/RE DEI RE Accordi -Rns.pdf');
    if (!fs.existsSync(pdfPath)) return;

    const buf = fs.readFileSync(pdfPath);
    const res = await parsePdfCanto(buf, { compactScout: true });

    // Verify Title & Author
    expect(res.titolo).toBe('RE DEI RE');
    expect(res.autore).toBe('RNS');
    expect(res.categoria).toBe('chiesa');

    // Verify Strofa 1 has chords
    expect(res.testo_chordpro).toContain('[MIm]Hai solle[DO]vato i nostri [SOL]volti dalla [RE]polvere');

    // Verify Chorus 1 has RIT: and chords
    expect(res.testo_chordpro).toContain('RIT:\n[MIm]Figlio dell’altissimo,');

    // Verify Strofa 2 keeps chords because the chord progression changed (modulated to F minor)
    expect(res.testo_chordpro).toContain('[FAm]Ci hai risc');
    expect(res.testo_chordpro).toContain('[REb]');

    // Verify Chorus 2 and 3 are collapsed to RIT.
    expect(res.testo_chordpro).toContain('\nRIT.\n');
  });

  it('UN FALCO NEL CIELO: intro deduplication, chorus extraction and scout compaction', async () => {
    const falcoPath = path.resolve('Riferimenti_PDF&Immagini/UN FALCO NEL CIELO Accordi 100% Corretti -Canti Scout.pdf');
    if (!fs.existsSync(falcoPath)) return;

    const res = await parsePdfCanto(fs.readFileSync(falcoPath), { compactScout: true });

    // Intro comment deduplicated to single comment
    expect(res.testo_chordpro).toContain('{comment: intro: RE SOL RE SOL LA RE}');
    expect(res.testo_chordpro).not.toContain('{comment: intro: RE SOL RE SOL LA RE}\n{comment: intro: RE SOL RE SOL LA RE}');

    // Verse 1 has story and chords
    expect(res.testo_chordpro).toContain('Un [RE]falco volava nel [SOL]cielo un mattino,');

    // Chorus recognized and marked RIT:
    expect(res.testo_chordpro).toContain('RIT:\nE allora [SOL]eha, eha, eha!\nE allora [RE]eha, eha, eha!\nEha, eha, eha, eha, eha, eha, eh!');

    // Verse 2 and 3 collapsed chorus to RIT.
    expect(res.testo_chordpro).toContain('\nRIT.\n');
  });

  it('RIPTIDE: unified multipart chorus, intro deduplication and preserved outro', async () => {
    const riptidePath = path.resolve('Riferimenti_PDF&Immagini/RIPTIDE Accordi 100% Corretti -Vance Joy.pdf');
    if (!fs.existsSync(riptidePath)) return;

    const res = await parsePdfCanto(fs.readFileSync(riptidePath), { compactScout: true });

    // Intro comment
    expect(res.testo_chordpro).toContain('{comment: intro: SIbm LAb REb SIbm LAb REb}');

    // Verse 1
    expect(res.testo_chordpro).toContain('[SIbm]I was scared of [LAb]dentists and the [REb]dark');

    // Complete Chorus with both parts unified with chords
    expect(res.testo_chordpro).toContain('RIT:\n[SIbm]Lady, [LAb]running down to the [REb]riptide');
    expect(res.testo_chordpro).toContain('And I got a lump in my [SIbm]throat\n\'Cause [LAb]you\'re gonna sing the [REb]words wrong');

    // Subsequent choruses collapsed to RIT.
    expect(res.testo_chordpro).toContain('\nRIT.\n');

    // Bridge with chords
    expect(res.testo_chordpro).toContain('[SIbm]I just wanna, I just wanna [LAb]know');

    // Outro not truncated
    expect(res.testo_chordpro).not.toContain('CREDITS');
    expect(res.testo_chordpro).not.toContain('AUTORE: KEOGH');
  });

  it('WONDERWALL: preserves intro, verse 1 chords, compacts subsequent verse, and preserves full finale sequence without truncation', async () => {
    const p = path.resolve('Riferimenti_PDF&Immagini/WONDERWALL Accordi 100% Corretti -Oasis.pdf');
    if (!fs.existsSync(p)) return;
    const res = await parsePdfCanto(fs.readFileSync(p), { compactScout: true });

    // Intro comment
    expect(res.testo_chordpro).toContain('{comment: intro: MIm SOL RE LA}');

    // Strofa 1 with chords
    expect(res.testo_chordpro).toContain('[MIm]Today is [SOL]gonna be the day');

    // First Chorus labeled RIT:
    expect(res.testo_chordpro).toContain('RIT:\nBecause [DO]maybe.[MIm].... [SOL]');

    // Strofa 2 (Back beat...) compacted without chords
    expect(res.testo_chordpro).toContain('Back beat, the word is on the street\nThat the fire in your heart is out,');
    expect(res.testo_chordpro).not.toContain('[MIm]Back beat');

    // Strofa 3 compacted without chords
    expect(res.testo_chordpro).toContain('Today is gonna be the day\nThat they\'re gonna throw it back to you,');

    // Finale: Full chorus retained before variation, not truncated to RIT.
    expect(res.testo_chordpro).toContain('Because [DO]maybe.[MIm].... [SOL]\nYou\'re [MIm]gonna be the one that [DO]saves me.[MIm].... [SOL]\nAnd [MIm]after [DO]all....[MIm]. [SOL]\nYou\'re my [MIm]wond[DO]erwall. [MIm] [SOL] [MIm]');

    // Coda variations retained with chords
    expect(res.testo_chordpro).toContain('I said [DO]maybe.[MIm].... [SOL]');
    expect(res.testo_chordpro).toContain('I said [DO]maybe, [MIm] [SOL]');

    // Outro strum comment
    expect(res.testo_chordpro).toContain('{comment: strum: MIm DO MIm SOL MIm DO MIm SOL}');

    // No orphan RIT. preceding I said maybe
    expect(res.testo_chordpro).not.toMatch(/RIT\.\s*\n+\s*I said/);
  });

  it('Check first lines of all 12 reference PDFs', async () => {
    const dir = path.resolve('Riferimenti_PDF&Immagini');
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.pdf'));
    for (const f of files) {
      const res = await parsePdfCanto(fs.readFileSync(path.join(dir, f)), { compactScout: true });
      const firstLines = res.testo_chordpro.split('\n').filter(Boolean).slice(0, 4);
      console.log(`FILE: ${f}`);
      console.log(`  TITLE: ${res.titolo}`);
      console.log(`  FIRST LINES:`, firstLines);
    }
  });

  it('Universal Level 1 Invariants: handles canonical headers, bridges, and intro/outro without data loss', () => {
    const inputSong = `[Intro]
[DO] [SOL] [LAm] [FA]

[Verse 1]
[DO]Nel mezzo del cammin [SOL]di nostra vita
[LAm]mi ritrovai per una [FA]selva oscura

[Chorus]
[DO]E quindi uscimmo [SOL]a riveder [FA]le stelle
[SOL]brillanti nella [DO]notte

Strofa 2:
Ahi quanto a dir qual era è cosa dura
esta selva selvaggia e aspra e forte

[Chorus]
[DO]E quindi uscimmo [SOL]a riveder [FA]le stelle
[SOL]brillanti nella [DO]notte

[Bridge]
[REm]Ma per trattar del ben [SOL]ch'i' vi trovai
[LAm]dirò de l'altre cose [FA]ch'i' v'ho scorte

Ritornello:
[DO]E quindi uscimmo [SOL]a riveder [FA]le stelle
[SOL]brillanti nella [DO]notte

[Outro]
[DO] [FA] [SOL] [DO]`;

    const compacted = compactChordProText(inputSong);

    // Intro converted to single comment
    expect(compacted).toContain('{comment: intro: DO SOL LAm FA}');

    // Verse 1 headers stripped and chords preserved
    expect(compacted).not.toContain('[Verse 1]');
    expect(compacted).toContain('[DO]Nel mezzo del cammin [SOL]di nostra vita');

    // First chorus labeled RIT: with chords, [Chorus] stripped
    expect(compacted).not.toContain('[Chorus]');
    expect(compacted).toContain('RIT:\n[DO]E quindi uscimmo [SOL]a riveder [FA]le stelle');

    // Strofa 2 header stripped, lyrics preserved without chords
    expect(compacted).not.toContain('Strofa 2:');
    expect(compacted).toContain('Ahi quanto a dir qual era è cosa dura\nesta selva selvaggia e aspra e forte');

    // Subsequent choruses collapsed to RIT.
    expect(compacted).toContain('\nRIT.\n');

    // Bridge labeled with {comment: bridge} and retains all its chords
    expect(compacted).toContain('{comment: bridge}\n[REm]Ma per trattar del ben [SOL]ch\'i\' vi trovai\n[LAm]dirò de l\'altre cose [FA]ch\'i\' v\'ho scorte');

    // Outro converted to comment
    expect(compacted).toContain('{comment: outro: DO FA SOL DO}');
  });
});



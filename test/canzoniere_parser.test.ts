import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import {
  isChordToken,
  isChordLine,
  alignChordsOverLyrics,
  parsePastedText,
  parseDocx,
} from '../src/features/canti/canzoniere_parser';

describe('FASE 9 - Canzoniere Parser & Chord Alignment Pipeline', () => {
  describe('1. Riconoscimento e Disambiguazione Accordi', () => {
    it('riconosce accordi standard italiani e anglosassoni, con alterazioni e slash chord', () => {
      expect(isChordToken('DO')).toBe(true);
      expect(isChordToken('Sol7')).toBe(true);
      expect(isChordToken('Lam')).toBe(true);
      expect(isChordToken('Fa#m')).toBe(true);
      expect(isChordToken('Sib')).toBe(true);
      expect(isChordToken('Re/Fa#')).toBe(true);
      expect(isChordToken('Cmaj7')).toBe(true);
      expect(isChordToken('D/F#')).toBe(true);
      expect(isChordToken('Gsus4')).toBe(true);
      expect(isChordToken('Bdim7')).toBe(true);
    });

    it('rifiuta parole che non sono accordi', () => {
      expect(isChordToken('gatto')).toBe(false);
      expect(isChordToken('ciao')).toBe(false);
      expect(isChordToken('camminare')).toBe(false);
    });

    it('trappola parole italiane comuni: "la la la" o frasi colloquiali NON sono righe di accordi', () => {
      expect(isChordLine('la la la')).toBe(false);
      expect(isChordLine('si si')).toBe(false);
      expect(isChordLine('fa molto caldo')).toBe(false);
      expect(isChordLine('do il mio cuore')).toBe(false);
    });

    it('riconosce righe di accordi tutte maiuscole o con alterazioni o in grassetto', () => {
      expect(isChordLine('DO   FA   DO   SOL')).toBe(true);
      expect(isChordLine('Lam   Fa   Do   Sol7')).toBe(true);
      expect(isChordLine('Re   Sol', { isBold: true })).toBe(true);
      expect(isChordLine('C   G   Am   F')).toBe(true);
    });

    it('gestisce slash chord e accordi a fine riga', () => {
      expect(isChordLine('DO   SOL/SI   LAm   FA/DO')).toBe(true);
      expect(isChordToken('SOL/SI')).toBe(true);
      expect(isChordToken('FA/DO')).toBe(true);
    });
  });

  describe('2. Allineamento Accordi su Testo (Proporzionale Roboto e Monospace)', () => {
    it('un accordo che cade a metà di una parola rimane sulla sillaba esatta (senza saltare a inizio parola)', () => {
      // In Fase 9B, gli accordi a metà parola restano sulla sillaba esatta
      const chordLine = '            SOL';
      const lyricsLine = 'verso camminare insieme';
      const merged = alignChordsOverLyrics(chordLine, lyricsLine, false);
      expect(merged).toContain('c[SOL]amminare');
    });

    it('un accordo posizionato esattamente sopra la parola rimane lì', () => {
      const chordLine = 'DO    SOL';
      const lyricsLine = 'Nel   mezzo';
      const merged = alignChordsOverLyrics(chordLine, lyricsLine, false);
      expect(merged).toBe('[DO]Nel   [SOL]mezzo');
    });

    it('modalità spaziatura fissa (monospace): allinea 1:1 per colonna di caratteri', () => {
      const chordLine = 'DO        SOL';
      const lyricsLine = 'Nel mezzo del cammin';
      const merged = alignChordsOverLyrics(chordLine, lyricsLine, true);
      expect(merged).toBe('[DO]Nel mezzo [SOL]del cammin');
    });

    it('riga di soli accordi senza testo (es. intro strumentale) genera blocco di soli accordi', () => {
      const chordLine = 'DO   FA   SOL   DO';
      const lyricsLine = '';
      const merged = alignChordsOverLyrics(chordLine, lyricsLine, false);
      expect(merged).toBe('[DO] [FA] [SOL] [DO]');
    });
  });

  describe('3. Incolla Testo: Formato Intestazione, ChordPro e Solo Testo', () => {
    it('parsea testo incollato con intestazione formattata e conserva intervallo BPM esatto come testo', () => {
      const pasted = `TITOLO: Canto Sintetico del Sentiero
AUTORE: Route Regionale 2024
TEMPO: 4/4
BPM: circa 92-94
RITMO: Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)
CAPOTASTO: 2
---
[Do]Sento nel profondo un [Sol]desiderio
[Lam]verso l'orizzonte [Fa]possiam camminare

RIT.
[Do]E' giunta l'ora di [Sol]partire`;

      const parsed = parsePastedText(pasted);
      expect(parsed.titolo).toBe('Canto Sintetico del Sentiero');
      expect(parsed.autore).toBe('Route Regionale 2024');
      expect(parsed.misura).toBe('4/4');
      expect(parsed.bpm_testo).toBe('circa 92-94');
      expect(parsed.tempo_bpm).toBe(92); // primo intero estratto per metronomo
      expect(parsed.ritmo).toBe('Giù, Giù-Su, Su-Giù-Su (↓ ↓↑ ↑↓↑)');
      expect(parsed.capotasto).toBe(2);
      expect(parsed.testo_chordpro).toContain('[Do]Sento nel profondo');
      expect(parsed.testo_chordpro).toContain('RIT.');
      expect(parsed.warnings.length).toBe(0);
    });

    it('parsea testo con accordi posti sopra il testo', () => {
      const pasted = `Canto del Bivacco
Tradizione Scout
---
DO             FA          DO          SOL
Sento nel profondo un desiderio nascere
LAm            FA          DO          SOL
verso l'orizzonte possiam camminare`;

      const parsed = parsePastedText(pasted);
      expect(parsed.testo_chordpro).toContain('[DO]Sento');
      expect(parsed.testo_chordpro).toContain('[FA]');
      expect(parsed.testo_chordpro).toContain('[LAm]verso');
    });

    it('parsea solo testo senza accordi, pronto per essere completato', () => {
      const pasted = `TITOLO: Testo Puro Senza Accordi
AUTORE: Autore Anonimo
---
Nel mezzo del cammin di nostra vita
mi ritrovai per una selva oscura
che la diritta via era smarrita.`;

      const parsed = parsePastedText(pasted);
      expect(parsed.titolo).toBe('Testo Puro Senza Accordi');
      expect(parsed.stats.chordsCount).toBe(0);
      expect(parsed.testo_chordpro).toContain('Nel mezzo del cammin');
      expect(parsed.tonalita).toBeNull();
    });

    it('segnala avvisi per token [?], parentesi non chiuse e caratteri speciali < & " \'', () => {
      const pasted = `TITOLO: Canto con Errori & Note <Speciali> "Test"
AUTORE: Clan & Reparto
---
[Do]Testo con marcatore [?] da completare
[Re]Riga con parentesi sbilanciata [Sol senza chiusura
[Fa]Caratteri speciali: <prova & verifica> "apici" 'singoli'`;

      const parsed = parsePastedText(pasted);
      expect(parsed.titolo).toContain('&');
      expect(parsed.titolo).toContain('<Speciali>');
      expect(parsed.warnings.some((w) => w.includes('[?]'))).toBe(true);
      expect(parsed.warnings.some((w) => w.includes('parentesi'))).toBe(true);
      expect(parsed.testo_chordpro).toContain('&');
      expect(parsed.testo_chordpro).toContain('<prova & verifica>');
    });
  });

  describe('4. Carica Documento Word (.docx) Sintetico con Tabella a Due Colonne', () => {
    it('estrae metadati, titolo, autore, parametri con frecce e converte tabella a 2 colonne inserendo {nuova_colonna}', async () => {
      // Generazione a runtime di un buffer .docx sintetico conforme con JSZip
      const syntheticDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>CANTO SINTETICO DEI PIONIERI</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:rPr><w:i/></w:rPr></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Route Nazionale 2014</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Tempo: </w:t></w:r>
      <w:r><w:t>4/4 ; circa 92-94 BPM.</w:t><w:tab/></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Ritmo pennata: </w:t></w:r>
      <w:r><w:t>Giù, Giù-Su, Su-Giù-Su (↓  ↓↑  ↑↓↑)</w:t></w:r>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Capotasto: 2</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:p>
            <w:r><w:rPr><w:b/></w:rPr><w:t>DO             FA          DO          SOL</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>Sento nel profondo un desiderio nascere</w:t></w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:p>
            <w:r><w:t>Un cielo stellato un fuoco e il suo calore</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:rPr><w:b/></w:rPr><w:t>RIT.</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

      const zip = new JSZip();
      zip.file('word/document.xml', syntheticDocXml);
      const docxBuffer = await zip.generateAsync({ type: 'arraybuffer' });

      // In happy-dom / test environment, window.DOMParser exists
      const parsed = await parseDocx(docxBuffer, { preserveColumnBreak: true });

      expect(parsed.titolo).toBe('CANTO SINTETICO DEI PIONIERI');
      expect(parsed.autore).toBe('Route Nazionale 2014');
      expect(parsed.misura).toBe('4/4');
      expect(parsed.bpm_testo).toBe('circa 92-94');
      expect(parsed.tempo_bpm).toBe(92);
      expect(parsed.ritmo).toContain('Giù, Giù-Su, Su-Giù-Su');
      expect(parsed.capotasto).toBe(2);

      // Verifica che la colonna sinistra e destra siano separate dalla direttiva {nuova_colonna}
      expect(parsed.testo_chordpro).toContain('{nuova_colonna}');
      expect(parsed.testo_chordpro).toContain('[DO]Sento');
      expect(parsed.testo_chordpro).toContain('Un cielo stellato');
      expect(parsed.testo_chordpro).toContain('RIT.');
    });
  });

  describe('5. Rimozione Dipendenza AI (Fase 10A)', () => {
    it('non esporta né incorpora prompt AI nel modulo canzoniere', async () => {
      const module = await import('../src/features/canti/canzoniere_parser');
      expect((module as Record<string, unknown>).AI_IMPORT_PROMPT).toBeUndefined();
    });
  });
});

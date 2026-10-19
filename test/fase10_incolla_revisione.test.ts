import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  cleanPastedText,
  reconstructWithActiveChanges,
} from '../src/features/canti/canzoniere_cleaner';
import {
  isChordToken,
  isChordLine,
  normalizeChord,
} from '../src/features/canti/chord_detection';
import {
  alignChordsOverLyrics,
  parsePastedText,
} from '../src/features/canti/canzoniere_parser';
import { NOISE_PATTERNS } from '../src/features/canti/rumore.config';

describe('FASE 10 — Test Suite Inserimento Canti a Mano e Senza AI (10A & 10B)', () => {
  /* ==============================================================================
     10A — RIMOZIONE DELL'AI E PULIZIA
     ============================================================================== */
  describe('10A — Rimozione AI e Pulizia', () => {
    it('1. Nessun testo dell\'interfaccia o dei documenti attivi contiene riferimenti AI per l\'importazione', () => {
      const activeDocPaths = [
        path.join(process.cwd(), 'docs/GUIDA_CAPI.md'),
        path.join(process.cwd(), 'docs/ARCHITECTURE.md'),
        path.join(process.cwd(), 'src/features/canti/CantoFormSheet.tsx'),
        path.join(process.cwd(), 'src/features/canti/canzoniere_parser.ts'),
      ];

      for (const p of activeDocPaths) {
        if (!fs.existsSync(p)) continue;
        const content = fs.readFileSync(p, 'utf-8');
        // Verifica che non vi siano istruzioni di import con IA / prompt nel canzoniere attivo
        expect(content).not.toMatch(/chiedi il canto desiderato.*AI/i);
        expect(content).not.toMatch(/l'AI verificherà/i);
        expect(content).not.toMatch(/Copia prompt/i);
        expect(content).not.toMatch(/AI_IMPORT_PROMPT/);
      }

      // Verifica archiviazione del prompt vecchio
      const archivedPrompt = path.join(process.cwd(), 'docs/archivio/PROMPT_IMPORT_CANTI.md');
      expect(fs.existsSync(archivedPrompt)).toBe(true);
      const archivedContent = fs.readFileSync(archivedPrompt, 'utf-8');
      expect(archivedContent).toContain('DOCUMENTO ARCHIVIATO — NON USATO');
    });

    it('2. Notazioni accordi da accettare: La-, SI-, Re- convertiti in m, maiuscolo/minuscolo e slash chord', () => {
      // Trattino indicatore di minore '-' convertito in 'm'
      expect(normalizeChord('La-')).toBe('Lam');
      expect(normalizeChord('SI-')).toBe('SIm');
      expect(normalizeChord('Re-')).toBe('Rem');
      expect(normalizeChord('Do-')).toBe('Dom');
      expect(normalizeChord('Mi-')).toBe('Mim');
      expect(normalizeChord('Fa-')).toBe('Fam');
      expect(normalizeChord('Sol-')).toBe('Solm');

      // Maiuscolo e minuscolo accettati
      expect(normalizeChord('RE')).toBe('RE');
      expect(normalizeChord('Sol')).toBe('Sol');
      expect(normalizeChord('LAm')).toBe('LAm');
      expect(normalizeChord('do')).toBe('Do');

      // Modificatori (7, maj7, sus4, add9, dim, #, b)
      expect(normalizeChord('Do7')).toBe('Do7');
      expect(normalizeChord('Solmaj7')).toBe('Solmaj7');
      expect(normalizeChord('Resus4')).toBe('Resus4');
      expect(normalizeChord('Faadd9')).toBe('Faadd9');
      expect(normalizeChord('Sidim')).toBe('Sidim');
      expect(normalizeChord('Fa#')).toBe('Fa#');
      expect(normalizeChord('Sib')).toBe('Sib');
      expect(normalizeChord('Do#m7')).toBe('Do#m7');

      // Slash chord
      expect(normalizeChord('Re/Fa#')).toBe('Re/Fa#');
      expect(normalizeChord('Sol/Si')).toBe('Sol/Si');
      expect(normalizeChord('La-/Do#')).toBe('Lam/Do#');
      expect(normalizeChord('C/G')).toBe('C/G');
    });

    it('3. Rifiuto rigoroso delle trappole parole italiane (Do, Re, Mi, Fa, Sol, La, Si)', () => {
      // Frasi di testo colloquiali contenenti note come parole non sono MAI prese per accordi
      expect(isChordLine('Do una cosa a te')).toBe(false);
      expect(isChordLine('Re della terra')).toBe(false);
      expect(isChordLine('Mi sento bene')).toBe(false);
      expect(isChordLine('Fa caldo oggi')).toBe(false);
      expect(isChordLine('Sol levante all\'orizzonte')).toBe(false);
      expect(isChordLine('La strada che sale')).toBe(false);
      expect(isChordLine('Si dice che domani pioverà')).toBe(false);

      // Ritornelli cantati con parole note omonime a spazio singolo
      expect(isChordLine('Fa la la la')).toBe(false);
      expect(isChordLine('Si fa la la')).toBe(false);
      expect(isChordLine('Do re mi fa sol la si')).toBe(false);
      expect(isChordLine('la la la')).toBe(false);

      // Al contrario, righe di accordi reali spaziati o in maiuscolo sono riconosciute
      expect(isChordLine('DO   FA   DO   SOL')).toBe(true);
      expect(isChordLine('Lam   Fa   Do   Sol7')).toBe(true);
      expect(isChordLine('Re-   SI-   La-')).toBe(true);
      expect(isChordLine('Re   Sol', { isBold: true })).toBe(true);
    });

    it('4. Accordi separati da spazi, trattini o barre', () => {
      expect(isChordLine('Do - Fa - Sol - Do')).toBe(true);
      expect(isChordLine('Lam | Fa | Do | Sol')).toBe(true);
      expect(isChordLine('Rem / Sol7 / Do')).toBe(true);
      expect(isChordLine('Do – Sol – Lam – Fa')).toBe(true); // En-dash
    });
  });

  /* ==============================================================================
     10B — INCOLLA INTELLIGENTE + REVISIONE
     ============================================================================== */
  describe('10B — Incolla Intelligente e Normalizzazione', () => {
    it('1. Normalizza spazi, tabulazioni, caratteri non separabili, quote tipografiche e trattini sillabazione', () => {
      const rawSynthetic = [
        'Eravamo\u00A0in\u202Fcammino\tverso\u00A0la valle',
        'L’aquila disse: “Salite in vetta”',
        'sul monte gran-',
        'de della Majella',
      ].join('\n');

      const cleaned = cleanPastedText(rawSynthetic);

      // Quote tipografiche normalizzate in standard ASCII
      expect(cleaned.cleanedText).toContain("L'aquila disse: \"Salite in vetta\"");
      // Trattino di sillabazione a fine riga ricongiunto
      expect(cleaned.cleanedText).toContain('monte grande della Majella');
      expect(cleaned.changes.some((c) => c.type === 'hyphen')).toBe(true);
    });

    it('2. Rimuove righe di rumore tipiche del web tramite rumore.config.ts', () => {
      const dirtySynthetic = [
        'TITOLO: Canto Sintetico dei Sentieri',
        'www.canzonierionline.it/download',
        'Condividi su Facebook',
        'Trasponi tonalità +1 -1',
        'Stampa questo spartito',
        'Tutti i diritti riservati © 2026 Associazione',
        'Pagina 1 di 4',
        '12',
        '[Do]Camminiamo insieme nel [Sol]bosco',
      ].join('\n');

      const cleaned = cleanPastedText(dirtySynthetic);

      expect(cleaned.cleanedText).not.toContain('www.canzonierionline.it');
      expect(cleaned.cleanedText).not.toContain('Condividi su Facebook');
      expect(cleaned.cleanedText).not.toContain('Trasponi');
      expect(cleaned.cleanedText).not.toContain('Tutti i diritti riservati');
      expect(cleaned.cleanedText).toContain('[Do]Camminiamo insieme nel [Sol]bosco');

      const noiseChanges = cleaned.changes.filter((c) => c.type === 'noise');
      expect(noiseChanges.length).toBeGreaterThanOrEqual(4);
    });

    it('3. Converte etichette ([Ritornello], [Strofa 1], [Bridge]) preservando RIT. e RIT:', () => {
      const textWithLabels = [
        '[Strofa 1]',
        'Sotto le stelle accendiamo il fuoco',
        '[Ritornello]',
        'Cantiamo tutti in coro intorno al ceppo',
        'RIT.',
        'La melodia risuona nella notte',
        'Rit: ancora un altro giro',
        '[Bridge]',
        'E il vento porta via le faville',
      ].join('\n');

      const cleaned = cleanPastedText(textWithLabels);

      // Etichette convertite
      expect(cleaned.cleanedText).toContain('{comment: Strofa 1}');
      expect(cleaned.cleanedText).toContain('RIT.');
      expect(cleaned.cleanedText).toContain('{comment: Bridge}');

      // RIT. e Rit: conservate come testo
      expect(cleaned.cleanedText).toContain('Rit: ancora un altro giro');
    });

    it('4. Unisce le righe spezzate dall\'impaginazione solo quando evidente (senza accordi sopra)', () => {
      const brokenText = [
        'Questa è una frase lunga che è stata spezzata a metà',
        'dall\'impaginazione stretta di una colonna',
        'Questa riga invece termina con punto.',
        'Nuova frase che inizia con maiuscola',
      ].join('\n');

      const cleaned = cleanPastedText(brokenText);

      // La prima frase è unita perché la riga 1 finisce senza punteggiatura e la riga 2 inizia minuscola
      expect(cleaned.cleanedText).toContain(
        "Questa è una frase lunga che è stata spezzata a metà dall'impaginazione stretta di una colonna"
      );

      // La seconda riga termina con punto e non viene unita
      expect(cleaned.cleanedText).toContain('Questa riga invece termina con punto.\nNuova frase');
      expect(cleaned.changes.some((c) => c.type === 'join')).toBe(true);
    });

    it('5. Non unisce righe se ci sono accordi sopra o se la riga è un accordo', () => {
      const withChords = [
        'DO             FA          DO          SOL',
        'Sento nel profondo un desiderio nascere',
        'LAm            FA          DO          SOL',
        'verso l\'orizzonte possiam camminare',
      ].join('\n');

      const cleaned = cleanPastedText(withChords);

      // Le righe di accordi non devono mai essere fuse con i versi sottostanti
      expect(cleaned.cleanedText).toContain('DO             FA          DO          SOL');
      expect(cleaned.cleanedText).toContain('Sento nel profondo un desiderio nascere');
      expect(cleaned.cleanedText).toContain('LAm            FA          DO          SOL');
      expect(cleaned.cleanedText).toContain('verso l\'orizzonte possiam camminare');
    });

    it('6. Schermata di revisione: annullamento singola modifica (reconstructWithActiveChanges)', () => {
      const originalText = [
        'TITOLO: Canto del Fuoco',
        'Condividi su Facebook',
        '[Ritornello]',
        'Fiamma che brilli alta nel cielo',
        'sul monte gran-',
        'de della Majella',
      ].join('\n');

      const initialClean = cleanPastedText(originalText);
      expect(initialClean.changes.length).toBeGreaterThanOrEqual(3);

      // Trova la modifica di rumore "Condividi su Facebook" e disabilitala (annulla eliminazione)
      const noiseChange = initialClean.changes.find((c) => c.type === 'noise');
      expect(noiseChange).toBeDefined();

      const updatedChanges = initialClean.changes.map((c) =>
        c.id === noiseChange!.id ? { ...c, enabled: false } : c
      );

      // Ricostruisci il testo
      const reconstructed = reconstructWithActiveChanges(
        initialClean.originalLines,
        updatedChanges
      );

      // La riga ripristinata ricompare nel testo ricostruito!
      expect(reconstructed.join('\n')).toContain('Condividi su Facebook');
      // Le altre modifiche attive (etichetta e sillabazione) rimangono applicate
      expect(reconstructed.join('\n')).toContain('RIT.');
      expect(reconstructed.join('\n')).toContain('monte grande della Majella');
    });

    it('7. Riconoscimento accordi sopra il testo con misurazione posizioni e avviso se spaziatura persa', () => {
      // Testo con accordi ben spaziati sopra
      const wellSpaced = [
        'DO             FA          DO          SOL',
        'Sento nel profondo un desiderio nascere',
      ].join('\n');

      const parsedWell = parsePastedText(wellSpaced);
      expect(parsedWell.testo_chordpro).toContain('[DO]Sento');
      expect(parsedWell.testo_chordpro).toContain('[FA]');
      expect(parsedWell.warnings.some((w) => w.includes("accordi senza posizione"))).toBe(false);

      // Testo con spaziatura persa (accordi compressi a 1 spazio a inizio riga sopra frase lunga)
      const collapsedSpacing = [
        'DO FA DO SOL',
        'Sento nel profondo della notte un grande desiderio di camminare verso la montagna',
      ].join('\n');

      const parsedCollapsed = parsePastedText(collapsedSpacing);
      // Rileva l'avviso richiesto dalla specifica: "accordi senza posizione: usa l'editor accordi"
      expect(parsedCollapsed.warnings.some((w) => w.includes("accordi senza posizione: usa l'editor accordi"))).toBe(true);
    });

    it('8. Sicurezza XSS: sanitizzazione e gestione caratteri speciali < & " \'', () => {
      const xssRaw = [
        '<script>alert("xss")</script>',
        'Nel <mezzo> & nel "cammin" \'di nostra vita\'',
        '[Do]Canto con tag <div class="evil"> & accordi',
      ].join('\n');

      const parsed = parsePastedText(xssRaw);
      // Non crasha, traccia gli avvisi o neutralizza il testo
      expect(parsed.testo_chordpro).toBeDefined();
      expect(parsed.testo_chordpro).toContain('Nel <mezzo> & nel "cammin" \'di nostra vita\'');
      expect(parsed.testo_chordpro).toContain('[Do]Canto con tag <div class="evil"> & accordi');
    });
  });
});

import { describe, it, expect } from 'vitest';
import { fixOcrChordLine, processOcrText } from '../src/features/canti/image_importer';

describe('Image OCR Importer & Chord Extractor', () => {
  it('corregge refusi tipici OCR sulle righe di accordi', () => {
    expect(fixOcrChordLine('FR   DO')).toBe('FA   DO');
    expect(fixOcrChordLine('sol  la-')).toBe('SOL  LAm');
    expect(fixOcrChordLine('la-  sol la-')).toBe('LAm  SOL LAm');
    expect(fixOcrChordLine('mi-  si-')).toBe('MIm  SIm');
  });

  it('estrae titolo e testo pulito escludendo accordi e rumore web', () => {
    const rawOcr = `Tra boschi e prati
LA-            DO
Tra boschi e prati verdi e fiumi
SOL       LA-
con l'acqua e con il sole
             DO
col vento pure con l'aria lieve
    SOL       LA-
nella calda estate o con la neve
FA       DO
quanti passi fatti insieme
SOL      LA-
allegria di una fatica
FA       DO       SOL
ancor più meravigliosa perché ...
    LA- SOL LA-
fatta con te.

Un sorso d'acqua fresca e poi
l'orizzonte di nuovo davanti a noi
senza più limiti ed ore

© 1996-2003: Testi ospitati da TUTTOSCOUT.ORG
© Ogni testo appartiene ai rispettivi autori - Tutti i diritti sono riservati`;

    const res = processOcrText(rawOcr, 'Tra boschi');

    expect(res.titolo).toBe('Tra boschi e prati');
    // Il testo deve essere pulito e privo di accordi spuri
    expect(res.chordProText).toContain('Tra boschi e prati verdi e fiumi');
    expect(res.chordProText).not.toContain('[LAm]');
    expect(res.chordProText).not.toContain('[DO]');
    expect(res.chordProText).not.toContain('LA-');
    expect(res.chordProText).toContain("Un sorso d'acqua fresca e poi");
    // Rumore web eliminato
    expect(res.chordProText).not.toContain('TUTTOSCOUT.ORG');
    expect(res.chordProText).not.toContain('diritti sono riservati');
  });
});

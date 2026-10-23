import { describe, it, expect } from 'vitest';
import { generateScoutWordTemplate } from '../src/features/canti/word_template';
import { parseDocx } from '../src/features/canti/canzoniere_parser';

describe('Scout Word Template Generator and Parser', () => {
  it('generates a valid .docx that parseDocx can parse cleanly', async () => {
    const bytes = await generateScoutWordTemplate();
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(1000);

    const parsed = await parseDocx(bytes);
    expect(parsed.titolo).toBe('TITOLO DEL CANTO');
    expect(parsed.autore).toContain('Route Nazionale');
    expect(parsed.misura).toBe('4/4');
    expect(parsed.testo_chordpro).toContain('[Do]');
    expect(parsed.testo_chordpro).toContain('[Sol]');
    expect(parsed.testo_chordpro).toContain('RIT:');
    expect(parsed.testo_chordpro).toContain('RIT.');
  });
});

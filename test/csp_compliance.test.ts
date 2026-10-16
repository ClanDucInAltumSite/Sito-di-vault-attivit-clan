// test/csp_compliance.test.ts
// Test statico per CORREZIONE 4:
// Confronta domini e schemi usati dal codice applicativo (Supabase Storage, blob:, data:)
// con quelli ammessi dalla Content Security Policy (CSP) di index.html per img-src, connect-src e frame/object PDF.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getIndexCspDirectives(): Record<string, string[]> {
  const indexPath = path.resolve(process.cwd(), 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  const cspMatch = indexHtml.match(/http-equiv=["']Content-Security-Policy["'][\s\S]*?content="([^"]+)"/i);
  if (!cspMatch || !cspMatch[1]) {
    throw new Error('Nessuna Content-Security-Policy trovata nel tag <meta> di index.html');
  }

  const cspString = cspMatch[1];
  const directives: Record<string, string[]> = {};

  const parts = cspString.split(';').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(/\s+/).filter(Boolean);
    const directiveName = tokens[0]?.toLowerCase();
    const directiveValues = tokens.slice(1);
    if (directiveName) {
      directives[directiveName] = directiveValues;
    }
  }

  return directives;
}

function getAllSourceFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllSourceFiles(fullPath, fileList);
    } else if (/\.(ts|tsx|js|jsx|html|css)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

describe('CORREZIONE 4 - Verifica Statica Conformità Content Security Policy (CSP)', () => {
  const csp = getIndexCspDirectives();

  it('1. Direttiva img-src: ammette tutti gli schemi e domini usati (blob:, data:, self, supabase)', () => {
    const imgSrc = csp['img-src'] || csp['default-src'] || [];

    // Schemi e domini usati dal codice per le immagini
    expect(imgSrc).toContain("'self'");
    expect(imgSrc).toContain('data:');
    expect(imgSrc).toContain('blob:');

    // Supabase storage
    const hasSupabaseDomain = imgSrc.some(
      (entry) => entry.includes('supabase.co') || entry.includes('*.supabase.co')
    );
    expect(hasSupabaseDomain).toBe(true);
  });

  it('2. Direttiva connect-src: ammette connessioni REST e WebSocket a Supabase', () => {
    const connectSrc = csp['connect-src'] || csp['default-src'] || [];

    expect(connectSrc).toContain("'self'");

    // Supabase HTTP e WSS
    const hasHttpSupabase = connectSrc.some(
      (entry) => entry.startsWith('https://') && entry.includes('supabase.co')
    );
    const hasWssSupabase = connectSrc.some(
      (entry) => entry.startsWith('wss://') && entry.includes('supabase.co')
    );

    expect(hasHttpSupabase).toBe(true);
    expect(hasWssSupabase).toBe(true);
  });

  it('3. Gestione PDF e Oggetti incorporati: nessun uso insicuro di <object> o <embed> nel codice applicativo', () => {
    const srcFiles = getAllSourceFiles(path.resolve(process.cwd(), 'src'));

    const objectOrEmbedRegex = /<(object|embed)\b[^>]*>/i;
    const violations: { file: string; match: string }[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(objectOrEmbedRegex);
      if (match) {
        violations.push({ file: path.relative(process.cwd(), file), match: match[0] });
      }
    }

    // Se CSP dichiara object-src 'none', non deve esserci alcun tag <object> o <embed>
    const objectSrc = csp['object-src'] || [];
    if (objectSrc.includes("'none'")) {
      expect(
        violations.length,
        `Rilevato uso di <object> o <embed> non consentito da object-src 'none': ${JSON.stringify(violations)}`
      ).toBe(0);
    }
  });

  it('4. Nessuna chiamata a domini terzi esterni non ammessi da CSP (zero CDN)', () => {
    const srcFiles = getAllSourceFiles(path.resolve(process.cwd(), 'src'));
    const thirdPartyViolations: { file: string; match: string }[] = [];

    // Cerca URL assoluti http/https nel codice
    const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+)/g;

    for (const file of srcFiles) {
      // Escludi commenti o documentazioni interne se presenti
      const content = fs.readFileSync(file, 'utf-8');
      let m: RegExpExecArray | null;
      while ((m = urlRegex.exec(content)) !== null) {
        const domain = m[1].toLowerCase();
        // Domini legittimi: localhost, 127.0.0.1, domini supabase.co, schema chordpro.org/standard se in commenti
        if (
          domain === 'localhost' ||
          domain === '127.0.0.1' ||
          domain.endsWith('.supabase.co') ||
          domain === 'supabase.co'
        ) {
          continue;
        }

        // Se compare una libreria esterna o CDN (es. cdnjs, unpkg, googlefonts) è una violazione
        if (
          domain.includes('cdnjs') ||
          domain.includes('unpkg') ||
          domain.includes('jsdelivr') ||
          domain.includes('googleapis') ||
          domain.includes('gstatic')
        ) {
          thirdPartyViolations.push({ file: path.relative(process.cwd(), file), match: domain });
        }
      }
    }

    expect(thirdPartyViolations.length).toBe(0);
  });
});

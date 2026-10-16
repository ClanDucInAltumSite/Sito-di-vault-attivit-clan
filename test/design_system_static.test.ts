import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

function getAllFiles(dirPath: string, extensions: string[]): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'dist') {
        files = files.concat(getAllFiles(fullPath, extensions));
      }
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('FASE 1B - Verifica Statica del Design System Apple-Grade', () => {
  const srcDir = path.resolve(__dirname, '../src');

  it('Verifica che i font Inter woff2 self-hosted siano presenti in public/fonts', () => {
    const publicFontsDir = path.resolve(__dirname, '../public/fonts');
    expect(fs.existsSync(publicFontsDir)).toBe(true);

    const latinWoff2 = path.join(publicFontsDir, 'inter-latin.woff2');
    const latinExtWoff2 = path.join(publicFontsDir, 'inter-latin-ext.woff2');

    expect(fs.existsSync(latinWoff2)).toBe(true);
    expect(fs.existsSync(latinExtWoff2)).toBe(true);

    expect(fs.statSync(latinWoff2).size).toBeGreaterThan(10000);
    expect(fs.statSync(latinExtWoff2).size).toBeGreaterThan(10000);
  });

  it('Verifica che tutti i colori siano definiti come token in tokens.css', () => {
    const tokensFile = path.resolve(srcDir, 'styles/tokens.css');
    expect(fs.existsSync(tokensFile)).toBe(true);
    const tokensContent = fs.readFileSync(tokensFile, 'utf-8');

    // Verifica presenza di variabili OKLCH
    expect(tokensContent).toContain('--color-bg: oklch(');
    expect(tokensContent).toContain('--color-surface: oklch(');
    expect(tokensContent).toContain('--color-accent: oklch(');
    expect(tokensContent).toContain('--color-giallo: oklch(');
    expect(tokensContent).toContain('--color-rosso: oklch(');

    // Nessun colore hardcoded nei file CSS di stile componenti al di fuori di tokens.css
    const cssFiles = getAllFiles(path.resolve(srcDir, 'styles'), ['.css']).filter(
      (f) => !f.endsWith('tokens.css')
    );

    const hexColorRegex = /#([0-9a-fA-F]{3,8})\b/g;
    for (const cssFile of cssFiles) {
      const content = fs.readFileSync(cssFile, 'utf-8');
      const matches = content.match(hexColorRegex);
      expect(
        matches,
        `Trovati colori HEX hardcoded in ${path.basename(cssFile)}: ${matches?.join(', ')}`
      ).toBeNull();
    }
  });

  it('Verifica che non ci siano emoji come icone nei componenti e navigazione', () => {
    const tsxFiles = getAllFiles(path.resolve(srcDir), ['.tsx', '.ts']);
    // Range Unicode tipico delle emoji grafiche
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const file of tsxFiles) {
      // Salta file di test o di mock se presenti
      if (file.includes('test') || file.includes('vite-env')) continue;
      const content = fs.readFileSync(file, 'utf-8');

      const lines = content.split('\n');
      lines.forEach((line, lineIndex) => {
        // Ignora commenti
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) {
          return;
        }
        const hasEmoji = emojiRegex.test(line);
        expect(
          hasEmoji,
          `Emoji trovata in ${path.basename(file)} riga ${lineIndex + 1}: ${line.trim()}`
        ).toBe(false);
      });
    }
  });

  it('Verifica che tutte le immagini abbiano l\'attributo alt obbligatorio', () => {
    const tsxFiles = getAllFiles(path.resolve(srcDir), ['.tsx']);
    const imgRegex = /<img\b([^>]*)\/?>/g;

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        const imgTag = match[1];
        expect(
          imgTag.includes('alt='),
          `Tag <img> privo di attributo 'alt' in ${path.basename(file)}: ${match[0]}`
        ).toBe(true);
      }
    }
  });

  it('Verifica che non venga usato innerHTML o dangerouslySetInnerHTML (sicurezza e contrasto)', () => {
    const tsxFiles = getAllFiles(path.resolve(srcDir), ['.tsx', '.ts']);

    for (const file of tsxFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.includes('dangerouslySetInnerHTML')).toBe(false);
      expect(content.includes('.innerHTML =')).toBe(false);
    }
  });

  it('Verifica che le animazioni CSS utilizzino unicamente transform e opacity (zero layout reflow)', () => {
    const cssFiles = getAllFiles(path.resolve(srcDir, 'styles'), ['.css']);
    const keyframesRegex = /@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;

    for (const file of cssFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      while ((match = keyframesRegex.exec(content)) !== null) {
        const animName = match[1];
        const animBody = match[2];

        // Se l'animazione contiene proprietà diverse da transform, opacity, stroke-dashoffset, stroke, color, background-color, rx, ry, cx, cy
        // non deve animare width, height, margin, padding, top, left, bottom, right
        const forbiddenProps = ['width:', 'height:', 'margin:', 'padding:', 'top:', 'left:', 'bottom:', 'right:'];
        for (const prop of forbiddenProps) {
          expect(
            animBody.includes(prop),
            `Animazione @keyframes ${animName} in ${path.basename(file)} anima la proprietà layout '${prop}', causando reflow.`
          ).toBe(false);
        }
      }
    }
  });
});

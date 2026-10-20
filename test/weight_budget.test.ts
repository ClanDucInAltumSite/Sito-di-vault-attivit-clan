// test/weight_budget.test.ts
// Test di regressione per i budget di peso di avvio, precache e fotografie

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FASE 12A — Verifica Statica dei Budget di Peso', () => {
  it('lo script scripts/check_weight_budget.mjs esiste ed è configurato', () => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'check_weight_budget.mjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, 'utf8');
    expect(content).toContain('maxInitialJsGzipKiB');
    expect(content).toContain('pdfjs-dist');
    expect(content).toContain('pdf.worker');
  });

  it('il peso totale delle fotografie in public/photos/ non supera 700 KB', () => {
    const photosDir = path.join(process.cwd(), 'public', 'photos');
    expect(fs.existsSync(photosDir)).toBe(true);
    const files = fs.readdirSync(photosDir).filter(f => f.endsWith('.webp'));
    expect(files.length).toBeGreaterThanOrEqual(15);

    let totalBytes = 0;
    for (const f of files) {
      const size = fs.statSync(path.join(photosDir, f)).size;
      totalBytes += size;
      // Nessuna foto singola deve superare 150 KB
      expect(size / 1024).toBeLessThanOrEqual(150);
    }

    const totalKiB = totalBytes / 1024;
    expect(totalKiB).toBeLessThanOrEqual(700);
  });

  it('vite.config.ts esclude esplicitamente pdf.worker e pdfjs dal precache statico', () => {
    const viteConfig = fs.readFileSync(path.join(process.cwd(), 'vite.config.ts'), 'utf8');
    expect(viteConfig).toContain('globIgnores');
    expect(viteConfig).toContain('pdf.worker');
    expect(viteConfig).toContain('pdfjs');
  });
});

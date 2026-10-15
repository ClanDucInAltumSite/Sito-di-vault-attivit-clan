import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Verifica Vincoli di Sicurezza nel Codebase', () => {
  it('nessun riferimento a service_role come valore o chiave in tutto il repository', () => {
    const rootDir = path.resolve(__dirname, '..');
    const ignoredDirs = new Set(['node_modules', '.git', 'dist', '.gemini', 'coverage', 'test-results']);
    const allowedExtensions = new Set([
      '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.sql', '.html', '.css', '.env', '.example', '.yml', '.yaml'
    ]);

    const violations: { file: string; line: number; text: string }[] = [];

    function scanDirectory(currentDir: string) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) {
            scanDirectory(path.join(currentDir, entry.name));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          const isEnvFile = entry.name.startsWith('.env');
          if (allowedExtensions.has(ext) || isEnvFile) {
            const filePath = path.join(currentDir, entry.name);
            const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

            // Salta questo test stesso se sta solo definendo il nome del test
            if (relativePath === 'test/security_contract.test.ts') continue;

            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (!line) continue;
              if (line.toLowerCase().includes('service_role')) {
                // Esclude commenti o testi che documentano il DIVIETO di usarlo
                const isProhibitionText =
                  line.includes('NON') ||
                  line.includes('vietat') ||
                  line.includes('nessuna chiave') ||
                  line.includes('nessun riferimento') ||
                  line.includes('proibit') ||
                  line.includes('senza service_role') ||
                  line.includes('fallisca se trova');

                if (!isProhibitionText) {
                  violations.push({
                    file: relativePath,
                    line: i + 1,
                    text: line.trim(),
                  });
                }
              }
            }
          }
        }
      }
    }

    scanDirectory(rootDir);
    expect(violations).toEqual([]);
  });

  it('nessun innerHTML o dangerouslySetInnerHTML nel codice sorgente applicativo', () => {
    const srcDir = path.resolve(__dirname, '../src');

    function checkDir(dir: string) {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          checkDir(fullPath);
        } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          expect(content.includes('innerHTML')).toBe(false);
          expect(content.includes('dangerouslySetInnerHTML')).toBe(false);
        }
      }
    }

    checkDir(srcDir);
  });
});

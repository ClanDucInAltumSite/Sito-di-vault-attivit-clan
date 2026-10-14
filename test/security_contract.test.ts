import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Verifica Vincoli di Sicurezza nel Codebase', () => {
  it('nessun riferimento a service_role compare nel codice sorgente', () => {
    const srcDir = path.resolve(__dirname, '../src');
    
    function checkDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          checkDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html') || file.endsWith('.css')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          expect(content.includes('service_role')).toBe(false);
          expect(content.includes('innerHTML')).toBe(false);
        }
      }
    }

    checkDir(srcDir);
  });

  it('nessun innerHTML compare nei file dei componenti', () => {
    const uiDir = path.resolve(__dirname, '../src/ui');
    const files = fs.readdirSync(uiDir);
    for (const file of files) {
      if (file.endsWith('.tsx')) {
        const content = fs.readFileSync(path.join(uiDir, file), 'utf-8');
        expect(content.includes('innerHTML')).toBe(false);
        expect(content.includes('dangerouslySetInnerHTML')).toBe(false);
      }
    }
  });
});

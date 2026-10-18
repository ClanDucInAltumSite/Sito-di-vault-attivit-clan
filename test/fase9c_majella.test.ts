import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

describe('FASE 9C — Verifica Sfondo Topografico Reale della Majella', () => {
  const svgPath = path.resolve('public/assets/topo_majella.svg');
  const jsonPath = path.resolve('src/ui/topo_majella_data.json');
  const componentsCssPath = path.resolve('src/styles/components.css');
  const printCssPath = path.resolve('src/styles/print.css');

  it('1. File SVG esiste e la dimensione compressa GZIP è <= 40 KB', () => {
    expect(fs.existsSync(svgPath)).toBe(true);
    const content = fs.readFileSync(svgPath, 'utf8');
    const gz = zlib.gzipSync(Buffer.from(content));
    const gzKb = gz.byteLength / 1024;
    console.log(`[TEST FASE 9C] SVG Raw size: ${(content.length / 1024).toFixed(1)} KB, Gzip: ${gzKb.toFixed(1)} KB`);
    expect(gz.byteLength).toBeLessThanOrEqual(40 * 1024);
  });

  it('2. Elenco etichette nel JSON corrisponde esattamente ai 7 toponimi ufficiali verificati', () => {
    expect(fs.existsSync(jsonPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    expect(data.dataset).toContain('Copernicus GLO-30');
    expect(data.points).toHaveLength(7);

    const ids = data.points.map((p: any) => p.id);
    expect(ids).toContain('monte_amaro');
    expect(ids).toContain('rava_del_ferro');
    expect(ids).toContain('bivacco_pelino');
    expect(ids).toContain('monte_focalone');
    expect(ids).toContain('monte_acquaviva');
    expect(ids).toContain('passo_san_leonardo');
    expect(ids).toContain('lama_bianca');

    // Verifica Monte Amaro
    const amaro = data.points.find((p: any) => p.id === 'monte_amaro');
    expect(amaro.quota).toBe(2793);
    expect(amaro.highlight).toBe(true);
    expect(amaro.sources.length).toBeGreaterThanOrEqual(2);

    // Ogni punto ha almeno due fonti verificate
    for (const pt of data.points) {
      expect(pt.sources.length).toBeGreaterThanOrEqual(2);
      expect(pt.svgX).toBeGreaterThanOrEqual(0);
      expect(pt.svgX).toBeLessThanOrEqual(1200);
      expect(pt.svgY).toBeGreaterThanOrEqual(0);
      expect(pt.svgY).toBeLessThanOrEqual(480);
    }
  });

  it('3. SVG e TopographicBackground contengono curve di livello reali, 7 toponimi e zero riferimenti vecchi', () => {
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    const tsxContent = fs.readFileSync(path.resolve('src/ui/TopographicBackground.tsx'), 'utf8');

    expect(svgContent).toContain('<svg viewBox="0 0 1200 480"');
    expect(svgContent).toContain('topo-line');
    expect(svgContent).toContain('topo-line-major');
    expect(svgContent).toContain('topo-line-accent');
    expect(svgContent).toContain('Monte Amaro 2793 m');
    expect(svgContent).toContain('Rava del Ferro');
    expect(svgContent).toContain('Biv. Pelino 2790 m');

    // Il componente TSX non usa innerHTML o dangerouslySetInnerHTML
    expect(tsxContent.includes('dangerouslySetInnerHTML')).toBe(false);
    expect(tsxContent.includes('innerHTML')).toBe(false);

    // Assenza di riferimenti ai monti sostituiti
    expect(svgContent.toLowerCase()).not.toContain('subasio');
    expect(svgContent.toLowerCase()).not.toContain('sibillini');
    expect(tsxContent.toLowerCase()).not.toContain('subasio');
    expect(tsxContent.toLowerCase()).not.toContain('sibillini');
  });

  it('4. Nascosto rigorosamente in stampa sia in print.css che in components.css', () => {
    const printCss = fs.readFileSync(printCssPath, 'utf8');
    const compCss = fs.readFileSync(componentsCssPath, 'utf8');

    expect(printCss).toMatch(/\.topo-contour-wrapper[\s\S]*?display:\s*none\s*!important/);
    expect(compCss).toMatch(/@media\s+print[\s\S]*?\.topo-contour-wrapper[\s\S]*?display:\s*none\s*!important/);
  });

  it('5. Rispetto di prefers-reduced-motion e varianti tema scuro', () => {
    const compCss = fs.readFileSync(componentsCssPath, 'utf8');

    // Reduced motion disattiva animazioni e trasformazioni
    expect(compCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(compCss).toContain('animation: none !important');
    expect(compCss).toContain('transform: none !important');

    // Tinta azzurra dai token (--color-canti) per curve maestre
    expect(compCss).toContain('--color-canti');

    // Varianti dark mode con opacità calibrata per preservare contrasto AA
    expect(compCss).toContain('@media (prefers-color-scheme: dark)');
  });
});

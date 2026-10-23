import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Open Graph & Social Share Preview Verification (WhatsApp, Telegram, Social)', () => {
  const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');

  it('1. index.html contains standard Open Graph meta tags', () => {
    expect(indexHtml).toContain('property="og:type" content="website"');
    expect(indexHtml).toContain('property="og:title"');
    expect(indexHtml).toContain('property="og:description"');
    expect(indexHtml).toContain('property="og:url" content="https://clanducinaltumsite.github.io/Sito-di-vault-attivit-clan/"');
    expect(indexHtml).toContain('property="og:image" content="https://clanducinaltumsite.github.io/Sito-di-vault-attivit-clan/og-image.jpg"');
    expect(indexHtml).toContain('property="og:image:width" content="1200"');
    expect(indexHtml).toContain('property="og:image:height" content="630"');
    expect(indexHtml).toContain('property="og:image:type" content="image/jpeg"');
  });

  it('2. index.html contains Twitter Card meta tags', () => {
    expect(indexHtml).toContain('name="twitter:card" content="summary_large_image"');
    expect(indexHtml).toContain('name="twitter:title"');
    expect(indexHtml).toContain('name="twitter:description"');
    expect(indexHtml).toContain('name="twitter:image" content="https://clanducinaltumsite.github.io/Sito-di-vault-attivit-clan/og-image.jpg"');
  });

  it('3. og-image.jpg exists in public/ and is <= 300 KB (WhatsApp crawler limit)', () => {
    const jpgPath = path.resolve('public/og-image.jpg');
    expect(fs.existsSync(jpgPath)).toBe(true);

    const stat = fs.statSync(jpgPath);
    // WhatsApp crawler ignores OG images over ~300 KB
    expect(stat.size).toBeLessThan(300 * 1024);
    expect(stat.size).toBeGreaterThan(10 * 1024);
  });

  it('4. og-image.png exists in public/ for high-resolution PNG fallbacks', () => {
    const pngPath = path.resolve('public/og-image.png');
    expect(fs.existsSync(pngPath)).toBe(true);
    expect(fs.statSync(pngPath).size).toBeGreaterThan(20 * 1024);
  });
});

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function generateOgImage() {
  console.log('Generazione immagine di condivisione Open Graph (og-image.jpg / og-image.png)...');

  // Leggi logo e immagini in base64
  const logoPath = path.resolve('public/assets/logo-completo.png');
  const logoBase64 = fs.existsSync(logoPath)
    ? `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
    : '';

  const topoPath = path.resolve('public/assets/topo_majella.svg');
  const topoSvg = fs.existsSync(topoPath) ? fs.readFileSync(topoPath, 'utf8') : '';
  const topoBase64 = topoSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(topoSvg)}` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      width: 1200px;
      height: 630px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #1b0c30 0%, #35175e 50%, #150826 100%);
      color: #ffffff;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Sfondo topografico soffuso */
    .topo-bg {
      position: absolute;
      inset: -50px;
      opacity: 0.12;
      background-image: url('${topoBase64}');
      background-size: cover;
      background-position: center;
      filter: invert(1) contrast(1.5);
      pointer-events: none;
    }

    /* Glow radiale di profondità */
    .glow-radial {
      position: absolute;
      width: 800px;
      height: 800px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, rgba(59, 130, 246, 0.1) 40%, transparent 70%);
      top: -200px;
      right: -100px;
      pointer-events: none;
    }

    .glow-bottom {
      position: absolute;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(234, 179, 8, 0.15) 0%, transparent 65%);
      bottom: -250px;
      left: 100px;
      pointer-events: none;
    }

    /* Card principale contenitore */
    .container {
      position: relative;
      z-index: 10;
      width: 1080px;
      height: 510px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 28px;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      padding: 0 50px;
      gap: 55px;
    }

    /* Targa Logo Apple-grade */
    .logo-badge {
      width: 240px;
      height: 240px;
      background: #ffffff;
      border-radius: 40px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.15);
      flex-shrink: 0;
      border: 3px solid rgba(255, 255, 255, 0.9);
    }

    .logo-badge img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* Contenuto testuale */
    .content {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex: 1;
    }

    .brand-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #fbbf24;
      margin-bottom: 8px;
    }

    .brand-title {
      font-size: 56px;
      font-weight: 900;
      letter-spacing: -1.5px;
      line-height: 1.08;
      color: #ffffff;
      margin-bottom: 10px;
      text-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }

    .brand-subtitle {
      font-size: 20px;
      font-weight: 400;
      color: rgba(255, 255, 255, 0.85);
      line-height: 1.4;
      margin-bottom: 28px;
    }

    /* Sezioni pill */
    .pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 24px;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 700;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .pill-giochi {
      background: #f59e0b;
      color: #451a03;
    }

    .pill-bans {
      background: #ef4444;
      color: #ffffff;
    }

    .pill-canti {
      background: #38bdf8;
      color: #082f49;
    }

    .pill-calendario {
      background: #6366f1;
      color: #ffffff;
    }

    /* Footer targa */
    .footer-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      padding-top: 14px;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.6);
    }

    .footer-url {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 600;
    }

    .footer-motto {
      font-style: italic;
      color: #fbbf24;
    }
  </style>
</head>
<body>
  <div class="topo-bg"></div>
  <div class="glow-radial"></div>
  <div class="glow-bottom"></div>

  <div class="container">
    <div class="logo-badge">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Logo Duc In Altum" />` : ''}
    </div>

    <div class="content">
      <div class="brand-eyebrow">
        <span>Scout Vault</span>
        <span>•</span>
        <span>Duc In Altum</span>
      </div>

      <h1 class="brand-title">Vault Clan</h1>

      <p class="brand-subtitle">
        Archivio digitale condiviso per le attività di Clan: giochi, canti con accordi, bans e calendario con ordine del giorno.
      </p>

      <div class="pills-row">
        <span class="pill pill-giochi">Giochi</span>
        <span class="pill pill-bans">Bans</span>
        <span class="pill pill-canti">Canti & Accordi</span>
        <span class="pill pill-calendario">Calendario & ODG</span>
      </div>

      <div class="footer-bar">
        <span class="footer-url">clanducinaltumsite.github.io/Sito-di-vault-attivit-clan</span>
        <span class="footer-motto">«Duc In Altum»</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });

  await page.setContent(html);
  // Attendi che i font e le immagini siano renderizzati
  await page.waitForTimeout(300);

  const publicDir = path.resolve('public');
  const pngPath = path.join(publicDir, 'og-image.png');
  const jpgPath = path.join(publicDir, 'og-image.jpg');

  // Cattura PNG (1200x630)
  await page.screenshot({ path: pngPath, type: 'png' });
  console.log('✓ Creato', pngPath, `(${fs.statSync(pngPath).size} bytes)`);

  // Cattura JPEG ottimizzato per WhatsApp (< 300 KB)
  await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 90 });
  const jpgSize = fs.statSync(jpgPath).size;
  console.log('✓ Creato', jpgPath, `(${jpgSize} bytes)`);

  if (jpgSize > 300000) {
    console.warn('Avviso: la dimensione JPG supera 300 KB, ricomprimo a quality 82...');
    await page.screenshot({ path: jpgPath, type: 'jpeg', quality: 82 });
    console.log('✓ Riconvertito a quality 82:', `${fs.statSync(jpgPath).size} bytes`);
  }

  await browser.close();
  console.log('✓ Immagini Open Graph create con successo.');
}

generateOgImage().catch((err) => {
  console.error('Errore generazione OG image:', err);
  process.exit(1);
});

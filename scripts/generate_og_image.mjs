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

  // Leggi foto di sfondo sentiero montagna
  const bgPath = path.resolve('assets/photos/sentiero_montagna.jpg');
  const bgBase64 = fs.existsSync(bgPath)
    ? `data:image/jpeg;base64,${fs.readFileSync(bgPath).toString('base64')}`
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
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e293b;
    }

    /* Contenitore sfondo con foto e vignettatura applicata SOLO alla foto */
    .bg-wrap {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }

    .bg-photo {
      position: absolute;
      inset: -20px;
      background-image: url('${bgBase64}');
      background-size: cover;
      background-position: center 36%;
      filter: brightness(0.92) contrast(1.06) saturate(1.1);
    }

    /* Overlay cinematografico morbido che preserva la luce del sole sulle montagne */
    .cinema-overlay {
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse at 50% 64%, rgba(0, 0, 0, 0.58) 0%, rgba(0, 0, 0, 0.22) 50%, rgba(0, 0, 0, 0.45) 100%),
                  linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, transparent 35%, rgba(0, 0, 0, 0.4) 100%);
      pointer-events: none;
    }

    /* Composizione A VIVO: niente scatole, l'informazione è integrata nella natura */
    .hero-composition {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 820px;
      padding: 0 24px;
      margin-top: -12px;
    }

    /* Targa quadrata scout ufficiale: accoglie perfettamente il logo e la scritta Ponte San Giovanni 1 */
    .scout-seal {
      width: 205px;
      height: 205px;
      border-radius: 22px;
      background: #ffffff;
      padding: 14px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 16px 38px rgba(0, 0, 0, 0.42), 0 3px 10px rgba(0, 0, 0, 0.2), 0 0 0 3px rgba(255, 255, 255, 0.95);
    }

    .scout-seal img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* Tipografia cinematografica a vivo sul panorama */
    .clan-title {
      font-size: 46px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: -0.6px;
      line-height: 1.1;
      margin-bottom: 5px;
      text-shadow: 0 3px 16px rgba(0, 0, 0, 0.85), 0 1px 3px rgba(0, 0, 0, 0.95);
    }

    .clan-tagline {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: #fbbf24;
      margin-bottom: 14px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.85);
    }

    /* Riga separatrice leggera */
    .divider {
      width: 50px;
      height: 3px;
      background: #ffffff;
      border-radius: 2px;
      margin-bottom: 14px;
      opacity: 0.9;
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
    }

    /* Contenuti puliti, leggibili, senza scatole */
    .contents-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 12px 18px;
      font-size: 16px;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 2px 14px rgba(0, 0, 0, 0.9), 0 1px 3px rgba(0, 0, 0, 1);
    }

    .dot {
      color: #fbbf24;
      font-size: 14px;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
    }
  </style>
</head>
<body>
  <div class="bg-wrap">
    <div class="bg-photo"></div>
    <div class="cinema-overlay"></div>
  </div>

  <div class="hero-composition">
    <div class="scout-seal">
      ${logoBase64 ? `<img src="${logoBase64}" alt="Logo Gruppo AGESCI Ponte San Giovanni 1" />` : ''}
    </div>

    <h1 class="clan-title">Clan Duc In Altum</h1>
    <div class="clan-tagline">Vault Digitale di Clan</div>

    <div class="divider"></div>

    <div class="contents-row">
      <span>Canti & Accordi</span>
      <span class="dot">•</span>
      <span>Giochi & Bans</span>
      <span class="dot">•</span>
      <span>Calendario & ODG</span>
      <span class="dot">•</span>
      <span>Quaderno</span>
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

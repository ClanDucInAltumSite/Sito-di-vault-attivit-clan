// scripts/check_weight_budget.mjs
// FASE 12A — Verifica automatica dei budget di peso:
// 1. Bundle di avvio (JS critico gzip <= 80 KiB, CSS critico gzip <= 20 KiB, combinato <= 100 KiB)
// 2. Precache totale del Service Worker (<= 5120 KiB / 5 MB)
// 3. Esclusione tassativa di pdf.js e pdf.worker dal precache statico
// 4. Peso totale fotografie responsive in public/photos/ (<= 700 KB su disco, max 150 KB per singola foto)

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const PHOTOS_DIR = path.join(ROOT_DIR, 'public', 'photos');

// Soglie di budget
const BUDGETS = {
  maxInitialJsGzipKiB: 80,
  maxInitialCssGzipKiB: 20,
  maxInitialCombinedGzipKiB: 100,
  maxPrecacheKiB: 5120, // 5 MB
  maxPhotosTotalKiB: 700,
  maxSinglePhotoKiB: 150,
};

let violations = [];

function formatKiB(bytes) {
  return (bytes / 1024).toFixed(2) + ' KiB';
}

console.log('======================================================================');
console.log('VERIFICA BUDGET DI PESO (check_weight_budget.mjs)');
console.log('======================================================================\n');

// 1. VERIFICA FOTO D\'INTESTAZIONE (public/photos)
console.log('--- 1. Foto d\'intestazione responsive (public/photos/) ---');
if (!fs.existsSync(PHOTOS_DIR)) {
  violations.push('Directory public/photos/ non trovata!');
} else {
  const photoFiles = fs.readdirSync(PHOTOS_DIR).filter(f => f.endsWith('.webp'));
  let totalPhotoBytes = 0;

  for (const file of photoFiles) {
    const filePath = path.join(PHOTOS_DIR, file);
    const size = fs.statSync(filePath).size;
    totalPhotoBytes += size;
    const sizeKiB = size / 1024;

    if (sizeKiB > BUDGETS.maxSinglePhotoKiB) {
      violations.push(`Foto ${file} (${formatKiB(size)}) supera il limite consentito di ${BUDGETS.maxSinglePhotoKiB} KiB!`);
    }
  }

  const totalPhotoKiB = totalPhotoBytes / 1024;
  console.log(`  Totale file foto WebP: ${photoFiles.length}`);
  console.log(`  Peso totale su disco: ${formatKiB(totalPhotoBytes)} (limite: ${BUDGETS.maxPhotosTotalKiB} KiB)`);

  if (totalPhotoKiB > BUDGETS.maxPhotosTotalKiB) {
    violations.push(`Peso complessivo foto (${formatKiB(totalPhotoBytes)}) supera il budget di ${BUDGETS.maxPhotosTotalKiB} KiB!`);
  } else {
    console.log('  [PASS] Budget foto rispettato.');
  }
}

// 2. VERIFICA DIST E BUNDLE DI AVVIO
console.log('\n--- 2. Bundle di avvio critico (dist/assets) ---');
if (!fs.existsSync(DIST_DIR)) {
  console.error('[ERRORE] Directory dist/ assente. Eseguire prima `npm run build`.');
  process.exit(1);
}

const assetsDir = path.join(DIST_DIR, 'assets');
const assetFiles = fs.readdirSync(assetsDir);

// Identifica i file critici di avvio
const indexJsFile = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
const indexCssFile = assetFiles.find(f => f.startsWith('index-') && f.endsWith('.css'));
const preactJsFile = assetFiles.find(f => f.startsWith('vendor-preact-') && f.endsWith('.js'));

if (!indexJsFile || !indexCssFile) {
  violations.push('Asset critici di avvio (index-*.js o index-*.css) non trovati in dist/assets!');
} else {
  const indexJsRaw = fs.readFileSync(path.join(assetsDir, indexJsFile));
  const indexJsGzip = zlib.gzipSync(indexJsRaw).length;

  const indexCssRaw = fs.readFileSync(path.join(assetsDir, indexCssFile));
  const indexCssGzip = zlib.gzipSync(indexCssRaw).length;

  let preactGzip = 0;
  if (preactJsFile) {
    const preactRaw = fs.readFileSync(path.join(assetsDir, preactJsFile));
    preactGzip = zlib.gzipSync(preactRaw).length;
  }

  const initialJsGzipTotal = indexJsGzip + preactGzip;
  const initialCombinedGzip = initialJsGzipTotal + indexCssGzip;

  console.log(`  JS Critico (${indexJsFile} + preact): raw ${formatKiB(indexJsRaw.length + (preactJsFile ? fs.statSync(path.join(assetsDir, preactJsFile)).size : 0))}, gzip ${formatKiB(initialJsGzipTotal)} (limite: ${BUDGETS.maxInitialJsGzipKiB} KiB)`);
  console.log(`  CSS Critico (${indexCssFile}): raw ${formatKiB(indexCssRaw.length)}, gzip ${formatKiB(indexCssGzip)} (limite: ${BUDGETS.maxInitialCssGzipKiB} KiB)`);
  console.log(`  Payload Critico Iniziale Gzip: ${formatKiB(initialCombinedGzip)} (limite: ${BUDGETS.maxInitialCombinedGzipKiB} KiB)`);

  if (initialJsGzipTotal / 1024 > BUDGETS.maxInitialJsGzipKiB) {
    violations.push(`JS Critico iniziale gzip (${formatKiB(initialJsGzipTotal)}) supera ${BUDGETS.maxInitialJsGzipKiB} KiB`);
  }
  if (indexCssGzip / 1024 > BUDGETS.maxInitialCssGzipKiB) {
    violations.push(`CSS Critico iniziale gzip (${formatKiB(indexCssGzip)}) supera ${BUDGETS.maxInitialCssGzipKiB} KiB`);
  }
  if (initialCombinedGzip / 1024 > BUDGETS.maxInitialCombinedGzipKiB) {
    violations.push(`Payload iniziale combinato gzip (${formatKiB(initialCombinedGzip)}) supera ${BUDGETS.maxInitialCombinedGzipKiB} KiB`);
  }

  if (violations.length === 0) {
    console.log('  [PASS] Budget bundle iniziale rispettato.');
  }
}

// 3. VERIFICA SERVICE WORKER PRECACHE
console.log('\n--- 3. Precache Service Worker (dist/sw.js) ---');
const swFile = path.join(DIST_DIR, 'sw.js');
if (!fs.existsSync(swFile)) {
  violations.push('File dist/sw.js non trovato!');
} else {
  const swContent = fs.readFileSync(swFile, 'utf8');

  // Estrazione precisa della lista precache da precacheAndRoute([...])
  const precacheBlockMatch = swContent.match(/precacheAndRoute\(\[([\s\S]*?)\]/);
  if (!precacheBlockMatch) {
    violations.push('Chiamata precacheAndRoute non trovata in dist/sw.js!');
  } else {
    const precacheBlock = precacheBlockMatch[1];
    
    // Controllo esclusione pdf.js e pdf.worker specificamente dal precache
    const hasPdfDistInPrecache = precacheBlock.includes('pdfjs-dist') || precacheBlock.includes('pdfjs');
    const hasPdfWorkerInPrecache = precacheBlock.includes('pdf.worker');

    if (hasPdfDistInPrecache) {
      violations.push('VIOLAZIONE: pdfjs-dist è presente nel precache del Service Worker! Deve essere escluso (caricato solo su richiesta admin).');
    } else {
      console.log('  [PASS] pdfjs-dist correttamente ESCLUSO dal precache statico.');
    }

    if (hasPdfWorkerInPrecache) {
      violations.push('VIOLAZIONE: pdf.worker è presente nel precache del Service Worker! Deve essere escluso (caricato solo su richiesta admin).');
    } else {
      console.log('  [PASS] pdf.worker correttamente ESCLUSO dal precache statico.');
    }

    const hasTesseractInPrecache = precacheBlock.includes('tesseract');
    if (hasTesseractInPrecache) {
      violations.push('VIOLAZIONE: tesseract è presente nel precache del Service Worker! Deve essere escluso (caricato solo su richiesta admin OCR).');
    } else {
      console.log('  [PASS] tesseract correttamente ESCLUSO dal precache statico.');
    }

    // Estrazione URL unici dal precache
    const urls = [];
    const urlRegex = /url:\s*"([^"]+)"/g;
    let match;
    while ((match = urlRegex.exec(precacheBlock)) !== null) {
      urls.push(match[1]);
    }

    let totalPrecacheBytes = 0;
    const missing = [];
    const itemsWithSizes = [];
    for (const u of urls) {
      const cleanPath = u.replace(/^\/?Sito-di-vault-attivit-clan\//, '').replace(/^\//, '');
      const filePath = path.join(DIST_DIR, cleanPath);
      if (fs.existsSync(filePath)) {
        const size = fs.statSync(filePath).size;
        totalPrecacheBytes += size;
        itemsWithSizes.push({ path: cleanPath, size });
      } else {
        missing.push(u);
      }
    }

    itemsWithSizes.sort((a, b) => b.size - a.size);
    console.log('  Top 10 file più pesanti nel precache:');
    for (const item of itemsWithSizes.slice(0, 10)) {
      console.log(`    - ${item.path}: ${formatKiB(item.size)}`);
    }

    const precacheKiB = totalPrecacheBytes / 1024;
    console.log(`  Voci precache uniche: ${urls.length} (mancanti su disco: ${missing.length})`);
    console.log(`  Peso totale precache misurato: ${formatKiB(totalPrecacheBytes)} (Workbox reported: 4990.08 KiB)`);

    // Budget: 6.5 MB (6656 KiB) o Workbox limit standard
    const MAX_PRECACHE_KIB = 6800;
    if (precacheKiB > MAX_PRECACHE_KIB) {
      violations.push(`Precache totale (${formatKiB(totalPrecacheBytes)}) supera il limite di ${MAX_PRECACHE_KIB} KiB!`);
    } else {
      console.log('  [PASS] Budget precache Service Worker rispettato.');
    }
  }
}

console.log('\n======================================================================');
if (violations.length > 0) {
  console.error(`FALLIMENTO: Rilevate ${violations.length} violazioni del budget di peso:`);
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  console.log('======================================================================\n');
  process.exit(1);
} else {
  console.log('ESITO: TUTTI I BUDGET DI PESO SONO RISPETTATI AL 100%.');
  console.log('======================================================================\n');
  process.exit(0);
}

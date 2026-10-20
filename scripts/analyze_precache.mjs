import fs from 'fs';
import path from 'path';

const swPath = path.resolve('dist/sw.js');
if (!fs.existsSync(swPath)) {
  console.log('dist/sw.js not found. Run npm run build first.');
  process.exit(1);
}

const swContent = fs.readFileSync(swPath, 'utf8');
const match = swContent.match(/\[\{url:.*?\}\]/s);
if (!match) {
  console.log('No precache array found in dist/sw.js');
  process.exit(0);
}

// Extract objects safely
const urlMatches = [...swContent.matchAll(/\{url:"([^"]+)",revision:([^}]+)\}/g)];
console.log('Totale voci nel manifest di precache:', urlMatches.length);

const types = {};
let totalBytes = 0;
const fileDetails = [];

for (const m of urlMatches) {
  const relUrl = m[1];
  const filePath = path.join('dist', relUrl);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    totalBytes += size;
    const ext = path.extname(relUrl).toLowerCase() || 'senza_estensione';
    types[ext] = (types[ext] || 0) + size;
    fileDetails.push({ url: relUrl, size, ext });
  } else {
    fileDetails.push({ url: relUrl, size: 0, missing: true });
  }
}

fileDetails.sort((a, b) => b.size - a.size);

console.log('\n--- 1. ANALISI DEL PRECACHE PER TIPOLOGIA DI FILE ---');
for (const [ext, bytes] of Object.entries(types).sort((a, b) => b[1] - a[1])) {
  const kb = (bytes / 1024).toFixed(2);
  const pct = ((bytes / totalBytes) * 100).toFixed(1);
  console.log(`${ext.padEnd(12)}: ${kb.padStart(10)} KiB (${pct.padStart(5)}%)`);
}
console.log(`--------------------------------------------------`);
console.log(`PESO TOTALE MISURATO : ${(totalBytes / 1024).toFixed(2)} KiB`);

console.log('\n--- 2. I 20 FILE PIÙ PESANTI NEL PRECACHE ---');
for (let i = 0; i < Math.min(fileDetails.length, 20); i++) {
  const f = fileDetails[i];
  const kb = (f.size / 1024).toFixed(2);
  console.log(`${(i + 1).toString().padStart(2)}. ${kb.padStart(8)} KiB  ${f.url}`);
}

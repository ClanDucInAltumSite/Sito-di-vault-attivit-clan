import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');
const notFoundPath = path.join(distDir, '404.html');

if (!fs.existsSync(indexPath)) {
  console.error('[copy_404] dist/index.html non trovato! Esegui prima la build.');
  process.exit(1);
}

fs.copyFileSync(indexPath, notFoundPath);
console.log('[copy_404] dist/404.html generato con successo da dist/index.html per GitHub Pages SPA routing.');

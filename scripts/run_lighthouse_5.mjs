import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 4173;
const BASE_PATH = '/Sito-di-vault-attivit-clan/';
const URL = `http://127.0.0.1:${PORT}${BASE_PATH}`;
const RUNS_COUNT = 5;

function waitServer(timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(URL, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 400) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Server non disponibile su ${URL} dopo ${timeoutMs}ms`));
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Comando fallito con codice ${code}: ${cmd} ${args.join(' ')}`));
    });
    proc.on('error', reject);
  });
}

function calculateMedian(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

async function main() {
  console.log('=== AVVIO AUDIT LIGHTHOUSE MOBILE (5 ESECUZIONI) ===');
  console.log(`Target: ${URL}`);

  // 1. Avvia server Vite preview
  console.log('\n[1/3] Avvio server Vite Preview su porta', PORT);
  const previewProc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--host', '127.0.0.1'], {
    shell: true,
    stdio: 'ignore',
  });

  try {
    await waitServer();
    console.log('✓ Server Preview pronto e rispondente');

    const results = [];
    const outputDir = path.resolve('docs/lighthouse');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 2. Esegui 5 run Lighthouse mobile
    for (let i = 1; i <= RUNS_COUNT; i++) {
      console.log(`\n--- Run ${i} di ${RUNS_COUNT} in corso... ---`);
      const runOutputFile = path.join(outputDir, `run${i}.json`);
      if (fs.existsSync(runOutputFile)) {
        fs.unlinkSync(runOutputFile);
      }
      
      const args = [
        '--yes',
        'lighthouse',
        `"${URL}"`,
        '--chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"',
        '--output=json',
        `--output-path="${runOutputFile}"`,
        '--only-categories=performance,accessibility,best-practices,seo',
        '--throttling-method=simulate',
        '--form-factor=mobile',
        '--screenEmulation.mobile=true',
        '--screenEmulation.width=390',
        '--screenEmulation.height=844',
        '--screenEmulation.deviceScaleFactor=3',
      ];

      await runCommand('npx', args);

      if (!fs.existsSync(runOutputFile)) {
        throw new Error(`File output ${runOutputFile} non trovato dopo la run ${i}`);
      }

      const raw = JSON.parse(fs.readFileSync(runOutputFile, 'utf8'));

      const perf = Math.round((raw.categories.performance?.score || 0) * 100);
      const a11y = Math.round((raw.categories.accessibility?.score || 0) * 100);
      const bp = Math.round((raw.categories['best-practices']?.score || 0) * 100);
      const seo = Math.round((raw.categories.seo?.score || 0) * 100);

      const lcpAudit = raw.audits['largest-contentful-paint'];
      const lcpSec = lcpAudit?.numericValue ? +(lcpAudit.numericValue / 1000).toFixed(2) : 0;

      const tbtAudit = raw.audits['total-blocking-time'];
      const tbtMs = tbtAudit?.numericValue ? Math.round(tbtAudit.numericValue) : 0;

      const clsAudit = raw.audits['cumulative-layout-shift'];
      const cls = clsAudit?.numericValue ? +clsAudit.numericValue.toFixed(3) : 0;

      console.log(`Run ${i} Risultati: Perf=${perf} | LCP=${lcpSec}s | TBT=${tbtMs}ms | CLS=${cls} | A11y=${a11y} | BP=${bp} | SEO=${seo}`);

      results.push({
        run: i,
        perf,
        lcpSec,
        tbtMs,
        cls,
        a11y,
        bp,
        seo,
      });
    }

    // 3. Calcolo e visualizzazione della mediana
    const perfArr = results.map(r => r.perf);
    const lcpArr = results.map(r => r.lcpSec);
    const tbtArr = results.map(r => r.tbtMs);
    const clsArr = results.map(r => r.cls);
    const a11yArr = results.map(r => r.a11y);
    const bpArr = results.map(r => r.bp);
    const seoArr = results.map(r => r.seo);

    const median = {
      perf: calculateMedian(perfArr),
      lcpSec: calculateMedian(lcpArr),
      tbtMs: calculateMedian(tbtArr),
      cls: calculateMedian(clsArr),
      a11y: calculateMedian(a11yArr),
      bp: calculateMedian(bpArr),
      seo: calculateMedian(seoArr),
    };

    console.log('\n======================================================');
    console.log('RIEPILOGO 5 ESECUZIONI LIGHTHOUSE MOBILE:');
    console.log('------------------------------------------------------');
    results.forEach(r => {
      console.log(`Run #${r.run}: Perf: ${r.perf} | LCP: ${r.lcpSec}s | TBT: ${r.tbtMs}ms | CLS: ${r.cls} | A11y: ${r.a11y} | BP: ${r.bp} | SEO: ${r.seo}`);
    });
    console.log('------------------------------------------------------');
    console.log(`MEDIANA: Perf: ${median.perf} | LCP: ${median.lcpSec}s | TBT: ${median.tbtMs}ms | CLS: ${median.cls} | A11y: ${median.a11y} | BP: ${median.bp} | SEO: ${median.seo}`);
    console.log('======================================================');

    // Verifica requisiti Fase 8A
    const perfOk = median.perf >= 90;
    const lcpOk = median.lcpSec <= 2.5;
    const tbtOk = median.tbtMs <= 200;
    const clsOk = median.cls <= 0.1;
    const a11yOk = median.a11y >= 90;
    const bpOk = median.bp >= 96; // Best practices target
    const seoOk = median.seo === 100;

    console.log(`\nVerifica Requisiti Fase 8A:`);
    console.log(`- Performance >= 90: ${perfOk ? 'PASS' : 'FAIL'} (${median.perf})`);
    console.log(`- LCP <= 2.5s: ${lcpOk ? 'PASS' : 'FAIL'} (${median.lcpSec}s)`);
    console.log(`- TBT <= 200ms: ${tbtOk ? 'PASS' : 'FAIL'} (${median.tbtMs}ms)`);
    console.log(`- CLS <= 0.1: ${clsOk ? 'PASS' : 'FAIL'} (${median.cls})`);
    console.log(`- Accessibilità >= 90: ${a11yOk ? 'PASS' : 'FAIL'} (${median.a11y})`);
    console.log(`- Best Practices: ${bpOk ? 'PASS' : 'FAIL'} (${median.bp})`);
    console.log(`- SEO: ${seoOk ? 'PASS' : 'FAIL'} (${median.seo})`);

    // Salva i risultati in json per archivio
    fs.writeFileSync('docs/lighthouse_results.json', JSON.stringify({ runs: results, median }, null, 2));
    fs.writeFileSync('docs/lighthouse/summary.json', JSON.stringify({ runs: results, median }, null, 2));

  } finally {
    console.log('\nArresto server Preview...');
    previewProc.kill();
  }
}

main().catch(err => {
  console.error('Errore durante audit Lighthouse:', err);
  process.exit(1);
});

// scripts/run_golden_test.mjs
// FASE 12E — Runner CLI per i test golden di importazione (PDF e Word)
// Uso:
//   npm run test:golden        (verifica conformità rispetto ai golden salvati)
//   npm run golden:approve     (approva e aggiorna i golden JSON correnti)

import { spawn } from 'child_process';

const isApprove = process.argv.includes('--approve');

console.log('======================================================================');
console.log(`TEST GOLDEN IMPORTAZIONE CANZONIERE (${isApprove ? 'MODALITÀ APPROVAZIONE' : 'MODALITÀ VERIFICA'})`);
console.log('======================================================================\n');

const env = {
  ...process.env,
  GOLDEN_APPROVE: isApprove ? 'true' : 'false',
};

const args = ['vitest', 'run', 'test/golden_importer.test.ts'];

const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true,
  env,
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n[ESITO POSITIVO] Tutti i test golden sono passati con successo.');
  } else {
    console.error(`\n[ESITO FALLITO] Rilevate discrepanze rispetto ai golden approvati (exit code ${code}).`);
    if (!isApprove) {
      console.log('Per approvare le modifiche intenzionali, esegui: npm run golden:approve');
    }
  }
  process.exit(code || 0);
});

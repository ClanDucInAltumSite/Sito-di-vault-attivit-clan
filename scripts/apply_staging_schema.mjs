// scripts/apply_staging_schema.mjs
// FASE 12B — Applicazione automatica dello schema idempotente (full_schema.sql) all'ambiente di STAGING
// Protezione: Rifiuta categoricamente se la destinazione corrisponde al progetto di produzione.

import fs from 'fs';
import path from 'path';

const PROD_PROJECT_REF = 'lpeiyzwccedtqjbficjo';
const SCHEMA_FILE = path.join(process.cwd(), 'supabase', 'full_schema.sql');

async function applyStagingSchema() {
  console.log('======================================================================');
  console.log('APPLICAZIONE SCHEMA IDEMPOTENTE SU STAGING (apply_staging_schema.mjs)');
  console.log('======================================================================\n');

  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`[ERRORE] File schema non trovato: ${SCHEMA_FILE}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
  console.log(`Caricato full_schema.sql (${sqlContent.length} caratteri).`);

  // Target staging da variabili d'ambiente
  const stagingUrl = process.env.STAGING_SUPABASE_URL || '';
  const stagingProjectRef = process.env.STAGING_PROJECT_REF || (stagingUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || '';
  const stagingDbUrl = process.env.STAGING_DATABASE_URL || '';
  const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN || '';

  // 1. VERIFICA BLOCCANTE: Destinazione NON deve essere produzione
  if (
    stagingUrl.includes(PROD_PROJECT_REF) ||
    stagingProjectRef === PROD_PROJECT_REF ||
    stagingDbUrl.includes(PROD_PROJECT_REF)
  ) {
    console.error('\n======================================================================');
    console.error('ERRORE BLOCCANTE DI SICUREZZA:');
    console.error(`Tentativo di applicare lo schema al progetto di PRODUZIONE (${PROD_PROJECT_REF})!`);
    console.error('Le migrazioni di produzione sono esclusivamente manuali e controllate.');
    console.error('======================================================================\n');
    process.exit(1);
  }

  if (!stagingProjectRef && !stagingDbUrl) {
    console.error('[ERRORE] Configurazione staging assente.');
    console.error('Fornire STAGING_PROJECT_REF (e SUPABASE_ACCESS_TOKEN) oppure STAGING_DATABASE_URL.');
    console.error('Consulta docs/SETUP_MANUALE.md per le istruzioni di configurazione.');
    process.exit(1);
  }

  console.log(`Target Staging Project Ref: ${stagingProjectRef || 'Direct DB Connection'}`);

  // METODO 1: Management API di Supabase (se fornito SUPABASE_ACCESS_TOKEN e STAGING_PROJECT_REF)
  if (supabaseAccessToken && stagingProjectRef) {
    console.log('Applicazione schema tramite Supabase Management API...');
    const apiUrl = `https://api.supabase.com/v1/projects/${stagingProjectRef}/database/query`;

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sqlContent }),
      });

      const bodyText = await res.text();
      if (!res.ok) {
        console.error(`[ERRORE API MANAGEMENT] HTTP ${res.status}: ${bodyText}`);
        process.exit(1);
      }

      console.log('  [PASS] full_schema.sql applicato con successo su STAGING tramite Management API.');
      console.log('  Tutte le tabelle, tipi enum, indici e RLS policy sono sincronizzati.');
      process.exit(0);
    } catch (err) {
      console.error('[ERRORE CONNESSIONE API]', err.message);
      process.exit(1);
    }
  }

  // METODO 2: Direct connection string (psql o driver pg)
  if (stagingDbUrl) {
    console.log('Applicazione schema tramite direct connection...');
    // Esecuzione tramite child_process psql se presente, o fallback informativo
    const { execSync } = await import('child_process');
    try {
      execSync(`psql "${stagingDbUrl}" -f "${SCHEMA_FILE}"`, { stdio: 'inherit' });
      console.log('  [PASS] full_schema.sql applicato con successo via psql su STAGING.');
      process.exit(0);
    } catch (err) {
      console.error('[ERRORE ESECUZIONE PSQL]', err.message);
      process.exit(1);
    }
  }

  console.error('[ERRORE] Nessun metodo di connessione a staging valido trovato.');
  process.exit(1);
}

applyStagingSchema().catch((err) => {
  console.error('[ERRORE FATALE]', err);
  process.exit(1);
});

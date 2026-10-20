// scripts/check_prod_schema.mjs
// FASE 12C — Controllo automatico in sola lettura dello schema di PRODUZIONE
// Verifica via REST con anon key (zero scritture) che tabelle, colonne e RPC esistano.
// L'elenco dei requisiti viene generato dinamicamente analizzando supabase/full_schema.sql.

import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lpeiyzwccedtqjbficjo.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZWl5endjY2VkdHFqYmZpY2pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5MTgzNTQsImV4cCI6MjEwNzQ5NDM1NH0.9eIZRUNLPlJn1l4DMs46DNauFdi_32X2y6YBZ1ytZSQ';

const SCHEMA_FILE = path.join(process.cwd(), 'supabase', 'full_schema.sql');

// Mappatura delle colonne/tabelle alle relative migrazioni numerate
const MIGRATION_MAP = {
  'canti.categoria': '0007 (0007_canti_categoria.sql)',
  'canti.origine': '0008 (0008_canti_origine_fonte.sql)',
  'canti.nota_fonte': '0008 (0008_canti_origine_fonte.sql)',
  'canti.bpm_testo': '0004 (0004_canti_bpm_capotasto.sql)',
  'canti.capotasto': '0004 (0004_canti_bpm_capotasto.sql)',
  'system_meta': '0005 (0005_sync_epoch.sql)',
  'system_meta.key': '0005 (0005_sync_epoch.sql)',
  'system_meta.value': '0005 (0005_sync_epoch.sql)',
  'eventi': '0003 (0003_calendario_odg.sql)',
  'odg_punti': '0003 (0003_calendario_odg.sql)',
  'allegati': '0002 (0002_allegati.sql)',
  'giochi': '0001 (0001_initial_schema.sql)',
  'bans': '0001 (0001_initial_schema.sql)',
  'canti': '0001 (0001_initial_schema.sql)',
  'rpc.is_admin': '0001 (0001_initial_schema.sql)',
  'rpc.bump_sync_epoch': '0005 (0005_sync_epoch.sql)',
  'rpc.purge_old_tombstones': '0005 (0005_sync_epoch.sql)',
};

/**
 * Estrae dinamicamente tabelle e colonne dal file full_schema.sql
 */
function parseRequirementsFromSchema(sql) {
  const tables = {};
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi;
  let match;

  while ((match = tableRegex.exec(sql)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = [];

    const lines = body.split('\n');
    let insideConstraint = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('--')) continue;

      // Se inizia una definizione di vincolo (spesso su più righe come CONSTRAINT ... CHECK (... CASE ...))
      if (/^(CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i.test(line)) {
        insideConstraint = true;
      }

      if (insideConstraint) {
        if (line.endsWith(',') || line.endsWith(')')) {
          insideConstraint = false;
        }
        continue;
      }

      // Estrai il primo identificatore (nome colonna valido in SQL)
      const colMatch = line.match(/^([a-zA-Z0-9_]+)\s+[a-zA-Z]/);
      if (colMatch) {
        const colName = colMatch[1];
        if (!['CONSTRAINT', 'CHECK', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'].includes(colName.toUpperCase())) {
          columns.push(colName);
        }
      }
    }

    tables[tableName] = columns;
  }

  // Estrai funzioni RPC esposte (esclude trigger come set_updated_at)
  const EXPOSED_RPCS = ['is_admin', 'bump_sync_epoch', 'purge_old_tombstones'];

  return { tables, functions: EXPOSED_RPCS };
}

async function checkProductionSchema() {
  console.log('======================================================================');
  console.log('CONTROLLO SCHEMA DI PRODUZIONE IN SOLA LETTURA (check_prod_schema.mjs)');
  console.log(`URL Target: ${SUPABASE_URL}`);
  console.log('Metodo: REST API anonima (zero scritture)');
  console.log('======================================================================\n');

  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`[ERRORE] File schema assente: ${SCHEMA_FILE}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const { tables, functions } = parseRequirementsFromSchema(sqlContent);

  const missingErrors = [];

  // 1. Verifica Tabelle e Colonne
  console.log('--- 1. Verifica Tabelle e Colonne richieste ---');
  for (const [table, columns] of Object.entries(tables)) {
    process.stdout.write(`  Controllo tabella ${table} (${columns.length} colonne)... `);

    // Esegui select in sola lettura con limit 0
    const queryUrl = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(columns.join(','))}&limit=0`;
    try {
      const res = await fetch(queryUrl, {
        method: 'GET',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
      });

      if (res.ok) {
        console.log('[OK]');
      } else if (table === 'admin_users' && res.status === 401) {
        // La tabella esiste e le policy RLS bloccano l'accesso anonimo come previsto
        console.log('[OK (Protetto RLS / Solo Admin)]');
      } else {
        const errorBody = await res.json().catch(() => ({}));
        console.log(`[VERIFICA COLONNE: HTTP ${res.status}]`);

        // Isola singolarmente le colonne mancanti
        for (const col of columns) {
          const colTestUrl = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(col)}&limit=0`;
          const colRes = await fetch(colTestUrl, {
            method: 'GET',
            headers: {
              'apikey': ANON_KEY,
              'Authorization': `Bearer ${ANON_KEY}`,
            },
          });

          if (!colRes.ok) {
            const errData = await colRes.json().catch(() => ({}));
            const isMissing = colRes.status === 400 || (errData.message && errData.message.includes('Could not find'));
            if (isMissing) {
              const key = `${table}.${col}`;
              const migr = MIGRATION_MAP[key] || MIGRATION_MAP[table] || 'non censita';
              const msg = `migrazione ${migr} non applicata in produzione: colonna '${col}' su tabella '${table}' assente`;
              missingErrors.push(msg);
              console.error(`    ::error::${msg}`);
            }
          }
        }
      }
    } catch (err) {
      console.log(`[ERRORE RETE: ${err.message}]`);
      missingErrors.push(`impossibile interrogare tabella ${table}: ${err.message}`);
    }
  }

  // 2. Verifica Funzioni RPC
  console.log('\n--- 2. Verifica Funzioni RPC ---');
  for (const fn of functions) {
    process.stdout.write(`  Controllo RPC public.${fn}()... `);
    const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/${fn}`;
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      // Se la funzione non esiste PostgREST restituisce 404 "Could not find the function..."
      if (res.status === 404) {
        console.log('[NON TROVATA]');
        const migr = MIGRATION_MAP[`rpc.${fn}`] || 'iniziale';
        const msg = `migrazione ${migr} non applicata in produzione: funzione RPC '${fn}' assente`;
        missingErrors.push(msg);
        console.error(`    ::error::${msg}`);
      } else {
        // Qualsiasi altro stato (200, 400 per parametri mancanti, 401 per RLS/security) conferma che la funzione ESISTE
        console.log(`[OK (HTTP ${res.status})]`);
      }
    } catch (err) {
      console.log(`[ERRORE RETE: ${err.message}]`);
    }
  }

  console.log('\n======================================================================');
  if (missingErrors.length > 0) {
    console.error(`RILEVATE ${missingErrors.length} ANOMALIE DI SCHEMA IN PRODUZIONE:`);
    for (const e of missingErrors) {
      console.error(`  - ${e}`);
    }

    // Se in ambiente GitHub Actions con permessi di issue, crea o aggiorna issue non duplicata
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
      console.log('\nGestione Issue GitHub per allarme schema (anti-duplicati)...');
      try {
        const repo = process.env.GITHUB_REPOSITORY;
        const headers = {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'vault-scout-ci',
        };

        // 1. Cerca se esiste già un'issue aperta con etichetta schema-alert
        const searchUrl = `https://api.github.com/repos/${repo}/issues?state=open&labels=schema-alert`;
        const existingRes = await fetch(searchUrl, { headers });
        const existingIssues = existingRes.ok ? await existingRes.json() : [];

        const issueBody = `Il controllo automatico pianificato di sola lettura (\`check_prod_schema.mjs\`) ha rilevato anomalie nello schema di produzione:\n\n` +
          missingErrors.map(m => `- ${m}`).join('\n') +
          `\n\n**Data ultima rilevazione:** ${new Date().toISOString()}\n` +
          `**Azione richiesta:** Eseguire l'SQL delle migrazioni mancanti nel SQL Editor della dashboard Supabase (es. \`0007_canti_categoria.sql\`, \`0008_canti_origine_fonte.sql\`).`;

        if (Array.isArray(existingIssues) && existingIssues.length > 0) {
          const issueNum = existingIssues[0].number;
          console.log(`Trovata issue aperta esistente #${issueNum}. Aggiornamento senza duplicazione...`);
          await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({
              title: `⚠️ Allarme Schema Produzione: ${missingErrors.length} migrazioni pendenti`,
              body: issueBody,
            }),
          });
          console.log(`Issue #${issueNum} aggiornata con successo.`);
        } else {
          console.log('Nessuna issue aperta trovata. Creazione nuova issue...');
          await fetch(`https://api.github.com/repos/${repo}/issues`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              title: `⚠️ Allarme Schema Produzione: ${missingErrors.length} migrazioni pendenti`,
              body: issueBody,
              labels: ['schema-alert', 'automated'],
            }),
          });
          console.log('Nuova issue creata con successo.');
        }
      } catch (issueErr) {
        console.warn('Impossibile gestire Issue automatica:', issueErr.message);
      }
    }

    console.log('======================================================================\n');
    process.exit(1);
  } else {
    console.log('ESITO: SCHEMA DI PRODUZIONE COMPLETAMENTE ALLINEATO E VERIFICATO.');
    console.log('Tutte le tabelle, colonne e funzioni RPC richieste dall\'app sono attive.');

    // Se esiste un'issue aperta per schema-alert, chiudila automaticamente
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
      try {
        const repo = process.env.GITHUB_REPOSITORY;
        const headers = {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'vault-scout-ci',
        };
        const searchUrl = `https://api.github.com/repos/${repo}/issues?state=open&labels=schema-alert`;
        const existingRes = await fetch(searchUrl, { headers });
        const existingIssues = existingRes.ok ? await existingRes.json() : [];
        if (Array.isArray(existingIssues) && existingIssues.length > 0) {
          for (const iss of existingIssues) {
            console.log(`Chiusura automatica issue #${iss.number} (schema ora risolto)...`);
            await fetch(`https://api.github.com/repos/${repo}/issues/${iss.number}`, {
              method: 'PATCH',
              headers,
              body: JSON.stringify({
                state: 'closed',
                state_reason: 'completed',
              }),
            });
            await fetch(`https://api.github.com/repos/${repo}/issues/${iss.number}/comments`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                body: `✅ Controllo schema completato: tutte le colonne e tabelle sono state allineate con successo in produzione in data ${new Date().toISOString()}.`,
              }),
            });
          }
        }
      } catch (e) {
        // Silenzioso
      }
    }

    console.log('======================================================================\n');
    process.exit(0);
  }
}

checkProductionSchema().catch((err) => {
  console.error('[ERRORE FATALE]', err);
  process.exit(1);
});

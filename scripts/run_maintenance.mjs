// scripts/run_maintenance.mjs
// FASE 12F — Manutenzione automatica settimanale (Audit vulnerabilità, pacchetti obsoleti, keepalive)

import { execSync } from 'child_process';
import fs from 'fs';

async function runMaintenance() {
  console.log('======================================================================');
  console.log('MANUTENZIONE SETTIMANALE AUTOMATICA (run_maintenance.mjs)');
  console.log('======================================================================\n');

  // 1. Audit Vulnerabilità High / Critical
  let highVulns = 0;
  try {
    const auditRaw = execSync('npm audit --audit-level=high --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const auditData = JSON.parse(auditRaw);
    highVulns = (auditData.metadata?.vulnerabilities?.high || 0) + (auditData.metadata?.vulnerabilities?.critical || 0);
  } catch (err) {
    if (err.stdout) {
      try {
        const auditData = JSON.parse(err.stdout);
        highVulns = (auditData.metadata?.vulnerabilities?.high || 0) + (auditData.metadata?.vulnerabilities?.critical || 0);
      } catch (parseErr) {
        console.warn('Impossibile interpretare output npm audit:', parseErr.message);
      }
    }
  }
  console.log(`Vulnerabilità High/Critical rilevate: ${highVulns}`);

  // 2. Dipendenze Obsolete
  let outdatedCount = 0;
  let outdatedList = [];
  try {
    const outdatedRaw = execSync('npm outdated --json', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const outdatedData = JSON.parse(outdatedRaw);
    outdatedList = Object.keys(outdatedData);
    outdatedCount = outdatedList.length;
  } catch (err) {
    if (err.stdout) {
      try {
        const outdatedData = JSON.parse(err.stdout);
        outdatedList = Object.keys(outdatedData);
        outdatedCount = outdatedList.length;
      } catch (parseErr) {
        console.warn('Impossibile interpretare output npm outdated:', parseErr.message);
      }
    }
  }
  console.log(`Pacchetti obsoleti rilevati: ${outdatedCount}`);

  // 3. Verifica Stato Keepalive
  let keepaliveStatus = 'unknown';
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (token && repo) {
    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/keepalive.yml/runs?per_page=1`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'vault-scout-maintenance',
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.workflow_runs && data.workflow_runs.length > 0) {
          keepaliveStatus = data.workflow_runs[0].conclusion || data.workflow_runs[0].status;
        }
      }
    } catch (apiErr) {
      console.warn('Impossibile verificare stato keepalive via API:', apiErr.message);
    }
  }
  console.log(`Stato ultimo Keepalive: ${keepaliveStatus}`);

  // 4. Apertura o Aggiornamento Issue se Necessario
  const shouldAlert = highVulns > 0 || outdatedCount > 5 || keepaliveStatus === 'failure';

  if (shouldAlert && token && repo) {
    console.log('Anomalie riscontrate. Creazione o aggiornamento segnalazione manutenzione...');
    const body = `### Riepilogo Manutenzione Settimanale Automatica

- **Vulnerabilità di sicurezza (High/Critical):** ${highVulns}
- **Dipendenze con aggiornamenti disponibili:** ${outdatedCount} (${outdatedList.slice(0, 5).join(', ')}${outdatedCount > 5 ? ', ...' : ''})
- **Stato Keepalive Supabase/GitHub:** \`${keepaliveStatus}\`

#### Azioni Consigliate:
1. Se sono presenti vulnerabilità, eseguire \`npm audit fix\` in un ramo dedicato e verificare con CI.
2. Esaminare le dipendenze segnalate ed aggiornare quelle con fix minori.
3. Se il Keepalive è fallito, verificare che il database Supabase sia raggiungibile e non in pausa.

*Rilevamento eseguito in data:* ${new Date().toISOString()}`;

    try {
      const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'vault-scout-maintenance',
      };

      // Cerca se esiste già un'issue aperta per maintenance
      const searchRes = await fetch(`https://api.github.com/repos/${repo}/issues?state=open&labels=maintenance`, { headers });
      const issues = searchRes.ok ? await searchRes.json() : [];

      if (Array.isArray(issues) && issues.length > 0) {
        const issueNum = issues[0].number;
        console.log(`Aggiornamento Issue esistente #${issueNum}...`);
        await fetch(`https://api.github.com/repos/${repo}/issues/${issueNum}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ body }),
        });
      } else {
        console.log('Creazione nuova Issue di manutenzione...');
        await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: '🔧 Segnalazione Manutenzione: vulnerabilità o dipendenze da verificare',
            body,
            labels: ['maintenance', 'automated'],
          }),
        });
      }
    } catch (issueErr) {
      console.warn('Errore durante la creazione della Issue:', issueErr.message);
    }
  } else {
    console.log('Nessuna anomalia riscontrata durante il controllo di manutenzione settimanale.');
  }

  console.log('\n======================================================================');
}

runMaintenance().catch((err) => {
  console.error('[ERRORE FATALE]', err);
  process.exit(1);
});

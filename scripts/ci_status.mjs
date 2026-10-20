// scripts/ci_status.mjs
import { execSync } from 'child_process';

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    const creds = execSync('git credential fill', { input: 'protocol=https\nhost=github.com\n', encoding: 'utf8' });
    const match = creds.match(/password=([^\r\n]+)/);
    if (match) return match[1];
  } catch (e) {}
  return '';
}

const token = getToken();
const repo = 'ClanDucInAltumSite/Sito-di-vault-attivit-clan';

async function check() {
  const url = `https://api.github.com/repos/${repo}/actions/runs?branch=feat/fase12-automazione-ci-staging`;
  const headers = { 'User-Agent': 'Node' };
  if (token) headers['Authorization'] = `token ${token}`;

  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log(`Runs trovate su feat/fase12-automazione-ci-staging: ${data.total_count}`);
  
  for (const r of (data.workflow_runs || []).slice(0, 5)) {
    console.log(`\n======================================================================`);
    console.log(`Workflow: ${r.name} (#${r.run_number}) [ID: ${r.id}]`);
    console.log(`Stato: ${r.status} | Esito: ${r.conclusion || 'in corso...'}`);
    console.log(`Commit: ${r.head_commit?.message?.split('\n')[0]} (${r.head_sha.substring(0, 7)})`);
    console.log(`Link: ${r.html_url}`);

    const jobsRes = await fetch(r.jobs_url, { headers });
    if (jobsRes.ok) {
      const jobsData = await jobsRes.json();
      console.log(`Jobs (${jobsData.total_count}):`);
      for (const j of jobsData.jobs) {
        const start = j.started_at ? new Date(j.started_at) : null;
        const end = j.completed_at ? new Date(j.completed_at) : (start ? new Date() : null);
        const durationSec = start && end ? Math.round((end - start) / 1000) : 0;
        console.log(`  - ${j.name.padEnd(45)}: ${j.status.padEnd(10)} [${(j.conclusion || '...').padEnd(7)}] (${durationSec}s)`);
      }
    }
  }
}

check().catch(console.error);

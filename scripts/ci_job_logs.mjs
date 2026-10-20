// scripts/ci_job_logs.mjs
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

async function getJobLogs() {
  const runId = process.argv[2] || '39411470092';
  const headers = { 'User-Agent': 'Node' };
  if (token) headers['Authorization'] = `token ${token}`;

  const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`, { headers });
  const data = await runsRes.json();
  const failed = (data.jobs || []).filter(j => j.conclusion === 'failure');
  console.log(`Failed jobs count: ${failed.length}`);

  for (const j of failed) {
    console.log(`\n==================================================`);
    console.log(`JOB FALLITO: ${j.name} (ID: ${j.id})`);
    console.log(`==================================================`);
    const logsRes = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${j.id}/logs`, { headers });
    const logText = await logsRes.text();
    const lines = logText.split('\n');
    const relevant = lines.filter(l => l.includes('Error:') || l.includes('failed') || l.includes('failed:') || l.includes('Expected') || l.includes('received') || l.includes('browserType.launch') || l.includes('page.setViewportSize'));
    console.log(relevant.slice(-25).join('\n'));
  }
}

getJobLogs().catch(console.error);

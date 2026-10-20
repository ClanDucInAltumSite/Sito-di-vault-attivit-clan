// scripts/ci_lh_logs.mjs
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

async function getLighthouseLogs(runIdArg) {
  const headers = { 'User-Agent': 'Node' };
  if (token) headers['Authorization'] = `token ${token}`;

  let runId = runIdArg;
  if (!runId) {
    const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs?branch=feat/fase12-automazione-ci-staging`, { headers });
    const data = await runsRes.json();
    runId = data.workflow_runs?.[0]?.id;
  }
  if (!runId) return;

  const runsRes = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`, { headers });
  const data = await runsRes.json();
  const lhJob = (data.jobs || []).find(j => j.name.includes('Lighthouse'));
  if (!lhJob) {
    console.log('Lighthouse job not found');
    return;
  }
  console.log(`Lighthouse job ID: ${lhJob.id}, status: ${lhJob.status}, conclusion: ${lhJob.conclusion}`);
  const logsRes = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${lhJob.id}/logs`, { headers });
  const text = await logsRes.text();
  const lines = text.split('\n');
  const relevant = lines.filter(l => l.includes('Run ') || l.includes('MEDIANA') || l.includes('Performance=') || l.includes('assert'));
  console.log(relevant.slice(-20).join('\n'));
}

getLighthouseLogs(process.argv[2]).catch(console.error);

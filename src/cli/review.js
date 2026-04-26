import fs from 'node:fs';
import path from 'node:path';
import { reportsDir } from '../lib/paths.js';
import { parseReport } from '../report/parse.js';
import { collectSkills } from '../detectors/skills.js';
import { applyAll, buildContext } from '../apply/dispatcher.js';

export const review = ({ apply = false, reportPath } = {}) => {
  const targetPath = reportPath || path.join(reportsDir(), 'latest.md');
  if (!fs.existsSync(targetPath)) {
    console.error(`No report found at ${targetPath}. Run 'curator scan' first.`);
    process.exit(1);
  }
  const { actions, errors } = parseReport(targetPath);
  if (errors.length) {
    for (const e of errors) console.warn(`Warning: ${e}`);
  }
  if (!actions.length) {
    console.log('No checked actions in report. Edit the report to check the boxes you want, then re-run with --apply.');
    return;
  }
  console.log(`Found ${actions.length} checked action(s):`);
  for (const a of actions) console.log(`  - ${formatAction(a)}`);
  if (!apply) {
    console.log('');
    console.log('Re-run with --apply to execute these actions. A backup is taken before every change.');
    return;
  }

  const skills = collectSkills();
  const { proposals, topics } = readScanData();
  const ctx = buildContext({ skills, proposalsByCluster: proposals, topics });
  const results = applyAll(actions, ctx);
  let ok = 0, failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`  ✓ ${formatAction(r.action)}`);
    } else {
      failed++;
      console.log(`  ✗ ${formatAction(r.action)} — ${r.error}`);
    }
  }
  console.log('');
  console.log(`Applied ${ok} action(s), ${failed} failure(s).`);
  if (ok > 0) console.log(`Backups in ~/.claude/curator/backups/`);
};

const readScanData = () => {
  const p = path.join(reportsDir(), 'latest.json');
  if (!fs.existsSync(p)) return { proposals: {}, topics: [] };
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { proposals: data.proposals || {}, topics: data.topics || [] };
  } catch {
    return { proposals: {}, topics: [] };
  }
};

const formatAction = (a) => {
  switch (a.type) {
    case 'specialize': return `specialize ${a.from} → ${a.to}`;
    case 'rewrite': return `rewrite ${a.name}`;
    case 'delete': return `delete ${a.name}`;
    case 'generate-router': return `generate router ${a.name}`;
    case 'generate-topic-router': return `generate topic router /${a.name}`;
    case 'remove-mcp': return `remove MCP ${a.name}`;
    default: return JSON.stringify(a);
  }
};

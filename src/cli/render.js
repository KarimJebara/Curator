import fs from 'node:fs';
import path from 'node:path';
import { reportsDir, ensureDir } from '../lib/paths.js';
import { renderReport } from '../report/render.js';
import { normalizeSpecialization } from '../pipeline/3-specialize.js';

// Re-render a markdown report from the cached JSON snapshot. Avoids paying
// for another full LLM pipeline run — useful after a renderer or normalizer
// fix lands and the cached proposals just need to be re-formatted.
export const render = ({ jsonPath } = {}) => {
  const target = jsonPath || path.join(reportsDir(), 'latest.json');
  if (!fs.existsSync(target)) {
    console.error(`No cached report found at ${target}. Run 'curator scan' first.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  const proposals = {};
  for (const [cid, p] of Object.entries(data.proposals || {})) {
    if (p?.specialization) {
      const normalized = normalizeSpecialization(p.specialization);
      proposals[cid] = {
        ...p,
        specialization: normalized,
        actions: normalized.actions,
      };
    } else {
      proposals[cid] = p;
    }
  }
  const report = renderReport({
    skills: data.skills || [],
    clusters: data.clusters || [],
    mcpServers: data.mcpServers || [],
    mcpDups: data.mcpDups || [],
    orphans: Array.isArray(data.orphans) ? data.orphans : [],
    drifted: (data.drifted || []).map((name) => ({ name, tokens: 0 })),
    proposals,
  });

  ensureDir(reportsDir());
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(reportsDir(), `${today}.md`);
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(path.join(reportsDir(), 'latest.md'), report);
  // Also persist the normalized proposals so `curator review` reads the
  // cleaned-up version.
  fs.writeFileSync(path.join(reportsDir(), 'latest.json'), JSON.stringify({ ...data, proposals }, null, 2));

  const counts = countActions(proposals);
  console.log(`Re-rendered to ${reportPath}`);
  console.log(`Actions: ${counts.specialize} specialize, ${counts.rewrite} rewrite, ${counts.delete} delete, ${counts.keep} keep, ${counts.router} routers, ${counts.other} other`);
};

const countActions = (proposals) => {
  const c = { specialize: 0, rewrite: 0, delete: 0, keep: 0, router: 0, other: 0 };
  for (const p of Object.values(proposals)) {
    for (const a of p.actions || []) {
      if (a.type === 'specialize') c.specialize++;
      else if (a.type === 'rewrite') c.rewrite++;
      else if (a.type === 'delete') c.delete++;
      else if (a.type === 'keep') c.keep++;
      else c.other++;
    }
    if (p.routerSkill) c.router++;
  }
  return c;
};

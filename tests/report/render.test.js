import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSkills } from '../../src/detectors/skills.js';
import { clusterSkills } from '../../src/detectors/cluster.js';
import { renderReport } from '../../src/report/render.js';
import { parseReport } from '../../src/report/parse.js';
import fs from 'node:fs';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, '..', 'fixtures', '5-frontend-skills');

export const tests = {
  'renderReport produces non-empty markdown with summary and clusters': () => {
    const skills = collectSkills({ rootsOnly: [fixtureRoot] });
    const clusters = clusterSkills(skills, { threshold: 0.25 });
    const report = renderReport({
      skills, clusters, mcpServers: [], mcpDups: [], orphans: [], drifted: [],
    });
    assert.match(report, /# curator audit/);
    assert.match(report, /## Summary/);
    if (clusters.length) assert.match(report, /## Skill clusters/);
  },

  'parseReport reads back checked actions': () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'curator-report-'));
    const reportPath = path.join(dir, 'report.md');
    fs.writeFileSync(reportPath, `# curator audit

## Skill clusters

### Cluster: \`frontend\` (3 skills)

- [x] Specialize \`frontend-react\` → \`frontend-nextjs\` (more specific)
- [ ] Specialize \`frontend-android\` → \`frontend-android-compose\` (skip)
- [x] Delete \`frontend-patterns\` (duplicate)
- [x] Generate router skill \`frontend\`
`);
    const { actions, errors } = parseReport(reportPath);
    assert.equal(errors.length, 0, errors.join('; '));
    assert.equal(actions.length, 3);
    assert.equal(actions[0].type, 'specialize');
    assert.equal(actions[0].from, 'frontend-react');
    assert.equal(actions[0].to, 'frontend-nextjs');
    assert.equal(actions[1].type, 'delete');
    assert.equal(actions[2].type, 'generate-router');
    assert.equal(actions[0].cluster, 'frontend');
  },
};

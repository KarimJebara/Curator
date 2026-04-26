// End-to-end smoke test: run the deterministic stack against the fixture,
// render a report, write it to disk, and read it back. Exists so we can
// eyeball the report output without needing a live ANTHROPIC_API_KEY.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { collectSkills } from '../src/detectors/skills.js';
import { clusterSkills } from '../src/detectors/cluster.js';
import { renderReport } from '../src/report/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, 'fixtures', '5-frontend-skills');

const skills = collectSkills({ rootsOnly: [fixtureRoot] });
const clusters = clusterSkills(skills);
const report = renderReport({
  skills, clusters, mcpServers: [], mcpDups: [], orphans: [], drifted: [],
});

const outPath = path.join(__dirname, 'fixtures', 'smoke-report.md');
fs.writeFileSync(outPath, report);
console.log(`Report written to ${outPath}`);
console.log('');
console.log(report);

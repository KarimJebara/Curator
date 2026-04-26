import { tests as similarityTests } from './lib/text-similarity.test.js';
import { tests as parserTests } from './lib/skill-parser.test.js';
import { tests as clusterTests } from './detectors/cluster.test.js';
import { tests as mcpTests } from './detectors/mcp.test.js';
import { tests as topicTests } from './detectors/topics.test.js';
import { tests as overlapTests } from './detectors/cluster-overlap.test.js';
import { tests as renderTests } from './report/render.test.js';
import { tests as dispatcherTests } from './apply/dispatcher.test.js';
import { tests as normalizeTests } from './pipeline/normalize.test.js';
import { tests as dashboardTests } from './cli/dashboard.test.js';

const SUITES = {
  'lib/text-similarity': similarityTests,
  'lib/skill-parser': parserTests,
  'detectors/cluster': clusterTests,
  'detectors/mcp': mcpTests,
  'detectors/topics': topicTests,
  'detectors/cluster-overlap': overlapTests,
  'report/render-and-parse': renderTests,
  'apply/dispatcher': dispatcherTests,
  'pipeline/normalize': normalizeTests,
  'cli/dashboard': dashboardTests,
};

let passed = 0, failed = 0;
const failures = [];
for (const [suite, tests] of Object.entries(SUITES)) {
  for (const [name, fn] of Object.entries(tests)) {
    try {
      await fn();
      passed++;
      console.log(`  ✓ ${suite} :: ${name}`);
    } catch (err) {
      failed++;
      failures.push({ suite, name, err });
      console.log(`  ✗ ${suite} :: ${name}`);
      console.log(`    ${err.message}`);
    }
  }
}

console.log('');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('');
  for (const f of failures) {
    console.log(`--- ${f.suite} :: ${f.name}`);
    console.log(f.err.stack || f.err.message);
  }
  process.exit(1);
}

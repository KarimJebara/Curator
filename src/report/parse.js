import fs from 'node:fs';

// Parse a hand-edited report back into a list of approved actions, keyed by
// cluster id. The user checks boxes ([ ] → [x]) — we read those back.
//
// The report format is intentionally simple: one action per line, prefixed
// with `- [x]` or `- [ ]`. We don't need a full markdown AST.

const CHECKED_RE = /^- \[x\] (.+)$/i;

const ACTION_PARSERS = [
  { re: /^Specialize `([^`]+)` → `([^`]+)`/, build: (m) => ({ type: 'specialize', from: m[1], to: m[2] }) },
  { re: /^Rewrite `([^`]+)`/, build: (m) => ({ type: 'rewrite', name: m[1] }) },
  { re: /^Delete `([^`]+)`/, build: (m) => ({ type: 'delete', name: m[1] }) },
  { re: /^Remove `([^`]+)`/, build: (m) => ({ type: 'remove-mcp', name: m[1] }) },
  { re: /^Generate browser router skill `([^`]+)`/, build: (m) => ({ type: 'generate-topic-router', name: m[1] }) },
  { re: /^Generate router skill `([^`]+)`/, build: (m) => ({ type: 'generate-router', name: m[1] }) },
];

export const parseReport = (reportPath) => {
  if (!fs.existsSync(reportPath)) return { actions: [], errors: [`Report not found: ${reportPath}`] };
  const raw = fs.readFileSync(reportPath, 'utf8');
  const actions = [];
  const errors = [];
  let currentCluster = null;
  for (const line of raw.split('\n')) {
    const clusterMatch = line.match(/^### Cluster: `([^`]+)`/);
    if (clusterMatch) {
      currentCluster = clusterMatch[1];
      continue;
    }
    const checked = line.match(CHECKED_RE);
    if (!checked) continue;
    const text = checked[1];
    let parsed = null;
    for (const p of ACTION_PARSERS) {
      const m = text.match(p.re);
      if (m) {
        parsed = p.build(m);
        break;
      }
    }
    if (parsed) {
      actions.push({ ...parsed, cluster: currentCluster });
    } else {
      errors.push(`Could not parse action: ${text}`);
    }
  }
  return { actions, errors };
};

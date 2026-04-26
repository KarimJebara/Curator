import fs from 'node:fs';
import path from 'node:path';
import { claudeHome, memoryFile } from '../lib/paths.js';

// Memory file convention: MEMORY.md is an index, lines like
//   - [Title](file.md) — hook
// Anything in the memory directory not referenced is orphan.
export const orphanMemoryFiles = () => {
  const memoryDir = path.join(claudeHome(), 'memory');
  if (!fs.existsSync(memoryDir)) return [];
  const indexPath = path.join(memoryDir, 'MEMORY.md');
  const indexed = new Set();
  if (fs.existsSync(indexPath)) {
    const raw = fs.readFileSync(indexPath, 'utf8');
    for (const m of raw.matchAll(/\(([^)]+\.md)\)/g)) {
      indexed.add(path.basename(m[1]));
    }
  }
  const files = fs.readdirSync(memoryDir).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md');
  return files.filter((f) => !indexed.has(f)).map((f) => path.join(memoryDir, f));
};

// Skills with version-drift suffixes (v2, enhanced, agentic, new, latest)
// are usually old copies that survived a re-import.
const STALE_SUFFIX_RE = /-(v\d+|enhanced|agentic|new|latest|old|backup|copy|bak)$/i;

export const driftedSkills = (skills) => {
  return skills.filter((s) => STALE_SUFFIX_RE.test(s.name));
};

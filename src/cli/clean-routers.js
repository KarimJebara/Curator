import fs from 'node:fs';
import path from 'node:path';
import { userSkillsDir, ensureDir, backupsDir } from '../lib/paths.js';
import { backup } from '../lib/backup.js';

// Identify which skill directories were created by curator's earlier
// topic-router or topic-index pipeline so we can clean them up cleanly
// without touching anything the user wrote themselves.
//
// Detection: we look at the SKILL.md frontmatter for the marker types
// curator emits. We do NOT delete by name match — too easy to clobber a
// user-written skill that happens to share a tag name.
const CURATOR_TYPES = new Set(['topic-router', 'topic-index', 'router']);

const isCuratorRouter = (skillDir) => {
  const filePath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(filePath)) return false;
  const raw = fs.readFileSync(filePath, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return false;
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    if (line.slice(0, idx).trim() === 'type') {
      const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (CURATOR_TYPES.has(value)) return true;
    }
  }
  return false;
};

export const cleanRouters = ({ dryRun = false } = {}) => {
  const root = userSkillsDir();
  if (!fs.existsSync(root)) {
    console.log(`No skills dir at ${root}. Nothing to clean.`);
    return;
  }
  const candidates = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    if (isCuratorRouter(dir)) candidates.push(dir);
  }
  if (!candidates.length) {
    console.log('No curator-generated routers found. Nothing to clean.');
    return;
  }
  console.log(`Found ${candidates.length} curator-generated router skill(s):`);
  for (const dir of candidates) console.log(`  • ${path.basename(dir)}`);
  if (dryRun) {
    console.log('\n--dry-run set; no changes made.');
    return;
  }
  ensureDir(backupsDir());
  let removed = 0;
  for (const dir of candidates) {
    const backupPath = backup(dir, 'clean-routers');
    fs.rmSync(dir, { recursive: true, force: true });
    removed++;
    console.log(`  ✓ removed ${path.basename(dir)} (backup: ${path.basename(backupPath)})`);
  }
  console.log(`\nRemoved ${removed} router(s). Backups in ${backupsDir()}.`);
};

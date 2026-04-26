import fs from 'node:fs';
import path from 'node:path';
import { backupsDir, ensureDir } from './paths.js';

const ts = () => new Date().toISOString().replace(/[:.]/g, '-');

// Recursively copy `src` (file or directory) into a timestamped slot inside
// the curator backups dir. Returns the backup path so callers can log it.
export const backup = (src, label = 'change') => {
  if (!fs.existsSync(src)) return null;
  ensureDir(backupsDir());
  const name = `${ts()}-${label}-${path.basename(src)}`;
  const dest = path.join(backupsDir(), name);
  copyRecursive(src, dest);
  return dest;
};

const copyRecursive = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};

import fs from 'node:fs';
import path from 'node:path';
import { userSkillsDir, ensureDir } from '../lib/paths.js';
import { backup } from '../lib/backup.js';

// Write a new router skill to ~/.claude/skills/<name>/SKILL.md. If the
// directory already exists, the existing skill is backed up first and then
// replaced — the user explicitly opted in via the report checkbox.
export const writeRouterSkill = (name, skillContent) => {
  const dir = path.join(userSkillsDir(), name);
  let backupPath = null;
  if (fs.existsSync(dir)) backupPath = backup(dir, 'router-replace');
  ensureDir(dir);
  const target = path.join(dir, 'SKILL.md');
  fs.writeFileSync(target, skillContent);
  return { path: target, backup: backupPath };
};

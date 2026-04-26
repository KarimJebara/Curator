import fs from 'node:fs';
import { backup } from '../lib/backup.js';

// Soft delete: the skill directory is copied to backups and then removed
// from its source. The user can restore from backups if they change their
// mind. We never use rm -rf on real filesystems without a backup first.
export const deleteSkill = (skillDir) => {
  if (!fs.existsSync(skillDir)) throw new Error(`Skill not found: ${skillDir}`);
  const backupPath = backup(skillDir, 'delete');
  fs.rmSync(skillDir, { recursive: true, force: true });
  return { dir: skillDir, backup: backupPath };
};

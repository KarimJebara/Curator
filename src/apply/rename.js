import fs from 'node:fs';
import path from 'node:path';
import { backup } from '../lib/backup.js';
import { readSkill, writeSkill } from '../lib/skill-parser.js';

// Rename a skill: move its directory and update the `name` field in
// frontmatter. We require the destination not to exist — collisions are
// reported, not silently merged.
export const renameSkill = (skillDir, newName) => {
  if (!fs.existsSync(skillDir)) throw new Error(`Skill not found: ${skillDir}`);
  const parent = path.dirname(skillDir);
  const newDir = path.join(parent, newName);
  if (fs.existsSync(newDir)) {
    throw new Error(`Cannot rename: ${newDir} already exists`);
  }
  const backupPath = backup(skillDir, 'rename');
  fs.renameSync(skillDir, newDir);
  const skill = readSkill(newDir);
  if (skill) {
    skill.frontmatter.name = newName;
    skill.path = path.join(newDir, 'SKILL.md');
    writeSkill(skill);
  }
  return { from: skillDir, to: newDir, backup: backupPath };
};

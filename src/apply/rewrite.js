import { backup } from '../lib/backup.js';
import { readSkill, writeSkill } from '../lib/skill-parser.js';

// Rewrite the description and (optionally) body of an existing skill.
// `newBody` is optional — Phase 1 typically only tightens the description.
export const rewriteSkill = (skillDir, { description, body }) => {
  const skill = readSkill(skillDir);
  if (!skill) throw new Error(`Skill not found: ${skillDir}`);
  const backupPath = backup(skillDir, 'rewrite');
  if (description !== undefined) skill.frontmatter.description = description;
  if (body !== undefined) skill.body = body;
  writeSkill(skill);
  return { dir: skillDir, backup: backupPath };
};

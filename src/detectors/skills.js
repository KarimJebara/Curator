import fs from 'node:fs';
import path from 'node:path';
import { userSkillsDir, userPluginsDir } from '../lib/paths.js';
import { readSkill } from '../lib/skill-parser.js';
import { estimateTokens, grade, gradeEager } from '../lib/tokens.js';

const walkSkillDirs = (root) => {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(root, entry.name);
    if (fs.existsSync(path.join(dir, 'SKILL.md'))) {
      out.push(dir);
    } else {
      // recurse one level for plugin layouts
      for (const sub of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!sub.isDirectory()) continue;
        const subDir = path.join(dir, sub.name);
        if (fs.existsSync(path.join(subDir, 'SKILL.md'))) out.push(subDir);
      }
    }
  }
  return out;
};

export const collectSkills = ({ extraRoots = [], rootsOnly } = {}) => {
  const roots = rootsOnly ? rootsOnly : [userSkillsDir(), userPluginsDir(), ...extraRoots];
  const dirs = roots.flatMap(walkSkillDirs);
  const seen = new Set();
  const skills = [];
  for (const dir of dirs) {
    const skill = readSkill(dir);
    if (!skill) continue;
    if (seen.has(skill.dir)) continue;
    seen.add(skill.dir);
    // Eager: description is loaded into the autorouter context every session,
    // so the user pays it before typing a single character.
    // Lazy: body is loaded only when the Skill tool fires for this skill.
    // Total: full file size (kept for backwards compat with anything that
    // grades on raw weight).
    const eagerTokens = estimateTokens(skill.description || '');
    const lazyTokens = estimateTokens(skill.body || '');
    const tokens = estimateTokens(skill.raw);
    skills.push({
      ...skill,
      tokens,
      eagerTokens,
      lazyTokens,
      grade: grade(lazyTokens),
      eagerGrade: gradeEager(eagerTokens),
      source: roots.find((r) => skill.dir.startsWith(r)) || 'unknown',
    });
  }
  return skills;
};

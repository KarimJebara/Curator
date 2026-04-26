import fs from 'node:fs';
import path from 'node:path';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const parseFrontmatter = (raw) => {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: {}, body: raw };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    fm[key] = val;
  }
  return { frontmatter: fm, body: m[2] };
};

export const readSkill = (skillDir) => {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) return null;
  const raw = fs.readFileSync(skillFile, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const name = frontmatter.name || path.basename(skillDir);
  return {
    name,
    description: frontmatter.description || '',
    frontmatter,
    body,
    raw,
    path: skillFile,
    dir: skillDir,
  };
};

export const writeSkill = (skill) => {
  const fmLines = Object.entries(skill.frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const out = `---\n${fmLines}\n---\n${skill.body}`;
  fs.writeFileSync(skill.path, out);
};

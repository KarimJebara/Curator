import fs from 'node:fs';
import path from 'node:path';

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

const stripQuotes = (s) => s.replace(/^['"]|['"]$/g, '');

const indentOf = (line) => line.length - line.trimStart().length;

// Minimal YAML frontmatter parser sufficient for SKILL.md files.
// Handles: scalar values, quoted values, folded (>, >-) and literal (|, |-)
// block scalars, and skips nested mappings so their child keys don't get
// hoisted to the top level. Returns only top-level keys as strings.
const parseFrontmatter = (raw) => {
  const m = raw.match(FRONTMATTER_RE);
  if (!m) return { frontmatter: {}, body: raw };
  const lines = m[1].split('\n');
  const fm = {};

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) { i++; continue; }
    if (indentOf(line) > 0) { i++; continue; } // nested-mapping child, skip
    const colon = line.indexOf(':');
    if (colon < 0) { i++; continue; }
    const key = line.slice(0, colon).trim();
    const rest = line.slice(colon + 1).trim();
    i++;

    // Block scalar: `|`, `|-`, `>`, `>-` (chomping indicator ignored).
    const blockMatch = rest.match(/^([|>])([+-]?)\s*$/);
    if (blockMatch) {
      const folded = blockMatch[1] === '>';
      const chunkLines = [];
      let baseIndent = null;
      while (i < lines.length) {
        const cur = lines[i];
        if (!cur.trim()) { chunkLines.push(''); i++; continue; }
        const ind = indentOf(cur);
        if (ind === 0) break;
        if (baseIndent === null) baseIndent = ind;
        if (ind < baseIndent) break;
        chunkLines.push(cur.slice(baseIndent));
        i++;
      }
      // Trim trailing blanks
      while (chunkLines.length && chunkLines[chunkLines.length - 1] === '') chunkLines.pop();
      fm[key] = folded ? chunkLines.join(' ').replace(/\s+/g, ' ').trim() : chunkLines.join('\n');
      continue;
    }

    // Nested mapping header (`metadata:` with empty value, children indented).
    if (rest === '') {
      // Skip child lines so they don't get hoisted.
      while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0)) i++;
      continue;
    }

    fm[key] = stripQuotes(rest);
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

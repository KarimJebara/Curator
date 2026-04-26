import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { renameSkill } from '../../src/apply/rename.js';
import { rewriteSkill } from '../../src/apply/rewrite.js';
import { deleteSkill } from '../../src/apply/delete.js';
import { readSkill } from '../../src/lib/skill-parser.js';

const makeSkillFixture = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'curator-apply-'));
  const skillDir = path.join(root, 'old-name');
  fs.mkdirSync(skillDir);
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `---
name: old-name
description: original description
---

# Old skill body
`);
  return { root, skillDir };
};

export const tests = {
  'renameSkill moves dir and updates frontmatter name': () => {
    const { root, skillDir } = makeSkillFixture();
    const result = renameSkill(skillDir, 'new-name');
    const newDir = path.join(root, 'new-name');
    assert.equal(result.to, newDir);
    assert.ok(fs.existsSync(newDir));
    assert.ok(!fs.existsSync(skillDir));
    const skill = readSkill(newDir);
    assert.equal(skill.name, 'new-name');
  },

  'renameSkill refuses to overwrite an existing dir': () => {
    const { root, skillDir } = makeSkillFixture();
    fs.mkdirSync(path.join(root, 'collision'));
    assert.throws(() => renameSkill(skillDir, 'collision'), /already exists/);
  },

  'rewriteSkill updates description in place': () => {
    const { skillDir } = makeSkillFixture();
    rewriteSkill(skillDir, { description: 'tightened description' });
    const skill = readSkill(skillDir);
    assert.equal(skill.description, 'tightened description');
  },

  'deleteSkill removes dir but keeps a backup': () => {
    const { skillDir } = makeSkillFixture();
    const r = deleteSkill(skillDir);
    assert.ok(!fs.existsSync(skillDir));
    assert.ok(fs.existsSync(r.backup), 'backup should exist');
  },
};

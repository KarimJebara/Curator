import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSkill } from '../../src/lib/skill-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '..', 'fixtures', '5-frontend-skills');

export const tests = {
  'reads frontmatter from a real fixture': () => {
    const skill = readSkill(path.join(fixtureDir, 'frontend-react'));
    assert.ok(skill, 'expected a skill');
    assert.equal(skill.name, 'frontend-react');
    assert.match(skill.description, /React component patterns/);
  },

  'returns null when SKILL.md is missing': () => {
    const skill = readSkill('/tmp/this-does-not-exist-123');
    assert.equal(skill, null);
  },

  'separates frontmatter from body': () => {
    const skill = readSkill(path.join(fixtureDir, 'frontend-react'));
    assert.ok(!skill.body.startsWith('---'));
    assert.match(skill.body, /# Frontend React/);
  },
};

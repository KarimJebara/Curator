import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSkill } from '../../src/lib/skill-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, '..', 'fixtures', '5-frontend-skills');
const yamlDir = path.join(__dirname, '..', 'fixtures', 'yaml-edge-cases');

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

  'reads folded block scalar description (>-)': () => {
    const skill = readSkill(path.join(yamlDir, 'folded-desc'));
    assert.ok(skill);
    assert.match(skill.description, /folded block scalar/);
    assert.match(skill.description, /Lines should be joined/);
    assert.match(skill.description, /TRIGGER when: user asks for X/);
    assert.equal(skill.frontmatter.origin, 'ECC');
  },

  'reads literal block scalar description (|)': () => {
    const skill = readSkill(path.join(yamlDir, 'literal-desc'));
    assert.ok(skill);
    assert.match(skill.description, /Line one/);
    assert.match(skill.description, /Line two/);
    assert.equal(skill.frontmatter.origin, 'ECC');
  },

  'does not hoist nested mapping keys to top level': () => {
    const skill = readSkill(path.join(yamlDir, 'nested-metadata'));
    assert.ok(skill);
    assert.equal(skill.frontmatter.origin, 'community');
    assert.equal(skill.frontmatter.author, undefined,
      'nested author key must not leak to top level');
    assert.equal(skill.frontmatter.version, undefined,
      'nested version key must not leak to top level');
  },

  'preserves colons inside quoted description': () => {
    const skill = readSkill(path.join(yamlDir, 'quoted-with-colons'));
    assert.ok(skill);
    assert.equal(
      skill.description,
      'TRIGGER when: user says hello. Skip when: user says bye.'
    );
  },
};

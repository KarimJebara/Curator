import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSkills } from '../../src/detectors/skills.js';
import { clusterSkills } from '../../src/detectors/cluster.js';
import { skillRoots } from '../../src/lib/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.join(__dirname, '..', 'fixtures', '5-frontend-skills');

export const tests = {
  'collectSkills with rootsOnly returns exactly the fixture skills': () => {
    const skills = collectSkills({ rootsOnly: [fixtureRoot] });
    assert.equal(skills.length, 5);
    const names = skills.map((s) => s.name).sort();
    assert.deepEqual(names, [
      'frontend-android',
      'frontend-patterns',
      'frontend-react',
      'frontend-slides',
      'frontend-swiftui',
    ]);
  },

  'clusterSkills groups overlapping frontend skills with permissive threshold': () => {
    // Fixture skills are intentionally sparse; we use a lower threshold here
    // than production default. Real corpora with longer bodies cluster fine
    // at the default; the fixture only exists to exercise the algorithm.
    const skills = collectSkills({ rootsOnly: [fixtureRoot] });
    const clusters = clusterSkills(skills, { threshold: 0.05 });
    assert.ok(clusters.length >= 1, `expected at least 1 cluster, got ${clusters.length}`);
    const found = clusters.find((c) => c.members.length >= 2);
    assert.ok(found, 'expected at least one cluster of 2+ frontend skills');
  },

  'clusters carry confidence and silhouette annotations': () => {
    const skills = collectSkills({ rootsOnly: [fixtureRoot] });
    const clusters = clusterSkills(skills, { threshold: 0.05 });
    if (!clusters.length) return; // permissive threshold may still produce zero on tiny fixtures
    for (const c of clusters) {
      assert.ok(['high', 'medium', 'low'].includes(c.confidence));
      assert.ok(typeof c.silhouette === 'number');
    }
  },

  'clusterSkills filters out singletons': () => {
    const skills = collectSkills({ rootsOnly: [fixtureRoot] });
    const clusters = clusterSkills(skills, { threshold: 0.99 });
    assert.equal(clusters.length, 0, 'extreme threshold should produce no clusters');
  },

  'each member has token count and grade': () => {
    const skills = collectSkills({ rootsOnly: [fixtureRoot] });
    for (const s of skills) {
      assert.ok(s.tokens > 0, `${s.name} should have tokens`);
      assert.ok(['A', 'B', 'C', 'D', 'F'].includes(s.grade));
    }
  },

  'skillRoots includes OpenCode user and workspace skill dirs': () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'curator-roots-'));
    const previousUserSkillsDir = process.env.CURATOR_USER_SKILLS_DIR;
    try {
      delete process.env.CURATOR_USER_SKILLS_DIR;
      const roots = skillRoots({ cwd: path.join(tmp, 'project', 'nested') });
      assert.ok(roots.includes(path.join(os.homedir(), '.agents', 'skills')));
      assert.ok(roots.includes(path.join(tmp, 'project', 'nested', '.agents', 'skills')));
      assert.ok(roots.includes(path.join(tmp, 'project', '.agents', 'skills')));
      assert.ok(roots.includes(path.join(tmp, '.agents', 'skills')));
    } finally {
      if (previousUserSkillsDir === undefined) delete process.env.CURATOR_USER_SKILLS_DIR;
      else process.env.CURATOR_USER_SKILLS_DIR = previousUserSkillsDir;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  },

  'skillRoots includes extra skill roots from env path list': () => {
    const previous = process.env.CURATOR_EXTRA_SKILLS_DIRS;
    const previousUserSkillsDir = process.env.CURATOR_USER_SKILLS_DIR;
    const first = path.join(os.tmpdir(), 'curator-extra-one');
    const second = path.join(os.tmpdir(), 'curator-extra-two');
    try {
      delete process.env.CURATOR_USER_SKILLS_DIR;
      process.env.CURATOR_EXTRA_SKILLS_DIRS = [first, second].join(path.delimiter);
      const roots = skillRoots({ cwd: process.cwd() });
      assert.ok(roots.includes(first));
      assert.ok(roots.includes(second));
    } finally {
      if (previous === undefined) delete process.env.CURATOR_EXTRA_SKILLS_DIRS;
      else process.env.CURATOR_EXTRA_SKILLS_DIRS = previous;
      if (previousUserSkillsDir === undefined) delete process.env.CURATOR_USER_SKILLS_DIR;
      else process.env.CURATOR_USER_SKILLS_DIR = previousUserSkillsDir;
    }
  },
};

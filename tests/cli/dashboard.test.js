import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// HTTP smoke tests for the dashboard server. We use a tmp CURATOR_HOME so we
// never touch the user's real ~/.claude/curator/. The server reads
// reports/latest.json from CURATOR_HOME via paths.js.

const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'curator-test-'));
const reportsPath = path.join(tmpHome, 'reports');
fs.mkdirSync(reportsPath, { recursive: true });

// Synthetic skill on disk (so the live readSkill can find it). User-owned
// path is required for edit/delete to be allowed; we shim that by making the
// fake skill dir a child of a fake userSkillsDir override is not feasible
// without bigger refactor — so we skip the PUT/DELETE-success path and only
// assert the route returns sane errors when the skill isn't editable.
const fakeSkillDir = path.join(tmpHome, 'fake-skills', 'demo-skill');
fs.mkdirSync(fakeSkillDir, { recursive: true });
fs.writeFileSync(path.join(fakeSkillDir, 'SKILL.md'),
  '---\nname: demo-skill\ndescription: a tiny demo skill for tests\n---\n# Demo\n\nbody content here\n');

const fakeState = {
  skills: [{
    name: 'demo-skill',
    description: 'a tiny demo skill for tests',
    dir: fakeSkillDir,
    path: path.join(fakeSkillDir, 'SKILL.md'),
    tokens: 50, eagerTokens: 8, lazyTokens: 12,
    grade: 'A', eagerGrade: 'A',
    source: path.join(tmpHome, 'fake-skills'),
  }],
  clusters: [{
    id: 'c1', label: 'demo', members: [{ name: 'demo-skill' }],
    totalTokens: 50, meanSimilarity: 0, silhouette: 0, confidence: 'low',
  }],
  topics: [],
  mcpServers: [],
  mcpDups: [],
  orphans: 0,
  drifted: [],
  proposals: {},
};
fs.writeFileSync(path.join(reportsPath, 'latest.json'), JSON.stringify(fakeState));

// Override both the curator-config dir and the user-skills dir so the test is
// fully self-contained and never touches the user's real ~/.claude/.
const fakeUserSkillsDir = path.join(tmpHome, 'user-skills');
fs.mkdirSync(fakeUserSkillsDir, { recursive: true });
process.env.CURATOR_HOME = tmpHome;
process.env.CURATOR_USER_SKILLS_DIR = fakeUserSkillsDir;

// Import AFTER setting env so paths.js picks it up
const { dashboard } = await import('../../src/cli/dashboard.js');

const PORT = 4799;
const base = `http://127.0.0.1:${PORT}`;
const server = dashboard({ port: PORT, open: false });

const waitForReady = async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${base}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not come up in time');
};

await waitForReady();

const close = () => new Promise((resolve) => {
  server.close(() => resolve());
  setTimeout(() => resolve(), 500);
});

export const tests = {
  'GET /api/health returns ok': async () => {
    const r = await fetch(`${base}/api/health`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.ok, true);
  },

  'GET /api/state returns snapshot with skills, clusters, totals': async () => {
    const r = await fetch(`${base}/api/state`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.skills.length, 1);
    assert.equal(body.skills[0].name, 'demo-skill');
    assert.ok('eagerTokens' in body.skills[0], 'skill row should expose eagerTokens');
    assert.ok('totals' in body, 'state should expose totals');
    assert.equal(typeof body.totals.eager, 'number');
  },

  'GET /api/skills/:name returns full skill content': async () => {
    const r = await fetch(`${base}/api/skills/demo-skill`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.name, 'demo-skill');
    assert.ok(body.body.includes('body content here'));
    assert.ok('eagerTokens' in body);
  },

  'GET /api/skills/:unknown returns 404': async () => {
    const r = await fetch(`${base}/api/skills/does-not-exist`);
    assert.equal(r.status, 404);
  },

  'PUT /api/skills/:name on non-user-owned skill returns 403': async () => {
    // Our fake skill is outside userSkillsDir(), so isEditable() returns false
    const r = await fetch(`${base}/api/skills/demo-skill`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: 'mutation attempt' }),
    });
    assert.equal(r.status, 403);
  },

  'DELETE /api/skills/:name on non-user-owned skill returns 403': async () => {
    const r = await fetch(`${base}/api/skills/demo-skill`, { method: 'DELETE' });
    assert.equal(r.status, 403);
    assert.ok(fs.existsSync(fakeSkillDir), 'skill dir should still exist after rejected delete');
  },

  'GET /api/clusters/:id returns cluster + overlap analysis': async () => {
    const r = await fetch(`${base}/api/clusters/c1`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.cluster.id, 'c1');
    assert.equal(body.members.length, 1);
    assert.ok('overlap' in body);
    assert.ok(Array.isArray(body.overlap.shared));
  },

  'GET /api/clusters/:unknown returns 404': async () => {
    const r = await fetch(`${base}/api/clusters/does-not-exist`);
    assert.equal(r.status, 404);
  },

  'POST /api/skills creates a new SKILL.md in user skills dir': async () => {
    const r = await fetch(`${base}/api/skills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'created-by-test',
        description: 'a skill created by the dashboard test suite to verify the route',
        tags: ['test', 'demo'],
        body: '# Created by test\n\nbody.',
      }),
    });
    assert.equal(r.status, 201);
    const created = path.join(fakeUserSkillsDir, 'created-by-test', 'SKILL.md');
    assert.ok(fs.existsSync(created), 'SKILL.md should exist on disk');
    const content = fs.readFileSync(created, 'utf8');
    assert.ok(content.includes('name: created-by-test'));
    assert.ok(content.includes('tags: test, demo'));
    assert.ok(content.includes('Created by test'));
  },

  'POST /api/skills rejects invalid name': async () => {
    const r = await fetch(`${base}/api/skills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'has spaces and CAPS', description: 'nope' }),
    });
    assert.equal(r.status, 400);
  },

  'POST /api/skills rejects duplicate name': async () => {
    const r = await fetch(`${base}/api/skills`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'created-by-test',
        description: 'attempting to create a duplicate',
      }),
    });
    assert.equal(r.status, 409);
  },

  'cleanup: server closes': async () => {
    await close();
    fs.rmSync(tmpHome, { recursive: true, force: true });
    delete process.env.CURATOR_HOME;
    delete process.env.CURATOR_USER_SKILLS_DIR;
  },
};

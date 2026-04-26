import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reportsDir, userSkillsDir } from '../lib/paths.js';
import { readSkill, writeSkill } from '../lib/skill-parser.js';
import { backup } from '../lib/backup.js';
import { analyzeOverlap } from '../detectors/cluster-overlap.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS = path.resolve(__dirname, '..', 'dashboard');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return resolve({});
    try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
  });
  req.on('error', reject);
});

const loadState = () => {
  const p = path.join(reportsDir(), 'latest.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

// Resolve a skill by name from latest.json. We trust the cached `dir` path
// rather than scanning, so the dashboard reflects the snapshot the user just
// reviewed. If the dir disappeared since scan (user deleted it manually),
// return null and the route returns 404.
const findSkill = (state, name) => {
  if (!state) return null;
  const hit = (state.skills || []).find((s) => s.name === name);
  if (!hit) return null;
  if (!fs.existsSync(hit.dir)) return null;
  return hit;
};

// Only allow edits inside the user's ~/.claude/skills tree. Plugin-installed
// skills (~/.claude/plugins/...) are read-only because rewriting them gets
// blown away by the next plugin update.
const isEditable = (skillDir) => {
  const root = userSkillsDir();
  return skillDir.startsWith(root + path.sep) || skillDir === root;
};

const serveStatic = (req, res) => {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const safe = path.normalize(urlPath).replace(/^(\.\.[\\/])+/, '');
  const filePath = path.join(ASSETS, safe);
  if (!filePath.startsWith(ASSETS)) {
    res.writeHead(403); res.end('forbidden'); return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404); res.end('not found'); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
};

const handle = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (pathname === '/api/state' && req.method === 'GET') {
    const state = loadState();
    if (!state) return json(res, 404, { error: 'No scan found. Run `curator scan` first.' });
    // Strip raw/body bloat from the list payload — the dashboard fetches
    // the full content per-skill via /api/skills/:name only when the user
    // opens one. Cuts initial load by ~10x on a 100-skill setup.
    const skills = (state.skills || []).map(({ raw, body, frontmatter, ...rest }) => ({
      ...rest,
      hasFrontmatterTags: !!(frontmatter && frontmatter.tags),
      editable: isEditable(rest.dir),
    }));
    const totals = skills.reduce(
      (a, s) => ({
        eager: a.eager + (s.eagerTokens || 0),
        lazy: a.lazy + (s.lazyTokens || 0),
        all: a.all + (s.tokens || 0),
      }),
      { eager: 0, lazy: 0, all: 0 },
    );
    return json(res, 200, {
      skills,
      clusters: state.clusters || [],
      topics: state.topics || [],
      mcpServers: state.mcpServers || [],
      mcpDups: state.mcpDups || [],
      proposals: state.proposals || {},
      totals,
    });
  }

  const skillMatch = pathname.match(/^\/api\/skills\/([^/]+)$/);
  if (skillMatch) {
    const name = decodeURIComponent(skillMatch[1]);
    const state = loadState();
    const cached = findSkill(state, name);
    if (!cached) return json(res, 404, { error: `skill not found: ${name}` });

    if (req.method === 'GET') {
      const live = readSkill(cached.dir);
      if (!live) return json(res, 404, { error: 'skill file missing on disk' });
      return json(res, 200, {
        name: live.name,
        description: live.description,
        frontmatter: live.frontmatter,
        body: live.body,
        raw: live.raw,
        dir: live.dir,
        path: live.path,
        tokens: cached.tokens,
        eagerTokens: cached.eagerTokens,
        lazyTokens: cached.lazyTokens,
        grade: cached.grade,
        eagerGrade: cached.eagerGrade,
        editable: isEditable(cached.dir),
      });
    }

    if (req.method === 'PUT') {
      if (!isEditable(cached.dir)) {
        return json(res, 403, { error: 'plugin-installed skills are read-only' });
      }
      let payload;
      try { payload = await readBody(req); } catch { return json(res, 400, { error: 'invalid JSON' }); }
      const live = readSkill(cached.dir);
      if (!live) return json(res, 404, { error: 'skill file missing on disk' });
      backup(cached.dir, 'dashboard-edit');
      const next = { ...live };
      if (typeof payload.body === 'string') next.body = payload.body;
      if (payload.frontmatter && typeof payload.frontmatter === 'object') {
        next.frontmatter = { ...live.frontmatter, ...payload.frontmatter };
      }
      writeSkill(next);
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      if (!isEditable(cached.dir)) {
        return json(res, 403, { error: 'plugin-installed skills are read-only' });
      }
      const backupPath = backup(cached.dir, 'dashboard-delete');
      fs.rmSync(cached.dir, { recursive: true, force: true });
      return json(res, 200, { ok: true, backup: backupPath });
    }

    return json(res, 405, { error: 'method not allowed' });
  }

  const clusterMatch = pathname.match(/^\/api\/clusters\/([^/]+)$/);
  if (clusterMatch && req.method === 'GET') {
    const id = decodeURIComponent(clusterMatch[1]);
    const state = loadState();
    const cluster = (state?.clusters || []).find((c) => c.id === id);
    if (!cluster) return json(res, 404, { error: `cluster not found: ${id}` });
    // Pull live SKILL.md content so the overlap reflects whatever the user
    // has edited since the last scan. Falls back to cached body for plugin
    // skills whose dirs we can't always re-read cleanly.
    const members = cluster.members.map((m) => {
      const cached = (state.skills || []).find((s) => s.name === m.name);
      const live = cached?.dir ? readSkill(cached.dir) : null;
      return {
        name: m.name,
        description: cached?.description || m.description || '',
        text: (live?.body || cached?.body || ''),
        eagerTokens: cached?.eagerTokens || 0,
        lazyTokens: cached?.lazyTokens || 0,
        grade: cached?.grade || '',
        editable: cached ? isEditable(cached.dir) : false,
      };
    });
    const overlap = analyzeOverlap(members);
    return json(res, 200, { cluster, members, overlap });
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET') return serveStatic(req, res);
  return json(res, 404, { error: 'not found' });
};

const openInBrowser = (url) => {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  import('node:child_process').then(({ spawn }) => {
    spawn(cmd, [url], { detached: true, stdio: 'ignore' }).unref();
  }).catch(() => {});
};

export const dashboard = ({ port = 4711, open = true } = {}) => {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error(err);
      json(res, 500, { error: err.message || String(err) });
    });
  });

  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`curator dashboard running at ${url}`);
    console.log('Press Ctrl+C to stop.');
    if (open) openInBrowser(url);
  });

  const shutdown = () => {
    console.log('\nShutting down…');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  return server;
};

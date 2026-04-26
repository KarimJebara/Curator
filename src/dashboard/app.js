const state = {
  skills: [],
  topics: [],
  clusters: [],
  mcpServers: [],
  totals: { eager: 0, lazy: 0, all: 0, mcp: 0 },
  filter: { kind: 'all', value: null },
  query: '',
  selected: null,
  editing: false,
  clusterDetail: null, // { cluster, members, overlap } or null
  mcpDetail: null,     // mcp server object or null
};

const $ = (sel) => document.querySelector(sel);
const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
};

const api = async (path, opts = {}) => {
  const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...opts });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
};

const toast = (msg, kind = 'ok', ms = 2400) => {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${kind}`;
  setTimeout(() => { t.className = 'toast hidden'; }, ms);
};

const fmt = (n) => Number(n || 0).toLocaleString();
const silhClass = (s) => (s >= 0.28 ? 'high' : s >= 0.18 ? 'medium' : 'low');

/* ─── Sidebar ──────────────────────────────────────── */

// Frontmatter origin values vary in case (ECC vs ecc, etc.) so we normalize
// when matching. Labels are what the sidebar shows.
const ORIGIN_LABELS = {
  ecc: 'Everything Claude Code',
  community: 'Community',
  custom: 'Custom (you wrote it)',
  unset: 'No origin tag',
};
const labelForOrigin = (origin) => ORIGIN_LABELS[(origin || 'unset').toLowerCase()] || origin;

const renderSidebar = () => {
  // Counts
  const tagged = new Set(state.topics.flatMap((t) => t.members.map((m) => m.name)));
  const untagged = state.skills.filter((s) => !tagged.has(s.name)).length;
  $('#cAll').textContent = state.skills.length;
  $('#cOrphan').textContent = untagged;

  // Origins
  const byOrigin = new Map();
  for (const s of state.skills) {
    const o = s.origin || 'unset';
    byOrigin.set(o, (byOrigin.get(o) || 0) + 1);
  }
  const originsEl = $('#origins');
  originsEl.innerHTML = '';
  const sortedOrigins = [...byOrigin.entries()].sort((a, b) => b[1] - a[1]);
  for (const [origin, count] of sortedOrigins) {
    const label = labelForOrigin(origin);
    const btn = el('button', {
      class: 'filter-btn' + (state.filter.kind === 'origin' && state.filter.value === origin ? ' active' : ''),
      onclick: () => setFilter('origin', origin),
    }, label, el('span', { class: 'count' }, String(count)));
    originsEl.appendChild(el('li', {}, btn));
  }

  const topicsEl = $('#topics');
  topicsEl.innerHTML = '';
  for (const t of state.topics) {
    const btn = el('button', {
      class: 'filter-btn' + (state.filter.kind === 'topic' && state.filter.value === t.tag ? ' active' : ''),
      onclick: () => setFilter('topic', t.tag),
    }, `/${t.tag}`, el('span', { class: 'count' }, String(t.members.length)));
    topicsEl.appendChild(el('li', {}, btn));
  }

  const clustersEl = $('#clusters');
  clustersEl.innerHTML = '';
  for (const c of state.clusters) {
    const sil = (c.silhouette ?? 0).toFixed(2);
    const btn = el('button', {
      class: 'filter-btn' + (state.clusterDetail && state.clusterDetail.cluster.id === c.id ? ' active' : ''),
      onclick: () => showClusterDetail(c.id),
    }, c.label, el('span', { class: `silhouette ${silhClass(c.silhouette || 0)}` }, sil));
    clustersEl.appendChild(el('li', {}, btn));
  }

  for (const btn of document.querySelectorAll('.filter-btn[data-filter]')) {
    btn.classList.toggle('active', state.filter.kind === btn.dataset.filter);
    btn.onclick = () => setFilter(btn.dataset.filter, null);
  }
};

/* ─── List pane ────────────────────────────────────── */

const filterSkills = () => {
  const q = state.query.trim().toLowerCase();
  let list = state.skills;
  if (state.filter.kind === 'topic') {
    const t = state.topics.find((x) => x.tag === state.filter.value);
    if (t) {
      const names = new Set(t.members.map((m) => m.name));
      list = list.filter((s) => names.has(s.name));
    }
  } else if (state.filter.kind === 'cluster') {
    const c = state.clusters.find((x) => x.id === state.filter.value);
    if (c) {
      const names = new Set(c.members.map((m) => m.name));
      list = list.filter((s) => names.has(s.name));
    }
  } else if (state.filter.kind === 'origin') {
    list = list.filter((s) => (s.origin || 'unset') === state.filter.value);
  } else if (state.filter.kind === 'orphans') {
    const tagged = new Set(state.topics.flatMap((t) => t.members.map((m) => m.name)));
    list = list.filter((s) => !tagged.has(s.name));
  }
  if (q) {
    list = list.filter((s) => {
      if (s.name.toLowerCase().includes(q)) return true;
      if ((s.description || '').toLowerCase().includes(q)) return true;
      // Match by tag — supports "kotlin", "/kotlin", "tag:kotlin", and
      // partial-match (e.g. "kub" hits "kubernetes")
      const tagQuery = q.replace(/^[/]+|^tag:/, '');
      if ((s.tags || []).some((t) => t.toLowerCase().includes(tagQuery))) return true;
      return false;
    });
  }
  return list.sort((a, b) => (b.lazyTokens || 0) - (a.lazyTokens || 0));
};

const headerLabel = () => {
  const f = state.filter;
  if (f.kind === 'topic') return `Topic: /${f.value}`;
  if (f.kind === 'cluster') {
    const c = state.clusters.find((x) => x.id === f.value);
    return `Cluster: ${c ? c.label : f.value}`;
  }
  if (f.kind === 'origin') return `Origin: ${labelForOrigin(f.value)}`;
  if (f.kind === 'orphans') return 'Untagged skills';
  return 'All skills';
};

const renderList = () => {
  const list = filterSkills();
  const totalEager = list.reduce((a, s) => a + (s.eagerTokens || 0), 0);
  const totalLazy = list.reduce((a, s) => a + (s.lazyTokens || 0), 0);
  const maxTokens = Math.max(1, ...list.map((s) => s.lazyTokens || 0));
  $('#listHeader').textContent = headerLabel();
  $('#listSubheader').textContent = `${list.length} · ${fmt(totalEager)} always · ${fmt(totalLazy)} on use`;

  const ul = $('#skillList');
  ul.innerHTML = '';
  for (const s of list) {
    const isActive = state.selected && state.selected.name === s.name;
    const tokenPct = ((s.lazyTokens || 0) / maxTokens) * 100;
    const li = el('li', {
      class: isActive ? 'active' : '',
      onclick: () => selectSkill(s.name),
    },
      el('div', { class: 'name' }, s.name),
      el('div', { class: 'desc' }, s.description || '(no description)'),
      el('div', { class: 'meta' },
        el('span', {
          class: `badge ${s.eagerGrade || ''}`,
          title: 'Description size — loaded into Claude on every session',
        }, `${fmt(s.eagerTokens)} always`),
        el('span', {
          class: `badge ${s.grade || ''}`,
          title: 'Body size — loaded only when this skill fires',
        }, `${fmt(s.lazyTokens)} on use`),
        el('div', { class: 'token-bar' }, el('span', { style: `width: ${tokenPct}%` })),
        s.editable ? null : el('span', { class: 'badge readonly' }, 'plugin'),
      ),
    );
    ul.appendChild(li);
  }

  $('#counts').innerHTML = `<span><strong>${state.skills.length}</strong> skills</span><span><strong>${state.topics.length}</strong> topics</span><span><strong>${state.clusters.length}</strong> clusters</span>`;
};

/* ─── Detail pane: skill view ──────────────────────── */

const renderSkillDetail = () => {
  const pane = $('#detail');
  const s = state.selected;
  pane.innerHTML = '';

  const inner = el('div', { class: 'detail-inner fade-in' });
  pane.appendChild(inner);

  const head = el('div', { class: 'detail-head' },
    el('h1', {}, s.name),
    el('span', {
      class: `badge ${s.eagerGrade || ''}`,
      title: 'Description size — loaded into Claude on every session',
    }, `${fmt(s.eagerTokens)} always loaded`),
    el('span', {
      class: `badge ${s.grade || ''}`,
      title: 'Body size — loaded only when this skill fires',
    }, `${fmt(s.lazyTokens)} on use`),
    s.editable ? null : el('span', { class: 'badge readonly' }, 'read-only · plugin'),
  );
  inner.appendChild(head);

  inner.appendChild(el('div', { class: 'detail-meta' }, s.dir));

  if (s.description) {
    inner.appendChild(el('div', { class: 'detail-desc' }, s.description));
  }

  // Tag editor — user-owned skills can edit; plugin skills just display.
  if (s.editable) {
    inner.appendChild(renderTagEditor(s));
  } else {
    const myTopics = state.topics.filter((t) => t.members.some((m) => m.name === s.name));
    if (myTopics.length) {
      const tagsRow = el('div', { class: 'cloud', style: 'margin-bottom: 18px' });
      for (const t of myTopics) {
        tagsRow.appendChild(el('span', {
          class: 'chip',
          onclick: () => setFilter('topic', t.tag),
        }, t.tag, el('span', { class: 'num' }, String(t.members.length))));
      }
      inner.appendChild(tagsRow);
    }
  }

  const toolbar = el('div', { class: 'toolbar' });
  if (s.editable) {
    if (state.editing) {
      toolbar.appendChild(el('button', { class: 'btn primary', onclick: saveEdits }, 'Save'));
      toolbar.appendChild(el('button', {
        class: 'btn',
        onclick: () => { state.editing = false; renderSkillDetail(); },
      }, 'Cancel'));
    } else {
      toolbar.appendChild(el('button', {
        class: 'btn',
        onclick: () => { state.editing = true; renderSkillDetail(); },
      }, 'Edit'));
      toolbar.appendChild(el('button', { class: 'btn', onclick: () => renameSkillPrompt(s) }, 'Rename'));
      toolbar.appendChild(el('button', { class: 'btn danger', onclick: deleteSelected }, 'Delete'));
      toolbar.appendChild(el('button', {
        class: 'btn',
        onclick: () => { state.selected = null; renderDetail(); renderList(); },
      }, '← Back to overview'));
    }
  } else {
    toolbar.appendChild(el('button', {
      class: 'btn',
      onclick: () => { state.selected = null; renderDetail(); renderList(); },
    }, '← Back to overview'));
  }
  inner.appendChild(toolbar);

  if (state.editing) {
    inner.appendChild(el('label', { class: 'edit-label' }, 'Description — loaded into Claude every session, even when this skill never fires'));
    const descInput = el('input', { type: 'text', class: 'desc-edit', id: 'descEdit' });
    descInput.value = s.description || '';
    inner.appendChild(descInput);

    inner.appendChild(el('label', { class: 'edit-label' }, 'Body — only loaded when this skill actually fires'));
    const ta = el('textarea', { class: 'body-edit', id: 'bodyEdit' });
    ta.value = s.body || '';
    inner.appendChild(ta);
  } else {
    inner.appendChild(el('div', { class: 'body-view' }, s.body || '(empty body)'));
  }
};

/* ─── Detail pane: overview view ───────────────────── */

const grade = (s) => s.grade || 'F';

const renderOverview = () => {
  const pane = $('#detail');
  pane.innerHTML = '';

  const inner = el('div', { class: 'detail-inner fade-in' });
  pane.appendChild(inner);

  // Hero
  const eagerTotal = state.totals.eager || state.skills.reduce((a, s) => a + (s.eagerTokens || 0), 0);
  const lazyTotal = state.totals.lazy || state.skills.reduce((a, s) => a + (s.lazyTokens || 0), 0);
  const editableCount = state.skills.filter((s) => s.editable).length;
  const hero = el('section', { class: 'hero' },
    el('h1', {}, 'Your skill library at a glance'),
    el('div', { class: 'hero-sub' },
      `${state.skills.length} skills. About ${fmt(eagerTotal)} tokens of skill descriptions are loaded into Claude on every session — paid whether you use the skill or not. ` +
      `Another ${fmt(lazyTotal)} tokens of skill bodies sit on disk and only load when a skill actually fires. ` +
      `Pick a topic, cluster, or skill from the left — or scan the highlights below.`),
    el('div', { class: 'hero-stats' },
      stat('Skills', state.skills.length, `${editableCount} editable`),
      stat('Topics', state.topics.length, 'tag-based browsers'),
      stat('Always loaded', fmt(eagerTotal), 'tokens · every session'),
      stat('On use', fmt(lazyTotal), 'tokens · only when invoked'),
    ),
  );
  inner.appendChild(hero);

  // Cost-comparison callout: eager skill descriptions vs MCP tool envelopes.
  // MCP cost is usually 5–20× the skill-description cost — surfacing the
  // ratio is the most actionable single number on the page.
  if (state.totals.mcp && state.totals.eager) {
    const ratio = state.totals.mcp / state.totals.eager;
    if (ratio >= 2) {
      inner.appendChild(el('div', { class: 'callout' },
        el('div', { class: 'icon' }, '!'),
        el('div', { class: 'body' },
          el('div', { class: 'title' }, `Your MCP servers cost ${ratio.toFixed(1)}× more than your skill descriptions`),
          el('div', { class: 'detail' },
            `${fmt(state.totals.mcp)} tokens for MCP tool definitions vs ${fmt(state.totals.eager)} tokens for skill descriptions — both loaded into Claude on every session. ` +
            `Trimming MCP servers you don't actually use is the highest-leverage cleanup.`,
          ),
        ),
      ));
    }
  }

  // Row 1: Eager + Lazy heaviest charts
  const heaviestEager = [...state.skills].sort((a, b) => (b.eagerTokens || 0) - (a.eagerTokens || 0)).slice(0, 8);
  const heaviestLazy = [...state.skills].sort((a, b) => (b.lazyTokens || 0) - (a.lazyTokens || 0)).slice(0, 8);
  const maxEager = Math.max(1, ...heaviestEager.map((s) => s.eagerTokens || 0));
  const maxLazy = Math.max(1, ...heaviestLazy.map((s) => s.lazyTokens || 0));
  inner.appendChild(el('div', { class: 'grid two' },
    card('Heaviest descriptions', 'always loaded — paid every session',
      el('div', {},
        ...heaviestEager.map((s) => barRow(s.name, s.eagerTokens || 0, maxEager, () => selectSkill(s.name))),
      ),
    ),
    card('Heaviest bodies', 'on use — paid only when the skill fires',
      el('div', {},
        ...heaviestLazy.map((s) => barRow(s.name, s.lazyTokens || 0, maxLazy, () => selectSkill(s.name))),
      ),
    ),
  ));

  // Row 1b: Grade donut
  inner.appendChild(el('div', { class: 'grid' },
    card('Quality breakdown', 'graded by body size (paid only when a skill fires)', renderDonut()),
  ));

  // Row 2: Topics cloud + Cluster cards + MCP
  const topTopics = [...state.topics].sort((a, b) => b.members.length - a.members.length).slice(0, 12);
  const topClusters = [...state.clusters].sort((a, b) => (b.silhouette || 0) - (a.silhouette || 0)).slice(0, 5);
  inner.appendChild(el('div', { class: 'grid three' },
    card('Topics', `${state.topics.length} tag-based browsers`,
      el('div', { class: 'cloud' },
        ...topTopics.map((t) => el('span', {
          class: 'chip',
          onclick: () => setFilter('topic', t.tag),
        }, `/${t.tag}`, el('span', { class: 'num' }, String(t.members.length)))),
      ),
    ),
    card('Top clusters', 'click to inspect overlap',
      el('div', {},
        ...topClusters.map((c) => el('div', {
          class: 'cluster-card',
          onclick: () => showClusterDetail(c.id),
        },
          el('div', { class: 'label' }, c.label),
          el('div', { class: 'meta' },
            el('span', {}, `${c.members.length} skills`),
            el('span', { class: `silhouette ${silhClass(c.silhouette || 0)}` }, (c.silhouette || 0).toFixed(2)),
          ),
        )),
      ),
    ),
    card('MCP servers', `${state.mcpServers.length} · ${fmt(state.totals.mcp || 0)} tok`,
      el('div', {},
        ...(() => {
          const sorted = [...state.mcpServers].sort((a, b) => (b.tokens || 0) - (a.tokens || 0)).slice(0, 8);
          const maxTok = Math.max(1, ...sorted.map((m) => m.tokens || 0));
          return sorted.map((m) => el('div', {
            class: 'mcp-row',
            onclick: () => showMcpDetail(m.name),
          },
            el('div', {},
              el('div', { class: 'name' }, m.name),
              el('div', { class: 'scope' }, m.command || (m.url ? 'remote' : '—')),
            ),
            el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: `width: ${(m.tokens || 0) / maxTok * 100}%` })),
            el('div', { class: 'num' }, fmt(m.tokens)),
          ));
        })(),
      ),
    ),
  ));

  // Row 3: Untagged callout (if any)
  const tagged = new Set(state.topics.flatMap((t) => t.members.map((m) => m.name)));
  const untagged = state.skills.filter((s) => !tagged.has(s.name));
  if (untagged.length) {
    inner.appendChild(el('div', { class: 'grid' },
      card('Untagged skills', `${untagged.length} skills with no topic — candidates for review`,
        el('div', { class: 'cloud' },
          ...untagged.slice(0, 20).map((s) => el('span', {
            class: 'chip',
            onclick: () => selectSkill(s.name),
          }, s.name, el('span', { class: 'num' }, fmt(s.lazyTokens)))),
        ),
      ),
    ));
  }
};

const stat = (label, value, delta) => el('div', { class: 'stat' },
  el('div', { class: 'label' }, label),
  el('div', { class: 'value' }, String(value)),
  delta ? el('div', { class: 'delta' }, delta) : null,
);

const card = (title, hint, body) => el('div', { class: 'card' },
  el('div', { class: 'card-head' },
    el('h3', {}, title),
    hint ? el('span', { class: 'hint' }, hint) : null,
  ),
  body,
);

const barRow = (label, value, max, onclick) => {
  const pct = (value / max) * 100;
  return el('div', { class: 'bar-row', onclick },
    el('span', { class: 'label' }, label),
    el('div', {},
      el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: `width: ${pct}%` })),
      el('div', { class: 'num' }, fmt(value)),
    ),
  );
};

/* ─── Donut chart (SVG) ────────────────────────────── */

const GRADE_COLORS = { A: '#9ece6a', B: '#9ece6a', C: '#e0af68', D: '#f7768e', F: '#f7768e' };
const GRADE_LABEL = { A: 'A — lean', B: 'B — good', C: 'C — heavy', D: 'D — bloated', F: 'F — failing' };

const renderDonut = () => {
  const counts = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  for (const s of state.skills) counts[grade(s)] = (counts[grade(s)] || 0) + 1;
  const total = state.skills.length || 1;

  const size = 140;
  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'donut');
  svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);

  const bg = document.createElementNS(svgNS, 'circle');
  bg.setAttribute('cx', size / 2); bg.setAttribute('cy', size / 2); bg.setAttribute('r', r);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', '#1c2130'); bg.setAttribute('stroke-width', 14);
  svg.appendChild(bg);

  for (const g of ['A', 'B', 'C', 'D', 'F']) {
    const v = counts[g];
    if (!v) continue;
    const len = (v / total) * c;
    const arc = document.createElementNS(svgNS, 'circle');
    arc.setAttribute('cx', size / 2); arc.setAttribute('cy', size / 2); arc.setAttribute('r', r);
    arc.setAttribute('fill', 'none');
    arc.setAttribute('stroke', GRADE_COLORS[g]);
    arc.setAttribute('stroke-width', 14);
    arc.setAttribute('stroke-dasharray', `${len} ${c - len}`);
    arc.setAttribute('stroke-dashoffset', -offset);
    arc.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
    svg.appendChild(arc);
    offset += len;
  }

  // Center label
  const txt = document.createElementNS(svgNS, 'text');
  txt.setAttribute('x', size / 2); txt.setAttribute('y', size / 2 - 4);
  txt.setAttribute('text-anchor', 'middle');
  txt.setAttribute('fill', '#e8eaf1');
  txt.setAttribute('font-size', '22'); txt.setAttribute('font-weight', '700');
  txt.textContent = String(total);
  const sub = document.createElementNS(svgNS, 'text');
  sub.setAttribute('x', size / 2); sub.setAttribute('y', size / 2 + 14);
  sub.setAttribute('text-anchor', 'middle');
  sub.setAttribute('fill', '#8a90a3');
  sub.setAttribute('font-size', '11'); sub.setAttribute('letter-spacing', '0.5');
  sub.textContent = 'SKILLS';
  svg.appendChild(txt); svg.appendChild(sub);

  const legend = el('div', { class: 'donut-legend' },
    ...['A', 'B', 'C', 'D', 'F'].map((g) => el('div', { class: 'donut-row' },
      el('span', { class: 'swatch', style: `background: ${GRADE_COLORS[g]}` }),
      el('span', { class: 'label' }, GRADE_LABEL[g]),
      el('span', { class: 'num' }, `${counts[g]} (${Math.round(counts[g] / total * 100)}%)`),
    )),
  );

  return el('div', { class: 'donut-wrap' }, svg, legend);
};

/* ─── Cluster overlap view ─────────────────────────── */

const renderClusterDetail = () => {
  const pane = $('#detail');
  pane.innerHTML = '';
  const inner = el('div', { class: 'detail-inner fade-in' });
  pane.appendChild(inner);

  const { cluster, members, overlap } = state.clusterDetail;
  const sil = (cluster.silhouette || 0).toFixed(2);
  const silClass = silhClass(cluster.silhouette || 0);

  inner.appendChild(el('div', { class: 'detail-head' },
    el('h1', {}, `Cluster: ${cluster.label}`),
    el('span', { class: `silhouette ${silClass}` }, `silhouette ${sil}`),
    el('span', { class: 'badge' }, `${members.length} members`),
  ));
  inner.appendChild(el('div', { class: 'detail-meta' },
    `Mean similarity ${(cluster.meanSimilarity || 0).toFixed(2)} · ` +
    `${cluster.confidence || 'low'} confidence — ${
      silClass === 'high' ? 'these skills clearly overlap' :
      silClass === 'medium' ? 'these skills probably overlap; verify before deleting' :
      'low confidence — could be a noisy grouping'
    }`,
  ));

  inner.appendChild(el('div', { class: 'toolbar' },
    el('button', {
      class: 'btn',
      onclick: () => { state.clusterDetail = null; setFilter('cluster', cluster.id); },
    }, 'Show as filtered list'),
    el('button', {
      class: 'btn',
      onclick: () => { state.clusterDetail = null; renderDetail(); },
    }, '← Back to overview'),
  ));

  // Pairwise similarity
  const pairsCard = card('Pairwise similarity', 'cosine TF-IDF inside this cluster',
    el('div', {},
      ...overlap.pairs.map((p) => {
        const pct = Math.round(p.similarity * 100);
        const flag = pct >= 70 ? 'F' : pct >= 50 ? 'D' : pct >= 30 ? 'C' : 'A';
        return el('div', { class: 'bar-row' },
          el('span', { class: 'label' },
            el('span', {
              style: 'cursor:pointer;text-decoration:underline dotted',
              onclick: () => selectSkill(p.a),
            }, p.a),
            ' ↔ ',
            el('span', {
              style: 'cursor:pointer;text-decoration:underline dotted',
              onclick: () => selectSkill(p.b),
            }, p.b),
          ),
          el('div', {},
            el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: `width: ${pct}%` })),
            el('div', { class: 'num' }, el('span', { class: `badge ${flag}` }, `${pct}%`)),
          ),
        );
      }),
    ),
  );
  inner.appendChild(pairsCard);

  // Shared core
  inner.appendChild(card(
    `Shared by ≥${Math.max(2, Math.ceil(members.length * 0.66))} of ${members.length}`,
    `${overlap.shared.length} core terms`,
    el('div', { class: 'cloud' },
      ...overlap.shared.slice(0, 30).map((s) =>
        el('span', { class: 'chip' }, s.token, el('span', { class: 'num' }, `${s.members}/${members.length}`)),
      ),
      overlap.shared.length === 0
        ? el('span', { style: 'color: var(--text-muted)' }, 'No tokens common to most members — these skills may not actually overlap.')
        : null,
    ),
  ));

  // Per-member unique terms
  inner.appendChild(card('What each skill uniquely knows', 'top tokens that appear only in this skill, not in the others',
    el('div', {},
      ...members.map((m) => {
        const uniq = overlap.unique[m.name] || [];
        return el('div', { style: 'margin-bottom: 14px;' },
          el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;' },
            el('div', {},
              el('strong', {
                style: 'cursor:pointer;text-decoration:underline dotted',
                onclick: () => selectSkill(m.name),
              }, m.name),
              ' ',
              el('span', { class: 'badge', style: 'margin-left:8px' }, `${fmt(m.eagerTokens)}e · ${fmt(m.lazyTokens)}L`),
            ),
            uniq.length === 0
              ? el('span', { style: 'color: var(--danger);font-size:12px' }, '⚠ no unique vocabulary — likely duplicate')
              : el('span', { style: 'color: var(--text-muted);font-size:12px' }, `${uniq.length} unique terms`),
          ),
          uniq.length === 0 ? null : el('div', { class: 'cloud' },
            ...uniq.map((u) => el('span', { class: 'chip' }, u.token, el('span', { class: 'num' }, String(u.freq)))),
          ),
        );
      }),
    ),
  ));
};

/* ─── Tag editor ───────────────────────────────────── */

const parseTagsField = (raw) => {
  if (!raw) return [];
  return String(raw).split(/[,\s]+/).map((t) => t.trim()).filter(Boolean);
};

const renderTagEditor = (skill) => {
  const tags = parseTagsField(skill.frontmatter?.tags);
  const wrap = el('div', { class: 'tag-editor' });

  let dirty = false;
  let working = [...tags];

  const rerender = () => {
    wrap.innerHTML = '';
    for (const tag of working) {
      const chip = el('span', { class: 'chip' }, tag,
        el('span', {
          class: 'x',
          title: `Remove ${tag}`,
          onclick: (ev) => { ev.stopPropagation(); working = working.filter((t) => t !== tag); dirty = true; rerender(); },
        }, '×'),
      );
      wrap.appendChild(chip);
    }
    const input = el('input', { type: 'text', class: 'add-tag', placeholder: '+ tag' });
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      const v = input.value.trim().toLowerCase();
      if (v && !working.includes(v)) {
        working.push(v);
        dirty = true;
        rerender();
      }
    });
    wrap.appendChild(input);
    if (dirty) {
      wrap.appendChild(el('button', {
        class: 'save-tags',
        onclick: () => saveTags(skill, working),
      }, 'Save tags'));
    }
  };
  rerender();
  return wrap;
};

const saveTags = async (skill, tags) => {
  try {
    await api(`/api/skills/${encodeURIComponent(skill.name)}`, {
      method: 'PUT',
      body: JSON.stringify({ frontmatter: { tags: tags.join(', ') } }),
    });
    toast(`Tags saved (${tags.length}). Recomputing topics…`);
    // Refresh state + re-fetch the skill so the editor reflects what's on disk
    const data = await api('/api/state');
    Object.assign(state, {
      skills: data.skills,
      topics: data.topics,
      clusters: data.clusters,
      mcpServers: data.mcpServers || [],
      totals: data.totals || state.totals,
    });
    const fresh = await api(`/api/skills/${encodeURIComponent(skill.name)}`);
    state.selected = fresh;
    renderSidebar();
    renderList();
    renderDetail();
  } catch (e) { toast(e.message, 'error'); }
};

/* ─── New topic modal ──────────────────────────────── */

const topicState = { selected: new Set(), filter: '' };

const renderTopicSkillPicker = () => {
  const list = $('#topicSkillList');
  list.innerHTML = '';
  const filter = topicState.filter.toLowerCase();
  const candidates = state.skills
    .filter((s) => s.editable)
    .filter((s) => !filter || s.name.toLowerCase().includes(filter) || (s.description || '').toLowerCase().includes(filter))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!candidates.length) {
    list.appendChild(el('div', { class: 'empty' }, 'No editable skills match.'));
    return;
  }
  for (const s of candidates) {
    const checked = topicState.selected.has(s.name);
    const row = el('label', { class: 'row' });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = checked;
    cb.addEventListener('change', () => {
      if (cb.checked) topicState.selected.add(s.name);
      else topicState.selected.delete(s.name);
      $('#topicSelCount').textContent = `(${topicState.selected.size} selected)`;
    });
    row.appendChild(cb);
    row.appendChild(el('span', { class: 'name' }, s.name));
    if ((s.tags || []).length) {
      row.appendChild(el('span', { class: 'existing-tags' }, s.tags.slice(0, 3).join(' · ')));
    }
    list.appendChild(row);
  }
};

const openTopicModal = () => {
  topicState.selected.clear();
  topicState.filter = '';
  $('#topicTagInput').value = '';
  $('#topicSkillFilter').value = '';
  $('#topicSelCount').textContent = '(0 selected)';
  renderTopicSkillPicker();
  $('#topicModal').classList.remove('hidden');
  setTimeout(() => $('#topicTagInput').focus(), 50);
};
const closeTopicModal = () => $('#topicModal').classList.add('hidden');

const submitTopic = async () => {
  const tag = $('#topicTagInput').value.trim().toLowerCase().replace(/^[/]+|^tag:/, '');
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(tag)) {
    return toast('Tag must be 2–31 chars, lowercase, alphanumeric + hyphens', 'error');
  }
  if (topicState.selected.size === 0) {
    return toast('Pick at least one skill to tag', 'error');
  }

  // Tag each selected skill. We need each skill's current tags so we can
  // append rather than overwrite. Fetch them in parallel.
  const names = [...topicState.selected];
  try {
    const skills = await Promise.all(names.map((n) => api(`/api/skills/${encodeURIComponent(n)}`)));
    for (const s of skills) {
      const existing = parseTagsField(s.frontmatter?.tags);
      if (existing.includes(tag)) continue;
      const next = [...existing, tag];
      await api(`/api/skills/${encodeURIComponent(s.name)}`, {
        method: 'PUT',
        body: JSON.stringify({ frontmatter: { tags: next.join(', ') } }),
      });
    }
    closeTopicModal();
    const data = await api('/api/state');
    Object.assign(state, {
      skills: data.skills,
      topics: data.topics,
      clusters: data.clusters,
      mcpServers: data.mcpServers || [],
      totals: data.totals || state.totals,
    });
    renderSidebar();
    renderList();
    renderDetail();
    const newTopic = state.topics.find((t) => t.tag === tag);
    if (newTopic) {
      toast(`Topic /${tag} now has ${newTopic.members.length} skills`);
      setFilter('topic', tag);
    } else {
      toast(`Tagged ${names.length} skills with ${tag}. Topic appears in sidebar at 3+ members.`);
    }
  } catch (e) { toast(e.message, 'error'); }
};

/* ─── New skill modal ──────────────────────────────── */

const openNewSkillModal = () => {
  $('#newName').value = '';
  $('#newDesc').value = '';
  $('#newTags').value = '';
  $('#newBody').value = '';
  $('#modal').classList.remove('hidden');
  setTimeout(() => $('#newName').focus(), 50);
};
const closeModal = () => $('#modal').classList.add('hidden');

const submitNewSkill = async () => {
  const name = $('#newName').value.trim().toLowerCase();
  const description = $('#newDesc').value.trim();
  const tags = parseTagsField($('#newTags').value);
  const body = $('#newBody').value;
  try {
    const r = await api('/api/skills', {
      method: 'POST',
      body: JSON.stringify({ name, description, tags, body }),
    });
    closeModal();
    toast(`Created ${r.name}`);
    const data = await api('/api/state');
    Object.assign(state, {
      skills: data.skills,
      topics: data.topics,
      clusters: data.clusters,
      mcpServers: data.mcpServers || [],
      totals: data.totals || state.totals,
    });
    renderSidebar();
    renderList();
    selectSkill(r.name);
  } catch (e) { toast(e.message, 'error'); }
};

/* ─── MCP detail view ──────────────────────────────── */

const renderMcpDetail = () => {
  const pane = $('#detail');
  pane.innerHTML = '';
  const inner = el('div', { class: 'detail-inner fade-in' });
  pane.appendChild(inner);

  const m = state.mcpDetail;
  inner.appendChild(el('div', { class: 'detail-head' },
    el('h1', {}, m.name),
    el('span', { class: `badge ${m.grade || ''}` }, `${fmt(m.tokens)} tokens`),
    el('span', { class: 'badge' }, m.scope || 'global'),
  ));
  inner.appendChild(el('div', { class: 'detail-meta' }, m.source || ''));

  inner.appendChild(el('div', { class: 'toolbar' },
    el('button', {
      class: 'btn',
      onclick: () => { state.mcpDetail = null; renderDetail(); },
    }, '← Back to overview'),
  ));

  const rows = [];
  if (m.command) rows.push(['Command', m.command]);
  if (Array.isArray(m.args) && m.args.length) rows.push(['Args', m.args.join(' ')]);
  if (m.url) rows.push(['URL', m.url]);
  if (m.transport) rows.push(['Transport', m.transport]);
  const envKeys = Object.keys(m.env || {});
  if (envKeys.length) rows.push(['Env keys', envKeys.join(', ')]);

  inner.appendChild(card('Configuration', 'how this server is invoked',
    el('div', {},
      ...rows.map(([k, v]) => el('div', { class: 'bar-row' },
        el('span', { class: 'label' }, k),
        el('span', { style: 'font-family: var(--mono); font-size: 12px; color: var(--text-muted); word-break: break-all;' }, v),
      )),
    ),
  ));

  inner.appendChild(card('Token cost', 'always loaded — paid every session',
    el('div', { style: 'font-size: 13px; line-height: 1.7' },
      el('div', {}, `Loaded into Claude on every session: ${fmt(m.tokens)} tokens`),
      el('div', { style: 'color: var(--text-muted)' },
        m.tokensSource === 'known'
          ? 'Source: curated estimate for this server. Order-of-magnitude accurate, not measured live.'
          : 'Source: envelope estimate (server name not in our known-server table). Likely under-counts servers with rich tool schemas — we\'d need to probe the server live for an accurate number.',
      ),
    ),
  ));
};

const showMcpDetail = (mcpName) => {
  const m = state.mcpServers.find((x) => x.name === mcpName);
  if (!m) return;
  state.mcpDetail = m;
  state.selected = null;
  state.clusterDetail = null;
  renderDetail();
};

/* ─── Routing ──────────────────────────────────────── */

const renderDetail = () => {
  if (state.selected) renderSkillDetail();
  else if (state.clusterDetail) renderClusterDetail();
  else if (state.mcpDetail) renderMcpDetail();
  else renderOverview();
};

const showClusterDetail = async (clusterId) => {
  try {
    const detail = await api(`/api/clusters/${encodeURIComponent(clusterId)}`);
    state.clusterDetail = detail;
    state.selected = null;
    state.mcpDetail = null;
    renderSidebar();
    renderDetail();
  } catch (e) { toast(e.message, 'error'); }
};

const setFilter = (kind, value) => {
  state.filter = { kind, value };
  state.selected = null;
  state.clusterDetail = null;
  state.mcpDetail = null;
  state.editing = false;
  renderSidebar();
  renderList();
  renderDetail();
};

const selectSkill = async (name) => {
  try {
    const skill = await api(`/api/skills/${encodeURIComponent(name)}`);
    state.selected = skill;
    state.clusterDetail = null;
    state.mcpDetail = null;
    state.editing = false;
    renderList();
    renderSidebar();
    renderDetail();
  } catch (e) { toast(e.message, 'error'); }
};

const saveEdits = async () => {
  if (!state.selected) return;
  const body = $('#bodyEdit').value;
  const description = $('#descEdit').value.trim();
  try {
    await api(`/api/skills/${encodeURIComponent(state.selected.name)}`, {
      method: 'PUT',
      body: JSON.stringify({ body, frontmatter: { description } }),
    });
    state.selected.body = body;
    state.selected.description = description;
    if (state.selected.frontmatter) state.selected.frontmatter.description = description;
    state.editing = false;
    renderSkillDetail();
    // Description changes affect eager token cost + topic detection — refresh
    // state so the donut + sidebar update.
    const data = await api('/api/state');
    Object.assign(state, {
      skills: data.skills,
      topics: data.topics,
      clusters: data.clusters,
      mcpServers: data.mcpServers || [],
      totals: data.totals || state.totals,
    });
    renderSidebar();
    renderList();
    toast('Saved (backup created in ~/.claude/curator/backups)');
  } catch (e) { toast(e.message, 'error'); }
};

const deleteSelected = async () => {
  if (!state.selected) return;
  const name = state.selected.name;
  if (!confirm(`Delete skill "${name}"?\n\nA backup will be saved to ~/.claude/curator/backups/ first.`)) return;
  try {
    await api(`/api/skills/${encodeURIComponent(name)}`, { method: 'DELETE' });
    state.skills = state.skills.filter((s) => s.name !== name);
    state.selected = null;
    state.editing = false;
    renderList();
    renderDetail();
    toast(`Deleted ${name}`);
  } catch (e) { toast(e.message, 'error'); }
};

const renameSkillPrompt = async (skill) => {
  const oldName = skill.name;
  const newName = prompt(
    `Rename "${oldName}" to:\n\n` +
    `(lowercase, alphanumeric + hyphens, e.g. "my-new-skill"). ` +
    `Backup created in ~/.claude/curator/backups/ first.`,
    oldName,
  );
  if (!newName || newName === oldName) return;
  const norm = newName.trim().toLowerCase();
  try {
    const r = await api(`/api/skills/${encodeURIComponent(oldName)}/rename`, {
      method: 'POST',
      body: JSON.stringify({ newName: norm }),
    });
    toast(`Renamed → ${r.name}`);
    const data = await api('/api/state');
    Object.assign(state, {
      skills: data.skills,
      topics: data.topics,
      clusters: data.clusters,
      mcpServers: data.mcpServers || [],
      totals: data.totals || state.totals,
    });
    const fresh = await api(`/api/skills/${encodeURIComponent(r.name)}`);
    state.selected = fresh;
    renderSidebar();
    renderList();
    renderDetail();
  } catch (e) { toast(e.message, 'error'); }
};

/* ─── Boot ─────────────────────────────────────────── */

const init = async () => {
  try {
    const data = await api('/api/state');
    state.skills = data.skills;
    state.topics = data.topics;
    state.clusters = data.clusters;
    state.mcpServers = data.mcpServers || [];
    state.totals = data.totals || { eager: 0, lazy: 0, all: 0 };
    renderSidebar();
    renderList();
    renderDetail();
  } catch (e) {
    document.body.innerHTML = `<div style="padding:60px;color:#f7768e;font-family:ui-monospace,monospace;background:#0b0d12;height:100vh">
      <h2 style="margin-top:0">Couldn't load scan data</h2>
      <p>${e.message}</p>
      <p style="color:#8a90a3">Run <code style="background:#1c2130;padding:2px 8px;border-radius:4px">curator scan</code> first, then refresh this page.</p>
    </div>`;
  }
};

$('#search').addEventListener('input', (e) => {
  state.query = e.target.value;
  renderList();
});

$('#newSkillBtn').addEventListener('click', openNewSkillModal);
$('#modalCloseBtn').addEventListener('click', closeModal);
$('#modalCancelBtn').addEventListener('click', closeModal);
$('#modalCreateBtn').addEventListener('click', submitNewSkill);
$('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal') closeModal(); });

$('#newTopicBtn').addEventListener('click', openTopicModal);
$('#topicModalCloseBtn').addEventListener('click', closeTopicModal);
$('#topicCancelBtn').addEventListener('click', closeTopicModal);
$('#topicCreateBtn').addEventListener('click', submitTopic);
$('#topicSkillFilter').addEventListener('input', (ev) => {
  topicState.filter = ev.target.value;
  renderTopicSkillPicker();
});
$('#topicModal').addEventListener('click', (ev) => { if (ev.target.id === 'topicModal') closeTopicModal(); });

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  closeModal();
  closeTopicModal();
});

init();

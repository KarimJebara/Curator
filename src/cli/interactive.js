import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { reportsDir } from '../lib/paths.js';
import { collectSkills } from '../detectors/skills.js';
import { applyAll, buildContext } from '../apply/dispatcher.js';

// Two-level review:
//   1. Cluster overview — what's in the cluster, what curator proposes,
//      summary of verifier verdicts. User picks a cluster-level action.
//   2. Per-action flashcards — only when user opts to review-each. Each card
//      shows before/after/why/verdict for one action.
//
// Defaults: PASS → y, WARN/FAIL → n. Always confirm at the end.

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', blue: '\x1b[34m', magenta: '\x1b[35m',
};

const RULE = '─'.repeat(72);

const verdictBadge = (v) => {
  if (!v) return `${C.dim}—${C.reset}`;
  if (v === 'PASS') return `${C.green}✓ PASS${C.reset}`;
  if (v === 'WARN') return `${C.yellow}⚠ WARN${C.reset}`;
  if (v === 'FAIL') return `${C.red}✗ FAIL${C.reset}`;
  return v;
};

const wrap = (text, width = 66, indent = '  ') => {
  if (!text) return indent + '(none)';
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).length > width) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.map((l) => indent + l).join('\n');
};

const clear = () => process.stdout.write('\x1b[2J\x1b[H');
const findSkillByName = (skills, name) => skills.find((s) => s.name === name);
const defaultFor = (verdict) => (verdict === 'PASS' || !verdict) ? 'y' : 'n';

// ────────────────────────────────────────────────────────────────────
// Cluster overview — the big picture for one cluster
// ────────────────────────────────────────────────────────────────────

const summarizeProposal = (proposal) => {
  const actions = (proposal.actions || []).filter((a) => a.type !== 'keep');
  const verdicts = proposal.verification?.verdicts || [];
  const counts = { PASS: 0, WARN: 0, FAIL: 0 };
  for (const v of verdicts) counts[v.verdict] = (counts[v.verdict] || 0) + 1;
  const types = { specialize: 0, rewrite: 0, delete: 0 };
  for (const a of actions) types[a.type] = (types[a.type] || 0) + 1;
  return { actions, counts, types, hasRouter: Boolean(proposal.routerSkill) };
};

const confBadge = (c) => {
  if (c === 'high') return `${C.green}● high confidence${C.reset}`;
  if (c === 'medium') return `${C.yellow}● medium confidence${C.reset}`;
  if (c === 'low') return `${C.red}● low confidence${C.reset}`;
  return '';
};

const renderClusterOverview = (cluster, proposal, idx, total) => {
  clear();
  const summary = summarizeProposal(proposal);
  console.log(RULE);
  const conf = cluster.confidence ? `  ${confBadge(cluster.confidence)}` : '';
  console.log(`${C.dim}Cluster ${idx + 1} of ${total}${C.reset}  ${C.bold}${cluster.label}${C.reset}  ${C.dim}(${cluster.members.length} skills, ~${cluster.totalTokens} tokens, ${(cluster.meanSimilarity * 100).toFixed(0)}% mean similarity${typeof cluster.silhouette === 'number' ? `, silhouette ${cluster.silhouette.toFixed(2)}` : ''})${C.reset}${conf}`);
  console.log(RULE);
  if (cluster.confidence === 'low') {
    console.log('');
    console.log(`  ${C.yellow}This cluster has low silhouette — members may not actually belong together. Consider skipping or reviewing each action carefully.${C.reset}`);
  }
  console.log('');
  console.log(`${C.dim}members${C.reset}`);
  for (const m of cluster.members) {
    const desc = (m.description || '').slice(0, 70);
    console.log(`  ${C.cyan}${m.name.padEnd(30)}${C.reset}  ${C.dim}${desc}${desc.length === 70 ? '…' : ''}${C.reset}`);
  }
  console.log('');

  if (summary.hasRouter) {
    console.log(`${C.dim}proposed direction${C.reset}`);
    console.log(`  Split into specialists + 1 router skill ${C.bold}${proposal.router?.name}${C.reset}`);
  } else {
    console.log(`${C.dim}proposed direction${C.reset}`);
    console.log(`  Tighten descriptions / minor renames; no router needed.`);
  }
  console.log('');

  console.log(`${C.dim}actions in this cluster${C.reset}`);
  if (summary.types.specialize) console.log(`  ${C.magenta}${summary.types.specialize}${C.reset} specialize  ${C.dim}(rename + tighten description)${C.reset}`);
  if (summary.types.rewrite) console.log(`  ${C.blue}${summary.types.rewrite}${C.reset} rewrite     ${C.dim}(description-only, no rename)${C.reset}`);
  if (summary.types.delete) console.log(`  ${C.red}${summary.types.delete}${C.reset} delete      ${C.dim}(soft delete with backup)${C.reset}`);
  if (summary.hasRouter) console.log(`  ${C.green}1${C.reset} router      ${C.dim}(new orchestrator skill)${C.reset}`);
  console.log('');

  if (summary.counts.PASS + summary.counts.WARN + summary.counts.FAIL > 0) {
    console.log(`${C.dim}independent verifier${C.reset}`);
    console.log(`  ${C.green}${summary.counts.PASS} PASS${C.reset}    ${C.yellow}${summary.counts.WARN} WARN${C.reset}    ${C.red}${summary.counts.FAIL} FAIL${C.reset}`);
    if (summary.counts.WARN || summary.counts.FAIL) {
      console.log(`  ${C.dim}(review each will show every verdict; accept-clean takes only the PASS-rated)${C.reset}`);
    }
  }
  console.log('');
  console.log(RULE);
};

const promptCluster = async (rl, summary) => {
  const hasIssues = summary.counts.WARN || summary.counts.FAIL;
  const lines = [
    `${C.bold}r${C.reset}eview each       walk through every action with full context`,
  ];
  if (!hasIssues) {
    lines.push(`${C.bold}a${C.reset}ccept all        accept everything proposed`);
  } else {
    lines.push(`${C.bold}a${C.reset}ccept clean      accept the ${C.green}${summary.counts.PASS} PASS${C.reset} actions, skip ${C.yellow}WARN${C.reset}/${C.red}FAIL${C.reset}`);
  }
  lines.push(`${C.bold}s${C.reset}kip cluster      apply nothing in this cluster`);
  lines.push(`${C.bold}q${C.reset}uit              stop reviewing entirely`);
  for (const l of lines) console.log(`  ${l}`);
  console.log('');
  return (await rl.question('> ')).trim().toLowerCase();
};

// ────────────────────────────────────────────────────────────────────
// Per-action flashcard
// ────────────────────────────────────────────────────────────────────

const renderActionCard = (item, idx, totalInCluster, skills) => {
  const a = item.action;
  clear();
  console.log(RULE);
  console.log(`${C.dim}Cluster${C.reset} ${C.bold}${item.cluster.label}${C.reset}  ${C.dim}— action ${idx + 1} of ${totalInCluster}${C.reset}`);
  console.log(RULE);
  console.log('');

  switch (a.type) {
    case 'specialize':
      console.log(`  ${C.bold}${C.magenta}SPECIALIZE${C.reset}  ${C.cyan}${a.from}${C.reset}`);
      console.log('');
      console.log(`  ${C.dim}before${C.reset}`);
      console.log(`    name         ${a.from}`);
      console.log(`    description`);
      console.log(wrap(findSkillByName(skills, a.from)?.description || '(unknown)', 60, '      '));
      console.log('');
      console.log(`  ${C.dim}after${C.reset}`);
      console.log(`    name         ${C.bold}${a.to}${C.reset}`);
      console.log(`    description`);
      console.log(wrap(a.tightened_description || '(unchanged)', 60, '      '));
      console.log('');
      console.log(`  ${C.dim}why${C.reset}`);
      console.log(wrap(a.reason || '(no reason given)', 66, '    '));
      break;

    case 'rewrite':
      console.log(`  ${C.bold}${C.blue}REWRITE${C.reset}  ${C.cyan}${a.name}${C.reset}  ${C.dim}(description only, no rename)${C.reset}`);
      console.log('');
      console.log(`  ${C.dim}before${C.reset}`);
      console.log(wrap(findSkillByName(skills, a.name)?.description || '(unknown)', 60, '    '));
      console.log('');
      console.log(`  ${C.dim}after${C.reset}`);
      console.log(wrap(a.tightened_description || '(no new description)', 60, '    '));
      console.log('');
      console.log(`  ${C.dim}why${C.reset}`);
      console.log(wrap(a.reason || '', 66, '    '));
      break;

    case 'delete':
      console.log(`  ${C.bold}${C.red}DELETE${C.reset}  ${C.cyan}${a.name}${C.reset}`);
      console.log('');
      console.log(`  ${C.dim}current description${C.reset}`);
      console.log(wrap(findSkillByName(skills, a.name)?.description || '(unknown)', 60, '    '));
      console.log('');
      console.log(`  ${C.dim}why${C.reset}`);
      console.log(wrap(a.reason || '', 66, '    '));
      console.log('');
      console.log(`  ${C.dim}A backup is taken before deletion. Restorable from ~/.claude/curator/backups/${C.reset}`);
      break;

    case 'generate-router':
      console.log(`  ${C.bold}${C.green}NEW ROUTER SKILL${C.reset}  ${C.cyan}${a.name}${C.reset}`);
      console.log('');
      console.log(`  Creates ~/.claude/skills/${a.name}/SKILL.md.`);
      console.log(`  Dispatches user tasks to the right specialist in this cluster.`);
      console.log('');
      console.log(`  ${C.dim}preview${C.reset}`);
      console.log(wrap((item.proposal.routerSkill || '').slice(0, 400) + '…', 66, '    '));
      break;

    default:
      console.log(`  ${a.type}: ${JSON.stringify(a)}`);
  }

  console.log('');
  console.log(`  ${C.dim}verifier${C.reset}  ${verdictBadge(item.verdict)}`);
  if (item.verdictReason) console.log(wrap(item.verdictReason, 66, '    '));
  console.log('');
  console.log(RULE);
};

const promptAction = async (rl, item) => {
  const def = defaultFor(item.verdict);
  const ynLabel = def === 'y' ? '[Y/n]' : '[y/N]';
  return (await rl.question(`Apply? ${ynLabel}  (d=full diff, b=back, q=quit cluster)\n> `)).trim().toLowerCase();
};

const showFullDiff = async (rl, item, skills) => {
  const a = item.action;
  clear();
  console.log(RULE);
  console.log(`Full diff: ${a.from || a.name || a.type}`);
  console.log(RULE);
  console.log('');
  if (a.type === 'specialize' || a.type === 'rewrite') {
    const target = a.from || a.name;
    const skill = findSkillByName(skills, target);
    console.log(`${C.bold}BEFORE${C.reset}  ${C.dim}(${skill ? skill.tokens + ' tokens' : '?'})${C.reset}\n`);
    console.log(`name:        ${target}`);
    console.log(`description: ${skill?.description || '(unknown)'}`);
    if (skill?.body) {
      console.log(`\n${C.dim}body excerpt:${C.reset}`);
      console.log(skill.body.split('\n').slice(0, 14).map((l) => '  ' + l).join('\n'));
    }
    console.log(`\n${C.bold}AFTER${C.reset}\n`);
    console.log(`name:        ${a.to || a.name}`);
    console.log(`description: ${a.tightened_description || '(unchanged)'}`);
  } else if (a.type === 'generate-router') {
    console.log(item.proposal.routerSkill || '(no router content)');
  } else if (a.type === 'delete') {
    const skill = findSkillByName(skills, a.name);
    console.log(`Will move to backups: ${skill?.dir || a.name}`);
    console.log(`description: ${skill?.description || '(unknown)'}`);
  }
  console.log(`\n${C.dim}Press enter to return.${C.reset}`);
  await rl.question('');
};

// ────────────────────────────────────────────────────────────────────
// Cluster→action loop
// ────────────────────────────────────────────────────────────────────

const flattenClusterActions = (cluster, proposal) => {
  const verdicts = proposal.verification?.verdicts || [];
  const items = [];
  (proposal.actions || []).forEach((a, idx) => {
    if (a.type === 'keep') return;
    const v = verdicts.find((x) => x.action_index === idx);
    items.push({
      action: { ...a, cluster: cluster.id },
      cluster, proposal,
      verdict: v?.verdict, verdictReason: v?.reason,
    });
  });
  if (proposal.routerSkill) {
    items.push({
      action: { type: 'generate-router', name: proposal.router?.name, cluster: cluster.id },
      cluster, proposal,
      verdict: 'PASS', verdictReason: null,
    });
  }
  return items;
};

const reviewClusterEach = async (rl, cluster, proposal, skills) => {
  const items = flattenClusterActions(cluster, proposal);
  const decisions = new Array(items.length).fill(null);
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    renderActionCard(item, i, items.length, skills);
    const ans = await promptAction(rl, item);
    if (ans === 'q' || ans === 'quit') break;
    if (ans === 'b' || ans === 'back') { if (i > 0) i--; continue; }
    if (ans === 'd' || ans === 'diff') { await showFullDiff(rl, item, skills); continue; }
    const def = defaultFor(item.verdict);
    const yes = ans === 'y' || ans === 'yes' || (ans === '' && def === 'y');
    const no = ans === 'n' || ans === 'no' || (ans === '' && def === 'n');
    if (yes) decisions[i] = 'y';
    else if (no) decisions[i] = 'n';
    else continue;
    i++;
  }
  return items.filter((_, idx) => decisions[idx] === 'y').map((it) => it.action);
};

const acceptCluster = (cluster, proposal, mode) => {
  const items = flattenClusterActions(cluster, proposal);
  if (mode === 'all') return items.map((it) => it.action);
  // mode === 'clean': PASS only (the router defaults to PASS)
  return items.filter((it) => (it.verdict || 'PASS') === 'PASS').map((it) => it.action);
};

// ────────────────────────────────────────────────────────────────────
// Top-level entry
// ────────────────────────────────────────────────────────────────────

export const interactiveReview = async ({ jsonPath } = {}) => {
  const target = jsonPath || path.join(reportsDir(), 'latest.json');
  if (!fs.existsSync(target)) {
    console.error(`No cached report found at ${target}. Run 'curator scan' first.`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  const proposals = data.proposals || {};
  const clusters = (data.clusters || []).filter((c) => proposals[c.id] && !proposals[c.id].error);
  const topics = data.topics || [];
  const skills = data.skills || collectSkills();

  if (!clusters.length && !topics.length) {
    console.log('No clusters or topics found. Run `curator scan` first.');
    return;
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  const allSelected = [];
  let i = 0;
  let quit = false;

  while (i < clusters.length && !quit) {
    const cluster = clusters[i];
    const proposal = proposals[cluster.id];
    renderClusterOverview(cluster, proposal, i, clusters.length);
    const summary = summarizeProposal(proposal);
    const ans = await promptCluster(rl, summary);

    if (ans === 'q' || ans === 'quit') { quit = true; break; }
    if (ans === 's' || ans === 'skip' || ans === '') { i++; continue; }

    if (ans === 'a' || ans === 'accept') {
      const hasIssues = summary.counts.WARN || summary.counts.FAIL;
      const picked = acceptCluster(cluster, proposal, hasIssues ? 'clean' : 'all');
      allSelected.push(...picked);
      i++; continue;
    }

    if (ans === 'r' || ans === 'review' || ans === 'review each') {
      const picked = await reviewClusterEach(rl, cluster, proposal, skills);
      allSelected.push(...picked);
      i++; continue;
    }

    // Unknown — re-prompt the same cluster
    console.log(`${C.dim}(unrecognized choice — try r / a / s / q)${C.reset}`);
    await rl.question('Press enter to retry… ');
  }

  // Topics walkthrough — separate phase, simpler decisions per topic.
  if (topics.length && !quit) {
    let ti = 0;
    while (ti < topics.length && !quit) {
      const topic = topics[ti];
      renderTopicCard(topic, ti, topics.length);
      const ans = (await rl.question('Generate browser router for this topic? [y/N/q]\n> ')).trim().toLowerCase();
      if (ans === 'q' || ans === 'quit') { quit = true; break; }
      if (ans === 'y' || ans === 'yes') {
        allSelected.push({ type: 'generate-topic-router', name: topic.tag, topic: topic.id });
      }
      ti++;
    }
  }

  rl.close();

  if (!allSelected.length) {
    console.log('\nNothing selected. Nothing applied.');
    return;
  }

  // Confirmation summary
  clear();
  console.log(RULE);
  console.log(`${C.bold}Final review${C.reset}`);
  console.log(RULE);
  console.log('');
  console.log(`${allSelected.length} action(s) selected:`);
  for (const a of allSelected) console.log(`  • ${oneLine(a)}`);
  console.log('');

  const rl2 = readline.createInterface({ input: stdin, output: stdout });
  const final = (await rl2.question('Apply now? [y/N] ')).trim().toLowerCase();
  rl2.close();

  if (final !== 'y' && final !== 'yes') {
    console.log('Skipped. Nothing applied.');
    return;
  }

  const realSkills = collectSkills();
  const ctx = buildContext({ skills: realSkills, proposalsByCluster: proposals, topics });
  const results = applyAll(allSelected, ctx);
  let ok = 0, failed = 0;
  for (const r of results) {
    if (r.ok) {
      ok++;
      console.log(`  ${C.green}✓${C.reset} ${oneLine(r.action)}`);
    } else {
      failed++;
      console.log(`  ${C.red}✗${C.reset} ${oneLine(r.action)} — ${r.error}`);
    }
  }
  console.log('');
  console.log(`Applied ${ok}, ${failed} failure(s). Backups in ~/.claude/curator/backups/`);
};

const oneLine = (a) => {
  switch (a.type) {
    case 'specialize': return `Specialize ${a.from} → ${a.to}`;
    case 'rewrite': return `Rewrite ${a.name} description`;
    case 'delete': return `Delete ${a.name}`;
    case 'generate-router': return `Generate router ${a.name}`;
    case 'generate-topic-router': return `Generate topic router /${a.name}`;
    default: return JSON.stringify(a);
  }
};

const renderTopicCard = (topic, idx, total) => {
  clear();
  console.log(RULE);
  console.log(`${C.dim}Topic ${idx + 1} of ${total}${C.reset}  ${C.bold}${topic.tag}${C.reset}  ${C.dim}(${topic.members.length} skills, ~${topic.totalTokens} tokens)${C.reset}`);
  console.log(RULE);
  console.log('');
  console.log(`${C.dim}members${C.reset}`);
  for (const m of topic.members) {
    const desc = (m.description || '').slice(0, 70);
    console.log(`  ${C.cyan}${m.name.padEnd(34)}${C.reset}  ${C.dim}${desc}${desc.length === 70 ? '…' : ''}${C.reset}`);
  }
  console.log('');
  console.log(`${C.dim}what this would do${C.reset}`);
  console.log(`  Create ${C.bold}~/.claude/skills/${topic.tag}/SKILL.md${C.reset} as a browser router.`);
  console.log(`  Invoking \`/${topic.tag}\` lists all ${topic.members.length} specialists for you to pick from.`);
  console.log(`  Unlike cluster routers, this does NOT pick one specialist — it shows them all.`);
  console.log('');
  console.log(RULE);
};

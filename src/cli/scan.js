import fs from 'node:fs';
import path from 'node:path';
import { collectSkills } from '../detectors/skills.js';
import { collectMcpServers, mcpDigest, mcpDuplicates } from '../detectors/mcp.js';
import { clusterSkills } from '../detectors/cluster.js';
import { orphanMemoryFiles, driftedSkills } from '../detectors/orphans.js';
import { tagsForSkills } from '../detectors/tags.js';
import { buildTopics } from '../detectors/topics.js';
import { runPipeline } from '../pipeline/run.js';
import { renderReport } from '../report/render.js';
import { reportsDir, ensureDir } from '../lib/paths.js';
import { backend } from '../lib/llm.js';

const today = () => new Date().toISOString().slice(0, 10);

export const scan = async ({ quiet = false, rewrite = false, projectMcp } = {}) => {
  const log = (msg) => { if (!quiet) console.log(msg); };

  log('Collecting skills…');
  const skills = collectSkills();
  log(`  Found ${skills.length} skills.`);

  log('Collecting MCP servers…');
  const rawMcp = collectMcpServers({ projectMcpPath: projectMcp });
  const mcpServers = mcpDigest(rawMcp);
  const mcpDups = mcpDuplicates(mcpServers);
  log(`  Found ${mcpServers.length} servers, ${mcpDups.length} duplicate groups.`);

  log('Clustering skills…');
  const clusters = clusterSkills(skills);
  log(`  Found ${clusters.length} clusters.`);

  log('Building topics…');
  const tagMap = tagsForSkills(skills);
  const topics = buildTopics(skills, { augmentedTags: tagMap });
  // Topics are virtual: they live in latest.json and surface in the dashboard
  // for navigation. We do not write topic-router SKILL.md files to disk —
  // browsing/filtering happens in the dashboard, not via a slash command that
  // dumps a list and asks the user to pick.
  log(`  Found ${topics.length} topics.`);

  log('Scanning for orphans…');
  const orphans = orphanMemoryFiles();
  const drifted = driftedSkills(skills);
  log(`  ${orphans.length} orphan files, ${drifted.length} drifted skills.`);

  let proposals = {};
  if (rewrite && clusters.length) {
    log(`Running LLM pipeline on ${clusters.length} clusters via ${backend()} backend…`);
    proposals = await runPipeline(clusters, {
      onProgress: (e) => {
        if (e.stage === 'cluster-start') log(`  → ${e.cluster.label} (${e.cluster.members.length} skills)`);
        if (e.stage === 'cluster-error') log(`  ✗ ${e.cluster.label}: ${e.error}`);
      },
    });
  } else {
    log('  (LLM rewriting off — pass --rewrite to enable)');
  }

  const report = renderReport({ skills, clusters, topics, mcpServers, mcpDups, orphans, drifted, proposals });

  ensureDir(reportsDir());
  const reportPath = path.join(reportsDir(), `${today()}.md`);
  fs.writeFileSync(reportPath, report);
  fs.writeFileSync(path.join(reportsDir(), 'latest.md'), report);
  fs.writeFileSync(path.join(reportsDir(), 'latest.json'), JSON.stringify({
    skills, clusters, topics, mcpServers, mcpDups, orphans: orphans.length, drifted: drifted.map((s) => s.name), proposals,
  }, null, 2));

  log('');
  log(`Snapshot written to ${reportPath}`);
  log(`Run: curator dashboard   to browse and clean up your library in the browser.`);
  if (rewrite) {
    log(`Or:  curator review     to walk through LLM-proposed specializations.`);
  }
  return { reportPath, proposals, clusters };
};

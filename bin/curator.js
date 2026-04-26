#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan } from '../src/cli/scan.js';
import { review } from '../src/cli/review.js';
import { render } from '../src/cli/render.js';
import { interactiveReview } from '../src/cli/interactive.js';
import { cleanRouters } from '../src/cli/clean-routers.js';
import { dashboard } from '../src/cli/dashboard.js';
import { installCron, uninstallCron, isInstalled } from '../src/schedule/install.js';
import { reportsDir } from '../src/lib/paths.js';

const __filename = fileURLToPath(import.meta.url);
const binPath = path.resolve(__filename);

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = parseFlags(argv.slice(1));

const usage = () => {
  console.log(`curator — turn your skill graveyard into a coherent toolkit

Usage:
  curator scan [--rewrite] [--quiet] [--project-mcp PATH]
      Audit your skill library. Detects clusters, topics, MCP duplicates,
      orphans, and version drift. Writes a snapshot to ~/.claude/curator/.
      Defaults to deterministic-only (no LLM calls, no API key, finishes in
      seconds). Pass --rewrite to run the full LLM pipeline that proposes
      specialized renames + a router skill (slow; opt-in for power users).

  curator review
      Two-level walkthrough of the latest scan.
      First: an overview screen per cluster — members, proposed direction,
      action counts, and verifier verdicts. Pick (r)eview each, (a)ccept the
      clean actions, (s)kip cluster, or (q)uit.
      Then if you chose review: per-action flashcards with full before/after,
      reasoning, and verdict. y/n per card, d for full diff, b to go back.
      Always confirms once at the end before anything is written.

  curator review --report [--apply]
      Markdown mode: read ~/.claude/curator/reports/latest.md and apply any
      checked boxes. Useful for power users who want to commit decisions to git.

  curator render
      Re-render the latest report from cached JSON (no LLM calls). Useful after
      report-format or normalizer fixes.

  curator dashboard [--port 4711] [--no-open]
      Open a local web dashboard to browse, edit, and delete skills. Reads the
      latest scan and groups skills by virtual topics and clusters. Edits and
      deletes are backed up to ~/.claude/curator/backups/.

  curator schedule install [--at "0 9 * * 1"]
  curator schedule uninstall
  curator schedule status
      Manage the weekly cron entry.

  curator report
      Print the path of the most recent report.

Backends:
  Default            Uses your 'claude' CLI login (Max/Pro subscription). No API key needed.
  ANTHROPIC_API_KEY  If set, switches to the Anthropic SDK (faster, has prompt caching).
`);
};

const main = async () => {
  switch (cmd) {
    case 'scan':
      await scan({
        quiet: flags.quiet,
        rewrite: flags.rewrite,
        projectMcp: flags['project-mcp'],
      });
      break;
    case 'review':
      if (flags.report) {
        review({ apply: flags.apply, reportPath: typeof flags.report === 'string' ? flags.report : undefined });
      } else {
        await interactiveReview();
      }
      break;
    case 'render':
      render({ jsonPath: flags.json });
      break;
    case 'clean-routers':
      cleanRouters({ dryRun: flags['dry-run'] });
      break;
    case 'dashboard': {
      const port = flags.port ? Number(flags.port) : 4711;
      dashboard({ port, open: !flags['no-open'] });
      break;
    }
    case 'schedule': {
      const sub = argv[1];
      if (sub === 'install') {
        const r = installCron({ binPath, schedule: flags.at });
        console.log(`Installed cron entry: ${r.schedule}`);
      } else if (sub === 'uninstall') {
        const r = uninstallCron();
        console.log(r.removed ? 'Removed cron entry.' : 'No curator cron entry was installed.');
      } else if (sub === 'status') {
        console.log(isInstalled() ? 'Installed' : 'Not installed');
      } else {
        usage();
        process.exit(1);
      }
      break;
    }
    case 'report': {
      const p = path.join(reportsDir(), 'latest.md');
      console.log(p);
      break;
    }
    case '-h':
    case '--help':
    case undefined:
      usage();
      break;
    default:
      console.error(`Unknown command: ${cmd}`);
      usage();
      process.exit(1);
  }
};

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});

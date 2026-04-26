# curator

<p align="center">
  <img src="docs/media/demo.gif" alt="curator dashboard demo" width="760" />
</p>

> Open-source local dashboard for your Claude Code skills and MCP servers. Free, no login, no API key. See your library at a glance, find duplicates, decide what to keep.

## What it does

`curator` runs a local web dashboard at `http://127.0.0.1:4711` so you can actually see what's in your `~/.claude/`.

- **At-a-glance overview** — total skills, always-loaded vs on-use token cost, grade distribution, top-heaviest descriptions, top-heaviest bodies, MCP servers.
- **Cluster overlap analysis** — silhouette-scored hierarchical clustering surfaces overlapping skills. Click any cluster to see shared core vocabulary, per-skill unique vocabulary, and pairwise similarity. Members with no unique vocabulary are flagged as likely duplicates.
- **Topic browsing** — auto-detected tag groupings (`kotlin`, `testing`, `frontend`, …) in the sidebar. A skill can belong to several.
- **Edit and delete in place** — click a user-owned skill, edit the body, save. Or delete it. Plugin-installed skills are read-only.
- **Backups before every change** — written to `~/.claude/curator/backups/`. Every edit and delete is reversible.

Nothing auto-applies. You decide what to keep.

## Install

```bash
git clone git@github.com:KarimJebara/Curator.git
cd Curator
npm install
npm link            # puts `curator` on PATH; one-time setup
```

`npm link` is optional — you can also run everything as `node bin/curator.js <cmd>`.

## Quickstart

```bash
curator scan        # deterministic snapshot, ~3 seconds, no API key
curator dashboard   # opens http://127.0.0.1:4711 in your browser
```

That's it. The default scan is fully deterministic and finishes in seconds. There's also a weekly cron option if you want it to re-snapshot on its own:

```bash
curator schedule install
```

## How it works

A single `curator scan` produces two views of your library:

**Clusters** — Ward-linkage hierarchical clustering on TF-IDF + bigrams, with silhouette confidence scoring. Each cluster gets a high (≥0.28), medium (0.18–0.28), or low (<0.18) confidence badge so you know how much to trust the grouping. Click into a cluster from the dashboard to see what its members share, what each one *uniquely* knows, and pairwise cosine similarity. Members with no unique vocabulary stand out — those are your duplicates.

**Topics** — tag-based groupings detected from skill names, descriptions, and a known-vocabulary scan. A skill can belong to multiple topics. Surfaced in the dashboard sidebar.

## Always-loaded vs on-use token cost

Two different cost categories the dashboard separates:

- **Always loaded** — the `description:` line at the top of every SKILL.md is loaded into Claude on **every session**, so the autorouter can decide which skill to invoke. You pay this whether you ever use the skill or not. Usually 30–100 tokens per skill.
- **On use** — the body of the skill (everything below the frontmatter) loads **only when the Skill tool actually fires** for that skill. Usually 200–6,000 tokens.

Both are graded separately because the rules are different. A bloated description hurts every session forever — that's the kind to trim aggressively. A bloated body only hurts the sessions where the skill actually fires, so depth there is fine if it pays off when triggered.

## Advanced: LLM-driven rewriting (opt-in)

Default scan is deterministic. If you want machine-proposed specializations, pass `--rewrite` to run a 5-stage LLM pipeline:

```bash
curator scan --rewrite     # ~2–3 min per cluster
curator review             # walk through proposals as y/n flashcards
```

| Stage | Model | Purpose |
|---|---|---|
| 1. Detect clusters | none | Deterministic clustering |
| 2. Fingerprint | Haiku 4.5 | Extract each skill's unique strengths |
| 3. Specialize | Sonnet 4.6 | Propose renames + tightened prompts |
| 4. Generate router | Sonnet 4.6 | Produce a router SKILL.md |
| 5. Verify | Sonnet 4.6 (fresh instance) | Independent second opinion |

This is a power-user mode, not the headline. The dashboard alone is the headline.

## How it compares

`curator` is not the first tool in this space. Honest comparison in [`docs/COMPARISON.md`](./docs/COMPARISON.md). Short version:

- [`claudetoolkit.com`](https://claudetoolkit.com/) — closed-source desktop GUI, freemium. Closest analog. Pick this if you want a polished commercial product covering every config type. We're the open-source alternative focused on skills + MCPs with clustering on top.
- [`claude-config-audit`](https://github.com/paolodalprato/claude-config-audit), [`mcp-optimizer`](https://github.com/choam2426/mcp-optimizer), [`mcp-tidy`](https://github.com/nnnkkk7/mcp-tidy), `mcp-checkup`, [`claude-code-organizer`](https://github.com/mcpware/claude-code-organizer) — all open-source CLI auditors. None have a web dashboard or clustering. We borrow detection patterns from these (with credit).

## Roadmap

**v0.1 (now)**
- Local web dashboard, cluster overlap analysis, always-loaded vs on-use token grading
- MCP duplicate + token-cost detection, orphan & drift flagging
- Weekly cron snapshot
- Optional `--rewrite` LLM pipeline

**v0.2 (next)**
- MCP server editing through the UI
- Bulk select + delete
- Slash commands and agents in the dashboard
- Side-by-side skill compare
- Effectiveness tracking from `~/.claude/projects/*.jsonl` (find skills that *should* have triggered but didn't)
- Cross-tool: Cursor, Codex, OpenCode, Claude Desktop

## License & contributing

MIT — see [LICENSE](./LICENSE). The CLI is and stays MIT.

Contributions go through a CLA (see [CONTRIBUTING.md](./CONTRIBUTING.md)) — required to keep the project permissively licensed long-term. The CLA bot signs you in on your first PR.

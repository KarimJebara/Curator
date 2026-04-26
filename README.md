# curator

<p align="center">
  <img src="docs/media/demo.gif" alt="curator dashboard demo" width="760" />
</p>

> Open-source local dashboard for managing your Claude Code skills and MCP servers. Free. No login. No API key. See your library at a glance, find duplicates, decide what to keep.

You install skills from marketplaces and GitHub. After a few months you have 96 skills consuming thousands of tokens of always-loaded descriptions every session — and a quarter of them overlap. Existing tools detect the bloat. They don't help you fix it.

`curator` opens a local web dashboard at `http://127.0.0.1:4711` where you can:

- **See your library** — total skills, eager vs lazy token cost, grade distribution, top-heaviest descriptions, top-heaviest bodies.
- **Spot redundancy** — silhouette-scored clusters. Click any cluster to see what its members share, what each one uniquely knows, and pairwise similarity. Confidence is shown so you know how much to trust the grouping.
- **Browse by topic** — `kotlin`, `testing`, `frontend`, etc. — auto-detected from your skill names and descriptions.
- **Edit and delete** — click any user-owned skill, edit the body in place, or delete it. Plugin-installed skills are read-only.
- **Backups before every change** — written to `~/.claude/curator/backups/` so nothing is destructive.

```
┌─ Cluster: frontend (5 skills, silhouette 0.34 · high) ─────────────┐
│                                                                    │
│  Pairwise similarity                                               │
│   frontend-react ↔ frontend-nextjs           87%  ⚠ near-duplicate │
│   frontend-android ↔ frontend-swiftui        12%                   │
│   ...                                                              │
│                                                                    │
│  Shared by ≥4 of 5 (core vocabulary)                              │
│   [react] [component] [hooks] [props] [render] [state] ...         │
│                                                                    │
│  What each skill uniquely knows                                    │
│   frontend-android   compose, kotlin, gradle, jetpack              │
│   frontend-swiftui   liquid-glass, swiftui, ios, observable        │
│   frontend-slides    reveal, deck, slide, presentation             │
│   frontend-nextjs    app-router, server-component, rsc             │
│   frontend-react     ⚠ no unique vocabulary — likely duplicate     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

You decide what to keep. Nothing auto-applies.

## Install

```bash
git clone <repo>
cd curator
npm link             # puts `curator` on PATH; one-time setup
```

No `npm install` required — no runtime dependencies for the default path. (The optional LLM-rewriting mode lazy-loads the Anthropic SDK if you opt in.)

## Quickstart

```bash
curator scan         # ~3 seconds, deterministic, no LLM, no API key
curator dashboard    # opens http://127.0.0.1:4711 in your browser
```

Want it to re-audit every Monday?

```bash
curator schedule install
```

## Two views, one scan

A single `curator scan` produces two parallel groupings:

**Clusters — for spotting redundancy.** Tight similarity groups (Ward-linkage hierarchical clustering on TF-IDF + bigrams + IDF, with silhouette-based confidence scoring). Each cluster gets high / medium / low confidence so you know whether to trust the grouping. Click into a cluster from the dashboard to see shared core vocabulary, per-skill unique vocabulary, and pairwise similarity. Skills with **no unique vocabulary** are flagged as likely duplicates.

**Topics — for browsing.** Tag-based groupings (kebab-prefix + known-vocabulary scan). A skill can belong to multiple topics. Surface area in the dashboard sidebar — pick `/kotlin` to see your 6 Kotlin skills, `/testing` to see your 10 testing skills, etc.

## Eager vs lazy token cost

Skill descriptions get loaded into the autorouter context **every session** (eager — always paid). Skill bodies are loaded only when the skill actually fires (lazy — paid on invocation). The dashboard shows both numbers separately so the "cost before first prompt" headline isn't misleading.

| | Always paid (eager) | Paid on invocation (lazy) |
|---|---:|---:|
| What loads | Every skill description | One body when invoked |
| Typical size | 30–100 tokens each | 200–6000 tokens each |
| What to grade hard | Bloated descriptions | Bloated bodies |

Bloated descriptions hurt every session. Bloated bodies only hurt the sessions where they fire. The dashboard grades them differently for that reason.

## Advanced: LLM-driven rewriting

Power-user opt-in. Pass `--rewrite` to run a 5-stage LLM pipeline that proposes specialized renames + a router skill that dispatches to them via subagents:

```bash
curator scan --rewrite     # ~2-3 min per cluster
curator review             # walk through proposals as y/n flashcards
```

Pipeline stages:

| Stage | Model | Purpose |
|---|---|---|
| 1. Detect clusters | none (deterministic) | Group overlapping skills |
| 2. Fingerprint each | Haiku 4.5 | Extract unique strengths |
| 3. Specialize | Sonnet 4.6 | Propose renames + tightened prompts |
| 4. Generate router | Sonnet 4.6 | Produce orchestrator SKILL.md |
| 5. Verify | Sonnet 4.6 (fresh instance) | Independent second opinion |

LLM rewriting is **not** the headline feature. Default scan is deterministic-only. Use `--rewrite` only when you want machine-proposed specializations.

## How it compares

`curator` is not the first tool in this space. Several great projects already do detection and configuration management. Honest table:

- [`claudetoolkit.com`](https://claudetoolkit.com/) — commercial / freemium desktop GUI. Closest to what `curator` does. Differs: closed source, paid tiers, no clustering algorithm, no overlap analysis.
- [`paolodalprato/claude-config-audit`](https://github.com/paolodalprato/claude-config-audit) — open-source CLI auditor. No GUI. No clustering.
- [`mcpware/claude-code-organizer`](https://github.com/mcpware/claude-code-organizer) — full CLI dashboard with security scanning and bulk cleanup.
- [`choam2426/mcp-optimizer`](https://github.com/choam2426/mcp-optimizer) — `/mcp-doctor`, `/mcp-audit`, `/mcp-optimize`, `/mcp-to-skills`. CLI only.
- [`nnnkkk7/mcp-tidy`](https://github.com/nnnkkk7/mcp-tidy) — CLI for MCP cleanup with usage statistics.
- `mcp-checkup` — token-cost grading per tool/server.

See [`docs/COMPARISON.md`](./docs/COMPARISON.md) for the full table. The short version: incumbents are CLIs or paid GUIs; `curator` is the open-source local web dashboard with silhouette-scored clustering. We borrow detection patterns from the OSS projects above with credit.

## Roadmap

**Now (v0.1)**
- Local web dashboard with overview, topic + cluster filters, click-to-edit, click-to-delete
- Cluster overlap visualization (shared core, per-skill unique, pairwise similarity)
- Eager vs lazy token cost grading
- MCP token-cost grading, duplicate detection, orphan & version-drift flagging
- Weekly cron schedule
- Optional `--rewrite` LLM pipeline (5-stage with independent verifier)

**Next (v0.2)**
- MCP server editing through the UI
- Bulk select + delete
- Slash commands and agents in the dashboard
- Side-by-side skill compare
- Effectiveness tracking from `~/.claude/projects/*.jsonl` — find skills that *should* have triggered but didn't
- Cross-tool: Cursor, Codex, OpenCode, Claude Desktop
- Skill-diff PR mode if `~/.claude/` is a git repo

## Philosophy

`curator` is and will remain MIT. There's a separate team product in development — shared skill registries, governance dashboards, audit logs — for organizations with shared `~/.claude/` setups. That's a different product. The CLI you see here is the whole CLI; we're not holding back features for a paid tier.

If you want to be told when the team product is ready, drop your email at `<signup link TBD>`.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md). All contributions require a CLA — that's the lever that lets us keep the CLI permissively licensed forever even as the team product evolves separately. The CLA bot will sign you in on your first PR.

## License

MIT. See [LICENSE](./LICENSE).

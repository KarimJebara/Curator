# How curator compares to other Claude Code config tools

Honest, named comparison. If a tool below does something `curator` doesn't, we say so.

## Capability matrix

| Capability | curator | claudetoolkit.com | claude-config-audit | mcp-optimizer | mcp-tidy | mcp-checkup | claudectx | claude-code-organizer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Open-source** | ✓ MIT | ✗ freemium | ✓ | ✓ | ✓ | ✓ | paid | ✓ |
| **Local web dashboard** | ✓ | ✓ desktop | ✗ | ✗ | ✗ | ✗ | ✗ | partial CLI |
| **Edit skills through UI** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Delete skills through UI (with backup)** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | partial |
| **Silhouette-scored clustering** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Cluster overlap visualization** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Per-skill unique-vocab analysis** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Always-loaded vs on-use token grading** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Detects duplicate MCP servers | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Detects orphan files | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Token-cost grading per skill/MCP | ✓ | partial | ✗ | ✓ | ✗ | ✓ | ✓ | partial |
| Detects skill version drift | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Scheduled weekly audit | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Backups before changes | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| Cross-tool (Cursor, Codex, Desktop) | planned | partial (Desktop) | partial (Desktop) | ✗ | ✗ | ✗ | ✗ | ✗ |
| Effectiveness from session logs | planned | ✗ | ✗ | partial | partial | ✗ | ✗ | ✗ |

## What curator does that no incumbent does

1. **Open-source local web dashboard.** The only one in the OSS category — `claudetoolkit` is the only other dashboard and it's commercial / closed-source / desktop. Curator is a local Node http server (no Electron, no install), opens at `127.0.0.1:4711` in any browser.
2. **Silhouette-scored clustering with confidence tiers.** Ward-linkage hierarchical clustering on TF-IDF + bigrams + IDF. Each cluster gets a high (≥0.28) / medium (0.18–0.28) / low (<0.18) confidence badge so you know how much to trust the grouping before deleting anything.
3. **Cluster overlap analysis.** Click into any cluster to see (a) what its members share, (b) what each one *uniquely* knows, (c) pairwise cosine TF-IDF similarity. Skills with no unique vocabulary are flagged as likely duplicates.
4. **Always-loaded vs on-use token cost split.** Skill descriptions are loaded into Claude every session — paid whether you use the skill or not. Skill bodies load only when the Skill tool actually fires. Two separate grades. Most token-cost tools conflate the two.
5. **Scheduled weekly audit** — `curator schedule install` drops a weekly cron entry that re-snapshots your library. Snapshot lives in the dashboard, not in your inbox.

## Advanced: LLM-driven specialization (opt-in)

`curator scan --rewrite` runs a 5-stage LLM pipeline that proposes specialized renames + a router skill. Stages: cluster → fingerprint (Haiku) → specialize (Sonnet) → router (Sonnet) → verify (fresh Sonnet instance, independent second opinion). No incumbent attempts this; it's not the launch headline because most users don't need or want machine-rewritten skills.

## What incumbents do that curator doesn't

- **`claudetoolkit.com`** — purpose-built editors for every config component (hooks, permissions, agents, slash commands, MCP), manifest autodiscovery, polished desktop GUI. If you want a feature-complete commercial dashboard for everything in `~/.claude/`, this is the better choice today. Curator only edits skills in v0.1 — other config types are v0.2.
- **`paolodalprato/claude-config-audit`** — slightly more thorough audit of permissions, hooks, and stale memory entries. We borrow several of its detection patterns (with credit).
- **`mcp-optimizer`** — `/mcp-to-skills` conversion and project-scoped MCP setup. We don't do MCP-to-skill conversion yet.
- **`mcp-checkup`** — exposes itself as an MCP server you call from inside Claude. We're a CLI + dashboard; different ergonomics.
- **`mcp-tidy`** — usage statistics from session transcripts to identify unused servers. Closer to our planned effectiveness tracking. We'll catch up here.
- **`mcpware/claude-code-organizer`** — full CLI dashboard with security scanning and bulk cleanup. More breadth across config types; less depth on the clustering side.

## When to pick which

- **You want a polished commercial dashboard for everything in `~/.claude/`?** `claudetoolkit.com`.
- **You want a one-shot CLI audit and you're done?** `claude-config-audit` or `mcp-checkup`.
- **You want to cut MCP token bloat specifically?** `mcp-optimizer` + `mcp-tidy`.
- **You want a free, open-source local web dashboard for your skills, with clustering that surfaces overlapping skills visually?** `curator`.
- **You have 30+ skills, several covering similar ground, and you want them refactored into specialists with an LLM router?** `curator scan --rewrite` + `curator review`.

## Acknowledgements

`curator` borrows detection patterns and naming conventions from the open-source projects above, particularly `claude-config-audit` for stale-suffix detection and `mcp-checkup` for the token-cost grading scheme. Their work made this faster to build.

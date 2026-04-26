---
name: curator
description: Audit and curate the user's Claude Code skills and MCP servers. Detects overlapping clusters, proposes specialization/deletion, and generates router skills. Use when the user asks to clean up their setup, reduce token bloat, or has too many skills covering similar ground.
---

# curator

When invoked, run the curator audit on the user's `~/.claude/` setup and walk them through the findings.

## How to use

1. Run the scan via Bash: `npx -y @curator/cli scan`.
2. Run the interactive review: `npx -y @curator/cli review`. The CLI walks the user cluster-by-cluster with PASS actions pre-selected and WARN/FAIL pre-skipped — let the user drive that flow themselves.
3. If the user prefers to discuss before running the interactive prompt, read `~/.claude/curator/reports/latest.md`, summarize cluster-by-cluster, and surface verifier WARN/FAIL notes prominently. Then either edit the markdown file to check boxes (and run `curator review --report --apply`) or hand off to the interactive prompt.

## What to flag

- Clusters with mean similarity above 70% — those are usually true duplicates.
- Skills with version-drift suffixes (`-v2`, `-enhanced`, etc.) — almost always safe to delete.
- MCP servers consuming more than 1500 tokens individually — high-value targets for removal or scoping.

## What NOT to do

- Never apply actions without explicit user confirmation per action.
- Never delete a skill that has unique vocabulary or examples not covered elsewhere — even if curator suggested it.
- Never modify the report's structure when checking boxes; only flip `[ ]` to `[x]`.

# Launch artifact — r/ClaudeAI

This file collects the "what it does" pitch and launch-post drafts so they can
be iterated outside the README. Numbers come from a real scan of the author's
`~/.claude/` (96 skills, ~3.6k tokens of skill descriptions loaded into Claude
on every session, 243k tokens of skill bodies sitting on disk waiting to be
invoked), not invented placeholders.

---

## What curator does (in one paragraph)

`curator` is an **open-source local web dashboard** for managing the skills
and MCP servers in your Claude Code setup. Run `curator scan` (deterministic,
~3 seconds, no API key) and `curator dashboard` opens at
`http://127.0.0.1:4711`. You see your library at a glance — how many tokens
load into Claude on every session vs how many sit on disk waiting to fire,
the grade distribution, top-heaviest descriptions, top-heaviest bodies, MCP
servers, topic chips, cluster cards. Click into any silhouette-scored cluster
to see what its members share, what each member *uniquely* knows, and
pairwise similarity — duplicates with no unique vocabulary are flagged. Click
any user-owned skill to view, edit, or delete it; every change is backed up
to `~/.claude/curator/backups/` first. Plugin-installed skills are read-only.
No login. No API key required. MIT licensed. An optional `--rewrite` flag
opts into a 5-stage LLM pipeline that proposes specializations + a router
skill, but that's a power-user mode, not the headline.

---

## What curator does (in three bullets)

- **See your library** in a local browser dashboard — total skills,
  always-loaded vs on-use token cost, grade distribution, heaviest
  descriptions, heaviest bodies, topic chips, cluster cards.
- **Spot redundancy** with silhouette-scored clusters. Click into any
  cluster: shared core vocabulary, per-skill unique vocabulary, pairwise
  similarity. Duplicates are flagged automatically.
- **Decide what to keep.** Edit or delete any user-owned skill in place.
  Backups before every change. Nothing auto-applies.

---

## Reddit launch — title options

Lead with the dashboard hook + a real number.

1. **I built an open-source local dashboard for managing your Claude Code skills. Spots overlapping skills with hierarchical clustering. Free, no API key.**
2. **My `~/.claude/skills/` had 96 skills with 3.6k tokens of descriptions hitting the autorouter every session. I built a dashboard to find the duplicates.**
3. **`curator` — local web dashboard for Claude Code skills + MCPs, with silhouette-scored clustering. MIT.**

#1 is the best general hook. #2 leans into the diagnosis (good for skeptics).
#3 is the boring/honest fallback.

---

## Reddit post body (draft, ~400 words)

> I have 96 skills installed in `~/.claude/skills/`. Each one ships a
> description that gets loaded into the autorouter context every session
> — about **3.6k tokens of always-on description-soup before I type a
> single character**. Plus 243k tokens of skill bodies sitting on disk
> waiting to be invoked, half of which overlap with each other.
>
> The autorouter has to pick the right skill from 96 competing
> descriptions. It often picks wrong because five of them say nearly the
> same thing.
>
> Existing tools (`claude-config-audit`, `mcp-optimizer`, `mcp-checkup`,
> `claudetoolkit.com`, `mcp-tidy`) detect bloat. They don't help you
> decide what to cut. The only one with a GUI — `claudetoolkit` — is
> commercial / freemium / closed-source.
>
> So I built `curator`: an **open-source local web dashboard** for
> managing your Claude Code skills and MCP servers.
>
> One scan, two views:
>
> **For seeing what you have** — open
> [http://127.0.0.1:4711](http://127.0.0.1:4711) and you get
> hero stats, grade donut, heaviest descriptions, heaviest bodies, topic
> chips (`/kotlin`, `/testing`, `/django`...), cluster cards with
> silhouette confidence (high/medium/low), MCP server list. Search,
> filter, click any user-owned skill to view/edit/delete in place.
>
> **For spotting duplicates** — silhouette-scored clusters
> (Ward-linkage hierarchical clustering on TF-IDF + bigrams). Click into
> a cluster: shared core vocabulary, per-skill unique vocabulary,
> pairwise cosine similarity. Skills with **no unique vocabulary** get
> flagged as likely duplicates. You decide what to do.
>
> Every change is backed up to `~/.claude/curator/backups/` first.
> Plugin-installed skills are read-only. No login. No API key required —
> the default scan is deterministic and finishes in seconds.
>
> Power users can opt into `curator scan --rewrite` to run a 5-stage LLM
> pipeline that proposes specialized renames + a router skill, with an
> independent verifier stage. Not the headline — most people don't need
> or want machine-rewritten skills. The dashboard is.
>
> Honest comparison vs everyone in the space:
> [`docs/COMPARISON.md`](./COMPARISON.md). The OSS auditors do detection
> well; we built on their patterns (with credit). `claudetoolkit` is the
> closest analog and remains the better choice if you want a polished
> commercial GUI for *everything* in `~/.claude/` — we only do skills +
> MCPs in v0.1.
>
> Repo: `<github-url>` · MIT.
>
> Feedback welcome — especially on the silhouette confidence thresholds
> and the duplicate-detection heuristic.

---

## Pinned first-comment (transparency)

Reddit punishes hidden self-promotion. Pin a comment that names competitors,
gives credit, and signals where this is going.

> Wanted to be upfront about a few things:
>
> - Detection patterns where applicable were borrowed from
>   [`claude-config-audit`](https://github.com/paolodalprato/claude-config-audit)
>   and [`mcp-optimizer`](https://github.com/choam2426/mcp-optimizer).
>   Token-cost grading is borrowed from `mcp-checkup`. Credit goes to
>   those projects.
> - `claudetoolkit.com` is the closest existing tool — commercial /
>   freemium with a polished desktop GUI. If you want a feature-complete
>   paid product for everything in `~/.claude/`, that's still the better
>   choice today. We're the open-source alternative focused on skills +
>   MCPs.
> - The CLI and dashboard are MIT and will stay MIT. There's a separate
>   team product in development (shared skill registries, governance
>   dashboards, audit logs) for organizations with shared `~/.claude/`
>   setups. Sign up if interested: `<signup link TBD>`.
> - Cluster confidence thresholds, the duplicate-detection heuristic,
>   and the always-loaded vs on-use split are all places where I want feedback.
>   PRs welcome.

---

## Cross-post variants

- **Show HN** — same first paragraph, drop the diagnosis framing, add a one-line
  about the technical approach (Ward-linkage hierarchical clustering +
  silhouette confidence + cluster overlap analysis). HN cares more about how.
- **r/ClaudeCode** — shorter — dashboard screenshot + "MIT, no API key needed,
  here's what it does." That subreddit is smaller and more practical.
- **X/Twitter** — thread. Tweet 1: dashboard screenshot + "open-source local
  dashboard for your Claude Code skills." Tweet 2: cluster overlap view
  screenshot + "silhouette-scored. duplicates flagged automatically." Tweet 3:
  comparison table + repo link.

---

## Pre-launch checklist (must be green before posting)

- [ ] Initialize the repo as a git repo and push to GitHub.
- [ ] Reserve `@curator/cli` on npm (or pick the final name and reserve it).
- [ ] Trademark filing started.
- [ ] CLA bot configured (Linux Foundation EasyCLA or
      [cla-assistant.io](https://cla-assistant.io/)).
- [ ] Animated GIF / screenshot of `curator dashboard` for the README hero.
      Record: open dashboard → grade donut → click cluster → click skill →
      edit → save.
- [ ] Run scan + dashboard on a second person's `~/.claude/` setup before
      posting. Confirm it doesn't crash on a setup other than the author's.
- [ ] Decide on the "team product signup" link target and stand it up.

## Numbers to use in the post

From a real scan of the author's library:

| Metric | Value |
|---|---:|
| Total skills | 96 |
| Always-loaded tokens (skill descriptions, every session) | 3,639 |
| On-use tokens (skill bodies, only when invoked) | 243,475 |
| Grade distribution | 63 F · 24 D · 7 C · 2 B · 0 A |
| Topics auto-detected | 29 |
| Clusters detected | 19 |
| MCP servers | 22 (0 duplicate groups) |
| Default scan time | ~3 seconds |

The 3,639-token "always loaded" number is what's actually in the autorouter
context on every session. The 243k figure is the *potential* on-invocation
cost, not the always-on cost. Lead with the always-loaded number — it's the
smaller, more accurate, more honest framing.

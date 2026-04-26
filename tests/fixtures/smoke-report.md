# curator audit — 2026-04-25

## Summary

- 5 skills (~885 tokens)
- 0 MCP servers (~0 tokens)
- 1 overlapping clusters covering 3 skills
- 0 duplicate MCP groups
- 0 skills with version-drift suffixes
- 0 orphan memory files

## Skill clusters

Each cluster is a group of overlapping skills. Review each one and check the actions you want curator to apply.

### Cluster: `frontend` (3 skills, ~539 tokens)

Mean similarity within cluster: 21%

**Members:**
- `frontend-android` (~177 tokens, grade B) — Android Jetpack Compose patterns, state hoisting, navigation, and Material 3 theming. Use for native…
- `frontend-patterns` (~174 tokens, grade B) — Frontend development patterns for React, Next.js, state management, performance optimization, and UI…
- `frontend-react` (~188 tokens, grade B) — React component patterns, hooks, JSX hygiene, and Next.js App Router usage. Use for building React-b…

**Proposed actions:** _LLM pipeline not run — re-run `curator scan` with ANTHROPIC_API_KEY set._

Pairwise similarity:

| | `frontend-android` | `frontend-patterns` | `frontend-react` |
|---|---|---|---|
| `frontend-android` | — | 20% | 12% |
| `frontend-patterns` | 20% | — | 31% |
| `frontend-react` | 12% | 31% | — |

---

When done, run `curator review --apply` to apply checked items. A backup is taken before every change.
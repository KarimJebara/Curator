# Rewrite prompts

The exact system + user prompts used by each LLM stage. Documented here so users can audit what curator sends to the model and so we can track prompt revisions over time.

## Stage 2 — fingerprinter (Haiku 4.5)

System: produce a structured fingerprint of one skill. JSON only.

Output shape:

```json
{
  "core_purpose": "<one sentence>",
  "trigger_conditions": ["<when this skill should be used>"],
  "unique_vocabulary": ["<terms or APIs this skill uniquely covers>"],
  "examples": ["<concrete tasks this skill handles>"],
  "specialty_axis": "<the dimension this skill specializes along>"
}
```

Each call sees exactly one skill. We don't pass the cluster context — that's deliberate. It prevents the model from inventing overlap to satisfy the prompt.

## Stage 3 — specializer (Sonnet 4.6)

System: editor for skills. Given a cluster + per-skill fingerprints, propose how to differentiate them. Allow deletion when no unique fingerprint exists.

Output shape:

```json
{
  "cluster_label": "<short kebab-case label>",
  "actions": [
    { "type": "specialize", "from": "...", "to": "...", "tightened_description": "...", "reason": "..." },
    { "type": "delete", "name": "...", "reason": "..." },
    { "type": "keep", "name": "...", "reason": "..." }
  ]
}
```

Rules enforced in the prompt:

- Every member must appear in exactly one action.
- New names must be kebab-case and unique within the cluster.
- "delete" only when fingerprint shows no unique vocabulary or examples not covered by another member.
- Tightened descriptions must be ≤200 chars, trigger-focused, and avoid sibling overlap.

## Stage 4 — router-generator (Sonnet 4.6)

System: write a complete SKILL.md including frontmatter for a router skill that dispatches to the specialists.

Required body sections:

- A "Routing decision table" mapping task signals → specialist names.
- Explicit instructions to invoke the specialist via the Skill tool (slash-command path) or the Agent tool with `subagent_type` (autonomous path).

Length cap: 1500 characters total.

## Stage 5 — verifier (Sonnet 4.6, fresh instance)

System: independent reviewer of the proposed changes. The prompt includes the original skills' bodies and the proposed actions, but **does not include any of stage 3's reasoning**. The verifier must assess from scratch.

Output shape:

```json
{
  "verdicts": [
    { "action_index": 0, "verdict": "PASS|WARN|FAIL", "reason": "..." }
  ],
  "summary": "<one sentence>"
}
```

The verifier looks specifically for:

1. Renames that lose information.
2. Deletions of skills that have unique value.
3. Tightened descriptions that drop critical trigger conditions.
4. Cluster members that should have been specialized but were marked keep.

WARN and FAIL verdicts are surfaced in the report under the cluster card so the user sees the second opinion before checking any boxes.

## Why this split

We considered a single-prompt design where one model produces the specialization, the router, and self-verifies. Two reasons we don't:

1. **Token economics.** Fingerprinting one skill at a time on Haiku is much cheaper than passing the entire cluster to Sonnet. The pipeline only escalates to Sonnet for the genuinely opinionated stages.
2. **Verifier independence.** A model that wrote the rewrite has confirmation bias toward its own output. A fresh instance, prompted with no reasoning trail, is the cheap-but-real check that catches regressions.

import { complete, tryParseJson } from '../lib/llm.js';

// Stage 3: given a cluster of overlapping skills + their fingerprints,
// propose how to differentiate them. The prompt explicitly considers
// deletion when there's no unique fingerprint to extract — but the user
// makes the final call via the report checkboxes.

const SYSTEM = `You are an editor for Claude Code skills. Given a cluster of overlapping skills, your job is to propose how to specialize each one to its unique strength so they no longer compete for the same triggers. When two skills are truly redundant with no extractable difference, propose deletion. Output JSON only.`;

const userPrompt = (cluster, fingerprints) => `Cluster of ${cluster.members.length} overlapping skills (mean similarity ${(cluster.meanSimilarity * 100).toFixed(0)}%):

${cluster.members.map((m) => `--- skill: ${m.name} ---
description: ${m.description}
fingerprint: ${JSON.stringify(fingerprints[m.name], null, 2)}`).join('\n\n')}

Output a JSON object with this shape:

{
  "cluster_label": "<short kebab-case label, e.g. 'frontend' or 'kotlin-testing'>",
  "actions": [
    { "type": "specialize", "from": "<old name>", "to": "<new kebab-case name>", "tightened_description": "<new description, ≤200 chars>", "reason": "<short>" },
    { "type": "delete", "name": "<name>", "reason": "<why this skill has no unique value>" },
    { "type": "keep", "name": "<name>", "reason": "<why this one is fine as-is>" }
  ]
}

Rules:
- Every member must appear in exactly one action.
- "specialize" actions rename skills to reflect their unique specialty axis. New names must be kebab-case and unique within the cluster.
- "delete" only when fingerprint shows no unique vocabulary or examples not covered by another member.
- Tightened descriptions should be terse, trigger-focused, and avoid overlap with siblings.`;

export const specializeCluster = async (cluster, fingerprints) => {
  const { text } = await complete({
    which: 'sonnet',
    system: SYSTEM,
    user: userPrompt(cluster, fingerprints),
    maxTokens: 2048,
  });
  const parsed = tryParseJson(text);
  if (!parsed) {
    return {
      cluster_label: cluster.label,
      actions: cluster.members.map((m) => ({ type: 'keep', name: m.name, reason: 'LLM output unparseable' })),
      _parse_failed: true,
    };
  }
  return normalizeSpecialization(parsed);
};

// Models sometimes emit `{type:"specialize", from:"X", to:"X"}` when they
// mean "this skill is already well-named, just tighten the description."
// Normalize those to `keep` (preserving any tightened_description as a
// `rewrite` action when present) so the dispatcher doesn't no-op silently
// and the report doesn't show confusing identity renames.
export const normalizeSpecialization = (spec) => {
  if (!spec?.actions) return spec;
  const actions = [];
  for (const a of spec.actions) {
    if (a.type === 'specialize' && a.to && a.from === a.to) {
      if (a.tightened_description) {
        actions.push({
          type: 'rewrite',
          name: a.from,
          tightened_description: a.tightened_description,
          reason: a.reason || 'Description tightening only; no rename',
        });
      } else {
        actions.push({ type: 'keep', name: a.from, reason: a.reason || 'Already well-named' });
      }
    } else {
      actions.push(a);
    }
  }
  return { ...spec, actions };
};

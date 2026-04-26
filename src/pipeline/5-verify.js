import { complete, tryParseJson } from '../lib/llm.js';

// Stage 5: independent second opinion. We deliberately do NOT pass any
// stage-3 reasoning into the verifier prompt — only the raw before/after.
// The verifier's job is to catch regressions a confirmation-biased rewriter
// would miss.

const SYSTEM = `You are an independent reviewer of Claude Code skill rewrites. You did NOT participate in the rewrite — your job is to catch regressions. For each proposed change, output PASS, WARN, or FAIL with a one-line reason. Output JSON only.`;

const userPrompt = (cluster, specialization, originalsByName) => `Review these proposed changes to a cluster of skills.

Original skills:
${cluster.members.map((m) => `--- ${m.name} ---
description: ${m.description}
body excerpt: ${(m.body || '').slice(0, 800)}`).join('\n\n')}

Proposed actions:
${JSON.stringify(specialization.actions, null, 2)}

Output JSON with this shape:

{
  "verdicts": [
    { "action_index": 0, "verdict": "PASS|WARN|FAIL", "reason": "<short>" },
    ...
  ],
  "summary": "<one sentence overall assessment>"
}

Look for: (1) renames that lose information, (2) deletions of skills that have unique value, (3) tightened descriptions that drop critical trigger conditions, (4) cluster members that should have been specialized but were marked keep.`;

export const verifyCluster = async (cluster, specialization) => {
  const originalsByName = Object.fromEntries(cluster.members.map((m) => [m.name, m]));
  const { text } = await complete({
    which: 'sonnet',
    system: SYSTEM,
    user: userPrompt(cluster, specialization, originalsByName),
    maxTokens: 1024,
  });
  const parsed = tryParseJson(text);
  if (!parsed) return { verdicts: [], summary: 'Verifier output unparseable', _parse_failed: true };
  return parsed;
};

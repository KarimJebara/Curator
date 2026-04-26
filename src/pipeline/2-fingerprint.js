import { complete, tryParseJson } from '../lib/llm.js';

// Stage 2: produce a structured fingerprint per skill. One-skill-at-a-time
// to prevent cross-skill hallucination — the model can't "remember" the
// neighbors in this stage and invent overlap that isn't there.

const SYSTEM = `You analyze a single Claude Code skill and produce a structured fingerprint of what makes it unique. Output JSON only — no prose, no markdown fences.`;

const userPrompt = (skill) => `Analyze this skill and output JSON with this shape:

{
  "core_purpose": "<one sentence>",
  "trigger_conditions": ["<when this skill should be used>", ...],
  "unique_vocabulary": ["<terms or APIs this skill uniquely covers>", ...],
  "examples": ["<concrete tasks this skill handles>", ...],
  "specialty_axis": "<the dimension along which this skill specializes (e.g., 'platform: Android', 'framework: React', 'output: presentation slides')>"
}

Skill name: ${skill.name}
Description: ${skill.description}

Body:
${skill.body.slice(0, 4000)}`;

export const fingerprintSkill = async (skill) => {
  const { text } = await complete({
    which: 'haiku',
    system: SYSTEM,
    user: userPrompt(skill),
    maxTokens: 1024,
  });
  const parsed = tryParseJson(text);
  if (!parsed) {
    return {
      core_purpose: skill.description,
      trigger_conditions: [],
      unique_vocabulary: [],
      examples: [],
      specialty_axis: 'unknown',
      _parse_failed: true,
    };
  }
  return parsed;
};

export const fingerprintCluster = async (cluster) => {
  const fingerprints = {};
  for (const member of cluster.members) {
    fingerprints[member.name] = await fingerprintSkill(member);
  }
  return fingerprints;
};

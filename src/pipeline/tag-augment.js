import { complete, tryParseJson } from '../lib/llm.js';

// Optional Haiku stage that adds tags that aren't visible in the name. The
// deterministic extractor catches "kotlin-ktor-patterns" → "kotlin", but
// misses "compose-multiplatform-patterns" → also "kotlin", "android".
//
// We use a controlled vocabulary — the model picks 0-2 tags from a known
// list per skill. Open-ended tag generation is too noisy and produces
// inconsistent labels across skills.

const SYSTEM = `You add up to 2 hidden tags to a Claude Code skill. The tags must come from the provided controlled vocabulary. Output JSON only, no prose.`;

const userPrompt = (skill, knownTags) => `Skill name: ${skill.name}
Description: ${skill.description}
Body excerpt: ${(skill.body || '').slice(0, 600)}

The deterministic name parser already extracted these tags from this skill: [${[...skill.existingTags].join(', ')}]

From this controlled vocabulary, pick 0-2 ADDITIONAL tags that apply to this skill but were NOT extracted from the name.

Vocabulary: ${[...knownTags].join(', ')}

Output JSON: { "tags": ["tag1", "tag2"] }
- Only include tags from the vocabulary.
- Only include tags NOT already extracted.
- Empty array is fine if none apply.`;

const KNOWN_TAGS = [
  'kotlin', 'swift', 'python', 'golang', 'java', 'perl', 'cpp', 'rust',
  'typescript', 'javascript', 'ruby', 'php',
  'android', 'ios', 'compose', 'swiftui', 'react', 'nextjs', 'vue',
  'django', 'springboot', 'ktor',
  'postgres', 'clickhouse', 'docker', 'kubernetes',
  'frontend', 'backend', 'mobile', 'database', 'devops',
  'security', 'testing', 'tdd', 'verification', 'deployment',
  'analytics', 'ml', 'ai', 'llm', 'api',
  'docs', 'research', 'logistics', 'investor', 'content', 'media',
  'claude', 'mcp',
];

export const augmentTagsForSkill = async (skill) => {
  const { text } = await complete({
    which: 'haiku',
    system: SYSTEM,
    user: userPrompt(skill, KNOWN_TAGS),
    maxTokens: 256,
  });
  const parsed = tryParseJson(text);
  if (!parsed?.tags || !Array.isArray(parsed.tags)) return [];
  return parsed.tags
    .map((t) => String(t).toLowerCase().trim())
    .filter((t) => KNOWN_TAGS.includes(t));
};

// Run augmentation across all skills. Adds the new tags into the existing
// tag map (mutates entries by replacing them with new sets). Returns the
// updated map. Skips skills that already have 3+ tags — we cap aggregation.
export const augmentAllTags = async (skills, baseTagMap, { onProgress } = {}) => {
  const augmented = new Map();
  for (const skill of skills) {
    const existing = baseTagMap.get(skill.name) || new Set();
    if (existing.size >= 3) {
      augmented.set(skill.name, existing);
      continue;
    }
    onProgress?.({ stage: 'augment-skill', skill: skill.name });
    try {
      const extra = await augmentTagsForSkill({ ...skill, existingTags: existing });
      const combined = new Set(existing);
      for (const t of extra) combined.add(t);
      augmented.set(skill.name, combined);
    } catch (err) {
      onProgress?.({ stage: 'augment-error', skill: skill.name, error: err.message });
      augmented.set(skill.name, existing);
    }
  }
  return augmented;
};

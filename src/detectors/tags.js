// Tag extraction. Pure deterministic. The kebab-case prefix carries most of
// the signal — kotlin-* skills are about kotlin, frontend-* are frontend,
// etc. We also recognize known language/framework keywords appearing
// anywhere in the name (e.g. android-clean-architecture is "android" even
// though it doesn't start with "kotlin").
//
// LLM augmentation lives in src/pipeline/tag-augment.js and adds tags that
// aren't visible in the name. The deterministic layer is fast and runs
// every scan; LLM augmentation is opt-in.

// Known surface markers. Order doesn't matter. Hyphens in names are split
// before matching, so "android-clean-architecture" matches both "android"
// and "architecture" (the latter is too generic to be useful and gets
// filtered by isUsefulTag).
const KNOWN_TAGS = new Set([
  // Languages
  'kotlin', 'swift', 'python', 'golang', 'go', 'java', 'perl', 'cpp', 'rust',
  'typescript', 'javascript', 'ts', 'js', 'ruby', 'php', 'csharp',
  // Frameworks / platforms
  'android', 'ios', 'compose', 'swiftui', 'react', 'nextjs', 'vue', 'angular',
  'django', 'springboot', 'spring', 'ktor', 'rails', 'fastapi', 'flask',
  'express', 'svelte',
  // Data / infra
  'postgres', 'mysql', 'mongodb', 'redis', 'clickhouse', 'jpa', 'sqlite',
  'docker', 'kubernetes', 'k8s', 'terraform', 'ansible',
  // Domains
  'frontend', 'backend', 'fullstack', 'mobile', 'database', 'devops',
  'security', 'testing', 'tdd', 'verification', 'deployment', 'cicd',
  'monitoring', 'observability', 'analytics', 'ml', 'ai', 'llm', 'api',
  // Tooling / activities
  'git', 'github', 'gitlab', 'docs', 'research', 'logistics', 'investor',
  'content', 'video', 'audio', 'media', 'browser', 'crawler',
  // The medium itself
  'claude', 'mcp', 'hooks', 'skill', 'agent',
]);

const STOP_TAGS = new Set([
  // Bits of names that aren't really tags
  'patterns', 'pattern', 'best', 'practices', 'guide', 'example', 'examples',
  'standards', 'standard', 'workflow', 'workflows', 'design', 'config',
  'architecture', 'utility', 'utilities', 'helper', 'helpers',
  'and', 'or', 'with', 'for', 'the',
]);

const isUsefulTag = (t) => {
  if (!t) return false;
  if (t.length < 2) return false;
  if (STOP_TAGS.has(t)) return false;
  return KNOWN_TAGS.has(t);
};

// Pull tags from a single skill, no LLM. Returns a Set of strings.
export const extractTags = (skill) => {
  const tags = new Set();
  const parts = (skill.name || '').toLowerCase().split(/[-_]+/).filter(Boolean);
  for (const p of parts) {
    if (isUsefulTag(p)) tags.add(p);
  }
  // Also scan the description for known tags — catches cases where the name
  // doesn't mention the language but the description does.
  const descTokens = (skill.description || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const t of descTokens) {
    if (isUsefulTag(t)) tags.add(t);
  }
  return tags;
};

export const tagsForSkills = (skills) => {
  const out = new Map();
  for (const s of skills) out.set(s.name, extractTags(s));
  return out;
};

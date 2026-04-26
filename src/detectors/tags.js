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

// Validate an explicitly-authored tag. Looser than isUsefulTag — we trust
// what the user wrote in frontmatter, only rejecting obvious noise (stop
// words, things that are too short, or symbols).
const isValidExplicitTag = (t) => {
  if (!t) return false;
  if (t.length < 2 || t.length > 31) return false;
  if (STOP_TAGS.has(t)) return false;
  return /^[a-z][a-z0-9-]*$/.test(t);
};

// Pull tags from a single skill, no LLM. Returns a Set of strings.
//
// Two sources, in priority order:
//   1. frontmatter.tags — explicitly authored by the user. We trust these
//      and only filter obvious noise; arbitrary new tags like "convex" are
//      respected. This is what the dashboard "+ New topic" flow writes.
//   2. Heuristic extraction from name and description, gated to KNOWN_TAGS.
//      This catches `kotlin-patterns` → `kotlin` for skills that don't
//      author tags themselves.
//
// Both contribute additively, so an explicit tag list doesn't suppress
// heuristic tags — a skill named `kotlin-patterns` with frontmatter
// `tags: convex` ends up with both `kotlin` and `convex`.
export const extractTags = (skill) => {
  const tags = new Set();

  // Explicit frontmatter tags (the user-driven path)
  const fmTags = skill.frontmatter?.tags;
  if (fmTags) {
    const raw = Array.isArray(fmTags) ? fmTags : String(fmTags).split(/[,\s]+/);
    for (const t of raw) {
      const norm = String(t).trim().toLowerCase();
      if (isValidExplicitTag(norm)) tags.add(norm);
    }
  }

  // Heuristic from name (kebab parts → known tags)
  const parts = (skill.name || '').toLowerCase().split(/[-_]+/).filter(Boolean);
  for (const p of parts) {
    if (isUsefulTag(p)) tags.add(p);
  }
  // Heuristic from description (known tags only, prevents tagging noise)
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

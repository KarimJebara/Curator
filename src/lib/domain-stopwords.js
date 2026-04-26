// Domain-specific stopwords for the Claude Code skill ecosystem. The bar
// is high: a word only belongs here if it describes the *medium* (a
// skill/agent/tool/command) or is a generic action verb. Words that
// describe what a skill is *about* — "patterns", "framework", "library",
// "testing" — stay in. Removing those erases the legitimate signal that
// causes language-specific skills to cluster.
//
// Users can extend via ~/.claude/curator/stopwords.txt or pass
// `extraStopwords` to clusterSkills().

export const DOMAIN_STOPWORDS = new Set([
  // The medium itself — appears in nearly every skill
  'skill', 'skills', 'agent', 'agents', 'subagent', 'tool', 'tools',
  'command', 'commands', 'mcp', 'claude', 'anthropic', 'claudecode',

  // Generic action verbs that don't carry topic signal
  'use', 'uses', 'using', 'used', 'create', 'creates', 'created', 'creating',
  'build', 'builds', 'built', 'building', 'write', 'writes', 'written',
  'run', 'runs', 'running', 'follow', 'follows', 'following', 'support',
  'supports', 'supported', 'invoke', 'invokes', 'invoking',

  // Quality / quantity adjectives
  'best', 'better', 'good', 'great', 'high', 'low', 'large', 'small',
  'simple', 'complex', 'modern', 'idiomatic', 'standard', 'standards',
  'common', 'specific', 'general', 'production', 'real', 'first', 'new',
  'efficient', 'robust', 'maintainable', 'reusable', 'comprehensive',

  // Documentation noise
  'example', 'examples', 'including', 'includes', 'cover', 'covers', 'covered',
  'covering', 'description', 'task', 'tasks', 'workflow', 'workflows',
  'practice', 'practices', 'guide', 'guides', 'overview',
]);

export const mergeStopwords = (extra = []) => {
  const out = new Set(DOMAIN_STOPWORDS);
  for (const t of extra) out.add(t.toLowerCase());
  return out;
};

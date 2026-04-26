// Token estimation. We use a 4-chars-per-token heuristic which is accurate to
// within ~10% for English prose. Precise tokenization would require shipping
// a tokenizer; not worth the install cost for an estimate.

export const estimateTokens = (text) => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};

// Grade a skill body (lazy weight) — the cost paid only when the skill is
// invoked. Borrowed from mcp-checkup's scheme. Does NOT apply to skill
// descriptions (those are tiny by nature; we surface the number directly).
export const grade = (tokens) => {
  if (tokens <= 100) return 'A';
  if (tokens <= 300) return 'B';
  if (tokens <= 600) return 'C';
  if (tokens <= 1500) return 'D';
  return 'F';
};

// Grade a single skill description (eager weight) — the cost paid on every
// session because the autorouter loads it to decide whether to invoke. Tighter
// thresholds than the body grade because descriptions should be one sentence.
export const gradeEager = (tokens) => {
  if (tokens <= 30) return 'A';
  if (tokens <= 60) return 'B';
  if (tokens <= 100) return 'C';
  if (tokens <= 160) return 'D';
  return 'F';
};

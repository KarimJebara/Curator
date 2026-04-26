import { tokenize, termFrequency, cosine, buildIdf, tfIdf } from '../lib/text-similarity.js';

// Given the full raw text of every member of a cluster, compute three views
// the dashboard surfaces side-by-side:
//
//   - shared: tokens that appear in (almost) every member — the cluster's
//     "core vocabulary." Capped at top 30 by frequency-across-members.
//   - unique[name]: tokens that appear ONLY in that one member. Ranked by
//     local frequency, capped at top 12 each. These tell the user what each
//     skill *uniquely* knows that the others don't.
//   - pairs: pairwise cosine TF-IDF similarity for every pair, sorted
//     descending. Helps spot near-duplicates inside the cluster.
//
// All deterministic. No LLM. Single pass over the cluster.
export const analyzeOverlap = (members) => {
  if (members.length < 2) {
    return { shared: [], unique: {}, pairs: [] };
  }

  const tokensByName = {};
  for (const m of members) {
    tokensByName[m.name] = tokenize(m.text || '', { withBigrams: false });
  }

  // For each token, which member-names contain it?
  const memberCounts = new Map();
  for (const [name, toks] of Object.entries(tokensByName)) {
    const seen = new Set(toks);
    for (const t of seen) {
      if (!memberCounts.has(t)) memberCounts.set(t, new Set());
      memberCounts.get(t).add(name);
    }
  }

  const N = members.length;
  // "Shared" threshold: appears in at least ceil(N * 0.66) members. For a
  // 3-member cluster that's 2; for 5 members that's 4. Pure all-or-nothing
  // is too brittle on noisy real-world skills.
  const shareThreshold = Math.max(2, Math.ceil(N * 0.66));

  const shared = [];
  for (const [token, names] of memberCounts) {
    if (names.size >= shareThreshold) {
      // Frequency across members = sum of TFs across members that contain it
      let freq = 0;
      for (const name of names) {
        for (const t of tokensByName[name]) if (t === token) freq++;
      }
      shared.push({ token, members: names.size, freq });
    }
  }
  shared.sort((a, b) => b.members - a.members || b.freq - a.freq);

  const unique = {};
  for (const m of members) {
    const localTokens = tokensByName[m.name];
    const tfLocal = termFrequency(localTokens);
    const localUnique = [];
    for (const [token, count] of tfLocal) {
      const owners = memberCounts.get(token);
      if (owners && owners.size === 1) {
        localUnique.push({ token, freq: count });
      }
    }
    localUnique.sort((a, b) => b.freq - a.freq);
    unique[m.name] = localUnique.slice(0, 12);
  }

  // Pairwise cosine TF-IDF, computed locally to the cluster (so common
  // English/domain stopwords don't dominate). Bigrams included for phrase
  // signal — same recipe the clusterer uses.
  const docTokensWithBigrams = members.map((m) => tokenize(m.text || ''));
  const idf = buildIdf(docTokensWithBigrams);
  const vectors = docTokensWithBigrams.map((toks) => tfIdf(toks, idf));
  const pairs = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      pairs.push({
        a: members[i].name,
        b: members[j].name,
        similarity: cosine(vectors[i], vectors[j]),
      });
    }
  }
  pairs.sort((p, q) => q.similarity - p.similarity);

  return {
    shared: shared.slice(0, 30),
    unique,
    pairs,
  };
};

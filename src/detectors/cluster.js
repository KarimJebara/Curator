import {
  tokenize,
  buildIdf,
  tfIdf,
  cosine,
  jaccard,
  nameOverlap,
} from '../lib/text-similarity.js';
import { computeQuality, confidence } from './cluster-quality.js';

const BODY_TRUNCATE = 800;

// Composite similarity in [0, 1]. Cosine over the TF-IDF body+description
// vector carries the most signal; description and name overlap are tie-
// breakers and catch cases where one skill is bloated and another concise
// but they cover the same ground.
const similarity = (a, b) => {
  const cos = cosine(a._tf, b._tf);
  const desc = jaccard(a._descTokens, b._descTokens);
  const name = nameOverlap(a.name, b.name);
  return 0.6 * cos + 0.25 * desc + 0.15 * name;
};

const distance = (a, b) => 1 - similarity(a, b);

// Ward-linkage hierarchical clustering. Ward merges the pair of clusters
// whose merge produces the smallest increase in within-cluster variance —
// this consistently produces tighter, more compact clusters than average-
// or single-link. We agglomerate down from N singletons until either the
// next merge would exceed `cutDistance` or the cluster count drops below
// the minimum.
//
// Working in similarity space is non-traditional but matches the rest of
// our pipeline. We convert to distance internally, apply Lance-Williams
// recurrence for Ward updates, and return clusters in similarity space.
export const clusterSkills = (skills, { threshold = 0.12, extraStopwords } = {}) => {
  const docTokens = skills.map((s) => {
    const body = (s.body || '').slice(0, BODY_TRUNCATE);
    return tokenize(`${s.name} ${s.description} ${body}`, { extraStopwords });
  });
  const idf = buildIdf(docTokens);

  const enriched = skills.map((s, i) => ({
    ...s,
    _tf: tfIdf(docTokens[i], idf),
    _descTokens: tokenize(`${s.name} ${s.description}`, { extraStopwords, withBigrams: false }),
  }));

  if (enriched.length < 2) return [];

  // Build the initial distance matrix. We keep it dense — at N=500 that's
  // 250k entries, still trivial.
  const N = enriched.length;
  const dist = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const d = distance(enriched[i], enriched[j]);
      dist[i][j] = d;
      dist[j][i] = d;
    }
  }

  // Each cluster is a list of original-index members and its current size.
  const clusters = enriched.map((_, i) => ({ members: [i], size: 1, alive: true }));
  const cutDistance = 1 - threshold;

  while (true) {
    // Find the alive pair with the smallest pairwise distance.
    let bestI = -1, bestJ = -1, bestD = Infinity;
    const alive = clusters.map((c, idx) => (c.alive ? idx : -1)).filter((x) => x >= 0);
    for (let a = 0; a < alive.length; a++) {
      for (let b = a + 1; b < alive.length; b++) {
        const i = alive[a], j = alive[b];
        if (dist[i][j] < bestD) {
          bestD = dist[i][j];
          bestI = i;
          bestJ = j;
        }
      }
    }
    if (bestI < 0 || bestD > cutDistance) break;

    // Merge clusters bestJ into bestI. Update distances using Lance-Williams
    // recurrence for Ward linkage:
    //   d(A∪B, C) = sqrt( ((|A|+|C|)·d(A,C)² + (|B|+|C|)·d(B,C)² − |C|·d(A,B)²) / (|A|+|B|+|C|) )
    const A = clusters[bestI], B = clusters[bestJ];
    const merged = { members: A.members.concat(B.members), size: A.size + B.size, alive: true };
    for (const k of alive) {
      if (k === bestI || k === bestJ) continue;
      const C = clusters[k];
      const dAC = dist[bestI][k];
      const dBC = dist[bestJ][k];
      const dAB = bestD;
      const num =
        (A.size + C.size) * dAC * dAC +
        (B.size + C.size) * dBC * dBC -
        C.size * dAB * dAB;
      const denom = A.size + B.size + C.size;
      const newD = Math.sqrt(Math.max(0, num / denom));
      dist[bestI][k] = newD;
      dist[k][bestI] = newD;
    }
    clusters[bestI] = merged;
    clusters[bestJ] = { ...B, alive: false };
  }

  // Materialize live multi-member clusters with annotations.
  const result = [];
  let id = 1;
  for (const c of clusters) {
    if (!c.alive || c.members.length < 2) continue;
    const members = c.members.map((idx) => {
      // Strip the private fields before returning to caller.
      const { _tf, _descTokens, ...rest } = enriched[idx];
      return rest;
    });
    const totalTokens = members.reduce((a, m) => a + (m.tokens || 0), 0);
    const meanSim = meanPairwiseSim(c.members.map((idx) => enriched[idx]));
    const quality = computeQuality(c.members.map((idx) => enriched[idx]), enriched, similarity);
    result.push({
      id: `c${id++}`,
      label: guessClusterLabel(members),
      members,
      totalTokens,
      meanSimilarity: Number(meanSim.toFixed(3)),
      silhouette: Number(quality.silhouette.toFixed(3)),
      confidence: confidence(quality.silhouette),
    });
  }

  // Sort: high-confidence clusters first so the user sees clean wins
  // before having to triage borderline cases.
  result.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    if (order[a.confidence] !== order[b.confidence]) {
      return order[a.confidence] - order[b.confidence];
    }
    return b.meanSimilarity - a.meanSimilarity;
  });

  return result;
};

const meanPairwiseSim = (members) => {
  if (members.length < 2) return 0;
  let total = 0, count = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      total += similarity(members[i], members[j]);
      count++;
    }
  }
  return total / count;
};

const guessClusterLabel = (members) => {
  const freq = new Map();
  for (const m of members) {
    for (const part of m.name.toLowerCase().split(/[-_\s]+/).filter(Boolean)) {
      if (part.length < 3) continue;
      freq.set(part, (freq.get(part) || 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'mixed';
};

// Pairwise similarity matrix. Used by the report renderer to show "shared X%
// across all members" headlines and for the unique-content breakdown. Uses
// IDF computed over the cluster members only — gives a cluster-local view
// of "how distinct are these from each other."
export const pairwiseSimilarity = (members) => {
  const docTokens = members.map((m) => {
    const body = (m.body || '').slice(0, BODY_TRUNCATE);
    return tokenize(`${m.name} ${m.description} ${body}`);
  });
  const idf = buildIdf(docTokens);
  const enriched = members.map((m, i) => ({
    name: m.name,
    _tf: tfIdf(docTokens[i], idf),
    _descTokens: tokenize(`${m.name} ${m.description}`, { withBigrams: false }),
  }));
  const matrix = [];
  for (let i = 0; i < enriched.length; i++) {
    const row = [];
    for (let j = 0; j < enriched.length; j++) {
      row.push(i === j ? 1 : Number(similarity(enriched[i], enriched[j]).toFixed(3)));
    }
    matrix.push(row);
  }
  return matrix;
};

// Re-exported for the quality module so it can compute silhouette using the
// same similarity definition the clusterer used.
export { similarity };

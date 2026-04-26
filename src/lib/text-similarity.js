// Deterministic similarity primitives. No LLM. Used for clustering skills
// before the LLM pipeline runs, and for ranking which skill pairs need
// closer LLM-driven comparison.

import { DOMAIN_STOPWORDS } from './domain-stopwords.js';

const ENGLISH_STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in',
  'is','it','its','of','on','or','that','the','to','was','were','will','with',
  'this','using','when','how','what','if','can','also','should','must',
  'please','do','not','no','yes','any','all','some','more','most',
  'one','two','your','you','we','our','i','me','my',
]);

export const tokenize = (text, { extraStopwords, withBigrams = true } = {}) => {
  if (!text) return [];
  const stops = extraStopwords
    ? new Set([...ENGLISH_STOPWORDS, ...DOMAIN_STOPWORDS, ...extraStopwords])
    : new Set([...ENGLISH_STOPWORDS, ...DOMAIN_STOPWORDS]);
  const unigrams = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stops.has(w));
  if (!withBigrams) return unigrams;
  // Bigrams capture phrase-level signal (e.g. "react hook", "table driven")
  // that unigrams scatter. We emit them with a separator so cosine treats
  // them as distinct features.
  const bigrams = [];
  for (let i = 0; i < unigrams.length - 1; i++) {
    bigrams.push(`${unigrams[i]}__${unigrams[i + 1]}`);
  }
  return unigrams.concat(bigrams);
};

export const termFrequency = (tokens) => {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  return tf;
};

// Jaccard similarity over token sets. 0 = disjoint, 1 = identical.
export const jaccard = (a, b) => {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersect = 0;
  for (const x of setA) if (setB.has(x)) intersect++;
  return intersect / (setA.size + setB.size - intersect);
};

// Cosine similarity over TF vectors. Better signal than Jaccard for prose
// because it weighs frequent terms.
export const cosine = (tfA, tfB) => {
  const keys = new Set([...tfA.keys(), ...tfB.keys()]);
  let dot = 0, magA = 0, magB = 0;
  for (const k of keys) {
    const a = tfA.get(k) || 0;
    const b = tfB.get(k) || 0;
    dot += a * b;
    magA += a * a;
    magB += b * b;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

// Inverse document frequency over a corpus. Common words across the corpus
// (patterns, use, react, skill) get crushed; rare words (kotlin, exposed,
// liquid-glass) keep their signal. This is what stops "everything that
// mentions React" from clustering together.
export const buildIdf = (docTokens) => {
  const N = docTokens.length;
  const df = new Map();
  for (const tokens of docTokens) {
    const seen = new Set(tokens);
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map();
  for (const [t, count] of df) {
    // Smoothed log IDF — never zero, never negative
    idf.set(t, Math.log((N + 1) / (count + 1)) + 1);
  }
  return idf;
};

// Build a TF-IDF vector for a document given a precomputed IDF table.
export const tfIdf = (tokens, idf) => {
  const tf = termFrequency(tokens);
  const out = new Map();
  for (const [term, count] of tf) {
    const weight = idf.get(term) || 1;
    out.set(term, count * weight);
  }
  return out;
};

// Normalized name overlap. Catches "frontend-react" vs "react-frontend" vs
// "react-patterns" being near each other in name space.
export const nameOverlap = (nameA, nameB) => {
  const a = new Set(nameA.toLowerCase().split(/[-_\s]+/).filter(Boolean));
  const b = new Set(nameB.toLowerCase().split(/[-_\s]+/).filter(Boolean));
  return jaccard([...a], [...b]);
};

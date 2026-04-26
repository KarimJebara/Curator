import assert from 'node:assert/strict';
import {
  tokenize,
  jaccard,
  cosine,
  termFrequency,
  nameOverlap,
} from '../../src/lib/text-similarity.js';

export const tests = {
  'tokenize strips stopwords and punctuation': () => {
    const out = tokenize('The quick brown fox, jumps over.', { withBigrams: false });
    assert.deepEqual(out.sort(), ['brown', 'fox', 'jumps', 'over', 'quick'].sort());
  },

  'tokenize is case-insensitive': () => {
    const out = tokenize('REACT React react', { withBigrams: false });
    assert.deepEqual(out, ['react', 'react', 'react']);
  },

  'tokenize emits bigrams by default': () => {
    const out = tokenize('quick brown fox', { withBigrams: true });
    assert.ok(out.includes('quick'));
    assert.ok(out.includes('brown__fox'));
  },

  'tokenize prunes domain stopwords': () => {
    const out = tokenize('This skill uses comprehensive examples', { withBigrams: false });
    assert.ok(!out.includes('skill'), 'medium-word stopword leaked');
    assert.ok(!out.includes('comprehensive'), 'quality-adjective stopword leaked');
    assert.ok(!out.includes('examples'), 'documentation-noise stopword leaked');
  },

  'jaccard returns 1 for identical sets': () => {
    assert.equal(jaccard(['a', 'b'], ['a', 'b']), 1);
  },

  'jaccard returns 0 for disjoint sets': () => {
    assert.equal(jaccard(['a', 'b'], ['c', 'd']), 0);
  },

  'jaccard handles partial overlap': () => {
    assert.equal(jaccard(['a', 'b', 'c'], ['b', 'c', 'd']), 0.5);
  },

  'cosine of identical vectors is 1': () => {
    const tf = termFrequency(['react', 'hooks', 'react']);
    const score = cosine(tf, tf);
    assert.ok(Math.abs(score - 1) < 1e-9, `expected ~1, got ${score}`);
  },

  'cosine of orthogonal vectors is 0': () => {
    const a = termFrequency(['react']);
    const b = termFrequency(['kotlin']);
    assert.equal(cosine(a, b), 0);
  },

  'nameOverlap catches frontend-react vs react-frontend': () => {
    const score = nameOverlap('frontend-react', 'react-frontend');
    assert.equal(score, 1);
  },

  'nameOverlap is partial for frontend-react vs frontend-android': () => {
    const score = nameOverlap('frontend-react', 'frontend-android');
    assert.ok(score > 0 && score < 1, `expected 0 < score < 1, got ${score}`);
  },
};

import assert from 'node:assert/strict';
import { analyzeOverlap } from '../../src/detectors/cluster-overlap.js';

const member = (name, text) => ({ name, text });

export const tests = {
  'returns empty result for single-member clusters': () => {
    const out = analyzeOverlap([member('alone', 'kotlin patterns and stuff')]);
    assert.deepEqual(out.shared, []);
    assert.deepEqual(out.pairs, []);
    assert.deepEqual(out.unique, {});
  },

  'shared core surfaces tokens common to all members': () => {
    const out = analyzeOverlap([
      member('a', 'kotlin coroutines flow android'),
      member('b', 'kotlin patterns coroutines kmp'),
      member('c', 'kotlin testing coroutines kover'),
    ]);
    const sharedTokens = out.shared.map((s) => s.token);
    assert.ok(sharedTokens.includes('kotlin'), 'kotlin appears in all three');
    assert.ok(sharedTokens.includes('coroutines'), 'coroutines appears in all three');
  },

  'unique-per-member highlights tokens only one skill knows': () => {
    const out = analyzeOverlap([
      member('a', 'kotlin coroutines android compose'),
      member('b', 'kotlin coroutines kmp ios'),
    ]);
    const aUnique = out.unique['a'].map((u) => u.token);
    const bUnique = out.unique['b'].map((u) => u.token);
    assert.ok(aUnique.includes('compose') || aUnique.includes('android'));
    assert.ok(bUnique.includes('kmp') || bUnique.includes('ios'));
  },

  'pairs lists every pairwise similarity sorted descending': () => {
    const out = analyzeOverlap([
      member('a', 'kotlin coroutines flow'),
      member('b', 'kotlin coroutines flow'),
      member('c', 'totally different python django web'),
    ]);
    assert.equal(out.pairs.length, 3);
    // a↔b should be ~1, the other two pairs much lower
    assert.ok(out.pairs[0].similarity > 0.7, `expected high similarity for a↔b, got ${out.pairs[0].similarity}`);
    assert.ok(out.pairs[2].similarity < 0.3, `expected low similarity for the disjoint pair, got ${out.pairs[2].similarity}`);
  },

  'flags duplicates: members with no unique vocabulary': () => {
    const out = analyzeOverlap([
      member('a', 'kotlin coroutines flow patterns'),
      member('b', 'kotlin coroutines flow patterns'),
    ]);
    // Both have identical content — neither should have unique tokens
    assert.equal(out.unique['a'].length, 0, 'duplicate skill should have no unique tokens');
    assert.equal(out.unique['b'].length, 0, 'duplicate skill should have no unique tokens');
  },
};

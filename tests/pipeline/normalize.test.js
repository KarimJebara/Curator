import assert from 'node:assert/strict';
import { normalizeSpecialization } from '../../src/pipeline/3-specialize.js';

export const tests = {
  'identity rename with tightened_description becomes rewrite': () => {
    const input = {
      cluster_label: 'swift',
      actions: [
        {
          type: 'specialize',
          from: 'swift-actor-persistence',
          to: 'swift-actor-persistence',
          tightened_description: 'Tighter desc',
          reason: 'Already well-named',
        },
      ],
    };
    const out = normalizeSpecialization(input);
    assert.equal(out.actions[0].type, 'rewrite');
    assert.equal(out.actions[0].name, 'swift-actor-persistence');
    assert.equal(out.actions[0].tightened_description, 'Tighter desc');
  },

  'identity rename without tightened_description becomes keep': () => {
    const input = {
      cluster_label: 'java',
      actions: [
        { type: 'specialize', from: 'java-coding-standards', to: 'java-coding-standards', reason: 'Already specific' },
      ],
    };
    const out = normalizeSpecialization(input);
    assert.equal(out.actions[0].type, 'keep');
    assert.equal(out.actions[0].name, 'java-coding-standards');
  },

  'real specialize (different from/to) is left alone': () => {
    const input = {
      cluster_label: 'video',
      actions: [
        { type: 'specialize', from: 'videodb', to: 'video-ingest-search', reason: 'Niche' },
      ],
    };
    const out = normalizeSpecialization(input);
    assert.equal(out.actions[0].type, 'specialize');
    assert.equal(out.actions[0].to, 'video-ingest-search');
  },

  'keep and delete actions are passed through unchanged': () => {
    const input = {
      cluster_label: 'misc',
      actions: [
        { type: 'keep', name: 'x', reason: 'fine' },
        { type: 'delete', name: 'y', reason: 'dup' },
      ],
    };
    const out = normalizeSpecialization(input);
    assert.equal(out.actions.length, 2);
    assert.equal(out.actions[0].type, 'keep');
    assert.equal(out.actions[1].type, 'delete');
  },

  'missing actions array returns input unchanged': () => {
    assert.deepEqual(normalizeSpecialization({}), {});
    assert.equal(normalizeSpecialization(null), null);
  },
};

import assert from 'node:assert/strict';
import { extractTags, tagsForSkills } from '../../src/detectors/tags.js';
import { buildTopics } from '../../src/detectors/topics.js';

const fakeSkill = (name, description = '', tokens = 100) => ({ name, description, tokens });

export const tests = {
  'extractTags pulls language from kebab prefix': () => {
    const tags = extractTags(fakeSkill('kotlin-ktor-patterns'));
    assert.ok(tags.has('kotlin'));
    assert.ok(tags.has('ktor'));
  },

  'extractTags catches tags from description': () => {
    const tags = extractTags(fakeSkill('foo-bar', 'A skill for testing kotlin android apps'));
    assert.ok(tags.has('kotlin'));
    assert.ok(tags.has('android'));
    assert.ok(tags.has('testing'));
  },

  'extractTags ignores generic words like patterns': () => {
    const tags = extractTags(fakeSkill('frontend-patterns'));
    assert.ok(tags.has('frontend'));
    assert.ok(!tags.has('patterns'));
  },

  'buildTopics groups skills with min 3 members': () => {
    const skills = [
      fakeSkill('kotlin-patterns'),
      fakeSkill('kotlin-testing'),
      fakeSkill('kotlin-ktor-patterns'),
      fakeSkill('python-patterns'),
    ];
    const topics = buildTopics(skills, { minMembers: 3 });
    const kotlin = topics.find((t) => t.tag === 'kotlin');
    assert.ok(kotlin, 'expected a kotlin topic');
    assert.equal(kotlin.members.length, 3);
    assert.ok(!topics.find((t) => t.tag === 'python'), 'python should be below threshold');
  },

  'a skill can belong to multiple topics': () => {
    const skills = [
      fakeSkill('kotlin-testing'),
      fakeSkill('python-testing'),
      fakeSkill('golang-testing'),
      fakeSkill('kotlin-patterns'),
      fakeSkill('kotlin-ktor-patterns'),
    ];
    const topics = buildTopics(skills, { minMembers: 3 });
    const tags = topics.map((t) => t.tag).sort();
    assert.deepEqual(tags, ['kotlin', 'testing']);
    const kotlin = topics.find((t) => t.tag === 'kotlin');
    const testing = topics.find((t) => t.tag === 'testing');
    assert.ok(kotlin.members.find((m) => m.name === 'kotlin-testing'));
    assert.ok(testing.members.find((m) => m.name === 'kotlin-testing'),
      'kotlin-testing should be in both kotlin AND testing topics');
  },

  'extractTags reads frontmatter.tags (not just name + description)': () => {
    // Tag name "convex" isn't in KNOWN_TAGS — heuristic extraction would skip
    // it. But the user wrote it in frontmatter, so it should be respected.
    const skill = {
      name: 'my-thing',
      description: 'something unrelated',
      frontmatter: { tags: 'convex, react' },
    };
    const tags = extractTags(skill);
    assert.ok(tags.has('convex'), 'explicit frontmatter tag "convex" should be respected');
    assert.ok(tags.has('react'), 'explicit frontmatter tag "react" should be kept');
  },

  'explicit-frontmatter topic appears below the minMembers threshold': () => {
    // Only 1 skill is tagged with the user-authored tag. With pure heuristic
    // extraction this would be filtered (minMembers=3). With frontmatter
    // respect, it should appear.
    const skills = [
      { name: 'a', description: '', frontmatter: { tags: 'convex' } },
      fakeSkill('kotlin-patterns'),
      fakeSkill('python-patterns'),
      fakeSkill('go-patterns'),
    ];
    const topics = buildTopics(skills, { minMembers: 3 });
    const convex = topics.find((t) => t.tag === 'convex');
    assert.ok(convex, 'a single-member topic from explicit tags should appear');
    assert.equal(convex.members.length, 1);
    assert.equal(convex.explicit, true, 'explicit flag should be set');
  },
};

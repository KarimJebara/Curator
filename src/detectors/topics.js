import { tagsForSkills } from './tags.js';

// A topic is a tag with at least `minMembers` skills. A skill can belong to
// multiple topics — there's no single-membership constraint like clusters
// have. The product of this stage is the input to the topic-router
// generator: each topic becomes a candidate /tag-name browser router.
//
// Output is sorted by member count descending, then tag alphabetically.
export const buildTopics = (skills, { minMembers = 3, augmentedTags } = {}) => {
  const tagMap = augmentedTags || tagsForSkills(skills);
  const byTag = new Map();
  for (const skill of skills) {
    const tags = tagMap.get(skill.name) || new Set();
    for (const t of tags) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(skill);
    }
  }
  const topics = [];
  for (const [tag, members] of byTag) {
    if (members.length < minMembers) continue;
    topics.push({
      id: `t-${tag}`,
      tag,
      members: members.map(({ name, description, tokens, grade, dir, path }) => ({
        name, description, tokens, grade, dir, path,
      })),
      totalTokens: members.reduce((a, m) => a + (m.tokens || 0), 0),
    });
  }
  topics.sort((a, b) => b.members.length - a.members.length || a.tag.localeCompare(b.tag));
  return topics;
};

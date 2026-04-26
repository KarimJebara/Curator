import { tagsForSkills } from './tags.js';

// Pull every tag the user has authored into frontmatter (the explicit topics
// they meant to create via the dashboard or by hand). These bypass the
// minMembers threshold — if you explicitly tagged one skill, the topic still
// shows up.
const collectForcedTags = (skills) => {
  const forced = new Set();
  for (const s of skills) {
    const fm = s.frontmatter?.tags;
    if (!fm) continue;
    const raw = Array.isArray(fm) ? fm : String(fm).split(/[,\s]+/);
    for (const t of raw) {
      const norm = String(t).trim().toLowerCase();
      if (norm) forced.add(norm);
    }
  }
  return forced;
};

// A topic is a tag with at least `minMembers` skills — UNLESS the tag was
// explicitly authored in frontmatter, in which case any positive member
// count is enough. Heuristic threshold filters auto-detection noise;
// explicit threshold respects user intent.
//
// Output is sorted by member count descending, then tag alphabetically.
export const buildTopics = (skills, { minMembers = 3, augmentedTags, forcedTags } = {}) => {
  const tagMap = augmentedTags || tagsForSkills(skills);
  const forced = forcedTags || collectForcedTags(skills);
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
    const threshold = forced.has(tag) ? 1 : minMembers;
    if (members.length < threshold) continue;
    topics.push({
      id: `t-${tag}`,
      tag,
      members: members.map(({ name, description, tokens, grade, dir, path }) => ({
        name, description, tokens, grade, dir, path,
      })),
      totalTokens: members.reduce((a, m) => a + (m.tokens || 0), 0),
      explicit: forced.has(tag),
    });
  }
  topics.sort((a, b) => b.members.length - a.members.length || a.tag.localeCompare(b.tag));
  return topics;
};

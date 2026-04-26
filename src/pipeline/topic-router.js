// Topic router generator. Unlike a cluster router (which picks ONE
// specialist for a task), a topic router LISTS all members under a tag so
// a human can browse them. Used for /kotlin, /frontend, /testing, etc.
//
// We don't need an LLM for this — the body is purely structural. The
// frontmatter description follows a fixed template. Everything is
// deterministic so the user always gets the same topic router for the
// same set of members.

const buildBody = (topic) => {
  const lines = [];
  lines.push(`# ${capitalize(topic.tag)} skills`);
  lines.push('');
  lines.push(`This is a browser router for everything tagged \`${topic.tag}\` in the user's skill library. When invoked, list the available specialists below and ask the user which one they want — or pick the best fit if the task is specific enough to disambiguate.`);
  lines.push('');
  lines.push(`## Available specialists`);
  lines.push('');
  for (const m of topic.members) {
    const desc = (m.description || '').replace(/\n/g, ' ').slice(0, 120);
    lines.push(`- \`${m.name}\` — ${desc}${desc.length === 120 ? '…' : ''}`);
  }
  lines.push('');
  lines.push(`## How to use`);
  lines.push('');
  lines.push(`When invoked from a slash command (\`/${topic.tag}\`), summarize the available specialists and ask the user which they want.`);
  lines.push('');
  lines.push(`When invoked autonomously, examine the task signals and dispatch to the most specific specialist via the Skill tool. If multiple specialists could apply, prefer the most narrowly-scoped one.`);
  lines.push('');
  lines.push(`Do not answer the task directly — always delegate to a specialist or ask the user.`);
  return lines.join('\n');
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const renderTopicRouterSkill = (topic) => {
  const fm = [
    '---',
    `name: ${topic.tag}`,
    `description: Browse and dispatch ${capitalize(topic.tag)}-related tasks across ${topic.members.length} specialist skills`,
    `type: topic-router`,
    '---',
    '',
  ].join('\n');
  return fm + buildBody(topic);
};

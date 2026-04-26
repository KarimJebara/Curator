// Generates a meta-router that lists every other topic router. Invoked as
// /topics — the answer to "what curated browsers do I have?". This is
// purely deterministic; no LLM. Regenerated each scan so the list stays in
// sync with whatever topics currently exist.

export const renderTopicIndexSkill = (topics) => {
  const sorted = [...topics].sort((a, b) => b.members.length - a.members.length);
  const lines = [];
  lines.push('---');
  lines.push('name: topics');
  lines.push(`description: Index of every topic browser router curator generated for this skill library (${sorted.length} topics)`);
  lines.push('type: topic-index');
  lines.push('---');
  lines.push('');
  lines.push('# Topics index');
  lines.push('');
  lines.push(`This is the master index of all topic routers in the user's skill library. There are ${sorted.length} topics. Each one is invokable as \`/<tag>\`.`);
  lines.push('');
  lines.push('## Available topic browsers');
  lines.push('');
  lines.push('| Topic | Skills | Notes |');
  lines.push('|---|---:|---|');
  for (const t of sorted) {
    const exemplar = t.members[0]?.name || '';
    const more = t.members.length > 1 ? `, +${t.members.length - 1} more` : '';
    lines.push(`| \`/${t.tag}\` | ${t.members.length} | ${exemplar}${more} |`);
  }
  lines.push('');
  lines.push('## How to use');
  lines.push('');
  lines.push('When invoked from `/topics`, list the available topic routers above grouped by size and ask the user which area they want to browse.');
  lines.push('');
  lines.push('When invoked autonomously, examine the user task and dispatch to the most relevant topic router via the Skill tool. If the task is narrow enough to skip the topic layer, dispatch directly to the matching specialist instead.');
  lines.push('');
  lines.push('Do not answer the task directly — always delegate.');
  return lines.join('\n');
};

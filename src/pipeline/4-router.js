import { complete } from '../lib/llm.js';

// Stage 4: produce a router skill that dispatches to the specialized cluster
// members via subagents. This is the magic-moment output the user sees as
// the headline of the launch post.

const SYSTEM = `You write Claude Code router skills. A router skill examines the user's task, decides which specialist sub-skill (or sub-agent) best matches, and delegates. Output a complete SKILL.md including frontmatter. No commentary.`;

const userPrompt = (cluster, specialization) => {
  const specialists = specialization.actions.filter((a) => a.type === 'specialize' || a.type === 'keep');
  return `Generate a router SKILL.md for the "${specialization.cluster_label}" cluster.

Specialists this router dispatches to:
${specialists.map((s) => `- ${s.to || s.name}: ${s.tightened_description || s.reason || ''}`).join('\n')}

Requirements:
- Frontmatter must include name, description, type. Use:
  name: ${specialization.cluster_label}
  description: Routes ${specialization.cluster_label}-related tasks to the right specialist skill or sub-agent
- The body must contain a "Routing decision table" mapping task signals → specialist names.
- The body must include explicit instructions to invoke the specialist via the Skill tool when invoked from a slash command, or via the Agent tool with subagent_type when invoked autonomously.
- Keep total length under 1500 characters.
- Output only the SKILL.md content, starting with "---".`;
};

export const generateRouter = async (cluster, specialization) => {
  const { text } = await complete({
    which: 'sonnet',
    system: SYSTEM,
    user: userPrompt(cluster, specialization),
    maxTokens: 2048,
  });
  // Trim accidental code-fence wrappers.
  return text.replace(/^```(?:markdown|md)?\s*|\s*```$/g, '').trim();
};

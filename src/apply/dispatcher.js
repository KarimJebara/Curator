import path from 'node:path';
import { renameSkill } from './rename.js';
import { rewriteSkill } from './rewrite.js';
import { deleteSkill } from './delete.js';
import { writeRouterSkill } from './write-router.js';

// Map a parsed action (from the report) onto the file-system operation it
// describes. Returns a result record per action so the CLI can summarize
// what changed and what failed.
export const applyAction = (action, ctx) => {
  const skill = ctx.skillsByName.get(action.from || action.name);
  try {
    switch (action.type) {
      case 'specialize': {
        if (!skill) return { action, ok: false, error: `Skill not found: ${action.from}` };
        const tightened = ctx.proposalsByCluster?.[action.cluster]?.specialization?.actions?.find(
          (a) => a.type === 'specialize' && a.from === action.from,
        );
        if (tightened?.tightened_description) {
          rewriteSkill(skill.dir, { description: tightened.tightened_description });
        }
        const r = renameSkill(skill.dir, action.to);
        return { action, ok: true, result: r };
      }
      case 'rewrite': {
        if (!skill) return { action, ok: false, error: `Skill not found: ${action.name}` };
        const tightened = findRewrite(ctx, action.cluster, action.name);
        const r = rewriteSkill(skill.dir, tightened || {});
        return { action, ok: true, result: r };
      }
      case 'delete': {
        if (!skill) return { action, ok: false, error: `Skill not found: ${action.name}` };
        const r = deleteSkill(skill.dir);
        return { action, ok: true, result: r };
      }
      case 'generate-router': {
        const proposal = ctx.proposalsByCluster?.[action.cluster];
        if (!proposal?.routerSkill) {
          return { action, ok: false, error: 'No generated router skill found in proposal' };
        }
        const r = writeRouterSkill(action.name, proposal.routerSkill);
        return { action, ok: true, result: r };
      }
      case 'generate-topic-router': {
        const topic = ctx.topicsById?.[action.topic] || ctx.topicsByTag?.[action.name];
        if (!topic?.routerSkill) {
          return { action, ok: false, error: 'No topic router skill found' };
        }
        const r = writeRouterSkill(action.name, topic.routerSkill);
        return { action, ok: true, result: r };
      }
      case 'remove-mcp':
        return { action, ok: false, error: 'MCP removal not yet implemented (Phase 1.1)' };
      default:
        return { action, ok: false, error: `Unknown action type: ${action.type}` };
    }
  } catch (err) {
    return { action, ok: false, error: err.message };
  }
};

const findRewrite = (ctx, clusterId, name) => {
  const proposal = ctx.proposalsByCluster?.[clusterId];
  if (!proposal) return null;
  const a = proposal.specialization?.actions?.find(
    (x) => (x.from === name || x.name === name) && x.tightened_description,
  );
  return a ? { description: a.tightened_description } : null;
};

export const buildContext = ({ skills, proposalsByCluster, topics = [] }) => ({
  skillsByName: new Map(skills.map((s) => [s.name, s])),
  proposalsByCluster,
  topicsById: Object.fromEntries(topics.map((t) => [t.id, t])),
  topicsByTag: Object.fromEntries(topics.map((t) => [t.tag, t])),
});

export const applyAll = (actions, ctx) => actions.map((a) => applyAction(a, ctx));

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const HOME = os.homedir();

export const claudeHome = () => path.join(HOME, '.claude');
// Honors CURATOR_USER_SKILLS_DIR for test isolation. Default is ~/.claude/skills.
export const userSkillsDir = () => process.env.CURATOR_USER_SKILLS_DIR || path.join(claudeHome(), 'skills');
export const userCommandsDir = () => path.join(claudeHome(), 'commands');
export const userPluginsDir = () => path.join(claudeHome(), 'plugins');
export const claudeJsonPath = () => path.join(HOME, '.claude.json');
export const memoryFile = () => path.join(claudeHome(), 'CLAUDE.md');

export const agentsHome = () => path.join(HOME, '.agents');
export const userAgentSkillsDir = () => path.join(agentsHome(), 'skills');

const splitPathList = (value) => (value || '')
  .split(path.delimiter)
  .map((p) => p.trim())
  .filter(Boolean);

const dedupe = (items) => [...new Set(items)];

export const workspaceAgentSkillsDirs = (cwd = process.cwd()) => {
  const dirs = [];
  let current = path.resolve(cwd);
  while (true) {
    dirs.push(path.join(current, '.agents', 'skills'));
    const parent = path.dirname(current);
    if (parent === current || current === HOME) break;
    current = parent;
  }
  return dirs;
};

export const extraSkillRoots = () => [
  ...splitPathList(process.env.CURATOR_EXTRA_SKILLS_DIRS),
  ...splitPathList(process.env.CURATOR_WORKSPACE_SKILLS_DIR),
];

export const skillRoots = ({ cwd = process.cwd(), extraRoots = [] } = {}) => {
  if (process.env.CURATOR_USER_SKILLS_DIR) {
    return dedupe([userSkillsDir(), userPluginsDir(), ...extraRoots]);
  }
  return dedupe([
    userSkillsDir(),
    userPluginsDir(),
    userAgentSkillsDir(),
    ...workspaceAgentSkillsDirs(cwd),
    ...extraSkillRoots(),
    ...extraRoots,
  ]);
};

export const editableSkillRoots = (opts = {}) => dedupe([
  userSkillsDir(),
  userAgentSkillsDir(),
  ...workspaceAgentSkillsDirs(opts.cwd),
  ...extraSkillRoots(),
]);

// Honors CURATOR_HOME for test isolation. Default is ~/.claude/curator.
export const curatorHome = () => process.env.CURATOR_HOME || path.join(claudeHome(), 'curator');
export const reportsDir = () => path.join(curatorHome(), 'reports');
export const stagingDir = () => path.join(curatorHome(), 'staging');
export const backupsDir = () => path.join(curatorHome(), 'backups');

export const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  return p;
};

export const projectMcpJson = (cwd) => path.join(cwd, '.mcp.json');

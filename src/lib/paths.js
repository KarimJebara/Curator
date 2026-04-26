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

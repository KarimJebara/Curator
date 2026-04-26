import { execSync } from 'node:child_process';
import { reportsDir, ensureDir } from '../lib/paths.js';

const MARKER_START = '# >>> curator weekly audit >>>';
const MARKER_END = '# <<< curator weekly audit <<<';

const readCrontab = () => {
  try {
    return execSync('crontab -l', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

const writeCrontab = (text) => {
  execSync('crontab -', { input: text });
};

const stripExisting = (text) => {
  const startIdx = text.indexOf(MARKER_START);
  const endIdx = text.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1) return text;
  return text.slice(0, startIdx) + text.slice(endIdx + MARKER_END.length).replace(/^\n+/, '');
};

// Install a weekly cron entry that runs `curator scan` every Monday at
// 09:00 local time. The block is fenced with markers so we can update or
// remove it idempotently without disturbing the user's other entries.
export const installCron = ({ binPath, schedule = '0 9 * * 1' } = {}) => {
  ensureDir(reportsDir());
  const existing = stripExisting(readCrontab());
  const block = [
    MARKER_START,
    `${schedule} ${binPath} scan --quiet >> ${reportsDir()}/cron.log 2>&1`,
    MARKER_END,
    '',
  ].join('\n');
  writeCrontab(existing + (existing.endsWith('\n') ? '' : '\n') + block);
  return { schedule, binPath };
};

export const uninstallCron = () => {
  const existing = readCrontab();
  if (!existing.includes(MARKER_START)) return { removed: false };
  writeCrontab(stripExisting(existing));
  return { removed: true };
};

export const isInstalled = () => readCrontab().includes(MARKER_START);

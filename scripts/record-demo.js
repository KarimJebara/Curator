// Record a demo of the curator dashboard using Playwright, then ask ffmpeg
// to convert the WebM into a GIF for the README hero.
//
// Usage:
//   node bin/curator.js dashboard --port 4711 --no-open &
//   node scripts/record-demo.js
//
// Output: docs/media/demo.gif (and a temp .webm that gets cleaned up)
//
// Tunables at the top — adjust to taste.

import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const URL = process.env.CURATOR_URL || 'http://127.0.0.1:4711';
const VIEWPORT = { width: 1280, height: 800 };
const MEDIA_DIR = path.join(ROOT, 'docs', 'media');
const TMP_DIR = path.join(MEDIA_DIR, '.tmp');
const GIF_PATH = path.join(MEDIA_DIR, 'demo.gif');

const FPS = 10;
const GIF_WIDTH = 760;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ensureDashboardReachable = async () => {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${URL}/api/health`);
      if (res.ok) return;
    } catch {}
    await sleep(300);
  }
  throw new Error(`Dashboard not reachable at ${URL}. Start it with: node bin/curator.js dashboard --port 4711 --no-open`);
};

const run = async () => {
  await ensureDashboardReachable();
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: TMP_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();

  // Open the overview and let the fade-in finish
  await page.goto(URL);
  await page.waitForSelector('#counts');
  await sleep(1200);

  // Show off the hero + grade donut
  await page.evaluate(() => window.scrollBy({ top: 220, behavior: 'smooth' }));
  await sleep(1500);

  // Click the first cluster card and let the cluster-detail view load
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await sleep(600);
  const firstCluster = page.locator('.cluster-card').first();
  if (await firstCluster.count() > 0) {
    await firstCluster.click();
    await page.waitForSelector('.bar-row', { timeout: 5000 });
    await sleep(900);
    await page.evaluate(() => window.scrollBy({ top: 280, behavior: 'smooth' }));
    await sleep(1600);
    await page.evaluate(() => window.scrollBy({ top: 320, behavior: 'smooth' }));
    await sleep(1600);
    // Back to overview
    const back = page.getByRole('button', { name: /Back to overview/i }).first();
    if (await back.count() > 0) await back.click();
    await sleep(500);
  }

  // Filter by topic from the sidebar
  const firstTopic = page.locator('#topics .filter-btn').first();
  if (await firstTopic.count() > 0) {
    await firstTopic.click();
    await sleep(900);
  }

  // Open the first skill in the list
  const firstSkill = page.locator('.skill-list li').first();
  if (await firstSkill.count() > 0) {
    await firstSkill.click();
    await sleep(1300);
  }

  // Edit + cancel (showcase the editor without persisting)
  const editBtn = page.getByRole('button', { name: /^Edit$/ }).first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await sleep(800);
    const cancelBtn = page.getByRole('button', { name: /^Cancel$/ }).first();
    if (await cancelBtn.count() > 0) await cancelBtn.click();
    await sleep(600);
  }

  await context.close();
  await browser.close();

  // Find the WebM Playwright produced
  const webms = fs.readdirSync(TMP_DIR).filter((f) => f.endsWith('.webm'));
  if (!webms.length) throw new Error('Playwright did not produce a video file.');
  const webmPath = path.join(TMP_DIR, webms[0]);
  const palettePath = path.join(TMP_DIR, 'palette.png');

  // ffmpeg two-pass for high-quality, small GIF: generate palette, then use it.
  const filter = `fps=${FPS},scale=${GIF_WIDTH}:-1:flags=lanczos`;
  const palette = spawnSync('ffmpeg', [
    '-y', '-i', webmPath,
    '-vf', `${filter},palettegen=stats_mode=diff`,
    palettePath,
  ], { stdio: 'inherit' });
  if (palette.status !== 0) throw new Error('ffmpeg palettegen failed');

  const encode = spawnSync('ffmpeg', [
    '-y', '-i', webmPath, '-i', palettePath,
    '-lavfi', `${filter} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5`,
    '-loop', '0',
    GIF_PATH,
  ], { stdio: 'inherit' });
  if (encode.status !== 0) throw new Error('ffmpeg paletteuse failed');

  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  const sizeKb = Math.round(fs.statSync(GIF_PATH).size / 1024);
  console.log(`\nWrote ${path.relative(ROOT, GIF_PATH)} (${sizeKb} KB)`);
};

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

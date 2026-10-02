import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

try {
  // 1. Login via UI form
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('123');
  await page.locator('button', { hasText: '登 录' }).first().click();
  await page.waitForTimeout(4000);
  console.log('After login URL:', page.url());

  // 2. Capture screenshots of key pages
  const targets = [
    ['/sky', 'sky-home'],
    ['/sky/learning/today', 'sky-today'],
    ['/sky/cloud-mind', 'sky-resources'],
    ['/sky/cloud-mind/solve', 'sky-solve'],
  ];

  for (const [path, name] of targets) {
    try {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(
        () => document.querySelector('[data-sky-desktop-main]') !== null,
        { timeout: 15000 },
      );
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `scripts/_shot_${name}.png`, fullPage: false });
      console.log('SHOT', name, page.url());
    } catch (e) {
      console.log('SHOT_FAIL', name, e.message.split('\n')[0]);
    }
  }
} catch (e) {
  console.log('ERROR', e.message.split('\n')[0]);
} finally {
  await browser.close();
}
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('123');
  await page.locator('button', { hasText: '登 录' }).first().click();
  await page.waitForTimeout(3500);

  const pages = [
    ['/sky/cloud-mind', 'cloud-mind'],
    ['/sky', 'home'],
  ];
  for (const [path, name] of pages) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('[data-sky-desktop-main]'), { timeout: 15000 });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const sb = document.querySelector('[data-sky-sidebar]');
      const bg = document.body.querySelector('[class*="-z-10"]');
      const header = document.querySelector('header');
      const main = document.querySelector('[data-sky-desktop-main]');
      function cs(el) { return el ? getComputedStyle(el).backgroundColor : 'none'; }
      // body computed bg comes from a fixed container; sample pixel at body center via a temp probe
      return {
        sidebarBg: cs(sb),
        mainBg: cs(main),
        headerBg: cs(header),
      };
    });
    // sample a background pixel using screenshot-like approach: use path position by evaluating a positioned element
    const bodyBg = await page.evaluate(() => {
      // temporarily measure the atmospheric bg layer
      const layers = document.querySelectorAll('div');
      let out = [];
      for (const l of layers) {
        const g = l.getAttribute('style') || '';
        if (g.includes('linear-gradient') && getComputedStyle(l).position === 'fixed') {
          out.push(getComputedStyle(l).backgroundImage);
        }
      }
      return out;
    });
    console.log(`--- ${name} ---`);
    console.log('sidebarBg:', info.sidebarBg, '| headerBg:', info.headerBg, '| mainBg:', info.mainBg);
    console.log('fixedBg:', bodyBg.join(' | ') || 'none');
  }
} catch (e) {
  console.log('ERROR', e.message.split('\n')[0]);
} finally {
  await browser.close();
}
import { chromium } from './node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ 
  headless: true,
  channel: 'msedge'
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:3000/sky', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/sky-page.png', fullPage: false });
console.log('Screenshot saved');
const title = await page.title();
console.log('Page title:', title);
await browser.close();

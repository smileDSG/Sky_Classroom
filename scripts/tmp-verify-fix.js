/* 一次性验证: 修复后 —— 小视口下舞台尺寸是否被压到 45% 上限内 + 柔光背景是否生效 + 截图 */
const fs = require('fs');
const LOG = process.env.TEMP + '/tmp-verify-fix.txt';
const log = (m) => fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`);

(async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  // 用户截图同尺寸视口(657x468), 深色主题
  const page = await browser.newPage({ viewport: { width: 657, height: 468 }, colorScheme: 'dark' });
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('123');
  await page.getByRole('button', { name: /登\s*录/ }).last().click();
  await page.waitForTimeout(3000);
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  let found = false;
  for (let i = 0; i < 120; i++) {
    const stage = await page.$('#oml2d-stage').catch(() => null);
    if (stage) {
      const sized = await stage.evaluate((el) => el.dataset.sized);
      if (sized === '1') { found = true; break; }
    }
    await page.waitForTimeout(500);
  }
  log(`stage sized: ${found}`);
  if (!found) { await browser.close(); return; }

  // 等 3s 稳定, 采样 3 次
  for (let k = 0; k < 3; k++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const el = document.getElementById('oml2d-stage');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        win: { w: window.innerWidth, h: window.innerHeight },
        stage: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        right: el.style.right,
        bg: el.style.background.slice(0, 60),
        sized: el.dataset.sized,
        modelScale: (() => { const c = document.querySelector('#oml2d-canvas'); return c ? c.width + 'x' + c.height : null; })(),
        webgl: (() => {
          const c = document.querySelector('#oml2d-canvas');
          if (!c) return 'no-canvas';
          return !!window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')) ? 'yes' : 'no';
        })(),
      };
    });
    log(`sample${k + 1}: ${JSON.stringify(s)}`);
  }

  await page.screenshot({ path: process.env.TEMP + '/tmp-verify-fix.png' });
  log('screenshot saved');
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

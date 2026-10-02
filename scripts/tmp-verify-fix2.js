/* 一次性验证2: ①大视口无回归 ②缩到用户小视口后舞台是否压到 45% 上限 ③柔光背景生效 */
const fs = require('fs');
const LOG = process.env.TEMP + '/tmp-verify-fix2.txt';
const log = (m) => fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`);

const stageState = (page) =>
  page.evaluate(() => {
    const el = document.getElementById('oml2d-stage');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      win: { w: window.innerWidth, h: window.innerHeight },
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      right: el.style.right,
      bg: (el.style.background || '').slice(0, 55),
      sized: el.dataset.sized,
    };
  });

(async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  await page.goto('http://localhost:3000/auth/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('123');
  await page.getByRole('button', { name: /登\s*录/ }).last().click();
  await page.waitForTimeout(3000);
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);

  // 关掉引导弹窗(如有)
  try {
    const skip = page.getByRole('button', { name: /跳过/ }).first();
    if (await skip.isVisible({ timeout: 1500 }).catch(() => false)) {
      await skip.click();
      await page.waitForTimeout(500);
      log('modal dismissed');
    }
  } catch { /* 无弹窗 */ }

  let ready = false;
  for (let i = 0; i < 120; i++) {
    const s = await stageState(page);
    if (s && s.sized === '1' && s.h > 100) { ready = true; break; }
    await page.waitForTimeout(500);
  }
  log(`stage ready: ${ready}`);

  // ① 大视口(1440x900): 期望 216x314 左右, right=32, 深色柔光背景
  await page.waitForTimeout(2000);
  log('bigViewport: ' + JSON.stringify(await stageState(page)));
  await page.screenshot({ path: process.env.TEMP + '/tmp-fix-big.png' });

  // ② 缩到用户小视口(657x468): 期望舞台高度 ≈ 0.45*468 = 210(含44脚区), 宽随比例
  await page.setViewportSize({ width: 657, height: 468 });
  await page.waitForTimeout(2500);
  log('smallViewport: ' + JSON.stringify(await stageState(page)));
  await page.screenshot({ path: process.env.TEMP + '/tmp-fix-small.png' });

  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

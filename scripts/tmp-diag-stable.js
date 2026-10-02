/* 一次性诊断: 验证舞台尺寸稳定(不再被库重置) + 截图 */
const fs = require('fs');
const LOG = process.env.TEMP + '/tmp-diag-stable.txt';
const log = (m) => fs.appendFileSync(LOG, `[${new Date().toISOString()}] ${m}\n`);

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

  let stage = null;
  for (let i = 0; i < 100; i++) {
    stage = await page.$('#oml2d-stage').catch(() => null);
    if (stage) break;
    await page.waitForTimeout(500);
  }
  log(`stage: ${!!stage}`);
  if (!stage) { await browser.close(); return; }

  // 采样 12s, 每 1s 记录舞台状态
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const el = document.getElementById('oml2d-stage');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        styleW: el.style.width, styleH: el.style.height, right: el.style.right,
        sized: el.dataset.sized || null, vis: el.style.visibility,
      };
    });
    log(`t+${i + 1}s: ${JSON.stringify(s)}`);
  }

  // 最终几何: 舞台 + 切换条 + InputCat + 问候气泡 + 开始讲解按钮
  const final = await page.evaluate(() => {
    const grab = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const svg = [...document.querySelectorAll('svg')].find((s) => s.querySelector('ellipse[fill="#f5c690"]'));
    const ic = svg ? svg.getBoundingClientRect() : null;
    return {
      stage: grab('#oml2d-stage'),
      switchBar: grab('[data-pet-ui]'),
      bubble: grab('#pet-greeting-bubble'),
      inputCat: ic ? { x: Math.round(ic.x), y: Math.round(ic.y), w: Math.round(ic.width), h: Math.round(ic.height) } : null,
      startBtn: (() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('开始讲解'));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })(),
    };
  });
  log('final: ' + JSON.stringify(final));

  await page.screenshot({ path: process.env.TEMP + '/tmp-final.png' });
  log('screenshot saved');
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

/* 一次性诊断: 猫位置问题 —— 抓取所有相关元素真实坐标 + 整屏截图 */
const fs = require('fs');
const LOG = process.env.TEMP + '/tmp-diag-pos.txt';
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
  await page.waitForTimeout(1500);

  let stage = null;
  for (let i = 0; i < 100; i++) {
    stage = await page.$('#oml2d-stage').catch(() => null);
    if (stage) break;
    await page.waitForTimeout(500);
  }
  log(`stage: ${!!stage}`);
  if (!stage) { await browser.close(); return; }
  await page.waitForTimeout(4000); // 等问候气泡出现

  const rects = await page.evaluate(() => {
    const grab = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const catShape = () => {
      // 找 InputCat(奶油色 svg 在 hero 输入框内)
      const svg = [...document.querySelectorAll('svg')].find((s) => s.querySelector('ellipse[fill="#f5c690"]'));
      if (!svg) return null;
      const r = svg.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return {
      win: { w: window.innerWidth, h: window.innerHeight },
      stage: grab('#oml2d-stage'),
      canvas: grab('#oml2d-canvas'),
      switchBar: grab('[data-pet-ui]'),
      bubble: grab('#pet-greeting-bubble'),
      toggleBtn: grab('#pet-toggle-button') || (() => { const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label')?.includes('宠物')); return b ? null : null; })(),
      inputCat: catShape(),
      heroInput: (() => {
        const els = [...document.querySelectorAll('textarea, input')];
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width > 300 && r.bottom < 500) return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        }
        return null;
      })(),
      startBtn: (() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('开始讲解'));
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })(),
    };
  });
  log('rects: ' + JSON.stringify(rects));

  await page.screenshot({ path: process.env.TEMP + '/tmp-full.png' });
  log('screenshot saved');
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

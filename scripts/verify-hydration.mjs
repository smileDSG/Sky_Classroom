// 验证 React #418 水合失配已修掉: 服务端(UTC 容器)与浏览器(UTC+8)首屏文本必须一致。
// 做法: 抓所有 pageerror/console error, 只要出现 "Minified React error #418"(或 #423/#425
// 这类文本失配码) 就算 FAIL; 同时确认问候语挂载后**确实填上了**(不是一直空着)。
import { chromium } from 'file:///D:/大学作业/Sky_Classroom/node_modules/.pnpm/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const exe = 'C:/Users/1/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ok = (b) => (b ? 'PASS' : 'FAIL');

// 每个场景单独收集错误, 场景之间清空
let errs = [];
const grab = () =>
  errs.filter((e) => /Minified React error #(418|423|425)|Hydration failed|did not match/i.test(e));
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text());
});

const GREETINGS = ['早上好，同学', '下午好，同学', '晚上好，同学', '夜深了，注意休息'];

async function checkScene(label, url, waitMs = 6000) {
  errs = [];
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(waitMs);
  const text = await page.evaluate(() => document.body.innerText);
  const shown = GREETINGS.find((g) => text.includes(g)) || null;
  const hydration = grab();
  console.log(
    `${label}\n   问候语已渲染 -> ${ok(!!shown)} ${shown || '(未找到)'}` +
      `\n   水合错误 -> ${ok(hydration.length === 0)}${hydration.length ? ' ' + hydration.join(' | ') : ''}`,
  );
  return hydration.length === 0 && !!shown;
}

try {
  const pass = 'Test1234!';
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill('#username', `Hy${Date.now() % 100000}`);
  await page.fill('#password', pass);
  await page.fill('#confirmPassword', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/sky/onboarding?redirect=%2F`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  const skip = page.locator('button:has-text("暂时跳过"), button:has-text("跳过")');
  if (await skip.count()) {
    await skip.first().click();
    await page.waitForTimeout(1000);
  }

  const r1 = await checkScene('1) /sky/ 整页加载(就是报 #418 的那一页)', `${BASE}/sky/`);
  const r2 = await checkScene('2) / 主页整页加载', `${BASE}/`);

  // 3) 主页 -> 客户端跳转到 /sky/, 看导航后还有没有水合报错
  errs = [];
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const target = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll('a[href]')).find(
      (x) => x.getAttribute('href') === '/sky' || x.getAttribute('href') === '/sky/',
    );
    return a ? a.getAttribute('href') : null;
  });
  if (target) {
    await page.locator(`a[href="${target}"]`).first().click();
    await page.waitForTimeout(5000);
  }
  const hydration3 = grab();
  const text3 = await page.evaluate(() => document.body.innerText);
  const shown3 = GREETINGS.find((g) => text3.includes(g)) || null;
  console.log(
    `3) 主页点击客户端跳转 -> /sky/ (${target})\n   问候语已渲染 -> ${ok(!!shown3)} ${shown3 || '(未找到)'}` +
      `\n   水合错误 -> ${ok(hydration3.length === 0)}${hydration3.length ? ' ' + hydration3.join(' | ') : ''}`,
  );

  const all = r1 && r2 && hydration3.length === 0 && !!shown3;
  console.log(`\n总计: ${ok(all)}`);
} finally {
  await browser.close();
}

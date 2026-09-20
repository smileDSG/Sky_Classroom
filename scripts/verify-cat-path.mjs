import { chromium } from 'file:///D:/大学作业/Sky_Classroom/node_modules/.pnpm/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const exe = 'C:/Users/1/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ok = (b) => (b ? 'PASS' : 'FAIL');
const fabSrc = () => page.evaluate(() => {
  const f = document.querySelector('button[aria-label="打开小镜课堂"], button[aria-label="打开 AI 学习助手"]');
  return f && f.querySelector('img') ? f.querySelector('img').getAttribute('src') : null;
});
const panelSrcs = () => page.evaluate(() => Array.from(document.querySelectorAll('img[alt="小镜"]')).map((i) => i.getAttribute('src')));
try {
  const pass = 'Test1234!';
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill('#username', `Cat${Date.now() % 100000}`);
  await page.fill('#password', pass);
  await page.fill('#confirmPassword', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/sky/onboarding?redirect=%2F`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  const skip = page.locator('button:has-text("暂时跳过"), button:has-text("跳过")');
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(1000); }

  // LIGHT + cat(default) on home → open chat, check chat avatar
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const st = await page.locator('#oml2d-stage').boundingBox();
  if (st) { const cx = st.x + st.width / 2, cy = st.y + st.height * 0.7; await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 1, cy); await page.mouse.up(); await page.waitForTimeout(1500); }
  let srcs = await panelSrcs();
  console.log('A) LIGHT cat — chat avatars ->', ok(srcs.length > 0 && srcs.every((s) => s === '/avatars/mascot/mao.png')), JSON.stringify(srcs));
  const cb = page.locator('button[aria-label="关闭助手"]');
  if (await cb.count()) { await cb.first().click().catch(() => {}); await page.waitForTimeout(700); }

  // switch to DARK on home → cat should become heimao
  await page.evaluate(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const st2 = await page.locator('#oml2d-stage').boundingBox();
  if (st2) { const cx = st2.x + st2.width / 2, cy = st2.y + st2.height * 0.7; await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 1, cy); await page.mouse.up(); await page.waitForTimeout(1500); }
  srcs = await panelSrcs();
  console.log('B) DARK cat — chat avatars ->', ok(srcs.length > 0 && srcs.every((s) => s === '/avatars/mascot/heimao.png')), JSON.stringify(srcs));

  // other page keeps the dark cat
  await page.goto(`${BASE}/sky/assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  console.log('C) OTHER PAGE keeps dark cat ->', ok((await fabSrc()) === '/avatars/mascot/heimao.png'), await fabSrc());
} finally { await browser.close(); }
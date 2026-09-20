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
const setTheme = (t) => page.evaluate((v) => { try { localStorage.setItem('theme', v); } catch {} }, t);
const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));

try {
  const pass = 'Test1234!';
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill('#username', `Th${Date.now() % 100000}`);
  await page.fill('#password', pass);
  await page.fill('#confirmPassword', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/sky/onboarding?redirect=%2F`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  const skip = page.locator('button:has-text("暂时跳过"), button:has-text("跳过")');
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(1000); }

  // 先让 MascotSync 建起来(它挂在全局, 800ms 后才挂)
  await page.goto(`${BASE}/sky/assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // 1) 非主页 + 亮色 = 白猫
  await setTheme('light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  let s = await fabSrc();
  console.log('1) 其他页面 + 亮色 -> 白猫 ->', ok(!(await isDark()) && s === '/avatars/mascot/mao.png'), s);

  // 2) 同一个非主页, 切成暗色 -> 黑猫  ← 用户报的 bug
  await setTheme('dark');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  s = await fabSrc();
  console.log('2) 其他页面 + 暗色 -> 黑猫 ->', ok((await isDark()) && s === '/avatars/mascot/heimao.png'), s);

  // 3) 再切回亮色 -> 白猫(两个方向都要能跟)
  await setTheme('light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  s = await fabSrc();
  console.log('3) 其他页面 + 切回亮色 -> 白猫 ->', ok(!(await isDark()) && s === '/avatars/mascot/mao.png'), s);

  // 4) 主页切到人形
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('button[aria-label="切换宠物"]').click();
  await page.waitForTimeout(2500);

  // 5) 人形 + 其他页面 + 暗色 = 仍然是人(不随主题变)
  await setTheme('dark');
  await page.goto(`${BASE}/sky/assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);
  s = await fabSrc();
  console.log('5) 人形 + 其他页面 + 暗色 -> 仍为人 ->', ok((await isDark()) && s === '/avatars/mascot/ren.jpg'), s);

  // 6) 人形 + 切回亮色 = 还是人
  await setTheme('light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  s = await fabSrc();
  console.log('6) 人形 + 亮色 -> 仍为人 ->', ok(!(await isDark()) && s === '/avatars/mascot/ren.jpg'), s);

  // 7) 回主页切回猫, 主页仍随主题
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('button[aria-label="切换宠物"]').click();
  await page.waitForTimeout(2000);
  await setTheme('dark');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const st = await page.locator('#oml2d-stage').boundingBox();
  if (st) { const cx = st.x + st.width / 2, cy = st.y + st.height * 0.7; await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 1, cy); await page.mouse.up(); await page.waitForTimeout(1500); }
  const imgs = await page.evaluate(() => Array.from(document.querySelectorAll('img[alt="小镜"]')).map((i) => i.getAttribute('src')));
  console.log('7) 主页暗色 + 猫 -> 对话里是黑猫 ->', ok(imgs.length > 0 && imgs.every((x) => x === '/avatars/mascot/heimao.png')), JSON.stringify(imgs));
} finally { await browser.close(); }
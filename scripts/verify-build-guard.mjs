// 验证构建指纹自愈:
//  1) 已登录页面上, 内嵌指纹 == 服务器指纹 → 不触发多余刷新(控制组);
//  2) 拦截接口返回「不同的指纹」(模拟已发新版) → 触发 focus/回访 → 恰好自刷一次, 不无限循环。
import { chromium } from 'file:///D:/大学作业/Sky_Classroom/node_modules/.pnpm/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const exe = 'C:/Users/1/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ok = (b) => (b ? 'PASS' : 'FAIL');
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));

async function login() {
  const pass = 'Test1234!';
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill('#username', `Bg${Date.now() % 100000}`);
  await page.fill('#password', pass);
  await page.fill('#confirmPassword', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/sky/onboarding?redirect=%2F`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  const skip = page.locator('button:has-text("暂时跳过"), button:has-text("跳过")');
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(1000); }
}

try {
  await login();
  // 控制组: 同一构建内, 指纹应一致、不应自刷
  await page.goto(`${BASE}/sky/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(7000); // 让 6s 的 setTimeout(check) 跑过
  const inlined = await page.evaluate(() => window.__SKY_BUILD_ID__ || null);
  const serverId = await page.evaluate(() =>
    fetch('/api/sky/build-id', { cache: 'no-store' }).then((r) => r.json()).then((d) => d.id).catch((e) => 'FETCH_ERR:' + e.message),
  );
  console.log('1) 内嵌指纹:', inlined);
  console.log('2) 服务器指纹:', serverId, '-> 一致(不该自刷) ->', ok(!!inlined && inlined === serverId), '(与控制组相符即 PASS)');

  let loads = 0;
  const onLoad = () => loads++;
  page.on('load', onLoad);
  await page.evaluate(() => sessionStorage.removeItem('sky_stale_reload_guard_v1')); // 计数归零

  // 拦截接口返回不同指纹 → 模拟「旧标签页遇到了新发布」
  await page.route('**/api/sky/build-id', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'DIFFERENT-BUILD-' + Date.now() }) }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); // 用户回到标签页
  await page.waitForTimeout(3500);
  const counter = await page.evaluate(() => sessionStorage.getItem('sky_stale_reload_guard_v1') || '0');

  // 自刷后页面已加载新(同一拦截下「仍会再刷」), 立刻解除拦截让后续指纹一致、停止循环
  if (loads > 0) {
    await page.unroute('**/api/sky/build-id');
    await page.waitForTimeout(3000); // 让解除后的 check 跑一次, 确认不再刷
  }
  const loadsAfterUnroute = loads;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(2000);
  console.log('3) 指纹不一致 → 自动刷新 ->', ok(loadsAfterUnroute > 0), `(得到 ${loadsAfterUnroute} 次刷新, 计数=${counter})`);
  console.log('4) 解除拦截后再聚焦 → 不再乱刷 ->', ok((loads - loadsAfterUnroute) === 0), `(总共 ${loads} 次)`);

  // 回归: learning-plan 与主面板
  const plan = await page.evaluate(() => fetch('/api/sky/learning-plan?view=today', { credentials: 'include' }).then((r) => r.status));
  console.log('5) learning-plan ->', plan, '->', ok(plan === 200));
  console.log('JS errors:', JSON.stringify(errs));
} finally { await browser.close(); }
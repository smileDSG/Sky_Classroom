// 验证商用自愈守卫:
//  1) beforeInteractive 内联脚本确实出现在首屏 HTML 里;
//  2) 模拟一次 chunk 懒加载失败(unhandledrejection, 消息带 _next/static/chunks),
//     守卫应自动 location.reload() 一次(用 sessionStorage 计数, 不无限刷)。
import { chromium } from 'file:///D:/大学作业/Sky_Classroom/node_modules/.pnpm/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const exe = 'C:/Users/1/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const ok = (b) => (b ? 'PASS' : 'FAIL');
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

try {
  const html = await page.goto(`${BASE}/sky/`, { waitUntil: 'domcontentloaded' });
  const body = (await html.text()) || '';
  const guardInjected =
    body.includes('sky_stale_reload_guard_v1') &&
    body.includes('unhandledrejection') &&
    body.includes('location.reload');
  console.log('1) 守卫已注入首屏 HTML ->', ok(guardInjected));

  // 等守卫脚本执行完毕(它在 head 里, 解析期就跑)
  await page.waitForTimeout(2000);

  // 覆盖 sessionStorage 计数, 保证从 0 开始、能看到一次 reload
  await page.evaluate(() => sessionStorage.removeItem('sky_stale_reload_guard_v1'));

  let loadsAfter = 0;
  const onLoad = () => loadsAfter++;
  page.on('load', onLoad);

  // 模拟老标签页里路由懒加载触发的一个 failed chunk
  await page.evaluate(() => {
    const err = new Error('Loading chunk 90210 failed: http://localhost:3002/_next/static/chunks/90210.js');
    const p = Promise.reject(err);
    setTimeout(() => p, 0); // 让它在微任务里变成真 unhandledrejection
  });

  await page.waitForTimeout(4000);
  const counter = await page.evaluate(() => sessionStorage.getItem('sky_stale_reload_guard_v1') || '0');
  console.log('2) 触发 chunk 失败 -> 自动刷新 ->', ok(loadsAfter > 0), `(额外 load 事件=${loadsAfter}, 计数=${counter})`);

  // 正常交互不应受影响: 守卫必须是无感的
  await page.waitForTimeout(3000);
  console.log('3) 无 JS 错误 ->', ok(errs.length === 0), JSON.stringify(errs));
} finally {
  await browser.close();
}
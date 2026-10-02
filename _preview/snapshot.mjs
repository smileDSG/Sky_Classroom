import { chromium } from '@playwright/test';

const b = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const pg = await b.newPage({ viewport: { width: 1920, height: 1000 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await pg.goto('http://localhost:3000/');
await pg.waitForLoadState('load');
await pg.fill('input[placeholder="请输入用户名"]', 'admin');
await pg.fill('input[placeholder="请输入密码"]', '123');
await pg.click('button:has-text("登 录")');
await sleep(3000);

await pg.goto('http://localhost:3000/sky/learning/today');
await pg.waitForLoadState('load');
await sleep(2500);

// 关闭首次访问的引导弹窗，截出干净全页
const skipBtns = pg.locator('button:has-text("跳过"), button:has-text("知道了"), button:has-text("完成")');
if ((await skipBtns.count()) > 0) await skipBtns.first().click();
await sleep(600);

await pg.screenshot({ path: '_preview/today-after.png', fullPage: true });
console.log('URL=', pg.url());
console.log('saved today-after.png');
await b.close();
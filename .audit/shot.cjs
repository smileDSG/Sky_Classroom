/* 临时截图脚本：验证首页改版效果（登录态） */
const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  // 如果出现登录表单则登录
  const userInput = page.getByPlaceholder('请输入用户名');
  if (await userInput.isVisible().catch(() => false)) {
    await userInput.fill('admin');
    await page.getByPlaceholder('请输入密码').fill('123');
    await page.getByRole('button', { name: /登录|登 录/ }).click();
    await page.waitForTimeout(4000);
  }

  await page.waitForTimeout(3500);

  const out = (name) => path.join(__dirname, name);
  await page.screenshot({ path: out('home-1-first-screen.png') });

  // 每日内容条局部截图
  const strip = page.locator('section[aria-label="每日内容"]');
  if (await strip.count()) {
    await strip.screenshot({ path: out('home-2-daily-strip.png') });
    const box = await strip.boundingBox();
    console.log('STRIP_BOX', JSON.stringify(box));
    console.log('STRIP_VISIBLE_IN_900', box ? box.y + box.height <= 900 : 'n/a');
  } else {
    console.log('STRIP_NOT_FOUND');
  }

  // 输入框完整性：检查"开始讲解"按钮是否在首屏内
  const submit = page.getByRole('button', { name: '开始讲解' });
  const sbox = await submit.boundingBox().catch(() => null);
  console.log('SUBMIT_BOX', JSON.stringify(sbox));
  console.log('SUBMIT_VISIBLE_IN_900', sbox ? sbox.y + sbox.height <= 900 : 'n/a');

  // 移动端视口
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out('home-3-mobile.png') });

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});

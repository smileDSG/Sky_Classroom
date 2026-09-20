// 验证「其他页面点击进入对话后的头像 = 当前角色(宠物)」:
//  1) 主页切换宠物 → VRM 人物, 再进入非主页(/sky/learning)点浮钮开对话,
//     面板头部头像必须是 /avatars/mascot/ren.jpg, 而不是小镜;
//  2) 切回主题猫(白猫)后, 头部头像必须跟着变成 /avatars/mascot/mao.png;
//  3) 移动端助手页(/m/sky/assistant)的助手头像同样跟随宠物;
//  4) 全程无 JS 错误。
// 只看 HTTP/DOM 证据, 不看图。
import { chromium } from 'file:///D:/大学作业/Sky_Classroom/node_modules/.pnpm/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const exe = 'C:/Users/1/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';

const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (b) => (b ? 'PASS' : 'FAIL');

// KagamiPanel 面板头部头像 (data-kagami 包裹层里的 img)
const headerAvatar = () =>
  page.evaluate(() => {
    const img = document.querySelector('[data-kagami] img');
    return img ? { src: img.getAttribute('src'), alt: img.getAttribute('alt') } : null;
  });
// 浮钮上的头像 (button 内含 alt="小镜" 的 img)
const fabAvatar = () =>
  page.evaluate(() => {
    const img = document.querySelector('button img[alt="小镜"]');
    return img ? img.getAttribute('src') : null;
  });
// 打开浮钮 → 对话面板
async function openPanelFromFab() {
  const fab = page.locator('button:has(img[alt="小镜"])').first();
  if (!(await fab.count())) return false;
  await fab.click();
  await page.waitForTimeout(900);
  return (await page.locator('[data-kagami]').count()) > 0;
}

try {
  const pass = 'Test1234!';
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill('#username', `AvatarRole${Date.now() % 100000}`);
  await page.fill('#password', pass);
  await page.fill('#confirmPassword', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/sky/onboarding?redirect=%2F`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  const skip = page.locator('button:has-text("暂时跳过"), button:has-text("跳过")');
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(1000); }

  // ── 1) 主页切到 VRM 人物 ──────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const petKindOf = () => page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('sky-classroom-storage') || '{}')?.state?.petKind ?? null; } catch { return null; }
  });
  // 默认 theme → 点一次切到 vrm; 若已是 vrm 则不再点
  if ((await petKindOf()) !== 'vrm') {
    const sw = page.locator('button[aria-label="切换宠物"]').first();
    if (await sw.count()) { await sw.click(); await page.waitForTimeout(1200); }
  }
  console.log('1) 主页 petKind =', await petKindOf(), '(期望 vrm)');

  // ── 2) 进非主页 /sky/learning, 点浮钮开对话 ─────────────────────
  await page.goto(`${BASE}/sky/learning`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const fabSrcVrm = await fabAvatar();
  const opened = await openPanelFromFab();
  const headVrm = await headerAvatar();
  console.log('2) 非主页浮钮头像 =', fabSrcVrm);
  console.log('   面板已打开 =', opened);
  console.log('   面板头部头像 =', JSON.stringify(headVrm));
  console.log('   → 头像随角色(VRM) →',
    ok(headVrm && headVrm.src === '/avatars/mascot/ren.jpg'), '(期望 /avatars/mascot/ren.jpg)');

  // ── 3) 切回主题猫(白猫) 再验一次 ───────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  if ((await petKindOf()) !== 'theme') {
    const sw = page.locator('button[aria-label="切换宠物"]').first();
    if (await sw.count()) { await sw.click(); await page.waitForTimeout(1200); }
  }
  await page.goto(`${BASE}/sky/learning`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const opened2 = await openPanelFromFab();
  const headCat = await headerAvatar();
  console.log('3) petKind =', await petKindOf(), '(期望 theme)');
  console.log('   面板已打开 =', opened2, '头部头像 =', JSON.stringify(headCat));
  console.log('   → 头像随角色(主题猫) →',
    ok(headCat && headCat.src === '/avatars/mascot/mao.png'), '(期望 /avatars/mascot/mao.png)');

  // ── 4) 移动端助手页头像 ────────────────────────────────────────
  await page.goto(`${BASE}/m/sky/assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const mob = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    const hit = imgs.find((i) => (i.getAttribute('alt') || '').includes('宠物'));
    const any = imgs.find((i) => /\/avatars\/(mascot|kagami)/.test(i.getAttribute('src') || ''));
    return { petAlt: hit ? hit.getAttribute('src') : null, anySrc: any ? any.getAttribute('src') : null };
  });
  console.log('4) 移动端助手页头像 =', JSON.stringify(mob));
  console.log('   → 助手头像随宠物 →', ok(!!mob.petAlt), '(期望非 null, 值为 /avatars/mascot/...)');

  console.log('JS errors:', JSON.stringify(errs));
} finally {
  await browser.close();
}

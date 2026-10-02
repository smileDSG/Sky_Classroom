import { chromium } from 'file:///D:/大学作业/Sky_Classroom/node_modules/.pnpm/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const exe = 'C:/Users/1/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));

const FAB = 'button[aria-label="打开小镜课堂"], button[aria-label="打开 AI 学习助手"]';
const KAGAMI_PANEL = 'section[role="dialog"][aria-label="小镜课堂"], section[role="dialog"][aria-label="AI 学习助手"]';
const HOME_PANEL = 'button[aria-label="关闭助手"]';
const ok = (b) => (b ? 'PASS' : 'FAIL');

const fabInfo = () => page.evaluate(() => {
  const fab = document.querySelector('button[aria-label="打开小镜课堂"], button[aria-label="打开 AI 学习助手"]');
  if (!fab) return { present: false };
  const cs = getComputedStyle(fab);
  const img = fab.querySelector('img');
  return { present: true, visible: cs.display !== 'none', display: cs.display, src: img ? img.getAttribute('src') : null };
});

try {
  const pass = 'Test1234!';
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill('#username', `Av${Date.now() % 100000}`);
  await page.fill('#password', pass);
  await page.fill('#confirmPassword', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/sky/onboarding?redirect=%2F`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  const skip = page.locator('button:has-text("暂时跳过"), button:has-text("跳过")');
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(1000); }

  // ---------- 1. HOME: FAB hidden, cat is the avatar ----------
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('1) HOME fab hidden ->', ok(!(await fabInfo()).visible), JSON.stringify(await fabInfo()));

  const st = await page.locator('#oml2d-stage').boundingBox();
  if (st) {
    const cx = st.x + st.width / 2, cy = st.y + st.height * 0.7;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 1, cy); await page.mouse.up();
    await page.waitForTimeout(1400);
  }
  console.log('2) HOME click cat opens chat ->', ok((await page.locator(HOME_PANEL).count()) > 0));
  const closeBtn = page.locator(HOME_PANEL);
  if (await closeBtn.count()) { await closeBtn.first().click().catch(() => {}); await page.waitForTimeout(700); }

  const s2 = await page.locator('#oml2d-stage').boundingBox();
  if (s2) {
    const dx = s2.x + s2.width / 2, dy = s2.y + s2.height * 0.7;
    await page.mouse.move(dx, dy); await page.mouse.down();
    await page.mouse.move(dx - 220, dy - 120, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(600);
    const s3 = await page.locator('#oml2d-stage').boundingBox();
    console.log('3) HOME drag cat ->', ok(s3 && Math.abs(s3.x - s2.x) > 50));
  }

  // ---------- 2. switch pet to VRM (human) ----------
  await page.locator('button[aria-label="切换宠物"]').click();
  await page.waitForTimeout(2500);
  console.log('4) HOME switched to VRM, fab hidden still ->', ok(!(await fabInfo()).visible));

  // ---------- 3. OTHER PAGE in human form: fab shows ren, click + drag work ----------
  await page.goto(`${BASE}/sky/assistant`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  let fi = await fabInfo();
  console.log('5) OTHER PAGE fab visible+human ->', ok(fi.visible && fi.src === '/avatars/mascot/ren.jpg'), JSON.stringify(fi));

  const fb = await page.locator(FAB).first().boundingBox();
  if (fb) {
    const cx = fb.x + fb.width / 2, cy = fb.y + fb.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 1, cy); await page.mouse.up();
    await page.waitForTimeout(1000);
  }
  console.log('6) OTHER PAGE click fab opens chat ->', ok((await page.locator(KAGAMI_PANEL).count()) > 0));
  const kc = page.locator('button[aria-label="关闭小镜课堂"], button[aria-label="关闭学习助手"]');
  if (await kc.count()) { await kc.first().click().catch(() => {}); await page.waitForTimeout(700); }

  const fb2 = await page.locator(FAB).first().boundingBox();
  if (fb2) {
    const dx = fb2.x + fb2.width / 2, dy = fb2.y + fb2.height / 2;
    await page.mouse.move(dx, dy); await page.mouse.down();
    await page.mouse.move(dx - 150, dy - 100, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(600);
    const fa = await page.locator(FAB).first().boundingBox();
    console.log('7) OTHER PAGE drag fab ->', ok(fa && Math.abs(fa.x - fb2.x) > 30));
  }

  // ---------- 4. human image must survive a reload AND dark theme ----------
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  fi = await fabInfo();
  console.log('8) AFTER RELOAD still human ->', ok(fi.src === '/avatars/mascot/ren.jpg'), JSON.stringify(fi));

  await page.evaluate(() => { try { localStorage.setItem('theme', 'dark'); } catch {} });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  fi = await fabInfo();
  console.log('9) DARK THEME still human ->', ok(dark && fi.src === '/avatars/mascot/ren.jpg'), `dark=${dark}`, JSON.stringify(fi));

  console.log('PAGE_ERRORS=', JSON.stringify(errs.slice(0, 5)));
} finally { await browser.close(); }
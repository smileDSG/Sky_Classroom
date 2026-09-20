import { chromium } from 'file:///D:/大学作业/Sky_Classroom/node_modules/.pnpm/node_modules/playwright/index.mjs';
const BASE = process.env.BASE_URL || 'http://localhost:3002';
const exe = 'C:/Users/1/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe';
const browser = await chromium.launch({ headless: true, executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const ok = (b) => (b ? 'PASS' : 'FAIL');
const FAB = 'button[aria-label="打开小镜课堂"], button[aria-label="打开 AI 学习助手"]';

try {
  const pass = 'Test1234!';
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.fill('#username', `Pb${Date.now() % 100000}`);
  await page.fill('#password', pass);
  await page.fill('#confirmPassword', pass);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/sky/onboarding?redirect=%2F`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(1000);
  const skip = page.locator('button:has-text("暂时跳过"), button:has-text("跳过")');
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(1000); }

  // 先在主页切到人形, 让头像变成人的图 —— 顺便验证跨页也带过去
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await page.locator('button[aria-label="切换宠物"]').click();
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/sky/pet-buddy`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  const info = await page.evaluate(() => {
    const f = document.querySelector('button[aria-label="打开小镜课堂"], button[aria-label="打开 AI 学习助手"]');
    if (!f) return { state: 'NO_FAB' };
    const cs = getComputedStyle(f);
    const b = f.getBoundingClientRect();
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const top = document.elementFromPoint(cx, cy);
    const stage = document.getElementById('vrm-pet-stage') || document.getElementById('oml2d-stage');
    const sb = stage ? stage.getBoundingClientRect() : null;
    return {
      display: cs.display,
      box: `${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`,
      reachable: !!(top && (top === f || f.contains(top))),
      over: top ? `${top.tagName.toLowerCase()}${top.id ? '#' + top.id : ''}` : 'null',
      src: f.querySelector('img') ? f.querySelector('img').getAttribute('src') : null,
      stageBox: sb ? `${Math.round(sb.x)},${Math.round(sb.y)} ${Math.round(sb.width)}x${Math.round(sb.height)}` : null,
    };
  });
  console.log('A) pet-buddy fab reachable ->', ok(info.reachable), JSON.stringify(info));

  const b1 = await page.locator(FAB).first().boundingBox();
  if (b1) {
    const cx = b1.x + b1.width / 2, cy = b1.y + b1.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 1, cy); await page.mouse.up();
    await page.waitForTimeout(1200);
  }
  const pv = await page.evaluate(() => {
    const p = document.querySelector('section[role="dialog"][aria-label="小镜课堂"], section[role="dialog"][aria-label="AI 学习助手"]');
    if (!p) return { present: false };
    const r = p.getBoundingClientRect();
    const onScreen = r.width > 40 && r.height > 40 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    const cx = Math.max(1, Math.min(innerWidth - 1, r.left + r.width / 2));
    const cy = Math.max(1, Math.min(innerHeight - 1, r.top + 40));
    const top = document.elementFromPoint(cx, cy);
    return { present: true, onScreen, onTop: !!(top && (p === top || p.contains(top))), box: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` };
  });
  console.log('B) pet-buddy click opens VISIBLE chat ->', ok(pv.present && pv.onScreen && pv.onTop), JSON.stringify(pv));
  const c = page.locator('button[aria-label="关闭小镜课堂"], button[aria-label="关闭学习助手"]');
  if (await c.count()) { await c.first().click().catch(() => {}); await page.waitForTimeout(700); }

  const b2 = await page.locator(FAB).first().boundingBox();
  if (b2) {
    const cx = b2.x + b2.width / 2, cy = b2.y + b2.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx + 160, cy - 110, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(600);
    const b3 = await page.locator(FAB).first().boundingBox();
    console.log('C) pet-buddy drag ->', ok(b3 && Math.abs(b3.x - b2.x) > 40), JSON.stringify(b3));
  }

  // pet-buddy 自己的宠物仍可拖(别把宠物的拖动弄坏了)
  const st = await page.locator('#vrm-pet-stage').boundingBox();
  if (st) {
    const cx = st.x + st.width / 2, cy = st.y + st.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down();
    await page.mouse.move(cx - 120, cy - 60, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(600);
    const st2 = await page.locator('#vrm-pet-stage').boundingBox();
    console.log('D) pet-buddy pet still draggable ->', ok(st2 && Math.abs(st2.x - st.x) > 40), JSON.stringify(st2));
  }
  console.log('PAGE_ERRORS=', JSON.stringify(errs.slice(0, 4)));
} finally { await browser.close(); }
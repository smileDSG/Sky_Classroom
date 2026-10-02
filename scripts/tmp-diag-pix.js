/* 一次性诊断: 像素分析用户的截图 —— 量出各元素真实边界 */
const fs = require('fs');
const path = 'c:/Users/lenovo/.trae-cn/attachments/6ab0912d5faca5d719d9781f/1b265835-2e05-4e98-83e2-b1670e4018fe_e74ceb31-d82e-47e8-b5a2-89830cab37cc_image.png';
const b64 = fs.readFileSync(path).toString('base64');

const LOG = process.env.TEMP + '/tmp-diag-pix.txt';
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  const src = `data:image/png;base64,${b64}`;
  const r = await page.evaluate(async (src) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const px = (x, y) => { const i = (y * W + x) * 4; return [d[i], d[i + 1], d[i + 2], d[i + 3]]; };

    const bounds = (pred, label, xr = [0, 100], yr = [0, 100]) => {
      let minX = -1, minY = -1, maxX = -1, maxY = -1, n = 0;
      const x0 = Math.floor(xr[0] / 100 * W), x1 = Math.ceil(xr[1] / 100 * W);
      const y0 = Math.floor(yr[0] / 100 * H), y1 = Math.ceil(yr[1] / 100 * H);
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const [r2, g, b, a] = px(x, y);
          if (a < 128) continue;
          if (pred(r2, g, b, a)) {
            if (minX < 0 || x < minX) minX = x;
            if (maxX < 0 || x > maxX) maxX = x;
            if (minY < 0 || y < minY) minY = y;
            if (y > maxY) maxY = y;
            n++;
          }
        }
      }
      if (n < 5) return { label, found: false };
      return { label, found: true, box: { x: Math.round(minX / W * 100), y: Math.round(minY / H * 100), w: Math.round((maxX - minX) / W * 100), h: Math.round((maxY - minY) / H * 100), px: [minX, minY, maxX, maxY] }, n };
    };

    const isDarkerThanBg = (r2, g, b) => r2 < 26 && g < 30 && b < 40; // 比深蓝背景更暗 → 黑猫身体
    const isCream = (r2, g, b) => r2 > 220 && g > 165 && g < 225 && b > 110 && b < 185; // 小黄猫(奶油金 #f6cf9f 附近)
    const isPurple = (r2, g, b) => r2 > 80 && r2 < 200 && g > 40 && g < 140 && b > 180 && r2 < b; // 切换条紫按钮
    const isBlueBtn = (r2, g, b) => b > 190 && r2 < 110 && g > 90 && g < 190; // 开始讲解蓝按钮
    const isLightBubble = (r2, g, b) => r2 > 215 && g > 215 && b > 225; // 亮色气泡/文字

    return {
      W, H,
      cat: bounds(isDarkerThanBg, '黑猫', [45, 100], [15, 100]),
      cream: bounds(isCream, '小黄猫'),
      purple: bounds(isPurple, '切换条'),
      blueCenter: bounds(isBlueBtn, '蓝色按钮(中)', [15, 72], [55, 100]),
      blueRight: bounds(isBlueBtn, '蓝色按钮(右)', [72, 100], [55, 100]),
      bubble: bounds(isLightBubble, '浅色气泡', [0, 45], [15, 65]),
    };
  }, src);
  log(JSON.stringify(r, null, 2));
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

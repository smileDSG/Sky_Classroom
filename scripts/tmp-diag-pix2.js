/* 一次性诊断2: 精确定位黑猫头部(黄绿眼)、切换条、小黄猫, 判断尺寸比例是否失调 */
const fs = require('fs');
const path =
  'c:/Users/lenovo/.trae-cn/attachments/6ab0912d5faca5d719d9781f/1b265835-2e05-4e98-83e2-b1670e4018fe_e74ceb31-d82e-47e8-b5a2-89830cab37cc_image.png';
const b64 = fs.readFileSync(path).toString('base64');

const LOG = process.env.TEMP + '/tmp-diag-pix2.txt';
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
      const x0 = Math.floor((xr[0] / 100) * W), x1 = Math.ceil((xr[1] / 100) * W);
      const y0 = Math.floor((yr[0] / 100) * H), y1 = Math.ceil((yr[1] / 100) * H);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const [r2, g, b] = px(x, y);
          if (pred(r2, g, b)) {
            if (minX < 0 || x < minX) minX = x;
            if (maxX < 0 || x > maxX) maxX = x;
            if (minY < 0 || y < minY) minY = y;
            if (y > maxY) maxY = y;
            n++;
          }
        }
      }
      if (n < 3) return { label, found: false };
      return { label, found: true, box: { x: Math.round((minX / W) * 100), y: Math.round((minY / H) * 100), w: Math.round(((maxX - minX) / W) * 100), h: Math.round(((maxY - minY) / H) * 100), px: [minX, minY, maxX, maxY] }, n };
    };

    // 黑猫黄绿色眼睛: 亮绿/黄, 蓝通道明显低
    const isEye = (r2, g, b) => g > 140 && r2 > 90 && b < 130 && g > r2 * 0.9 && g > b + 40;
    // 切换条紫色胶囊
    const isPurple = (r2, g, b) => r2 > 90 && r2 < 210 && g > 50 && g < 160 && b > 170 && r2 < b && b > r2 + 40;
    // 小黄猫奶油金
    const isCream = (r2, g, b) => r2 > 220 && g > 165 && g < 228 && b > 115 && b < 190;
    // 亮白高光(气泡/按钮文字)
    const isBright = (r2, g, b) => r2 > 225 && g > 225 && b > 235;

    const eyes = bounds(isEye, '黑猫眼睛', [40, 100], [0, 70]);
    const purple = bounds(isPurple, '切换条', [50, 100], [80, 100]);
    const cream = bounds(isCream, '小黄猫', [40, 100], [30, 90]);
    const bright = bounds(isBright, '亮白区域', [0, 45], [0, 100]);

    // 黑猫身体: 在眼睛下方取一列, 找最下端的暗色连续区域(排除背景) —— 用"比局部背景暗很多"判断
    let bodyBottom = -1;
    if (eyes.found) {
      const ex = Math.round((eyes.box.px[0] + eyes.box.px[2]) / 2);
      for (let y = eyes.box.px[3] + 5; y < H; y++) {
        const [r2, g, b] = px(ex, y);
        // 黑猫身体: 非常暗 (r,g,b 都 < 45), 且比背景(深蓝 ~18,26,48)更暗或同为暗色
        if (r2 < 45 && g < 45 && b < 55) bodyBottom = y;
      }
    }

    // 每 20% 高度截取右半区, 数"暗色像素"占比, 看猫占据的高度范围
    const darkProfile = [];
    for (let k = 0; k < 10; k++) {
      const y0 = Math.floor((k / 10) * H), y1 = Math.floor(((k + 1) / 10) * H);
      let n = 0, total = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = Math.floor(W * 0.5); x < W; x += 2) {
          const [r2, g, b] = px(x, y);
          total++;
          if (r2 < 40 && g < 44 && b < 60) n++;
        }
      }
      darkProfile.push(Math.round((n / total) * 100));
    }

    return { W, H, eyes, purple, cream, bright, bodyBottom, darkProfile };
  }, src);
  log(JSON.stringify(r, null, 2));
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

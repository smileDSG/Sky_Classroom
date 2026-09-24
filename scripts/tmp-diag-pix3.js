/* 一次性诊断3: 对比"猫脚下方"与"对照背景区"的像素统计, 判断猫脚下方是真空还是黑猫身体不可见 */
const fs = require('fs');
const path =
  'c:/Users/lenovo/.trae-cn/attachments/6ab0912d5faca5d719d9781f/1b265835-2e05-4e98-83e2-b1670e4018fe_e74ceb31-d82e-47e8-b5a2-89830cab37cc_image.png';
const b64 = fs.readFileSync(path).toString('base64');

const LOG = process.env.TEMP + '/tmp-diag-pix3.txt';
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

    const stat = (label, x0, y0, x1, y1) => {
      let sum = 0, n = 0, minV = 255, maxV = 0, darker = 0, br = 0;
      const samples = [];
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const [r2, g, b] = px(x, y);
          const lum = 0.299 * r2 + 0.587 * g + 0.114 * b;
          sum += lum; n++;
          if (lum < minV) minV = lum;
          if (lum > maxV) maxV = lum;
          if (lum < 45) darker++;
          if (lum > 80) br++;
          samples.push(lum);
        }
      }
      samples.sort((a, b) => a - b);
      return {
        label,
        mean: Math.round(sum / n),
        min: Math.round(minV), max: Math.round(maxV),
        median: Math.round(samples[Math.floor(samples.length / 2)]),
        pctDark: Math.round((darker / n) * 100),
        pctBright: Math.round((br / n) * 100),
      };
    };

    return {
      W, H,
      // 猫脚下方(疑似空白区): 舞台区域 x417-633
      belowFeet: stat('猫脚下方', 420, 315, 630, 420),
      // 右侧最底(切换条上方): 同属舞台
      stageBottom: stat('舞台底部', 420, 425, 630, 460),
      // 对照: 左侧同高度背景
      bgSameY: stat('左侧同高背景', 60, 315, 260, 420),
      // 对照: 左上纯背景
      bgTopLeft: stat('左上背景', 60, 30, 260, 120),
      // 猫头部周边(应有猫轮廓): 眼睛下方到身体
      underHead: stat('猫头下方', 420, 180, 500, 300),
      // 猫身体中心列 vs 背景: 看右侧下部是否有比背景亮的边缘
      rightMid: stat('右侧中部', 420, 250, 630, 315),
    };
  }, src);
  log(JSON.stringify(r, null, 2));
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

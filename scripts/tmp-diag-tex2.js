/* 诊断贴图2: 用多档 alpha 阈值精确测量猫实际绘制区域在 2048 画布中的位置 */
const fs = require('fs');
const LOG = process.env.TEMP + '/tmp-diag-tex2.txt';
const log = (m) => fs.appendFileSync(LOG, m + '\n');

(async () => {
  const { chromium } = require('@playwright/test');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();

  const analyze = async (name, file) => {
    const b64 = fs.readFileSync(file).toString('base64');
    const src = `data:image/png;base64,${b64}`;
    return page.evaluate(async ({ src, name }) => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, W, H).data;
      const scan = (threshold) => {
        let minX = -1, minY = -1, maxX = -1, maxY = -1, n = 0;
        for (let y = 0; y < H; y += 3) {
          for (let x = 0; x < W; x += 3) {
            const i = (y * W + x) * 4;
            if (d[i + 3] > threshold) {
              if (minX < 0 || x < minX) minX = x;
              if (maxX < 0 || x > maxX) maxX = x;
              if (minY < 0 || y < minY) minY = y;
              if (y > maxY) maxY = y;
              n++;
            }
          }
        }
        if (n < 5) return null;
        return {
          t: threshold,
          box: { x: Math.round((minX / W) * 100), y: Math.round((minY / H) * 100), w: Math.round(((maxX - minX) / W) * 100), h: Math.round(((maxY - minY) / H) * 100) },
          px: [minX, minY, maxX, maxY], n,
        };
      };
      // 水平扫描线: 每 10% 高度, 数不透明像素占比 —— 看猫在画布哪个高度区间
      const bands = [];
      for (let k = 0; k < 10; k++) {
        const y0 = Math.floor((k / 10) * H), y1 = Math.floor(((k + 1) / 10) * H);
        let n = 0, total = 0;
        for (let y = y0; y < y1; y += 3) {
          for (let x = 0; x < W; x += 3) {
            total++;
            const i = (y * W + x) * 4;
            if (d[i + 3] > 64) n++;
          }
        }
        bands.push(Math.round((n / total) * 1000) / 10);
      }
      return { name, tex: `${W}x${H}`, a32: scan(32), a64: scan(64), a128: scan(128), bands };
    }, { src, name });
  };

  log(JSON.stringify(await analyze('hijiki', 'e:/01_Work/sky-classroom/public/live2d/hijiki/moc/hijiki.2048/texture_00.png'), null, 2));
  log(JSON.stringify(await analyze('tororo', 'e:/01_Work/sky-classroom/public/live2d/tororo/moc/tororo.2048/texture_00.png'), null, 2));
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

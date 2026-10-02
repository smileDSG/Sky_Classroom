/* 诊断贴图: hijiki/tororo 的 2048 贴图里, 猫实际绘制区域占画布多少 */
const fs = require('fs');
const LOG = process.env.TEMP + '/tmp-diag-tex.txt';
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
      let minX = -1, minY = -1, maxX = -1, maxY = -1, n = 0;
      for (let y = 0; y < H; y += 2) {
        for (let x = 0; x < W; x += 2) {
          const i = (y * W + x) * 4;
          if (d[i + 3] > 16) {
            if (minX < 0 || x < minX) minX = x;
            if (maxX < 0 || x > maxX) maxX = x;
            if (minY < 0 || y < minY) minY = y;
            if (y > maxY) maxY = y;
            n++;
          }
        }
      }
      return {
        name,
        tex: `${W}x${H}`,
        drawn: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        pct: {
          x: Math.round((minX / W) * 100),
          y: Math.round((minY / H) * 100),
          w: Math.round(((maxX - minX) / W) * 100),
          h: Math.round(((maxY - minY) / H) * 100),
        },
        n,
      };
    }, { src, name });
  };

  log(JSON.stringify(await analyze('hijiki', 'e:/01_Work/sky-classroom/public/live2d/hijiki/moc/hijiki.2048/texture_00.png'), null, 2));
  log(JSON.stringify(await analyze('tororo', 'e:/01_Work/sky-classroom/public/live2d/tororo/moc/tororo.2048/texture_00.png'), null, 2));
  await browser.close();
})().catch((e) => {
  log('FATAL: ' + (e && e.message ? e.message.slice(0, 300) : String(e)));
  process.exit(1);
});

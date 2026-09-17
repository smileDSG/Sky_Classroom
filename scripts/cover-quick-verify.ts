/**
 * 快速封面验收 —— 仅渲染单张封面 PPTX → PDF → PNG，用于即时核对封面视觉效果。
 * 运行：node --import tsx scripts/cover-quick-verify.ts
 * 环境变量：PALETTE_ID（默认 classical-chinese）、LAYOUT（默认 vertical-poem）、
 *   TOPIC、SUBTITLE、LO_SOFFICE_PATH。
 */
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { execFile, spawnSync } from 'child_process';
import { promisify } from 'util';
import {
  COLOR_PALETTES,
  FONT_PAIRS,
  PALETTE_STYLE_INFO,
} from '@/lib/slides/agent/design-dna';
import { renderCoverPptx } from '@/lib/slides/agent/cover-renderer';

const execFileAsync = promisify(execFile);

const LO = process.env.LO_SOFFICE_PATH || 'E:\\06_Temp\\program\\soffice.exe';
const PY = process.env.PYTHON_PATH || 'python';

async function main() {
  const paletteId = process.env.PALETTE_ID || 'classical-chinese';
  const layout = process.env.LAYOUT || 'vertical-poem';
  const title = process.env.TOPIC || '光的折射';
  const subtitle = process.env.SUBTITLE || '高中教学课件';

  const palette = COLOR_PALETTES[paletteId];
  if (!palette) throw new Error('未知 palette: ' + paletteId);
  const style = PALETTE_STYLE_INFO[paletteId] || { styleName: paletteId, mood: '', bestFor: [] };
  const font = FONT_PAIRS['noto-sans'];
  const dna = {
    styleName: style.styleName,
    recommended: false,
    colors: { ...palette },
    fonts: { ...font },
    decoration: { motif: 'chinese-seal', density: 'moderate', cornerWeight: 'top-right' },
    components: {
      cardStyle: 'shadow-only',
      bulletStyle: 'dot',
      pageNumberStyle: 'number-slash-total',
    },
    layoutType: layout,
    mood: style.mood,
    bestFor: style.bestFor,
  } as never;

  const outDir = path.resolve(process.cwd(), 'docs', 'style-verify', `cover-v2-${paletteId}`);
  await fs.mkdir(outDir, { recursive: true });

  const r = await renderCoverPptx(dna, title, subtitle, outDir, 1);
  if (!r.success || !r.pptxPath) {
    console.error('封面渲染失败:', r.error);
    process.exit(1);
  }
  console.log('PPTX:', r.pptxPath);

  const profile = path.join(os.tmpdir(), 'lo-cv-' + Date.now());
  await fs.mkdir(profile, { recursive: true });
  await execFileAsync(
    LO,
    ['--headless', `-env:UserInstallation=file:///${profile.replace(/\\/g, '/')}`, '--convert-to', 'pdf', '--outdir', outDir, r.pptxPath],
    { timeout: 150000 },
  );
  const pdf = (await fs.readdir(outDir)).find((f) => f.endsWith('.pdf'));
  if (!pdf) throw new Error('PDF 未产出');
  const pdfPath = path.join(outDir, pdf);

  const dirFwd = outDir.replace(/\\/g, '/');
  const s = spawnSync(
    PY,
    [
      '-c',
      `import pymupdf;d=pymupdf.open(r"${pdfPath}")
for i in range(len(d)):
  d[i].get_pixmap(matrix=pymupdf.Matrix(2,2)).save(r"${dirFwd}"+"/%02d.png"%(i+1))
print("ok")`,
    ],
    { encoding: 'utf8', timeout: 150000 },
  );
  console.log(s.status === 0 ? 'PNG OK' : '渲染失败: ' + s.stderr?.slice(0, 500));
  console.log('输出目录:', outDir);
}

main().catch((e) => {
  console.error('脚本失败:', e);
  process.exit(1);
});
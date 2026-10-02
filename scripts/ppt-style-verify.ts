/**
 * 样式质量基线验收脚本 —— 用指定 COLOR_PALETTES 配色 + noto-sans 字体 +
 * 各样式预设 motif/layout 跑真实 openmaic 管线，并用 LibreOffice+PyMuPDF
 * 逐页渲染 PNG，用于人工验收该样式的封面/正文/内容卡片骨架是否达标。
 *
 * 运行：node --import tsx --env-file=.env.local scripts/ppt-style-verify.ts
 * 环境变量：
 *   PALETTE_ID  必填，取 COLOR_PALETTES 的 key（如 ocean-gradient / tech-dark-cn）
 *   TOPIC       选题，默认「光的折射」
 *   DIFFICULTY  默认「高中物理」
 *   PAGES_MIN / PAGES_MAX  默认 6 / 8，验收建议 12 / 16
 *   LAYOUT      可选，覆盖该样式预设 layoutType
 *   MOTIF       可选，覆盖该样式预设 motif
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

const execFileAsync = promisify(execFile);

const LO =
  process.env.LO_SOFFICE_PATH ||
  'E:\\06_Temp\\program\\soffice.exe';
const PY =
  process.env.PYTHON_PATH || 'python';

/** 各样式验收预设：motif + layout 尽量还原 cover-agent 的 topic 感知倾向。 */
const STYLE_PRESETS: Record<string, { motif: string; layout: string }> = {
  'modern-academic': { motif: 'geometric-lines', layout: 'hero-left' },
  'midnight-executive': { motif: 'geometric-lines', layout: 'hero-left' },
  'forest-moss': { motif: 'organic-circles', layout: 'hero-centered' },
  'coral-energy': { motif: 'neon-grid', layout: 'split-panel' },
  'warm-terracotta': { motif: 'ink-wash', layout: 'minimal-type' },
  'ocean-gradient': { motif: 'neon-grid', layout: 'split-panel' },
  'charcoal-minimal': { motif: 'geometric-lines', layout: 'hero-left' },
  'teal-trust': { motif: 'geometric-lines', layout: 'hero-left' },
  'berry-cream': { motif: 'organic-circles', layout: 'hero-centered' },
  'sage-calm': { motif: 'organic-circles', layout: 'hero-centered' },
  'cherry-bold': { motif: 'organic-circles', layout: 'hero-centered' },
  'classical-chinese': { motif: 'chinese-seal', layout: 'vertical-poem' },
  'tech-dark-cn': { motif: 'neon-grid', layout: 'split-panel' },
};

function buildDesignDNA(paletteId: string, layout: string, motif: string) {
  const palette = COLOR_PALETTES[paletteId];
  if (!palette) throw new Error(`未知 paletteId: ${paletteId}，可选：${Object.keys(COLOR_PALETTES).join(', ')}`);
  const style = PALETTE_STYLE_INFO[paletteId] || { styleName: paletteId, mood: '', bestFor: ['通用'] };
  const font = FONT_PAIRS['noto-sans'];
  return {
    styleName: style.styleName,
    recommended: false,
    colors: { ...palette },
    fonts: { ...font },
    decoration: {
      motif,
      density: 'moderate' as string,
      cornerWeight: 'top-right' as string,
    },
    components: {
      cardStyle: 'shadow-only',
      bulletStyle: 'dot',
      pageNumberStyle: 'number-slash-total',
    },
    layoutType: layout,
    mood: style.mood,
    bestFor: style.bestFor,
  };
}

async function main() {
  const paletteId = process.env.PALETTE_ID;
  if (!paletteId) {
    console.error('请设置 PALETTE_ID 环境变量');
    process.exit(1);
  }
  const preset = STYLE_PRESETS[paletteId] || { motif: 'geometric-lines', layout: 'hero-left' };
  const layout = process.env.LAYOUT || preset.layout;
  const motif = process.env.MOTIF || preset.motif;
  const topic = process.env.TOPIC || '光的折射';
  const difficulty = process.env.DIFFICULTY || '高中物理';

  const designDNA = buildDesignDNA(paletteId, layout, motif);
  console.log(`验收样式：${paletteId} (${designDNA.styleName}) motif=${motif} layout=${layout}`);

  const { resolveModel } = await import('@/lib/server/resolve-model');
  const { runPipeline, createJob, getJob } = await import('@/lib/slides/agent/pipeline');
  const { getDefaultDesignDNA } = await import('@/lib/slides/agent/design-dna');

  const resolved = await resolveModel({
    modelString: process.env.DEFAULT_MODEL || 'deepseek:deepseek-chat',
  });

  const jobId = `style-${paletteId}-${Date.now()}`;
  createJob(jobId, 8);
  await runPipeline({
    topic,
    difficulty,
    minPages: Number(process.env.PAGES_MIN) || 6,
    maxPages: Number(process.env.PAGES_MAX) || 8,
    designDNA,
    languageModel: resolved.model,
    jobId,
    educationLevel: process.env.DIFFICULTY ? undefined : '高中',
  });

  const job = getJob(jobId);
  if (!job?.pptxUrl) {
    console.log('未产出 PPTX：', job?.error || 'n/a');
    process.exit(1);
  }

  const pptxPath = path.resolve(process.cwd(), 'public', job.pptxUrl.replace(/^\//, '').replace(/\\/g, '/'));
  const outDir = path.resolve(process.cwd(), 'docs', 'style-verify', paletteId);
  const pagesDir = path.join(outDir, 'pages');
  await fs.mkdir(pagesDir, { recursive: true });
  const profile = path.join(os.tmpdir(), `lo-${paletteId}-${Date.now()}`);
  await fs.mkdir(profile, { recursive: true });
  const url = 'file:///' + profile.replace(/\\/g, '/');

  await execFileAsync(LO, ['--headless', `-env:UserInstallation=${url}`, '--convert-to', 'pdf', '--outdir', outDir, pptxPath], { timeout: 180000 });
  const pdfName = (await fs.readdir(outDir)).find((f) => f.endsWith('.pdf')) as string;
  if (!pdfName) throw new Error('PDF 未产出');
  const pdfPath = path.join(outDir, pdfName);
  console.log('PDF:', pdfPath);

  const pageDirFwd = pagesDir.replace(/\\/g, '/');
  const r = spawnSync(PY, ['-c', `import pymupdf,os; d=pymupdf.open(r"${pdfPath}"); out=[]
for i in range(len(d)):
  p="${pageDirFwd}/" + "%02d.png" % (i + 1)
  d[i].get_pixmap(matrix=pymupdf.Matrix(1.8,1.8)).save(p); out.append(p)
print("\\n".join(out))`], { encoding: 'utf8', timeout: 240000 });
  if (r.status !== 0) console.log('Python 渲染失败:', r.stderr?.slice(0, 500));
  else console.log(r.stdout);
  console.log('输出目录:', pagesDir);
}

main().catch((e) => { console.error('脚本失败：', e); process.exit(1); });
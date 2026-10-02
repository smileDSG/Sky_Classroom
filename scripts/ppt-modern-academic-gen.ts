/**
 * 一次性脚本：用当前默认设计DNA（modern-academic + noto-sans）跑真实管线，
 * 生成「光的折射」课件，并用 LibreOffice 逐页转 PNG，用于人工验收新主题。
 *
 * 运行：node --import tsx --env-file=.env.local scripts/ppt-modern-academic-gen.ts
 */
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// 本机 LibreOffice 真实安装（TRAE VM tools 内嵌）
const LO =
  process.env.LO_SOFFICE_PATH ||
  process.env.LO_SOFFICE_PATH_BACKUP ||
  'C:\\Users\\lenovo\\AppData\\Roaming\\TRAE SOLO CN\\ModularData\\ai-agent\\vm\\tools\\app\\libreoffice\\App\\libreoffice\\program\\soffice.exe';

async function main() {
  // 先解析设计DNA与模型
  const { getDefaultDesignDNA } = await import('@/lib/slides/agent/design-dna');
  const { resolveModel } = await import('@/lib/server/resolve-model');
  const { runPipeline } = await import('@/lib/slides/agent/pipeline');
  const { createJob, getJob } = await import('@/lib/slides/agent/pipeline');

  const designDNA = getDefaultDesignDNA();
  console.log('设计DNA默认：', {
    styleName: designDNA.styleName,
    coverBg: designDNA.colors.coverBg,
    accent: designDNA.colors.accent,
    font: designDNA.fonts.heading,
    bodySize: designDNA.fonts.bodySize,
    cardStyle: designDNA.components.cardStyle,
  });

  const resolved = await resolveModel({
    modelString: process.env.DEFAULT_MODEL || 'deepseek:deepseek-chat',
  });
  console.log('模型：', resolved.modelString);

  const jobId = `academic-demo-${Date.now()}`;
  createJob(jobId, 8);

  await runPipeline({
    topic: '光的折射',
    difficulty: '高中物理',
    minPages: Number(process.env.PAGES_MIN) || 6,
    maxPages: Number(process.env.PAGES_MAX) || 8,
    designDNA,
    languageModel: resolved.model,
    jobId,
    educationLevel: '高中',
  });

  const job = getJob(jobId);
  console.log('管线最终状态：', job?.stage, job?.message, 'pptxUrl=', job?.pptxUrl);
  if (!job?.pptxUrl) {
    console.log('未产出 PPTX，附加错误：', job?.error || 'n/a');
    return;
  }

  // 用 LibreOffice 转 PDF，再逐页渲染 PNG（便于验收内容页卡片骨架）
  const pptxPath = path.resolve(
    process.cwd(),
    'public',
    job.pptxUrl.replace(/^\//, '').replace(/\\/g, '/'),
  );
  const outDir = path.resolve(process.cwd(), 'docs', 'modern-academic-render');
  const pagesDir = path.join(outDir, 'pages');
  await fs.mkdir(outDir, { recursive: true });
  await fs.mkdir(pagesDir, { recursive: true });
  const profile = path.join(os.tmpdir(), `lo-${Date.now()}`);
  await fs.mkdir(profile, { recursive: true });
  const url = 'file:///' + profile.replace(/\\/g, '/');

  const lo = LO || (await import('@/lib/slides/agent/png-converter')).SOFFICE_CANDIDATES?.[0];
  if (!lo) throw new Error('未找到 LibreOffice');
  console.log('LibreOffice:', lo);

  await execFileAsync(
    lo,
    [
      '--headless',
      `-env:UserInstallation=${url}`,
      '--convert-to',
      'pdf',
      '--outdir',
      outDir,
      pptxPath,
    ],
    { timeout: 180000 },
  );
  const pdfName = (await fs.readdir(outDir)).find((f) => f.endsWith('.pdf')) as string;
  if (!pdfName) throw new Error('PDF 未产出');
  const pdfPath = path.join(outDir, pdfName);
  console.log('PDF:', pdfPath);

  // 用本机 python (PyMuPDF) 逐页渲染
  const py =
    process.env.PYTHON_PATH ||
    path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'python.exe');
  const { spawnSync } = await import('child_process');
  const r = spawnSync(
    py,
    [
      '-c',
      `import pymupdf,os; d=pymupdf.open(r"${pdfPath}"); n=min(len(d),8); out=[]
for i in range(n):
  p="${pagesDir.replace(/\\\\/g, '/')}/s" + "%02d.png" % (i + 1)
  d[i].get_pixmap(matrix=pymupdf.Matrix(1.6,1.6)).save(p); out.append(p)
print("\\n".join(out))`,
    ],
    { encoding: 'utf8', timeout: 180000 },
  );
  if (r.status !== 0) {
    console.log('Python 渲染失败:', r.stderr?.slice(0, 500));
  } else {
    console.log(r.stdout);
  }
}

main().catch((e) => {
  console.error('脚本失败：', e);
  process.exit(1);
});
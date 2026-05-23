/**
 * Template-based PPTX Exporter
 *
 * Uses python-pptx to apply AI-generated content onto real template PPTX files,
 * preserving all visual effects (gradients, shapes, images, animations).
 *
 * Falls back to pptxgenjs export if Python is unavailable.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exportPptx } from './pptx-exporter';
import type { PptxExportOptions, PptxExportResult } from './pptx-exporter';
import { getTheme } from './pptx-themes';
import { createLogger } from '@/lib/logger';

const log = createLogger('TemplateExporter');

const TEMPLATE_MAP: Record<string, string> = {
  'sky-blue': 'public/templates/source/教师说课PPT模板-14.pptx',
  'minimal': 'public/templates/source/教师说课PPT模板-14.pptx',
  'academic': 'public/templates/source/教师说课PPT模板-14.pptx',
  'tech-dark': 'public/templates/source/教师说课PPT模板-14.pptx',
  'nature-fresh': 'public/templates/source/教师说课PPT模板-14.pptx',
  'macaron-pink': 'public/templates/source/教师说课PPT模板-14.pptx',
};

const PYTHON_PATHS = [
  'python3',
  'python',
  path.join(process.cwd(), '.venv', 'Scripts', 'python.exe'),
  path.join(process.cwd(), '.venv', 'bin', 'python'),
  path.join(os.homedir(), 'AppData', 'Local', 'hermes', 'hermes-agent', 'venv', 'Scripts', 'python.exe'),
];

async function findPython(): Promise<string | null> {
  for (const p of PYTHON_PATHS) {
    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn(p, ['-c', 'import pptx; print(pptx.__version__)']);
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.on('close', (code) => {
          if (code === 0 && stdout.includes('1.')) resolve();
          else reject();
        });
        proc.on('error', reject);
      });
      log.info(`Found python-pptx at: ${p}`);
      return p;
    } catch {
      // try next
    }
  }
  return null;
}

function buildSlidesJson(options: PptxExportOptions): unknown[] {
  const { title, slides } = options;
  const result: unknown[] = [];

  // Cover
  const coverSlide = slides.find((s) => s.type === 'cover');
  if (coverSlide) {
    const titleEl = coverSlide.elements?.find((e) => e.type === 'text');
    const subtitleEl = coverSlide.elements?.find((e, i) => e.type === 'text' && i > (coverSlide.elements?.indexOf(titleEl!) ?? -1));
    result.push({
      type: 'cover',
      title: titleEl && 'content' in titleEl ? String(titleEl.content).replace(/<[^>]*>/g, '').trim() : title,
      subtitle: subtitleEl && 'content' in subtitleEl ? String(subtitleEl.content).replace(/<[^>]*>/g, '').trim() : '',
    });
  }

  // Content slides
  for (const slide of slides) {
    if (slide.type === 'cover' || slide.type === 'end') continue;
    const textEls = slide.elements?.filter((e) => e.type === 'text') ?? [];
    const titleEl = textEls[0];
    const bodyEls = textEls.slice(1);
    result.push({
      type: 'content',
      title: titleEl && 'content' in titleEl ? String(titleEl.content).replace(/<[^>]*>/g, '').trim() : '',
      body: bodyEls.map((e) => 'content' in e ? String(e.content).replace(/<[^>]*>/g, '').trim() : '').filter(Boolean),
    });
  }

  // End
  const endSlide = slides.find((s) => s.type === 'end');
  if (endSlide) {
    const textEls = endSlide.elements?.filter((e) => e.type === 'text') ?? [];
    result.push({
      type: 'end',
      keyPoints: textEls.map((e) => 'content' in e ? String(e.content).replace(/<[^>]*>/g, '').trim() : '').filter(Boolean),
    });
  }

  return result;
}

/** Build full slides JSON preserving all element positions/styles. */
function buildFullSlidesJson(options: PptxExportOptions): unknown {
  const { title, slides, theme } = options;

  // Resolve theme token for colors/fonts
  const themeToken = theme ? getTheme(theme) : undefined;

  return {
    slides: slides.map((slide) => ({
      ...slide,
      // Ensure elements are serializable
      elements: slide.elements?.map((el) => ({ ...el })) ?? [],
    })),
    theme: themeToken ? {
      backgroundColor: themeToken.contentBg,
      themeColors: [themeToken.accent, themeToken.accentSecondary, themeToken.accentLight],
      fontColor: themeToken.bodyColor,
      fontName: themeToken.fontFamily,
      coverTitleColor: themeToken.coverTitleColor,
      coverSubColor: themeToken.coverSubColor,
      bodyColor: themeToken.bodyColor,
      titleFontSize: themeToken.titleFontSize,
      bodyFontSize: themeToken.bodyFontSize,
      pageNumColor: themeToken.pageNumColor,
      dividerColor: themeToken.dividerColor,
    } : undefined,
  };
}

async function exportPptxWithAiLayout(options: PptxExportOptions): Promise<PptxExportResult> {
  const pythonPath = await findPython();
  if (!pythonPath) {
    throw new Error('python-pptx not available');
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'render-ai-layout.py');
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`AI layout script not found: ${scriptPath}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sky-ai-layout-'));
  const jsonPath = path.join(tmpDir, 'slides.json');
  const outputPath = path.join(tmpDir, 'output.pptx');

  try {
    const slidesData = buildFullSlidesJson(options);
    fs.writeFileSync(jsonPath, JSON.stringify(slidesData, null, 2), 'utf-8');

    log.info(`AI layout render: ${options.title} (${options.slides.length} slides)`);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonPath, [scriptPath, jsonPath, outputPath]);
      let stderr = '';
      let stdout = '';

      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('close', (code) => {
        if (code === 0) {
          log.info(`AI layout rendered: ${stdout.trim()}`);
          resolve();
        } else {
          reject(new Error(`AI layout script exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => reject(err));
    });

    const buffer = fs.readFileSync(outputPath);
    log.info(`AI layout export done: ${(buffer.length / 1024).toFixed(1)}KB`);

    return {
      buffer,
      fileName: `${sanitizeFileName(options.title)}.pptx`,
      size: buffer.length,
    };
  } catch (err) {
    log.error('AI layout export failed:', err);
    throw err;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

async function exportPptxWithTemplateBg(options: PptxExportOptions): Promise<PptxExportResult> {
  const themeId = options.theme || 'sky-blue';
  const templatePath = TEMPLATE_MAP[themeId];

  if (!templatePath) {
    throw new Error(`No template mapped for theme: ${themeId}`);
  }

  const absoluteTemplatePath = path.join(process.cwd(), templatePath);
  if (!fs.existsSync(absoluteTemplatePath)) {
    throw new Error(`Template file not found: ${absoluteTemplatePath}`);
  }

  const pythonPath = await findPython();
  if (!pythonPath) {
    throw new Error('python-pptx not available');
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'render-ai-layout-v2.py');
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`v2 script not found: ${scriptPath}`);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sky-tpl-bg-'));
  const jsonPath = path.join(tmpDir, 'slides.json');
  const outputPath = path.join(tmpDir, 'output.pptx');

  try {
    const slidesData = buildFullSlidesJson(options);
    fs.writeFileSync(jsonPath, JSON.stringify(slidesData, null, 2), 'utf-8');

    log.info(`WPS template + AI layout: ${options.title} (${options.slides.length} slides)`);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonPath, [scriptPath, jsonPath, absoluteTemplatePath, outputPath]);
      let stderr = '';
      let stdout = '';

      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('close', (code) => {
        if (code === 0) {
          log.info(`WPS+AI rendered: ${stdout.trim()}`);
          resolve();
        } else {
          reject(new Error(`v2 script exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => reject(err));
    });

    const buffer = fs.readFileSync(outputPath);
    log.info(`WPS+AI export done: ${(buffer.length / 1024).toFixed(1)}KB`);

    return {
      buffer,
      fileName: `${sanitizeFileName(options.title)}.pptx`,
      size: buffer.length,
    };
  } catch (err) {
    log.error('WPS+AI export failed:', err);
    throw err;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

export async function exportPptxWithTemplate(options: PptxExportOptions): Promise<PptxExportResult> {
  const layoutMode = options.layoutMode ?? 'template-bg';
  const themeId = options.theme || 'sky-blue';

  // ── Path 1: WPS Template Background + AI Foreground (default) ───
  if (layoutMode === 'template-bg') {
    try {
      return await exportPptxWithTemplateBg(options);
    } catch (err) {
      log.warn('WPS+AI export failed, falling back to pure AI layout:', err);
      try {
        return await exportPptxWithAiLayout(options);
      } catch (err2) {
        log.warn('Pure AI layout also failed, falling back to WPS template fill:', err2);
        // Continue to template path below
      }
    }
  }

  // ── Path 2: AI Layout (pure, no template background) ────────────
  if (layoutMode === 'ai') {
    try {
      return await exportPptxWithAiLayout(options);
    } catch (err) {
      log.warn('AI layout export failed, falling back to WPS template:', err);
      // Continue to template path below
    }
  }

  // ── Path 3: WPS Template Fill ───────────────────────────────────
  const templatePath = TEMPLATE_MAP[themeId];

  if (!templatePath) {
    return exportPptx(options);
  }

  const absoluteTemplatePath = path.join(process.cwd(), templatePath);
  if (!fs.existsSync(absoluteTemplatePath)) {
    log.warn(`Template file not found: ${absoluteTemplatePath}, falling back to pptxgenjs`);
    return exportPptx(options);
  }

  const pythonPath = await findPython();
  if (!pythonPath) {
    log.warn('python-pptx not available, falling back to pptxgenjs');
    return exportPptx(options);
  }

  const scriptPath = path.join(process.cwd(), 'scripts', 'apply-template-v4.py');
  if (!fs.existsSync(scriptPath)) {
    log.warn(`Template script not found: ${scriptPath}, falling back to pptxgenjs`);
    return exportPptx(options);
  }

  // Prepare temp files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sky-pptx-'));
  const jsonPath = path.join(tmpDir, 'slides.json');
  const outputPath = path.join(tmpDir, 'output.pptx');

  try {
    const slidesJson = buildSlidesJson(options);
    fs.writeFileSync(jsonPath, JSON.stringify(slidesJson, null, 2), 'utf-8');

    log.info(`Applying template: ${templatePath} (${slidesJson.length} slides)`);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(pythonPath, [scriptPath, absoluteTemplatePath, outputPath, jsonPath]);
      let stderr = '';
      let stdout = '';

      proc.stdout.on('data', (d) => { stdout += d; });
      proc.stderr.on('data', (d) => { stderr += d; });

      proc.on('close', (code) => {
        if (code === 0) {
          log.info(`Template applied: ${stdout.trim()}`);
          resolve();
        } else {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => reject(err));
    });

    const buffer = fs.readFileSync(outputPath);
    log.info(`Template export done: ${(buffer.length / 1024).toFixed(1)}KB`);

    return {
      buffer,
      fileName: `${sanitizeFileName(options.title)}.pptx`,
      size: buffer.length,
    };
  } catch (err) {
    log.error('Template export failed, falling back to pptxgenjs:', err);
    return exportPptx(options);
  } finally {
    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || '课件';
}

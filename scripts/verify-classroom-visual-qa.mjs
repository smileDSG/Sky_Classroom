#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'http://localhost:3000';
const MIN_FONT_PX = 18;
const MIN_SAFE_FALLBACK_FONT_PX = 22;
const OVERLAP_AREA_PX = 140;
const OVERLAP_RATIO = 0.16;
const EDGE_TOLERANCE_PX = 3;

function printUsage() {
  console.log(`
Usage:
  npm run qa:classroom:visual -- <classroom-id-or-url> [--base-url http://localhost:3000]

Examples:
  npm run qa:classroom:visual -- AQNdMxAz1F
  npm run qa:classroom:visual -- http://localhost:3000/classroom/AQNdMxAz1F
`);
}

function parseArgs(argv) {
  const args = [...argv];
  let input = '';
  let baseUrl = process.env.CLASSROOM_BASE_URL || DEFAULT_BASE_URL;
  let keepBrowser = process.env.HEADLESS === 'false';

  while (args.length > 0) {
    const arg = args.shift();
    if (!arg) continue;
    if (arg === '--base-url') {
      baseUrl = args.shift() || baseUrl;
      continue;
    }
    if (arg === '--headed') {
      keepBrowser = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (!input) {
      input = arg;
    }
  }

  if (!input) {
    printUsage();
    process.exit(2);
  }

  if (/^https?:\/\//i.test(input)) {
    const url = new URL(input);
    const match = url.pathname.match(/\/classroom\/([^/]+)/);
    if (!match?.[1]) {
      throw new Error(`Cannot extract classroom id from URL: ${input}`);
    }
    return {
      classroomId: decodeURIComponent(match[1]),
      baseUrl: url.origin,
      keepBrowser,
    };
  }

  return {
    classroomId: input,
    baseUrl: baseUrl.replace(/\/$/, ''),
    keepBrowser,
  };
}

async function fetchClassroom(baseUrl, classroomId) {
  const apiUrl = new URL('/api/classroom', baseUrl);
  apiUrl.searchParams.set('id', classroomId);

  let response;
  try {
    response = await fetch(apiUrl, { cache: 'no-store' });
  } catch (error) {
    throw new Error(
      `Cannot reach ${apiUrl}. Start the dev server first, for example: pnpm dev. ${error.message}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Classroom API returned ${response.status} for ${apiUrl}`);
  }

  const json = await response.json();
  if (!json?.success || !json?.classroom?.scenes) {
    throw new Error(`Classroom API response is missing classroom.scenes for ${classroomId}`);
  }
  return json.classroom;
}

function safeFilePart(value) {
  return String(value || 'unknown')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function issueMessage(issue) {
  const prefix = `P${issue.page} ${issue.title}`;
  switch (issue.type) {
    case 'text_too_small':
      return `${prefix}: 字号过小 ${issue.fontSize}px，元素 ${issue.elementId}`;
    case 'text_overflow':
      return `${prefix}: 文本超出所属元素，元素 ${issue.elementId}`;
    case 'element_outside_frame':
      return `${prefix}: 元素越出幻灯片可视区，元素 ${issue.elementId}`;
    case 'text_overlap':
      return `${prefix}: 文本块互相重叠，元素 ${issue.a} / ${issue.b}`;
    case 'slide_not_rendered':
      return `${prefix}: 没有检测到幻灯片元素`;
    default:
      return `${prefix}: ${issue.type}`;
  }
}

async function inspectCurrentSlide(page, meta) {
  return page.evaluate(
    ({ minFontPx, minSafeFallbackFontPx, overlapAreaPx, overlapRatio, edgeTolerancePx, meta }) => {
      const frame = document.querySelector('[data-classroom-slide-frame="true"]');
      const canvas = document.querySelector('[data-classroom-slide-canvas="true"]');
      const elements = Array.from(
        document.querySelectorAll('[data-classroom-slide-element="true"]'),
      );

      const rectToObject = (rect) => ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      });

      const isVisible = (element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > 1 &&
          rect.height > 1 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity || 1) > 0.02
        );
      };

      const normalizeText = (text) =>
        String(text || '')
          .replace(/\s+/g, ' ')
          .trim();

      const unionRects = (rects) => {
        const visibleRects = rects.filter((rect) => rect.width > 0.5 && rect.height > 0.5);
        if (visibleRects.length === 0) return null;
        const left = Math.min(...visibleRects.map((rect) => rect.left));
        const top = Math.min(...visibleRects.map((rect) => rect.top));
        const right = Math.max(...visibleRects.map((rect) => rect.right));
        const bottom = Math.max(...visibleRects.map((rect) => rect.bottom));
        return { left, top, right, bottom, width: right - left, height: bottom - top };
      };

      const textMetricsFor = (element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const metrics = [];
        let node = walker.nextNode();

        while (node) {
          const text = normalizeText(node.textContent);
          const parent = node.parentElement;
          if (text && parent && isVisible(parent)) {
            const range = document.createRange();
            range.selectNodeContents(node);
            const rect = unionRects(Array.from(range.getClientRects()));
            const style = window.getComputedStyle(parent);
            const fontSize = Number.parseFloat(style.fontSize || '0');
            if (rect && fontSize > 0) {
              metrics.push({ text, rect, fontSize });
            }
            range.detach();
          }
          node = walker.nextNode();
        }

        return metrics;
      };

      const issues = [];
      if (!frame || !canvas || elements.length === 0) {
        issues.push({ type: 'slide_not_rendered', ...meta });
        return {
          frame: frame ? rectToObject(frame.getBoundingClientRect()) : null,
          elementCount: elements.length,
          issues,
        };
      }

      const frameRect = frame.getBoundingClientRect();
      const records = [];

      for (const element of elements) {
        if (!isVisible(element)) continue;

        const rect = element.getBoundingClientRect();
        const elementId = element.getAttribute('data-element-id') || element.id || 'unknown';
        const elementType = element.getAttribute('data-element-type') || 'unknown';
        const text = normalizeText(element.textContent);
        const textMetrics = textMetricsFor(element);
        const hasText = textMetrics.length > 0 && text.length > 0;

        if (
          rect.left < frameRect.left - edgeTolerancePx ||
          rect.top < frameRect.top - edgeTolerancePx ||
          rect.right > frameRect.right + edgeTolerancePx ||
          rect.bottom > frameRect.bottom + edgeTolerancePx
        ) {
          issues.push({
            type: 'element_outside_frame',
            elementId,
            elementType,
            rect: rectToObject(rect),
            frame: rectToObject(frameRect),
            ...meta,
          });
        }

        if (hasText) {
          const minFont = Math.min(...textMetrics.map((metric) => metric.fontSize));
          const requiredFont = elementId.startsWith('classroom_qa_safe_')
            ? minSafeFallbackFontPx
            : minFontPx;

          if (minFont < requiredFont) {
            issues.push({
              type: 'text_too_small',
              elementId,
              elementType,
              fontSize: Number(minFont.toFixed(1)),
              requiredFont,
              text: text.slice(0, 80),
              ...meta,
            });
          }

          const textRect = unionRects(textMetrics.map((metric) => metric.rect));
          if (
            textRect &&
            (textRect.left < rect.left - edgeTolerancePx ||
              textRect.top < rect.top - edgeTolerancePx ||
              textRect.right > rect.right + edgeTolerancePx ||
              textRect.bottom > rect.bottom + edgeTolerancePx)
          ) {
            issues.push({
              type: 'text_overflow',
              elementId,
              elementType,
              rect: rectToObject(rect),
              textRect,
              text: text.slice(0, 80),
              ...meta,
            });
          }

          records.push({
            elementId,
            elementType,
            text: text.slice(0, 80),
            rect: rectToObject(rect),
            area: Math.max(1, rect.width * rect.height),
          });
        }
      }

      for (let i = 0; i < records.length; i += 1) {
        for (let j = i + 1; j < records.length; j += 1) {
          const a = records[i];
          const b = records[j];
          const left = Math.max(a.rect.left, b.rect.left);
          const top = Math.max(a.rect.top, b.rect.top);
          const right = Math.min(a.rect.right, b.rect.right);
          const bottom = Math.min(a.rect.bottom, b.rect.bottom);
          const width = right - left;
          const height = bottom - top;
          if (width <= 0 || height <= 0) continue;

          const area = width * height;
          const ratio = area / Math.min(a.area, b.area);
          if (area >= overlapAreaPx && ratio >= overlapRatio) {
            issues.push({
              type: 'text_overlap',
              a: a.elementId,
              b: b.elementId,
              aType: a.elementType,
              bType: b.elementType,
              area: Number(area.toFixed(1)),
              ratio: Number(ratio.toFixed(2)),
              aText: a.text,
              bText: b.text,
              ...meta,
            });
          }
        }
      }

      return {
        frame: rectToObject(frameRect),
        elementCount: elements.length,
        textElementCount: records.length,
        issues,
      };
    },
    {
      minFontPx: MIN_FONT_PX,
      minSafeFallbackFontPx: MIN_SAFE_FALLBACK_FONT_PX,
      overlapAreaPx: OVERLAP_AREA_PX,
      overlapRatio: OVERLAP_RATIO,
      edgeTolerancePx: EDGE_TOLERANCE_PX,
      meta,
    },
  );
}

async function launchBrowser(keepBrowser) {
  const headless = !keepBrowser;
  const requestedChannel = process.env.PLAYWRIGHT_CHANNEL;
  const channels = requestedChannel ? [requestedChannel] : [undefined, 'msedge', 'chrome'];
  let lastError;

  for (const channel of channels) {
    try {
      return await chromium.launch({
        headless,
        ...(channel ? { channel } : {}),
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Executable doesn't exist") && !message.includes('not found')) {
        break;
      }
    }
  }

  throw lastError;
}

async function loginIfNeeded(page, targetUrl) {
  if (!page.url().includes('/auth/login')) return;

  const username = process.env.CLASSROOM_QA_USERNAME || 'admin';
  const password = process.env.CLASSROOM_QA_PASSWORD || '123';

  console.log(`Login required; signing in as ${username}.`);
  const inputs = page.locator('input');
  if ((await inputs.count()) < 2) {
    throw new Error('Login page did not render username/password inputs.');
  }

  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  await page
    .locator('button')
    .filter({ hasText: /登\s*录|login/i })
    .first()
    .click();
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 20_000 });

  if (!page.url().includes('/classroom/')) {
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  }
}

async function main() {
  const { classroomId, baseUrl, keepBrowser } = parseArgs(process.argv.slice(2));
  const classroom = await fetchClassroom(baseUrl, classroomId);
  const scenes = classroom.scenes || [];
  const slideScenes = scenes
    .map((scene, sceneIndex) => ({ scene, sceneIndex }))
    .filter(({ scene }) => scene?.type === 'slide');

  if (slideScenes.length === 0) {
    throw new Error(`Classroom ${classroomId} has no slide scenes to inspect.`);
  }

  const outputDir = path.resolve('tmp', 'visual-qa', safeFilePart(classroomId));
  await mkdir(outputDir, { recursive: true });

  const browser = await launchBrowser(keepBrowser);
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const consoleErrors = [];

  await page.addInitScript(() => {
    const key = 'settings-storage';
    let value = { state: {}, version: 5 };
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        value = JSON.parse(raw);
      }
    } catch {
      value = { state: {}, version: 5 };
    }

    value.state = {
      ...(value.state || {}),
      timelineCollapsed: false,
      chatAreaCollapsed: true,
    };
    window.localStorage.setItem(key, JSON.stringify(value));
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });

  const targetUrl = new URL(`/classroom/${encodeURIComponent(classroomId)}`, baseUrl).toString();
  console.log(`Opening ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await loginIfNeeded(page, targetUrl);
  await page.waitForSelector('[data-testid="scene-item"]', { state: 'attached', timeout: 30_000 });
  await page.waitForSelector('[data-classroom-slide-frame="true"]', { timeout: 30_000 });

  const slideReports = [];
  const issues = [];

  for (let pageIndex = 0; pageIndex < slideScenes.length; pageIndex += 1) {
    const { scene, sceneIndex } = slideScenes[pageIndex];
    const item = page.locator('[data-testid="scene-item"]').nth(sceneIndex);
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await page.waitForTimeout(450);

    const title = scene.title || `Slide ${pageIndex + 1}`;
    const meta = {
      page: pageIndex + 1,
      sceneIndex: sceneIndex + 1,
      sceneId: scene.id,
      title,
    };
    const report = await inspectCurrentSlide(page, meta);
    const screenshotPath = path.join(
      outputDir,
      `page-${String(pageIndex + 1).padStart(2, '0')}.png`,
    );
    await page.screenshot({ path: screenshotPath, fullPage: false });

    slideReports.push({
      ...meta,
      screenshotPath,
      elementCount: report.elementCount,
      textElementCount: report.textElementCount,
      frame: report.frame,
      issues: report.issues,
    });
    issues.push(...report.issues);
  }

  await browser.close();

  const result = {
    classroomId,
    baseUrl,
    checkedAt: new Date().toISOString(),
    thresholds: {
      minFontPx: MIN_FONT_PX,
      minSafeFallbackFontPx: MIN_SAFE_FALLBACK_FONT_PX,
      overlapAreaPx: OVERLAP_AREA_PX,
      overlapRatio: OVERLAP_RATIO,
      edgeTolerancePx: EDGE_TOLERANCE_PX,
    },
    consoleErrors,
    slides: slideReports,
    issues,
  };

  const reportPath = path.join(outputDir, 'visual-qa-report.json');
  await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  if (consoleErrors.length > 0) {
    console.log(`Console errors: ${consoleErrors.length}`);
    for (const error of consoleErrors.slice(0, 5)) {
      console.log(`  - ${error}`);
    }
  }

  if (issues.length > 0) {
    console.error(`\nVisual QA failed: ${issues.length} issue(s) found.`);
    for (const issue of issues.slice(0, 40)) {
      console.error(`  - ${issueMessage(issue)}`);
    }
    if (issues.length > 40) {
      console.error(`  ... ${issues.length - 40} more issue(s) omitted`);
    }
    console.error(`\nReport: ${reportPath}`);
    process.exit(1);
  }

  console.log(`Visual QA passed: ${slideReports.length} slide(s) checked.`);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

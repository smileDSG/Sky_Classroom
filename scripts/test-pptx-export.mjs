/**
 * Test script for template-driven PPTX export.
 * Loads a template, resolves placeholders, and generates a PPTX file.
 */

import pptxgen from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import tinycolor from 'tinycolor2';

// ── Helpers (copied from use-export-pptx.ts) ──

const TEMPLATE_SCALE = 128;

function formatColor(_color) {
  if (!_color) {
    return { alpha: 0, color: '#000000' };
  }
  const c = tinycolor(_color);
  const alpha = c.getAlpha();
  const color = alpha === 0 ? '#ffffff' : c.setAlpha(1).toHexString();
  return { alpha, color };
}

function resolveTemplateColor(color, theme, fallback) {
  let resolved = fallback;
  if (color) {
    if (color.startsWith('$')) {
      const key = color.slice(1);
      resolved = theme?.colors?.[key] || fallback;
    } else {
      resolved = color;
    }
  }
  return formatColor(resolved);
}

function stripHtml(html) {
  return html
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

function applyTemplateBackground(pptxSlide, templateData) {
  const bg = templateData.page.background;
  if (!bg) return;

  if (bg.type === 'solid' && bg.color) {
    const c = resolveTemplateColor(bg.color, templateData.theme, '#FFFFFF');
    pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 };
  } else if (bg.type === 'gradient' && bg.stops && bg.stops.length > 0) {
    const c = resolveTemplateColor(bg.stops[0].color, templateData.theme, '#FFFFFF');
    pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 };
  }
}

function convertTemplateElement(pptxSlide, el, theme) {
  const [x, y, w, h] = el.bounds;
  const inchX = x / TEMPLATE_SCALE;
  const inchY = y / TEMPLATE_SCALE;
  const inchW = w / TEMPLATE_SCALE;
  const inchH = h / TEMPLATE_SCALE;

  switch (el.elementType) {
    case 'text': {
      const rawText = el.content?.text || '';
      const text = stripHtml(rawText);
      if (!text) return undefined;

      const colorC = resolveTemplateColor(el.content?.color, theme, '#333333');
      const align = (el.content?.align?.[0]) || 'left';
      const valign = (el.content?.align?.[1]) || 'top';

      let fontSize = 14;
      const styleRef = el.content?.style;
      if (styleRef && styleRef.startsWith('$') && theme?.textStyles) {
        const styleName = styleRef.slice(1);
        const style = theme.textStyles[styleName];
        if (style) {
          fontSize = style.fontSize ? Math.round(style.fontSize * 0.6) : 14;
        }
      }

      pptxSlide.addText(text, {
        x: inchX,
        y: inchY,
        w: inchW,
        h: inchH,
        fontSize,
        fontFace: 'Microsoft YaHei',
        color: colorC.color,
        align,
        valign,
        wrap: el.content?.wrap !== false,
      });
      return 'converted';
    }

    case 'shape': {
      const shapeType =
        el.shapeName === 'ellipse'
          ? 'ellipse'
          : el.shapeName === 'roundRect'
            ? 'roundRect'
            : 'rect';
      const fillC = resolveTemplateColor(el.fill?.color, theme, '#5b9bd5');
      const lineC = el.border
        ? resolveTemplateColor(el.border.color, theme, '#cccccc')
        : undefined;
      const shadowC = el.shadow
        ? resolveTemplateColor(el.shadow.color, theme, '#000000')
        : undefined;

      const shapeOpts = {
        x: inchX,
        y: inchY,
        w: inchW,
        h: inchH,
        fill: { color: fillC.color, transparency: (1 - fillC.alpha) * 100 },
      };
      if (el.border && lineC) {
        shapeOpts.line = {
          color: lineC.color,
          transparency: (1 - lineC.alpha) * 100,
          width: el.border.width / TEMPLATE_SCALE,
        };
      }
      if (el.shadow && shadowC) {
        shapeOpts.shadow = {
          type: 'outer',
          blur: el.shadow.blur / TEMPLATE_SCALE,
          color: shadowC.color,
          opacity: shadowC.alpha,
          offset: el.shadow.offset[0] / TEMPLATE_SCALE,
          angle: 45,
        };
      }

      pptxSlide.addShape(shapeType, shapeOpts);
      return 'converted';
    }

    case 'line': {
      const lineC = el.border
        ? resolveTemplateColor(el.border.color, theme, '#333333')
        : formatColor('#333333');
      pptxSlide.addShape('line', {
        x: inchX,
        y: inchY,
        w: inchW,
        h: inchH,
        line: {
          color: lineC.color,
          transparency: (1 - lineC.alpha) * 100,
          width: el.border ? el.border.width / TEMPLATE_SCALE : 1,
        },
      });
      return 'converted';
    }

    case 'image': {
      if (el.src && !el.src.startsWith('placeholder:')) {
        pptxSlide.addImage({
          path: el.src,
          x: inchX,
          y: inchY,
          w: inchW,
          h: inchH,
        });
        return 'converted';
      }
      return undefined;
    }

    case 'icon': {
      if (el.iconName) {
        const iconC = resolveTemplateColor(el.fill?.color, theme, '#94a3b8');
        pptxSlide.addText(`[${el.iconName}]`, {
          x: inchX,
          y: inchY,
          w: inchW,
          h: inchH,
          fontSize: 10,
          fontFace: 'Microsoft YaHei',
          color: iconC.color,
          align: 'center',
          valign: 'middle',
        });
        return 'converted';
      }
      return undefined;
    }

    default:
      console.warn(`Unsupported template element type: ${el.elementType}`);
      return undefined;
  }
}

// ── Template Parser (simplified) ──

function parsePPTD(manifestPath) {
  const content = fs.readFileSync(manifestPath, 'utf-8');
  return yaml.load(content);
}

function parsePage(pagePath) {
  const content = fs.readFileSync(pagePath, 'utf-8');
  return yaml.load(content);
}

function loadTemplate(templateDir) {
  const manifestPath = path.join(templateDir, path.basename(templateDir) + '.pptd');
  const manifest = parsePPTD(manifestPath);
  const pages = {};

  for (const pageFile of manifest.pages) {
    const fullPath = path.join(templateDir, pageFile);
    const pageName = path.basename(pageFile, '.page');
    pages[pageName] = parsePage(fullPath);
  }

  return { manifest, pages };
}

// ── Placeholder Replacer (simplified) ──

function replacePlaceholders(page, values) {
  return {
    ...page,
    elements: page.elements.map((el) => replaceInElement(el, values)),
  };
}

function replaceInElement(el, values) {
  if (!el.content?.placeholder) return el;

  const placeholder = el.content.placeholder;
  const newValue = values[placeholder];

  if (newValue === undefined) return el;

  const text = newValue.trim().startsWith('<')
    ? newValue
    : `<p>${newValue}</p>`;

  return {
    ...el,
    content: {
      ...el.content,
      text,
    },
  };
}

// ── Test: Generate a PPTX from template ──

const TEMPLATE_DIR = 'C:\\Users\\11486\\Desktop\\Kimi_Agent_星穹课堂课件模板';
const OUTPUT_DIR = 'C:\\Users\\11486\\Desktop';

async function testTemplateExport(templateName, pageName, values, outputFile) {
  const templateDir = `${TEMPLATE_DIR}\\${templateName}`;
  const { manifest, pages } = loadTemplate(templateDir);
  const page = pages[pageName];

  if (!page) {
    console.error(`Page ${pageName} not found in template ${templateName}`);
    return;
  }

  const resolvedPage = replacePlaceholders(page, values);

  const pptx = new pptxgen();
  pptx.layout = 'LAYOUT_16x9';

  const pptxSlide = pptx.addSlide();

  // Apply background
  const bg = resolvedPage.background;
  if (bg && bg.type === 'solid' && bg.color) {
    const c = resolveTemplateColor(bg.color, manifest.theme, '#FFFFFF');
    pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 };
  }

  let converted = 0;
  let skipped = 0;

  for (const el of resolvedPage.elements) {
    const result = convertTemplateElement(pptxSlide, el, manifest.theme);
    if (result === undefined) {
      skipped++;
      console.log(`  Skipped: ${el.elementId} (${el.elementType})`);
    } else {
      converted++;
    }
  }

  console.log(`[${templateName}/${pageName}] Converted: ${converted}, Skipped: ${skipped}`);

  const outputPath = path.join(OUTPUT_DIR, outputFile);
  await pptx.writeFile({ fileName: outputPath });
  console.log(`Saved to: ${outputPath}`);
}

async function main() {
  // Test 1: tech_dark_blue cover
  await testTemplateExport('tech_dark_blue', 'cover', {
    title: '走进天文物理学',
    subtitle: '探索宇宙的奥秘',
    instructor: '讲师：星穹课堂',
    date: '2026年6月10日',
  }, 'test-tech-cover.pptx');

  // Test 2: tech_dark_blue bullets (summary)
  await testTemplateExport('tech_dark_blue', 'bullets', {
    title: '天文学的核心概念',
    bullet_1_title: '恒星演化',
    bullet_1_desc: '恒星从诞生到死亡的完整生命周期',
    bullet_2_title: '黑洞理论',
    bullet_2_desc: '时空弯曲与事件视界',
    bullet_3_title: '宇宙大爆炸',
    bullet_3_desc: '宇宙起源与膨胀模型',
    bullet_4_title: '暗物质与暗能量',
    bullet_4_desc: '占据宇宙95%的未知存在',
  }, 'test-tech-bullets.pptx');

  // Test 3: warm_humanities cover
  await testTemplateExport('warm_humanities', 'cover', {
    title: '欢迎来到忍者世界',
    subtitle: '日本忍者文化探秘',
    instructor: '讲师：星穹课堂',
    date: '2026年6月10日',
  }, 'test-warm-cover.pptx');

  // Test 4: nature_green text (concept)
  await testTemplateExport('nature_green', 'text', {
    title: '生态系统的平衡',
    body: '<p><strong>生态系统</strong>是指在一定空间内，生物与环境构成的统一整体。</p><p>维持生态平衡需要生产者、消费者和分解者的协同作用。</p>',
  }, 'test-nature-text.pptx');

  console.log('All tests completed!');
}

main().catch(console.error);

import { describe, expect, it } from 'vitest';

import { auditSlideLayout, repairSlideLayout } from '@/lib/slides/agent/layout-guard-agent';

function getFirstFontSize(content: string): number {
  const match = content.match(/font-size\s*:\s*(\d+(?:\.\d+)?)px/i);
  return match ? Number(match[1]) : 0;
}

describe('layout guard agent', () => {
  it('reports and repairs text that extends beyond its background card', () => {
    const elements = [
      {
        id: 'card',
        type: 'shape',
        left: 130,
        top: 380,
        width: 370,
        height: 80,
        fill: '#e3edf7',
      },
      {
        id: 'body',
        type: 'text',
        left: 140,
        top: 390,
        width: 350,
        height: 90,
        content:
          '<p style="font-size:15px;">my_list = []</p><p style="font-size:15px;">my_list.append("welcome")</p>',
      },
    ];

    expect(auditSlideLayout(elements)).toContainEqual({
      type: 'text_outside_background',
      textId: 'body',
      backgroundId: 'card',
      detail: 'body exceeds card bounds',
    });

    const repaired = repairSlideLayout(elements);
    expect(auditSlideLayout(repaired)).toEqual([]);
    expect(repaired[0].height).toBeGreaterThan(80);
  });

  it('reports text that is too small or too low contrast for classroom playback', () => {
    const elements = [
      {
        id: 'panel',
        type: 'shape',
        left: 100,
        top: 160,
        width: 420,
        height: 280,
        fill: '#f0f4fc',
      },
      {
        id: 'small-label',
        type: 'text',
        left: 220,
        top: 268,
        width: 100,
        height: 50,
        content: '<p style="font-size:16px; color:#ffffff; text-align:center;">True -> run</p>',
        defaultColor: '#ffffff',
      },
      {
        id: 'muted-note',
        type: 'text',
        left: 140,
        top: 400,
        width: 160,
        height: 50,
        content:
          '<p style="font-size:16px; color:#8da0b8; text-align:center;">Continue after branch</p>',
        defaultColor: '#8da0b8',
      },
      {
        id: 'example-card',
        type: 'shape',
        left: 580,
        top: 372,
        width: 320,
        height: 60,
        fill: '#eaf4ff',
      },
      {
        id: 'example-text',
        type: 'text',
        left: 600,
        top: 382,
        width: 280,
        height: 50,
        content: '<p style="font-size:16px; color:#2f80d1;">age >= 18 -> allowed</p>',
        defaultColor: '#2f80d1',
      },
    ];

    const issues = auditSlideLayout(elements);

    expect(issues.some((issue) => issue.type === 'text_too_small')).toBe(true);
    expect(issues.some((issue) => issue.type === 'low_text_contrast')).toBe(true);
  });

  it('repairs small text and low contrast colors', () => {
    const elements = [
      {
        id: 'panel',
        type: 'shape',
        left: 100,
        top: 160,
        width: 420,
        height: 280,
        fill: '#f0f4fc',
      },
      {
        id: 'muted-note',
        type: 'text',
        left: 140,
        top: 400,
        width: 160,
        height: 50,
        content:
          '<p style="font-size:16px; color:#8da0b8; text-align:center;">Continue after branch</p>',
        defaultColor: '#8da0b8',
      },
    ];

    const repaired = repairSlideLayout(elements);
    const text = repaired.find((element) => element.id === 'muted-note') as {
      content: string;
      defaultColor?: string;
    };

    expect(getFirstFontSize(text.content)).toBeGreaterThanOrEqual(18);
    expect(text.content).toContain('color:#172033');
    expect(text.defaultColor).toBe('#172033');
    expect(auditSlideLayout(repaired)).toEqual([]);
  });

  it('reports thin text-only slides when richness checks are enabled', () => {
    const elements = [
      {
        id: 'title',
        type: 'text',
        left: 90,
        top: 70,
        width: 820,
        height: 70,
        content: '<p style="font-size:34px;">Python list basics</p>',
      },
      {
        id: 'body',
        type: 'text',
        left: 120,
        top: 180,
        width: 720,
        height: 90,
        content: '<p style="font-size:18px;">Lists store ordered values.</p>',
      },
    ];

    const issues = auditSlideLayout(elements, { includeRichness: true });

    expect(issues.some((issue) => issue.type === 'missing_visual_anchor')).toBe(true);
    expect(issues.some((issue) => issue.type === 'low_content_richness')).toBe(true);
  });

  it('reports readable overlaps, undersized formula boxes, and unsafe bottom placement', () => {
    const elements = [
      {
        id: 'body',
        type: 'text',
        left: 120,
        top: 220,
        width: 360,
        height: 90,
        content: '<p style="font-size:18px;">Formula interpretation should stay readable.</p>',
      },
      {
        id: 'formula',
        type: 'latex',
        left: 220,
        top: 250,
        width: 180,
        height: 38,
        latex: String.raw`y=ax^2+bx+c`,
      },
      {
        id: 'footer-formula',
        type: 'latex',
        left: 300,
        top: 505,
        width: 260,
        height: 48,
        latex: String.raw`\frac{-b \pm \sqrt{b^2-4ac}}{2a}`,
      },
    ];

    const issues = auditSlideLayout(elements);

    expect(issues.some((issue) => issue.type === 'readable_element_overlap')).toBe(true);
    expect(issues.some((issue) => issue.type === 'latex_box_too_small')).toBe(true);
    expect(issues.some((issue) => issue.type === 'unsafe_bottom_zone')).toBe(true);
  });

  it('reports misaligned parallel rows that should snap to a grid', () => {
    const elements = [
      {
        id: 'card-a',
        type: 'shape',
        left: 68,
        top: 110,
        width: 280,
        height: 54,
        fill: '#eef7ff',
      },
      {
        id: 'card-b',
        type: 'shape',
        left: 376,
        top: 118,
        width: 262,
        height: 48,
        fill: '#eef7ff',
      },
      {
        id: 'card-c',
        type: 'shape',
        left: 694,
        top: 102,
        width: 286,
        height: 62,
        fill: '#eef7ff',
      },
    ];

    const issues = auditSlideLayout(elements);

    expect(issues.some((issue) => issue.type === 'misaligned_parallel_group')).toBe(true);
  });

  it('accepts a rich classroom slide with visual anchor, hierarchy, and learning blocks', () => {
    const elements = [
      {
        id: 'title',
        type: 'text',
        left: 90,
        top: 64,
        width: 760,
        height: 70,
        content: '<p style="font-size:34px;"><strong>Python list workflow</strong></p>',
      },
      {
        id: 'rule',
        type: 'shape',
        left: 90,
        top: 142,
        width: 760,
        height: 4,
        fill: '#2f80d1',
      },
      {
        id: 'diagram-bg',
        type: 'shape',
        left: 110,
        top: 185,
        width: 430,
        height: 250,
        fill: '#eaf4ff',
      },
      {
        id: 'node-a',
        type: 'shape',
        left: 155,
        top: 240,
        width: 90,
        height: 64,
        fill: '#ffffff',
      },
      {
        id: 'node-b',
        type: 'shape',
        left: 365,
        top: 240,
        width: 90,
        height: 64,
        fill: '#ffffff',
      },
      {
        id: 'arrow',
        type: 'line',
        left: 252,
        top: 272,
        width: 3,
        start: [0, 0],
        end: [96, 0],
        style: 'solid',
        color: '#2f80d1',
        points: ['', 'arrow'],
      },
      {
        id: 'focus',
        type: 'text',
        left: 590,
        top: 198,
        width: 300,
        height: 58,
        content: '<p style="font-size:22px;"><strong>Focus: ordered container</strong></p>',
      },
      {
        id: 'explain',
        type: 'text',
        left: 590,
        top: 270,
        width: 300,
        height: 58,
        content: '<p style="font-size:18px;">Use index to locate each item.</p>',
      },
      {
        id: 'apply',
        type: 'text',
        left: 590,
        top: 342,
        width: 300,
        height: 58,
        content: '<p style="font-size:18px;">Practice: append, remove, sort.</p>',
      },
      {
        id: 'takeaway',
        type: 'text',
        left: 120,
        top: 460,
        width: 760,
        height: 42,
        content: '<p style="font-size:18px;">Takeaway: list operations change sequence state.</p>',
      },
    ];

    const issues = auditSlideLayout(elements, { includeRichness: true });

    expect(issues.filter((issue) => issue.type === 'missing_visual_anchor')).toEqual([]);
    expect(issues.filter((issue) => issue.type === 'low_content_richness')).toEqual([]);
    expect(issues.filter((issue) => issue.type === 'weak_visual_hierarchy')).toEqual([]);
  });

  it('reports wide foreground callouts that cover earlier slide content', () => {
    const elements = [
      {
        id: 'content-panel',
        type: 'shape',
        left: 110,
        top: 180,
        width: 410,
        height: 320,
        fill: '#e8f4ff',
      },
      {
        id: 'content-text',
        type: 'text',
        left: 150,
        top: 390,
        width: 330,
        height: 94,
        content:
          '<p style="font-size:20px;">Cargo / Rustfmt / Clippy toolchain<br/>Active crate ecosystem</p>',
      },
      {
        id: 'domain-strip',
        type: 'text',
        left: 112,
        top: 420,
        width: 776,
        height: 84,
        fill: '#06c8e9',
        content:
          '<p style="font-size:22px;">适用领域：操作系统 · 嵌入式 · WebAssembly · 高性能服务 · CLI工具</p>',
      },
    ];

    const issues = auditSlideLayout(elements);

    expect(issues).toContainEqual({
      type: 'foreground_overlay_collision',
      textId: 'domain-strip',
      detail: 'domain-strip overlaps earlier slide content',
    });
  });

  it('reports excessive colored background panels in clean classroom slides', () => {
    const elements = [
      {
        id: 'title',
        type: 'text',
        left: 90,
        top: 64,
        width: 760,
        height: 70,
        content: '<p style="font-size:34px;"><strong>Gradient descent workflow</strong></p>',
      },
      {
        id: 'rule',
        type: 'shape',
        left: 90,
        top: 142,
        width: 760,
        height: 3,
        fill: '#2f80d1',
      },
      {
        id: 'visual',
        type: 'image',
        left: 105,
        top: 185,
        width: 430,
        height: 242,
        src: 'img_1',
      },
      {
        id: 'panel-1',
        type: 'shape',
        left: 570,
        top: 190,
        width: 330,
        height: 70,
        fill: '#06c8e9',
      },
      {
        id: 'panel-2',
        type: 'shape',
        left: 570,
        top: 278,
        width: 330,
        height: 70,
        fill: '#f97316',
      },
      {
        id: 'panel-3',
        type: 'shape',
        left: 570,
        top: 366,
        width: 330,
        height: 70,
        fill: '#8b5cf6',
      },
      {
        id: 'focus',
        type: 'text',
        left: 590,
        top: 202,
        width: 290,
        height: 46,
        content: '<p style="font-size:20px;">Focus: choose a stable step</p>',
      },
      {
        id: 'explain',
        type: 'text',
        left: 590,
        top: 290,
        width: 290,
        height: 46,
        content: '<p style="font-size:18px;">Gradient points downhill.</p>',
      },
      {
        id: 'apply',
        type: 'text',
        left: 590,
        top: 378,
        width: 290,
        height: 46,
        content: '<p style="font-size:18px;">Practice: compare loss curves.</p>',
      },
    ];

    const issues = auditSlideLayout(elements, { includeRichness: true });

    expect(issues).toContainEqual({
      type: 'excessive_colored_panels',
      detail:
        'Slide uses 3 large colored background boxes; clean OpenMAIC pages should use at most one pale panel plus thin dividers',
    });
  });

  it('reports unlabeled abstract shape diagrams as visual placeholders', () => {
    const elements = [
      {
        id: 'title',
        type: 'text',
        left: 105,
        top: 78,
        width: 790,
        height: 70,
        content: '<p style="font-size:34px;">什么是二次函数</p>',
      },
      {
        id: 'visual-panel',
        type: 'shape',
        left: 110,
        top: 188,
        width: 410,
        height: 245,
        fill: '#e8f4ff',
      },
      {
        id: 'visual-blob',
        type: 'shape',
        left: 154,
        top: 232,
        width: 320,
        height: 148,
        fill: '#e8f4ff',
      },
      {
        id: 'visual-node-a',
        type: 'shape',
        left: 176,
        top: 260,
        width: 54,
        height: 54,
        fill: '#ffffff',
      },
      {
        id: 'visual-node-b',
        type: 'shape',
        left: 330,
        top: 242,
        width: 76,
        height: 76,
        fill: '#2f80d1',
      },
      {
        id: 'visual-line',
        type: 'line',
        left: 230,
        top: 284,
        width: 3,
        start: [0, 0],
        end: [98, -8],
        style: 'solid',
        color: '#2f80d1',
        points: ['', 'arrow'],
      },
      {
        id: 'focus',
        type: 'text',
        left: 590,
        top: 198,
        width: 300,
        height: 58,
        content: '<p style="font-size:22px;"><strong>核心定义</strong></p>',
      },
      {
        id: 'explain',
        type: 'text',
        left: 590,
        top: 270,
        width: 300,
        height: 58,
        content: '<p style="font-size:18px;">形如 y = ax^2 + bx + c。</p>',
      },
    ];

    const issues = auditSlideLayout(elements, { includeRichness: true });

    expect(issues).toContainEqual({
      type: 'unlabeled_visual_placeholder',
      detail:
        'Slide has a shape-based visual anchor without labels; replace abstract placeholders with a labeled diagram, image, chart, or formula',
    });
  });
});

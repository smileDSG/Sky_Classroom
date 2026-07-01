import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  enrichSlideElements,
  polishSlideElements,
} from '@/lib/generation/scene-content/slide-polish';
import { auditSlideLayout } from '@/lib/slides/agent/layout-guard-agent';

function overlaps(
  a: { left: number; top: number; width: number; height?: number },
  b: { left: number; top: number; width: number; height?: number },
): boolean {
  const aHeight = Number(a.height ?? 24);
  const bHeight = Number(b.height ?? 24);
  return !(
    a.left + a.width <= b.left ||
    a.left >= b.left + b.width ||
    a.top + aHeight <= b.top ||
    a.top >= b.top + bHeight
  );
}

describe('slide polish', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('removes stale richness overlays in playback-safe mode', () => {
    const elements = [
      {
        id: 'body',
        type: 'text',
        left: 120,
        top: 410,
        width: 700,
        height: 80,
        content: '<p style="font-size:18px;">Core lesson content</p>',
      },
      {
        id: 'polish_rich_index',
        type: 'text',
        left: 817,
        top: 88,
        width: 70,
        height: 18,
        content: '<p>LIVE LESSON</p>',
      },
      {
        id: 'polish_rich_strip',
        type: 'shape',
        left: 112,
        top: 462,
        width: 776,
        height: 34,
      },
    ];

    const polished = polishSlideElements(elements, { decorate: false });

    expect(polished.map((element) => element.id)).toEqual(['body']);
  });

  it('centers latex blocks and gives complex formulas enough room', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'formula',
          type: 'latex',
          left: 64,
          top: 430,
          width: 260,
          height: 42,
          latex: String.raw`\frac{\partial L}{\partial w}=\sum_{i=1}^{n}(wx_i+b-y_i)x_i`,
          align: 'left',
        },
      ],
      { decorate: false },
    );

    const formula = polished[0] as Record<string, unknown>;

    expect(formula.align).toBe('center');
    expect(formula.width).toBeGreaterThanOrEqual(760);
    expect(formula.height).toBeGreaterThanOrEqual(118);
    expect(formula.left).toBeCloseTo((1000 - Number(formula.width)) / 2);
    expect(Number(formula.top) + Number(formula.height)).toBeLessThanOrEqual(514.5);
  });

  it('normalizes three-column comparison rows onto a consistent grid', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'card-a',
          type: 'shape',
          left: 68,
          top: 112,
          width: 280,
          height: 52,
          fill: '#eef7ff',
        },
        {
          id: 'card-b',
          type: 'shape',
          left: 376,
          top: 120,
          width: 262,
          height: 48,
          fill: '#eef7ff',
        },
        {
          id: 'card-c',
          type: 'shape',
          left: 694,
          top: 104,
          width: 286,
          height: 62,
          fill: '#eef7ff',
        },
      ],
      { decorate: false },
    );

    const cards = ['card-a', 'card-b', 'card-c'].map(
      (id) => polished.find((element) => element.id === id)!,
    );
    const gaps = [
      cards[1].left - (cards[0].left + cards[0].width),
      cards[2].left - (cards[1].left + cards[1].width),
    ];

    expect(new Set(cards.map((card) => card.top)).size).toBe(1);
    expect(new Set(cards.map((card) => card.width)).size).toBe(1);
    expect(new Set(cards.map((card) => Number(card.height))).size).toBe(1);
    expect(gaps[0]).toBe(gaps[1]);
  });

  it('does not place enrichment overlays over occupied slide regions', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VITEST', '');

    const enriched = enrichSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 90,
          top: 80,
          width: 620,
          height: 60,
          content: '<p>Gradient descent</p>',
        },
        {
          id: 'bottom-content',
          type: 'latex',
          left: 160,
          top: 430,
          width: 680,
          height: 96,
          latex: String.raw`\theta_{t+1}=\theta_t-\eta\nabla J(\theta_t)`,
        },
      ],
      { keyPoints: ['step size', 'gradient direction'] },
    );

    const ids = enriched.map((element) => element.id);

    expect(ids).not.toContain('polish_rich_index');
    expect(ids).not.toContain('polish_rich_index_bg');
    expect(ids).not.toContain('polish_rich_strip');
    expect(ids).not.toContain('polish_rich_strip_text');
  });

  it('uses clean editorial enrichment instead of colored strips or side cards', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('VITEST', '');

    const enriched = enrichSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 105,
          top: 78,
          width: 790,
          height: 70,
          content: '<p style="font-size:34px;">Gradient descent</p>',
        },
        {
          id: 'body',
          type: 'text',
          left: 570,
          top: 220,
          width: 320,
          height: 94,
          content: '<p style="font-size:18px;">Step size controls each update.</p>',
        },
      ],
      { keyPoints: ['step size', 'gradient direction', 'loss surface'] },
    );

    const ids = enriched.map((element) => element.id);
    const largeFilledBoxes = enriched.filter((element) => {
      const fill = (element as Record<string, unknown>).fill;
      const height = Number(element.height ?? 0);
      return (
        typeof fill === 'string' &&
        element.type !== 'line' &&
        element.width * height >= 10000 &&
        height > 24
      );
    });

    expect(ids).toContain('polish_rich_title_rule');
    expect(ids).not.toContain('polish_rich_strip');
    expect(ids).not.toContain('polish_rich_side_card');
    expect(largeFilledBoxes).toHaveLength(0);
  });

  it('rebuilds weak quadratic pages into a dense safe teaching layout', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 105,
          top: 78,
          width: 790,
          height: 70,
          content:
            '<p style="font-size:34px;">\u4e8c\u6b21\u51fd\u6570\u7684\u56fe\u50cf\u2014\u2014\u629b\u7269\u7ebf</p>',
        },
        {
          id: 'definition',
          type: 'text',
          left: 590,
          top: 205,
          width: 300,
          height: 94,
          content:
            '<p style="font-size:18px;">\u5f62\u5982 y = ax^2 + bx + c \u7684\u51fd\u6570\u3002</p>',
        },
      ],
      {
        title: '\u4e8c\u6b21\u51fd\u6570\u7684\u56fe\u50cf\u2014\u2014\u629b\u7269\u7ebf',
        keyPoints: [
          '\u5f62\u5982 y = ax^2 + bx + c',
          '\u56fe\u50cf\u662f\u629b\u7269\u7ebf',
          '\u9876\u70b9\u51b3\u5b9a\u5f00\u53e3\u4f4d\u7f6e',
        ],
      },
    );

    const ids = polished.map((element) => element.id);
    const issueTypes = auditSlideLayout(polished, { includeRichness: true }).map(
      (issue) => issue.type,
    );

    expect(ids).toContain('polish_quad_parabola');
    expect(ids).toContain('polish_quad_symmetry_axis');
    expect(ids).toContain('polish_quad_vertex_dot');
    expect(ids).toContain('polish_quad_notes_title');
    expect(ids).toContain('polish_quad_step_1_text');
    expect(ids).toContain('polish_quad_step_2_text');
    expect(ids).toContain('polish_quad_step_3_text');
    expect(ids).toContain('polish_quad_takeaway');
    expect(ids).not.toContain('polish_visual_node_1');
    expect(polished.length).toBeGreaterThanOrEqual(28);
    expect(issueTypes).not.toContain('unsafe_bottom_zone');
    expect(issueTypes).not.toContain('readable_element_overlap');
    expect(issueTypes).not.toContain('missing_visual_anchor');
    expect(issueTypes).not.toContain('low_content_richness');
  });

  it('adds labels to generic fallback visuals so they are not blank placeholders', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 105,
          top: 78,
          width: 790,
          height: 70,
          content: '<p style="font-size:34px;">Rust ownership model</p>',
        },
      ],
      {
        title: 'Rust ownership model',
        keyPoints: ['Owner controls value', 'Borrow reads data', 'Lifetime prevents dangling'],
      },
    );

    const labels = polished.filter(
      (element) => element.id?.startsWith('polish_visual_label') && element.type === 'text',
    );
    const labelText = labels
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labelText).toContain('Owner controls value');
    expect(labelText).toContain('Borrow reads data');
    expect(labelText).toContain('Lifetime prevents');
  });

  it('removes thin decorative rules that cover readable bottom text', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'bottom-rule',
          type: 'shape',
          left: 60,
          top: 480,
          width: 880,
          height: 8,
        },
        {
          id: 'bottom-summary',
          type: 'text',
          left: 105,
          top: 472.5,
          width: 790,
          height: 42,
          content:
            '<p style="font-size:18px;">核心思想：边界上的线积分转化为内部区域上的二重积分</p>',
        },
      ],
      { decorate: false },
    );

    expect(polished.map((element) => element.id)).toEqual(['bottom-summary']);
  });

  it('compacts title whitespace and stacks overlapping bottom text rows', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 105,
          top: 78,
          width: 790,
          height: 70,
          content: '<p style="font-size:34px;">From physics to Green theorem</p>',
        },
        {
          id: 'title-rule',
          type: 'shape',
          left: 105,
          top: 154,
          width: 790,
          height: 8,
        },
        {
          id: 'core-summary',
          type: 'text',
          left: 105,
          top: 472.5,
          width: 790,
          height: 42,
          content:
            '<p style="font-size:18px;">Core idea: boundary line integral becomes area integral over the interior region</p>',
        },
        {
          id: 'learning-goal',
          type: 'text',
          left: 590,
          top: 462,
          width: 240,
          height: 52.5,
          content: '<p style="font-size:16px;">Learning goal: understand the geometry</p>',
        },
      ],
      { decorate: false },
    );

    const title = polished.find((element) => element.id === 'title')!;
    const core = polished.find((element) => element.id === 'core-summary')!;
    const goal = polished.find((element) => element.id === 'learning-goal')!;

    expect(title.top).toBe(48);
    expect(core.left).toBe(105);
    expect(goal.left).toBe(105);
    expect(core.width).toBe(790);
    expect(goal.width).toBe(790);
    expect(overlaps(core, goal)).toBe(false);
    expect(core.top).toBeLessThan(goal.top);
  });

  it('keeps formulas, right explanation panels, and bottom tables from overlapping', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'formula',
          type: 'latex',
          left: 120,
          top: 180,
          width: 760,
          height: 118,
          latex: String.raw`\oint_C (P\,dx+Q\,dy)=\iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)dA`,
          align: 'center',
        },
        {
          id: 'symbol-title',
          type: 'text',
          left: 610,
          top: 193,
          width: 310,
          height: 50,
          content: '<p style="font-size:18px;">符号说明</p>',
        },
        {
          id: 'symbol-body',
          type: 'text',
          left: 610,
          top: 244,
          width: 310,
          height: 166,
          content: '<p style="font-size:16px;">• C：正向封闭曲线<br/>• D：曲线所围区域</p>',
        },
        {
          id: 'comparison',
          type: 'table',
          left: 105,
          top: 364.5,
          width: 790,
          height: 150,
        },
      ],
      { decorate: false },
    );

    const formula = polished.find((element) => element.id === 'formula')!;
    const symbolBody = polished.find((element) => element.id === 'symbol-body')!;

    expect(formula.left + formula.width).toBeLessThanOrEqual(578);
    expect(Number(symbolBody.top) + Number(symbolBody.height)).toBeLessThanOrEqual(346.5);
  });

  it('does not move numbered body items into the auxiliary bottom rows', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'body-third',
          type: 'text',
          left: 550,
          top: 390,
          width: 370,
          height: 77,
          content:
            '<p style="font-size:18px;"><strong>3. Verify conservative fields</strong><br/>Curl is zero, so the integral is path independent</p>',
        },
        {
          id: 'core-summary',
          type: 'text',
          left: 80,
          top: 472.5,
          width: 840,
          height: 42,
          content:
            '<p style="font-size:18px;">Core idea: region properties and boundary properties transform into each other</p>',
        },
        {
          id: 'core-bg',
          type: 'shape',
          left: 60,
          top: 474.5,
          width: 880,
          height: 40,
        },
      ],
      { decorate: false },
    );

    const body = polished.find((element) => element.id === 'body-third')!;
    const summary = polished.find((element) => element.id === 'core-summary')!;
    const summaryBg = polished.find((element) => element.id === 'core-bg')!;

    expect(body.left).toBe(550);
    expect(body.width).toBe(370);
    expect(body.top).toBeLessThan(430);
    expect(summary.top).toBe(470.5);
    expect(summary.height).toBe(44);
    expect(summaryBg.top).toBe(summary.top);
    expect(overlaps(body, summary)).toBe(false);
  });

  it('moves short table captions above the table header without overlap', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'caption',
          type: 'text',
          left: 105,
          top: 340,
          width: 790,
          height: 56,
          content: '<p style="font-size:22px;"><strong>Correct usage vs wrong usage</strong></p>',
        },
        {
          id: 'comparison-table',
          type: 'table',
          left: 105,
          top: 374.5,
          width: 790,
          height: 140,
        },
      ],
      { decorate: false },
    );

    const caption = polished.find((element) => element.id === 'caption')!;
    const table = polished.find((element) => element.id === 'comparison-table')!;

    expect(caption.left).toBe(table.left);
    expect(caption.width).toBe(table.width);
    expect(caption.height).toBe(36);
    expect(Number(caption.top) + Number(caption.height)).toBeLessThanOrEqual(table.top - 8);
    expect(overlaps(caption, table)).toBe(false);
  });

  it('keeps card body summaries in place and reserves bottom rows for real footer notes', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'card-summary',
          type: 'text',
          left: 125,
          top: 350,
          width: 380,
          height: 102,
          content:
            '<p style="font-size:18px;"><strong>Core idea:</strong><br/>Boundary and interior are linked by circulation</p>',
        },
        {
          id: 'next-step',
          type: 'text',
          left: 125,
          top: 472.5,
          width: 790,
          height: 42,
          content:
            '<p style="font-size:18px;">Next: study vector calculus chapters and related exercises</p>',
        },
        {
          id: 'footer-bg',
          type: 'shape',
          left: 105,
          top: 474.5,
          width: 830,
          height: 40,
        },
      ],
      { decorate: false },
    );

    const cardSummary = polished.find((element) => element.id === 'card-summary')!;
    const nextStep = polished.find((element) => element.id === 'next-step')!;
    const footerBg = polished.find((element) => element.id === 'footer-bg')!;

    expect(cardSummary.left).toBe(125);
    expect(cardSummary.width).toBe(380);
    expect(cardSummary.top).toBeLessThan(430);
    expect(nextStep.left).toBe(105);
    expect(nextStep.top).toBe(470.5);
    expect(nextStep.height).toBe(44);
    expect(footerBg.top).toBe(nextStep.top);
    expect(Number(nextStep.top) + Number(nextStep.height)).toBeLessThanOrEqual(514.5);
    expect(overlaps(cardSummary, nextStep)).toBe(false);
  });

  it('densifies sparse text-only slides into a two-band layout with a visual anchor', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 90,
          top: 78,
          width: 760,
          height: 64,
          content: '<p style="font-size:32px;"><strong>三次函数建模回顾</strong></p>',
        },
        {
          id: 'concept',
          type: 'text',
          left: 145,
          top: 286,
          width: 320,
          height: 70,
          content:
            '<p style="font-size:18px;"><strong>模型入口</strong><br/>先识别最高次数项。</p>',
        },
        {
          id: 'method',
          type: 'text',
          left: 535,
          top: 356,
          width: 320,
          height: 70,
          content: '<p style="font-size:18px;"><strong>分析方法</strong><br/>用导数判断走势。</p>',
        },
      ],
      {
        title: '三次函数建模回顾',
        keyPoints: ['最高次数项', '导数判断走势', '草图验证结果'],
        decorate: false,
      },
    );

    const concept = polished.find((element) => element.id === 'concept')!;
    const method = polished.find((element) => element.id === 'method')!;

    expect(polished.some((element) => element.id?.startsWith('polish_density_anchor_'))).toBe(true);
    expect(concept.left).toBeGreaterThanOrEqual(430);
    expect(method.left).toBe(concept.left);
    expect(concept.top).toBeLessThanOrEqual(205);
    expect(method.top).toBeGreaterThan(concept.top);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('expands sparse summary notes into a wider bottom information band', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 90,
          top: 70,
          width: 760,
          height: 64,
          content: '<p style="font-size:32px;"><strong>课堂总结</strong></p>',
        },
        {
          id: 'main-point',
          type: 'text',
          left: 160,
          top: 230,
          width: 420,
          height: 70,
          content: '<p style="font-size:18px;">先抓住函数结构，再决定图像走势。</p>',
        },
        {
          id: 'summary-note',
          type: 'text',
          left: 380,
          top: 392,
          width: 300,
          height: 42,
          content: '<p style="font-size:18px;">课堂小结：公式、导数、草图三步一起看。</p>',
        },
      ],
      { title: '课堂总结', decorate: false },
    );

    const note = polished.find((element) => element.id === 'summary-note')!;

    expect(note.left).toBe(105);
    expect(note.width).toBe(790);
    expect(Number(note.height)).toBeGreaterThanOrEqual(56);
    expect(Number(note.top) + Number(note.height)).toBeLessThanOrEqual(514.5);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('shrinks stacked readable blocks in the same column so they do not overlap', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'formula',
          type: 'latex',
          left: 120,
          top: 220,
          width: 398,
          height: 118,
          latex: String.raw`\oint_C P\,dx + Q\,dy = \iint_D \left( \frac{\partial Q}{\partial x} - \frac{\partial P}{\partial y} \right)dA`,
        },
        {
          id: 'note',
          type: 'text',
          left: 80,
          top: 320,
          width: 400,
          height: 94,
          content:
            '<p style="font-size:18px;">Connection between the line integral and the double integral.</p>',
        },
      ],
      { decorate: false },
    );

    const formula = polished.find((element) => element.id === 'formula')!;
    const note = polished.find((element) => element.id === 'note')!;

    expect(Number(formula.top) + Number(formula.height)).toBeLessThanOrEqual(note.top - 8);
    expect(overlaps(formula, note)).toBe(false);
  });

  it('shrinks repeated right-column explanation rows instead of letting them cover each other', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'row-1',
          type: 'text',
          left: 603,
          top: 238,
          width: 310,
          height: 72,
          content:
            '<p style="font-size:18px;">Stokes theorem<br/>Surface integral to boundary integral</p>',
        },
        {
          id: 'row-2',
          type: 'text',
          left: 603,
          top: 298,
          width: 310,
          height: 72,
          content: '<p style="font-size:18px;">Divergence theorem<br/>Volume to surface flux</p>',
        },
        {
          id: 'row-3',
          type: 'text',
          left: 603,
          top: 358,
          width: 310,
          height: 72,
          content:
            '<p style="font-size:18px;">Unified viewpoint<br/>All are generalized Stokes</p>',
        },
      ],
      { decorate: false },
    );

    const row1 = polished.find((element) => element.id === 'row-1')!;
    const row2 = polished.find((element) => element.id === 'row-2')!;
    const row3 = polished.find((element) => element.id === 'row-3')!;

    expect(overlaps(row1, row2)).toBe(false);
    expect(overlaps(row2, row3)).toBe(false);
    expect(Number(row1.top) + Number(row1.height)).toBeLessThanOrEqual(row2.top - 8);
    expect(Number(row2.top) + Number(row2.height)).toBeLessThanOrEqual(row3.top - 8);
  });

  it('keeps wide bottom takeaway strips from covering main content', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'left-panel',
          type: 'shape',
          left: 110,
          top: 180,
          width: 410,
          height: 320,
          fill: '#e8f4ff',
        },
        {
          id: 'left-body',
          type: 'text',
          left: 150,
          top: 390,
          width: 330,
          height: 94,
          content:
            '<p style="font-size:20px;">Cargo / Rustfmt / Clippy toolchain<br/>Active crate ecosystem</p>',
        },
        {
          id: 'right-panel',
          type: 'shape',
          left: 570,
          top: 198,
          width: 330,
          height: 292,
          fill: '#ffffff',
        },
        {
          id: 'right-body',
          type: 'text',
          left: 610,
          top: 410,
          width: 250,
          height: 76,
          content: '<p style="font-size:20px;">性能 = C/C++，安全 > C/C++</p>',
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
      ],
      { decorate: false },
    );

    const strip = polished.find((element) => element.id === 'domain-strip')!;
    const leftBody = polished.find((element) => element.id === 'left-body')!;
    const rightBody = polished.find((element) => element.id === 'right-body')!;
    const leftPanel = polished.find((element) => element.id === 'left-panel')!;
    const rightPanel = polished.find((element) => element.id === 'right-panel')!;

    expect(overlaps(strip, leftBody)).toBe(false);
    expect(overlaps(strip, rightBody)).toBe(false);
    expect(overlaps(strip, leftPanel)).toBe(false);
    expect(overlaps(strip, rightPanel)).toBe(false);
  });

  it('keeps project skeleton callouts from covering setup steps', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'install-panel',
          type: 'shape',
          left: 193,
          top: 210,
          width: 522,
          height: 330,
          fill: '#e8f4ff',
        },
        {
          id: 'verify-title',
          type: 'text',
          left: 270,
          top: 455,
          width: 420,
          height: 76,
          content: '<p style="font-size:24px;"><strong>验证安装</strong></p>',
        },
        {
          id: 'command-row',
          type: 'text',
          left: 230,
          top: 504,
          width: 430,
          height: 52,
          content: '<p style="font-size:18px;">运行: rustc --version / cargo --version</p>',
        },
        {
          id: 'tip-callout',
          type: 'text',
          left: 193,
          top: 428,
          width: 900,
          height: 78,
          fill: '#172033',
          content:
            '<p style="font-size:18px; color:#ffffff;">💡 项目骨架：main.rs 为程序入口，Cargo.toml 管理依赖</p>',
          defaultColor: '#ffffff',
        },
      ],
      { decorate: false },
    );

    const callout = polished.find((element) => element.id === 'tip-callout')!;
    const verifyTitle = polished.find((element) => element.id === 'verify-title')!;
    const commandRow = polished.find((element) => element.id === 'command-row')!;
    const installPanel = polished.find((element) => element.id === 'install-panel')!;

    expect(overlaps(callout, verifyTitle)).toBe(false);
    expect(overlaps(callout, commandRow)).toBe(false);
    expect(overlaps(callout, installPanel)).toBe(false);
  });

  it('keeps expanded text inside its background cards', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'code-card',
          type: 'shape',
          left: 130,
          top: 380,
          width: 370,
          height: 80,
          fill: '#e3edf7',
        },
        {
          id: 'code-text',
          type: 'text',
          left: 140,
          top: 390,
          width: 350,
          height: 64,
          content:
            '<p style="font-size:15px;"># create empty list</p><p style="font-size:15px;">my_list = []</p><p style="font-size:15px;">my_list.append("welcome")  # add item</p>',
        },
        {
          id: 'methods-card',
          type: 'shape',
          left: 552,
          top: 336.5,
          width: 400,
          height: 148,
          fill: '#f9f9f9',
        },
        {
          id: 'methods-text',
          type: 'text',
          left: 575,
          top: 453,
          width: 360,
          height: 49,
          content:
            '<p style="font-size:15px;"><strong>append(item)</strong> · insert(index, item)<br/>remove(item) · sort() · pop(index)</p>',
        },
      ],
      { decorate: false },
    );

    const codeCard = polished.find((element) => element.id === 'code-card')!;
    const codeText = polished.find((element) => element.id === 'code-text')!;
    const methodsCard = polished.find((element) => element.id === 'methods-card')!;
    const methodsText = polished.find((element) => element.id === 'methods-text')!;

    expect(codeCard.top).toBeLessThanOrEqual(codeText.top);
    expect(Number(codeCard.top) + Number(codeCard.height)).toBeGreaterThanOrEqual(
      Number(codeText.top) + Number(codeText.height),
    );
    expect(methodsCard.top).toBeLessThanOrEqual(methodsText.top);
    expect(Number(methodsCard.top) + Number(methodsCard.height)).toBeGreaterThanOrEqual(
      Number(methodsText.top) + Number(methodsText.height),
    );
  });

  it('raises small labels and low-contrast text on generated lesson diagrams', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'main-panel',
          type: 'shape',
          left: 100,
          top: 162,
          width: 420,
          height: 280,
          fill: '#f0f4fc',
        },
        {
          id: 'if-bg',
          type: 'shape',
          left: 140,
          top: 182,
          width: 160,
          height: 56,
          fill: '#2f80d1',
        },
        {
          id: 'if-label',
          type: 'text',
          left: 160,
          top: 194,
          width: 120,
          height: 53,
          content:
            '<p style="font-size:18px; color:#ffffff; text-align:center;"><strong>if condition</strong></p>',
          defaultColor: '#ffffff',
        },
        {
          id: 'true-bg',
          type: 'shape',
          left: 205,
          top: 258,
          width: 130,
          height: 46,
          fill: '#27ae60',
        },
        {
          id: 'true-label',
          type: 'text',
          left: 220,
          top: 268,
          width: 100,
          height: 50,
          content: '<p style="font-size:16px; color:#ffffff; text-align:center;">True -> run</p>',
          defaultColor: '#ffffff',
        },
        {
          id: 'else-bg',
          type: 'shape',
          left: 140,
          top: 332,
          width: 160,
          height: 56,
          fill: '#8e44ad',
        },
        {
          id: 'after-note',
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
          id: 'example-bg',
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
          content: '<p style="font-size:16px; color:#2f80d1;">age &gt;= 18 -> allowed</p>',
          defaultColor: '#2f80d1',
        },
      ],
      { decorate: false },
    );

    const readabilityIssues = auditSlideLayout(polished).filter((issue) =>
      ['text_too_small', 'low_text_contrast'].includes(issue.type),
    );

    expect(readabilityIssues).toEqual([]);
  });

  it('rewrites crowded quadratic equation relation slides into the reference card layout', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 110,
          top: 68,
          width: 620,
          height: 58,
          content: '<p style="font-size:32px;"><strong>二次函数与一元二次方程的联系</strong></p>',
        },
        {
          id: 'formula',
          type: 'latex',
          left: 300,
          top: 260,
          width: 420,
          height: 70,
          latex: 'y=ax^2+bx+c \\quad ax^2+bx+c=0',
        },
        {
          id: 'floating-note',
          type: 'text',
          left: 300,
          top: 365,
          width: 470,
          height: 42,
          content:
            '<p style="font-size:16px;">二次函数与 x 轴的交点横坐标 = 一元二次方程的实数根</p>',
        },
        {
          id: 'card-a',
          type: 'shape',
          left: 72,
          top: 426,
          width: 348,
          height: 188,
          fill: '#e8f5ee',
        },
        {
          id: 'card-b',
          type: 'shape',
          left: 444,
          top: 426,
          width: 348,
          height: 188,
          fill: '#fff7dc',
        },
        {
          id: 'card-c',
          type: 'shape',
          left: 817,
          top: 426,
          width: 348,
          height: 188,
          fill: '#fde8e8',
        },
      ],
      {
        decorate: false,
        title: '二次函数与一元二次方程的联系',
        keyPoints: ['判别式 Δ', '实数根', 'x 轴交点'],
      },
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_relation_'))).toBe(true);
    expect(polished.some((element) => element.id === 'floating-note')).toBe(false);
    expect(polished.every((element) => element.left >= 48)).toBe(true);
    expect(polished.every((element) => element.left + element.width <= 952)).toBe(true);
    expect(polished.every((element) => element.top + Number(element.height ?? 0) <= 514.5)).toBe(
      true,
    );
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rewrites crowded quadratic vertex-form slides into the reference definition layout', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 140,
          top: 86,
          width: 620,
          height: 58,
          content: '<p style="font-size:32px;"><strong>二次函数的顶点式</strong></p>',
        },
        {
          id: 'definition',
          type: 'text',
          left: 180,
          top: 210,
          width: 240,
          height: 42,
          content: '<p style="font-size:20px;"><strong>顶点式定义</strong></p>',
        },
        {
          id: 'example-bg',
          type: 'shape',
          left: 730,
          top: 226,
          width: 496,
          height: 260,
          fill: '#eaf4fb',
        },
        {
          id: 'table',
          type: 'table',
          left: 136,
          top: 446,
          width: 1090,
          height: 110,
          outline: { color: '#cccccc', width: 1, style: 'solid' },
          colWidths: [0.2, 0.4, 0.4],
          cellMinHeight: 44,
          data: [],
        },
        {
          id: 'formula-over-table',
          type: 'latex',
          left: 350,
          top: 430,
          width: 460,
          height: 118,
          latex: 'y=a(x-h)^2+k',
        },
      ],
      {
        decorate: false,
        title: '二次函数的顶点式',
        keyPoints: ['顶点式：y = a(x-h)^2 + k', '顶点为 (h, k)', '对称轴为 x = h'],
      },
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_vertex_'))).toBe(true);
    expect(polished.some((element) => element.id === 'table')).toBe(false);
    expect(polished.some((element) => element.id === 'formula-over-table')).toBe(false);
    expect(polished.every((element) => element.left >= 48)).toBe(true);
    expect(polished.every((element) => element.left + element.width <= 952)).toBe(true);
    expect(polished.every((element) => element.top + Number(element.height ?? 0) <= 514.5)).toBe(
      true,
    );
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('repairs stale vertex reference slides when the title is about parameters c and b', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'polish_ref_vertex_title',
          type: 'text',
          left: 82,
          top: 42,
          width: 836,
          height: 58,
          content: '<p style="font-size:34px;"><strong>探索参数c与b</strong></p>',
        },
        {
          id: 'polish_ref_vertex_subtitle',
          type: 'text',
          left: 82,
          top: 122,
          width: 836,
          height: 38,
          content: '<p style="font-size:22px;">从顶点式直接读出顶点、对称轴和图像平移</p>',
        },
        {
          id: 'polish_ref_vertex_definition_title',
          type: 'text',
          left: 112,
          top: 216,
          width: 320,
          height: 36,
          content: '<p style="font-size:24px;"><strong>顶点式定义</strong></p>',
        },
      ],
      { title: '探索参数c与b', decorate: false },
    );

    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');
    const byId = (id: string) => {
      const element = polished.find((item) => item.id === id);
      expect(element).toBeTruthy();
      return element as NonNullable<(typeof polished)[number]>;
    };
    const cKey = byId('polish_ref_quad_coeff_c_key');
    const cBody = byId('polish_ref_quad_coeff_c_body');
    const bKey = byId('polish_ref_quad_coeff_b_key');
    const bBody = byId('polish_ref_quad_coeff_b_body');
    const formula = byId('polish_ref_quad_coeff_formula');
    const formulaPanel = byId('polish_ref_quad_coeff_formula_panel');

    expect(polished.some((element) => element.id?.startsWith('polish_ref_quad_coeff_'))).toBe(true);
    expect(combinedText).toContain('参数 c');
    expect(combinedText).toContain('参数 b');
    expect(combinedText).toContain('x = -');
    expect(combinedText).not.toContain('顶点式定义');
    expect(String(cKey.content)).toContain('font-size:24px');
    expect(String(cBody.content)).toContain('font-size:20px');
    expect(cBody.top).toBeLessThanOrEqual(354);
    expect(String(bKey.content)).toContain('font-size:24px');
    expect(String(bKey.content)).not.toContain('inline-block');
    expect(String(bBody.content)).toContain('font-size:20px');
    expect(bBody.top).toBeLessThanOrEqual(354);
    expect(String(formula.content)).toContain('font-size:23px');
    expect(formula.top).toBeLessThanOrEqual(440);
    expect(Number(formulaPanel.height ?? 0)).toBeGreaterThanOrEqual(86);
    expect(Number(formulaPanel.height ?? 0)).toBeLessThanOrEqual(90);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rewrites crowded Python variable/data-type pages into a stable reference layout', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>变量与数据类型</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content:
            '<p style="font-size:20px;">理解变量的概念、命名规则及 Python 中的常见数据类型</p>',
        },
        {
          id: 'variable-heading',
          type: 'text',
          left: 60,
          top: 208,
          width: 880,
          height: 44,
          content: '<p style="font-size:20px;"><strong>什么是变量？</strong></p>',
        },
        {
          id: 'variable-body',
          type: 'text',
          left: 60,
          top: 260,
          width: 880,
          height: 64,
          content: '<p style="font-size:18px;">• 变量是存储数据的“容器”，其值可以随时改变</p>',
        },
        {
          id: 'naming-heading',
          type: 'text',
          left: 60,
          top: 338,
          width: 880,
          height: 44,
          content: '<p style="font-size:20px;"><strong>变量命名规则</strong></p>',
        },
        {
          id: 'naming-body',
          type: 'text',
          left: 60,
          top: 390,
          width: 880,
          height: 36.5,
          content:
            '<p style="font-size:18px;">• 由字母、数字、下划线组成</p><p style="font-size:18px;">• 不能以数字开头</p><p style="font-size:18px;">• 区分大小写，如 name 和 Name 是不同的变量</p>',
        },
        {
          id: 'data-types-heading',
          type: 'text',
          left: 80,
          top: 435,
          width: 160,
          height: 42,
          content: '<p style="font-size:18px;"><strong>常见数据类型</strong></p>',
        },
        ...[60, 280, 500, 720].map((left, index) => ({
          id: `type-card-${index}`,
          type: 'shape',
          left,
          top: 423,
          width: 200,
          height: 92,
          fill: ['#dbeafe', '#dcfce7', '#fef3c7', '#fce4ec'][index],
        })),
        {
          id: 'int-label',
          type: 'text',
          left: 300,
          top: 435,
          width: 160,
          height: 42,
          content: '<p style="font-size:18px; text-align: center;">整数 (int)</p>',
        },
        {
          id: 'float-label',
          type: 'text',
          left: 520,
          top: 435,
          width: 160,
          height: 42,
          content: '<p style="font-size:18px; text-align: center;">浮点数 (float)</p>',
        },
        {
          id: 'str-label',
          type: 'text',
          left: 740,
          top: 435,
          width: 160,
          height: 42,
          content: '<p style="font-size:18px; text-align: center;">字符串 (str)</p>',
        },
        {
          id: 'bool-label',
          type: 'text',
          left: 80,
          top: 469,
          width: 160,
          height: 30,
          content: '<p style="font-size:18px; text-align: center;">布尔值 (bool)</p>',
        },
        {
          id: 'type-heading',
          type: 'text',
          left: 80,
          top: 469,
          width: 160,
          height: 30,
          content: '<p style="font-size:18px;"><strong>查看变量类型：type()</strong></p>',
        },
        {
          id: 'type-overlay',
          type: 'shape',
          left: 60,
          top: 456.5,
          width: 880,
          height: 56,
          fill: '#f8f9fa',
        },
        {
          id: 'type-example',
          type: 'text',
          left: 80,
          top: 469,
          width: 160,
          height: 30,
          content:
            '<p style="font-size:18px; color:#172033;"><code>type(42)</code> → <code>&lt;class \'int\'&gt;</code></p>',
        },
      ],
      { title: '变量与数据类型', decorate: false },
    );

    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');
    const cards = polished.filter((element) =>
      element.id?.startsWith('polish_ref_python_vars_type_card_'),
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_python_vars_'))).toBe(
      true,
    );
    expect(polished.some((element) => element.id === 'type-overlay')).toBe(false);
    expect(cards).toHaveLength(4);
    expect(new Set(cards.map((element) => element.top))).toHaveProperty('size', 1);
    expect(combinedText).toContain('变量：数据容器');
    expect(combinedText).toContain('命名规则');
    expect(combinedText).toContain('type(42)');
    expect(combinedText).toContain('布尔 bool');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rewrites generic text-only generated pages into a canonical template layout', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>条件语句与循环</strong></p>',
        },
        {
          id: 'subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">理解程序如何根据条件分支，并重复执行任务</p>',
        },
        {
          id: 'text_if_heading',
          type: 'text',
          left: 78,
          top: 216,
          width: 760,
          height: 42,
          content: '<p style="font-size:20px;"><strong>条件语句</strong></p>',
        },
        {
          id: 'text_if_body',
          type: 'text',
          left: 76,
          top: 260,
          width: 760,
          height: 58,
          content: '<p style="font-size:18px;">if 根据 True 或 False 选择执行不同代码块。</p>',
        },
        {
          id: 'text_loop_heading',
          type: 'text',
          left: 74,
          top: 340,
          width: 760,
          height: 42,
          content: '<p style="font-size:20px;"><strong>循环语句</strong></p>',
        },
        {
          id: 'text_loop_body',
          type: 'text',
          left: 76,
          top: 386,
          width: 760,
          height: 58,
          content: '<p style="font-size:18px;">for 遍历序列，while 在条件成立时持续执行。</p>',
        },
        {
          id: 'shape_bad_overlay',
          type: 'shape',
          left: 60,
          top: 438,
          width: 880,
          height: 66,
          fill: '#f8f9fa',
        },
        {
          id: 'text_bad_bottom',
          type: 'text',
          left: 88,
          top: 454,
          width: 240,
          height: 38,
          content: '<p style="font-size:18px;">口诀：先判断，再重复</p>',
        },
      ],
      { title: '条件语句与循环', decorate: false },
    );

    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(polished.some((element) => element.id?.startsWith('polish_ref_canonical_'))).toBe(true);
    expect(polished.some((element) => element.id === 'shape_bad_overlay')).toBe(false);
    expect(combinedText).toContain('条件语句');
    expect(combinedText).toContain('循环语句');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rotates generic generated text pages through multiple stable canonical layouts', () => {
    const makeElements = (title: string) => [
      {
        id: 'text_title',
        type: 'text',
        left: 60,
        top: 48,
        width: 880,
        height: 68,
        content: `<p style="font-size:32px;"><strong>${title}</strong></p>`,
      },
      {
        id: 'text_subtitle',
        type: 'text',
        left: 60,
        top: 124,
        width: 880,
        height: 56,
        content: '<p style="font-size:20px;">整理概念、方法、例子与课堂检查点</p>',
      },
      {
        id: 'text_a_heading',
        type: 'text',
        left: 70,
        top: 216,
        width: 760,
        height: 42,
        content: '<p style="font-size:20px;"><strong>概念入口</strong></p>',
      },
      {
        id: 'text_a_body',
        type: 'text',
        left: 70,
        top: 258,
        width: 760,
        height: 58,
        content: '<p style="font-size:18px;">先把本页要解决的问题说清楚。</p>',
      },
      {
        id: 'text_b_heading',
        type: 'text',
        left: 70,
        top: 326,
        width: 760,
        height: 42,
        content: '<p style="font-size:20px;"><strong>方法抓手</strong></p>',
      },
      {
        id: 'text_b_body',
        type: 'text',
        left: 70,
        top: 368,
        width: 760,
        height: 58,
        content: '<p style="font-size:18px;">再用一个稳定步骤连接输入与输出。</p>',
      },
      {
        id: 'text_c_heading',
        type: 'text',
        left: 70,
        top: 438,
        width: 760,
        height: 36,
        content: '<p style="font-size:20px;"><strong>课堂检查</strong></p>',
      },
      {
        id: 'text_c_body',
        type: 'text',
        left: 70,
        top: 474,
        width: 760,
        height: 34,
        content: '<p style="font-size:18px;">最后让学生复述判断依据。</p>',
      },
    ];

    const variants = [1, 2, 3, 4, 5].map((order) => {
      const polished = polishSlideElements(makeElements(`普通文本页 ${order}`), {
        title: `普通文本页 ${order}`,
        keyPoints: ['概念入口', '方法抓手', '课堂检查'],
        order,
        decorate: false,
      });
      const variantId = polished.find((element) =>
        /^polish_ref_canonical_v\d+_/.test(element.id ?? ''),
      )?.id;

      expect(variantId).toBeTruthy();
      expect(auditSlideLayout(polished)).toEqual([]);
      return variantId?.match(/polish_ref_canonical_v\d+/)?.[0];
    });

    expect(new Set(variants)).toHaveProperty('size', 5);
  });

  it('adds page-order visual signatures across canonical text pages', () => {
    const makeElements = (title: string) => [
      {
        id: 'text_title',
        type: 'text',
        left: 60,
        top: 48,
        width: 880,
        height: 68,
        content: `<p style="font-size:32px;"><strong>${title}</strong></p>`,
      },
      {
        id: 'text_subtitle',
        type: 'text',
        left: 60,
        top: 124,
        width: 880,
        height: 56,
        content: '<p style="font-size:20px;">Concept, method, example, and classroom check</p>',
      },
      {
        id: 'text_a_heading',
        type: 'text',
        left: 70,
        top: 216,
        width: 760,
        height: 42,
        content: '<p style="font-size:20px;"><strong>Entry</strong></p>',
      },
      {
        id: 'text_a_body',
        type: 'text',
        left: 70,
        top: 258,
        width: 760,
        height: 58,
        content: '<p style="font-size:18px;">Clarify the problem for this page.</p>',
      },
      {
        id: 'text_b_heading',
        type: 'text',
        left: 70,
        top: 326,
        width: 760,
        height: 42,
        content: '<p style="font-size:20px;"><strong>Method</strong></p>',
      },
      {
        id: 'text_b_body',
        type: 'text',
        left: 70,
        top: 368,
        width: 760,
        height: 58,
        content: '<p style="font-size:18px;">Connect the input and output with stable steps.</p>',
      },
    ];

    const visualSignatures = [1, 2, 3, 4, 5, 6].map((order) => {
      const polished = polishSlideElements(makeElements(`Text page ${order}`), {
        title: `Text page ${order}`,
        keyPoints: ['Entry', 'Method', 'Check'],
        order,
        decorate: false,
      });
      const visualId = polished.find((element) => element.id?.includes('_visual_'))?.id;

      expect(visualId).toBeTruthy();
      expect(auditSlideLayout(polished)).toEqual([]);
      return visualId?.replace(/^.*?_visual_/, 'visual_');
    });

    expect(new Set(visualSignatures)).toHaveProperty('size', 6);
  });

  it('keeps canonical focus-list content specific instead of truncating it into generic points', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>核心概念：文档、集合与数据库</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">MongoDB 的逻辑结构</p>',
        },
        {
          id: 'text_a',
          type: 'text',
          left: 70,
          top: 216,
          width: 760,
          height: 48,
          content: '<p style="font-size:18px;">集合 (Collection)：相当于关系数据库中的表</p>',
        },
        {
          id: 'text_b',
          type: 'text',
          left: 70,
          top: 286,
          width: 760,
          height: 48,
          content: '<p style="font-size:18px;">数据库 (Database)：多个集合的逻辑容器</p>',
        },
        {
          id: 'text_c',
          type: 'text',
          left: 70,
          top: 356,
          width: 760,
          height: 48,
          content: '<p style="font-size:18px;">示例：一个 users 集合保存用户文档</p>',
        },
        {
          id: 'text_d',
          type: 'text',
          left: 70,
          top: 426,
          width: 760,
          height: 48,
          content: '<p style="font-size:18px;">文档 (Document)：基本数据单元，类似 JSON 对象</p>',
        },
      ],
      {
        title: '核心概念：文档、集合与数据库',
        keyPoints: ['集合 (Collection)', '数据库 (Database)', '示例：users 集合'],
        order: 5,
        decorate: false,
      },
    );

    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(combinedText).toContain('Collection');
    expect(combinedText).toContain('Database');
    expect(combinedText).toContain('users');
    expect(combinedText).not.toContain('数据库 (Databas</p>');
    expect(combinedText).not.toContain('集合 (Collecti</p>');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('replaces generic focus body labels with concrete canonical content', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content:
            '<p style="font-size:32px;"><strong>项目挑战：构建一个简单的博客系统</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">使用 MongoDB 存储数据 · 后端逻辑设计</p>',
        },
        {
          id: 'text_focus_title',
          type: 'text',
          left: 70,
          top: 216,
          width: 760,
          height: 42,
          content: '<p style="font-size:20px;"><strong>\'posts\' 集合设计</strong></p>',
        },
        {
          id: 'text_focus_body',
          type: 'text',
          left: 70,
          top: 258,
          width: 760,
          height: 42,
          content: '<p style="font-size:18px;">核心功能</p>',
        },
        {
          id: 'text_a',
          type: 'text',
          left: 70,
          top: 326,
          width: 760,
          height: 42,
          content:
            '<p style="font-size:18px;">标题、内容、作者、创建时间：按作者查询与聚合统计</p>',
        },
        {
          id: 'text_b',
          type: 'text',
          left: 70,
          top: 386,
          width: 760,
          height: 42,
          content: '<p style="font-size:18px;">聚合管道 & 索引策略：聚合管道统计每个作者</p>',
        },
      ],
      {
        title: '项目挑战：构建一个简单的博客系统',
        keyPoints: ['posts 集合字段设计', '按作者查询', '聚合统计与索引策略'],
        order: 5,
        decorate: false,
      },
    );

    const focusBody = polished.find((element) =>
      element.id?.startsWith('polish_ref_canonical_v4_focus_body'),
    ) as { content?: string } | undefined;

    expect(focusBody?.content).not.toContain('核心功能');
    expect(focusBody?.content).toMatch(/posts|作者|聚合|索引/);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('expands a lone comparison table to use the main slide area', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 82,
          top: 52,
          width: 760,
          height: 58,
          content: '<p style="font-size:32px;"><strong>SQL 与 NoSQL 对比</strong></p>',
        },
        {
          id: 'rule',
          type: 'shape',
          left: 82,
          top: 138,
          width: 760,
          height: 3,
          fill: '#2f80d1',
        },
        {
          id: 'comparison-table',
          type: 'table',
          left: 92,
          top: 176,
          width: 390,
          height: 250,
          outline: { color: '#cccccc', width: 1 },
          colWidths: [0.33, 0.33, 0.34],
          cellMinHeight: 56,
          data: [
            [{ text: '维度' }, { text: 'SQL 数据库' }, { text: 'NoSQL (MongoDB)' }],
            [{ text: '数据模型' }, { text: '行 / 表' }, { text: '文档 / 集合' }],
            [{ text: '扩展方式' }, { text: '垂直扩展' }, { text: '水平扩展' }],
            [{ text: '数据结构' }, { text: '严格 Schema' }, { text: '灵活 BSON' }],
          ],
        },
      ],
      { title: 'SQL 与 NoSQL 对比', decorate: false },
    );

    const table = polished.find((element) => element.id === 'comparison-table')!;

    expect(table.left).toBeLessThanOrEqual(92);
    expect(table.width).toBeGreaterThanOrEqual(760);
    expect(Number(table.height)).toBeGreaterThanOrEqual(286);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('uses a wide data table and preserves bottom derivation text on formula table pages', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content:
            '<p style="font-size:32px;"><strong>诱导公式系列（一）：关于原点对称 (π+α)</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content:
            '<p style="font-size:20px;">利用单位圆上两点关于原点对称的性质（点 P vs 点 P\'）</p>',
        },
        {
          id: 'table_formula',
          type: 'table',
          left: 100,
          top: 245,
          width: 610,
          height: 176,
          outline: { color: '#cccccc', width: 1 },
          colWidths: [0.33, 0.33, 0.34],
          cellMinHeight: 76,
          data: [
            [{ text: 'sin(π+α)' }, { text: 'cos(π+α)' }, { text: 'tan(π+α)' }],
            [{ text: '- sin α' }, { text: '- cos α' }, { text: 'tan α' }],
          ],
        },
        {
          id: 'text_note_a',
          type: 'text',
          left: 112,
          top: 448,
          width: 360,
          height: 48,
          content: '<p style="font-size:18px;"><strong>公式推导：</strong> sin(π+α) = -sin α</p>',
        },
        {
          id: 'text_note_b',
          type: 'text',
          left: 548,
          top: 448,
          width: 360,
          height: 48,
          content:
            '<p style="font-size:18px;"><strong>cos(π+α) = -cos α：</strong>推导 tan(π+α) = (-sin α) / (-cos α)</p>',
        },
      ],
      {
        title: '诱导公式系列（一）：关于原点对称 (π+α)',
        keyPoints: ['sin(π+α) = -sin α', 'cos(π+α) = -cos α', 'tan(π+α) = tan α'],
        order: 3,
        decorate: false,
      },
    );

    const table = polished.find(
      (element) => element.id === 'polish_ref_canonical_data_v2_data_top',
    );
    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(table?.width).toBeGreaterThanOrEqual(820);
    expect(Number(table?.height ?? 0)).toBeGreaterThanOrEqual(210);
    expect(combinedText).toContain('cos(π+α) = -cos α');
    expect(combinedText).toContain('tan(π+α)');
    expect(combinedText).not.toContain('= -co</p>');
    expect(combinedText).not.toContain('/ (-c</p>');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('treats English colon-prefixed setup steps as a step layout instead of generic perspective cards', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>Installing PostgreSQL</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">Step-by-step setup guide</p>',
        },
        {
          id: 'text_step_1',
          type: 'text',
          left: 70,
          top: 216,
          width: 760,
          height: 58,
          content:
            '<p style="font-size:18px;">Step 1: Download the installer from the official website</p>',
        },
        {
          id: 'text_step_2',
          type: 'text',
          left: 70,
          top: 296,
          width: 760,
          height: 58,
          content: '<p style="font-size:18px;">Step 2: Follow the installation wizard</p>',
        },
        {
          id: 'text_step_3',
          type: 'text',
          left: 70,
          top: 376,
          width: 760,
          height: 58,
          content: '<p style="font-size:18px;">Step 3: Set a password for the postgres user</p>',
        },
      ],
      {
        title: 'Installing PostgreSQL',
        keyPoints: [
          'Step 1: Download the installer',
          'Step 2: Follow the installation wizard',
          'Step 3: Set a password',
        ],
        order: 3,
        decorate: false,
      },
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_canonical_steps_'))).toBe(
      true,
    );
    expect(polished.some((element) => element.id?.startsWith('polish_ref_canonical_v2_'))).toBe(
      false,
    );
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rewrites generic step-heavy generated pages into a canonical steps layout', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 62,
          top: 48,
          width: 860,
          height: 68,
          content: '<p style="font-size:32px;"><strong>函数定义与调用</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 62,
          top: 124,
          width: 860,
          height: 56,
          content: '<p style="font-size:20px;">掌握函数的定义、参数传递与返回值</p>',
        },
        {
          id: 'text_steps',
          type: 'text',
          left: 180,
          top: 268,
          width: 650,
          height: 150,
          content:
            '<p style="font-size:18px;">① 使用 def 写函数名</p><p style="font-size:18px;">② 在括号中声明参数</p><p style="font-size:18px;">③ 用 return 返回结果</p>',
        },
        {
          id: 'text_note',
          type: 'text',
          left: 160,
          top: 432,
          width: 620,
          height: 58,
          content: '<p style="font-size:18px;">调用函数时，实参会传给形参。</p>',
        },
      ],
      { title: '函数定义与调用', decorate: false },
    );

    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(polished.some((element) => element.id?.startsWith('polish_ref_canonical_steps_'))).toBe(
      true,
    );
    expect(combinedText).toContain('def 写函数名');
    expect(combinedText).toContain('return 返回结果');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rotates generated step pages through multiple stable canonical step layouts', () => {
    const makeStepElements = (title: string) => [
      {
        id: 'text_title',
        type: 'text',
        left: 62,
        top: 48,
        width: 860,
        height: 68,
        content: `<p style="font-size:32px;"><strong>${title}</strong></p>`,
      },
      {
        id: 'text_subtitle',
        type: 'text',
        left: 62,
        top: 124,
        width: 860,
        height: 56,
        content: '<p style="font-size:20px;">把操作流程拆成可执行的课堂步骤</p>',
      },
      {
        id: 'text_steps',
        type: 'text',
        left: 160,
        top: 246,
        width: 680,
        height: 160,
        content:
          '<p style="font-size:18px;">① 明确输入与目标</p><p style="font-size:18px;">② 拆分可执行步骤</p><p style="font-size:18px;">③ 检查结果是否符合预期</p>',
      },
      {
        id: 'text_note',
        type: 'text',
        left: 160,
        top: 430,
        width: 680,
        height: 52,
        content: '<p style="font-size:18px;">每一步都要能被学生复述。</p>',
      },
    ];

    const variants = [1, 2, 3].map((order) => {
      const polished = polishSlideElements(makeStepElements(`流程页 ${order}`), {
        title: `流程页 ${order}`,
        keyPoints: ['明确输入', '拆分步骤', '检查结果'],
        order,
        decorate: false,
      });
      const variantId = polished.find((element) =>
        /^polish_ref_canonical_steps_v\d+_/.test(element.id ?? ''),
      )?.id;

      expect(variantId).toBeTruthy();
      expect(auditSlideLayout(polished)).toEqual([]);
      return variantId?.match(/polish_ref_canonical_steps_v\d+/)?.[0];
    });

    expect(new Set(variants)).toHaveProperty('size', 3);
  });

  it('rotates generated formula pages through multiple stable canonical formula layouts', () => {
    const makeFormulaElements = (title: string) => [
      {
        id: 'text_title',
        type: 'text',
        left: 60,
        top: 48,
        width: 880,
        height: 68,
        content: `<p style="font-size:32px;"><strong>${title}</strong></p>`,
      },
      {
        id: 'text_subtitle',
        type: 'text',
        left: 60,
        top: 124,
        width: 880,
        height: 56,
        content: '<p style="font-size:20px;">用公式连接条件、变量与结果</p>',
      },
      {
        id: 'text_meaning_heading',
        type: 'text',
        left: 72,
        top: 214,
        width: 760,
        height: 42,
        content: '<p style="font-size:20px;"><strong>公式含义</strong></p>',
      },
      {
        id: 'text_meaning_body',
        type: 'text',
        left: 72,
        top: 258,
        width: 760,
        height: 58,
        content: '<p style="font-size:18px;">每一项都对应一个可解释的量。</p>',
      },
      {
        id: 'latex_formula_1',
        type: 'latex',
        left: 180,
        top: 316,
        width: 460,
        height: 80,
        latex: 'S = v_0t + \\frac{1}{2}at^2',
      },
      {
        id: 'text_check_heading',
        type: 'text',
        left: 72,
        top: 410,
        width: 760,
        height: 38,
        content: '<p style="font-size:20px;"><strong>代入检查</strong></p>',
      },
      {
        id: 'text_check_body',
        type: 'text',
        left: 72,
        top: 452,
        width: 760,
        height: 42,
        content: '<p style="font-size:18px;">先看单位，再看边界条件。</p>',
      },
    ];

    const variants = [1, 2, 3].map((order) => {
      const polished = polishSlideElements(makeFormulaElements(`公式页 ${order}`), {
        title: `公式页 ${order}`,
        keyPoints: ['公式含义', '代入检查', '边界条件'],
        order,
        decorate: false,
      });
      const variantId = polished.find((element) =>
        /^polish_ref_canonical_formula_v\d+_/.test(element.id ?? ''),
      )?.id;

      expect(variantId).toBeTruthy();
      expect(polished.some((element) => element.type === 'latex')).toBe(true);
      expect(auditSlideLayout(polished)).toEqual([]);
      return variantId?.match(/polish_ref_canonical_formula_v\d+/)?.[0];
    });

    expect(new Set(variants)).toHaveProperty('size', 3);
  });

  it('rotates generated data pages through multiple stable canonical data layouts', () => {
    const makeDataElements = (title: string) => [
      {
        id: 'text_title',
        type: 'text',
        left: 60,
        top: 48,
        width: 880,
        height: 68,
        content: `<p style="font-size:32px;"><strong>${title}</strong></p>`,
      },
      {
        id: 'text_subtitle',
        type: 'text',
        left: 60,
        top: 124,
        width: 880,
        height: 56,
        content: '<p style="font-size:20px;">用数据变化支撑课堂判断</p>',
      },
      {
        id: 'text_observe_heading',
        type: 'text',
        left: 70,
        top: 214,
        width: 760,
        height: 42,
        content: '<p style="font-size:20px;"><strong>观察对象</strong></p>',
      },
      {
        id: 'text_observe_body',
        type: 'text',
        left: 70,
        top: 258,
        width: 760,
        height: 58,
        content: '<p style="font-size:18px;">先比较不同组数据的变化趋势。</p>',
      },
      {
        id: 'chart_main',
        type: 'chart',
        left: 160,
        top: 318,
        width: 560,
        height: 150,
        chartType: 'bar',
        data: {
          labels: ['A', 'B', 'C'],
          legends: ['实验组'],
          series: [[12, 18, 26]],
        },
        themeColors: ['#2f80d1'],
      },
      {
        id: 'text_conclusion',
        type: 'text',
        left: 70,
        top: 478,
        width: 760,
        height: 34,
        content: '<p style="font-size:18px;">结论要回到横轴、纵轴和单位。</p>',
      },
    ];

    const variants = [1, 2, 3].map((order) => {
      const polished = polishSlideElements(makeDataElements(`数据页 ${order}`), {
        title: `数据页 ${order}`,
        keyPoints: ['观察对象', '变化趋势', '课堂判断'],
        order,
        decorate: false,
      });
      const variantId = polished.find((element) =>
        /^polish_ref_canonical_data_v\d+_/.test(element.id ?? ''),
      )?.id;

      expect(variantId).toBeTruthy();
      expect(polished.some((element) => element.type === 'chart')).toBe(true);
      expect(auditSlideLayout(polished)).toEqual([]);
      return variantId?.match(/polish_ref_canonical_data_v\d+/)?.[0];
    });

    expect(new Set(variants)).toHaveProperty('size', 3);
  });

  it('rotates generated media pages through multiple stable canonical media layouts', () => {
    const makeMediaElements = (title: string) => [
      {
        id: 'text_title',
        type: 'text',
        left: 60,
        top: 48,
        width: 880,
        height: 68,
        content: `<p style="font-size:32px;"><strong>${title}</strong></p>`,
      },
      {
        id: 'text_subtitle',
        type: 'text',
        left: 60,
        top: 124,
        width: 880,
        height: 56,
        content: '<p style="font-size:20px;">围绕视觉材料组织观察和讨论</p>',
      },
      {
        id: 'image_main',
        type: 'image',
        left: 140,
        top: 220,
        width: 520,
        height: 230,
        src: '/assets/demo.png',
      },
      {
        id: 'text_focus_heading',
        type: 'text',
        left: 700,
        top: 220,
        width: 220,
        height: 42,
        content: '<p style="font-size:20px;"><strong>观察重点</strong></p>',
      },
      {
        id: 'text_focus_body',
        type: 'text',
        left: 700,
        top: 270,
        width: 220,
        height: 80,
        content: '<p style="font-size:18px;">先看结构，再看变化细节。</p>',
      },
      {
        id: 'text_question',
        type: 'text',
        left: 700,
        top: 380,
        width: 220,
        height: 60,
        content: '<p style="font-size:18px;">你能指出最关键的差异吗？</p>',
      },
    ];

    const variants = [1, 2, 3].map((order) => {
      const polished = polishSlideElements(makeMediaElements(`视觉页 ${order}`), {
        title: `视觉页 ${order}`,
        keyPoints: ['观察重点', '结构变化', '课堂追问'],
        order,
        decorate: false,
      });
      const variantId = polished.find((element) =>
        /^polish_ref_canonical_media_v\d+_/.test(element.id ?? ''),
      )?.id;

      expect(variantId).toBeTruthy();
      expect(polished.some((element) => element.type === 'image')).toBe(true);
      expect(auditSlideLayout(polished)).toEqual([]);
      return variantId?.match(/polish_ref_canonical_media_v\d+/)?.[0];
    });

    expect(new Set(variants)).toHaveProperty('size', 3);
  });

  it('repairs stale vertex reference slides when the title is about real applications', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'polish_ref_vertex_title',
          type: 'text',
          left: 82,
          top: 42,
          width: 836,
          height: 58,
          content: '<p style="font-size:34px;"><strong>综合应用：解决实际问题</strong></p>',
        },
        {
          id: 'polish_ref_vertex_subtitle',
          type: 'text',
          left: 82,
          top: 122,
          width: 836,
          height: 38,
          content: '<p style="font-size:22px;">从顶点式直接读出顶点、对称轴和图像平移</p>',
        },
        {
          id: 'polish_ref_vertex_definition_title',
          type: 'text',
          left: 112,
          top: 216,
          width: 320,
          height: 36,
          content: '<p style="font-size:24px;"><strong>顶点式定义</strong></p>',
        },
      ],
      { title: '综合应用：解决实际问题', decorate: false },
    );

    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(polished.some((element) => element.id?.startsWith('polish_ref_quad_application_'))).toBe(
      true,
    );
    expect(combinedText).toContain('建模步骤');
    expect(combinedText).toContain('实际问题');
    expect(combinedText).not.toContain('顶点式定义');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('does not collapse every quadratic subsection into the same parabola fallback layout', () => {
    const subsectionTitles = ['二次函数的开口方向', '二次函数的最值', '二次函数的实际应用'];

    const polishedSlides = subsectionTitles.map((title) =>
      polishSlideElements(
        [
          {
            id: 'title',
            type: 'text',
            left: 105,
            top: 78,
            width: 790,
            height: 70,
            content: `<p style="font-size:34px;">${title}</p>`,
          },
          {
            id: 'body',
            type: 'text',
            left: 590,
            top: 205,
            width: 300,
            height: 94,
            content: '<p style="font-size:18px;">观察参数变化对二次函数图像和结论的影响。</p>',
          },
        ],
        {
          title,
          keyPoints: ['开口方向', '顶点', '对称轴'],
        },
      ),
    );

    expect(
      polishedSlides.every((elements) =>
        elements.every((element) => !element.id?.startsWith('polish_quad_')),
      ),
    ).toBe(true);
  });

  it('preserves application slide structure while keeping the definition below the cards', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 105,
          top: 78,
          width: 790,
          height: 70,
          content: '<p style="font-size:34px;">生活中的二次函数</p>',
        },
        {
          id: 'scene-a',
          type: 'shape',
          left: 82,
          top: 214,
          width: 250,
          height: 142,
          fill: '#e7f3ff',
        },
        {
          id: 'scene-b',
          type: 'shape',
          left: 375,
          top: 214,
          width: 250,
          height: 142,
          fill: '#e8faef',
        },
        {
          id: 'scene-c',
          type: 'shape',
          left: 668,
          top: 214,
          width: 250,
          height: 142,
          fill: '#fff3c4',
        },
        {
          id: 'definition',
          type: 'text',
          left: 118,
          top: 382,
          width: 760,
          height: 48,
          content:
            '<p style="font-size:18px;"><strong>二次函数定义：</strong>形如 y = ax<sup>2</sup> + bx + c（a ≠ 0）的函数</p>',
        },
        {
          id: 'empty-bottom-panel',
          type: 'shape',
          left: 105,
          top: 452,
          width: 790,
          height: 54,
          fill: '#eef3ff',
        },
      ],
      {
        title: '生活中的二次函数',
        keyPoints: ['篮球投篮', '拱桥造型', '喷泉水柱'],
      },
    );

    const definition = polished.find((element) => element.id === 'definition')!;
    const cards = ['scene-a', 'scene-b', 'scene-c'].map(
      (id) => polished.find((element) => element.id === id)!,
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_app_'))).toBe(false);
    expect(definition.top).toBeGreaterThan(
      Math.max(...cards.map((card) => card.top + Number(card.height))),
    );
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('moves misplaced key-step text out of card bodies into a readable bottom section', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'card-a',
          type: 'shape',
          left: 76,
          top: 228,
          width: 303,
          height: 194,
          fill: '#e7f3ff',
        },
        {
          id: 'card-b',
          type: 'shape',
          left: 401,
          top: 228,
          width: 303,
          height: 194,
          fill: '#fff3dc',
        },
        {
          id: 'card-c',
          type: 'shape',
          left: 726,
          top: 228,
          width: 303,
          height: 194,
          fill: '#f0e4ff',
        },
        {
          id: 'card-body-a',
          type: 'text',
          left: 134,
          top: 380,
          width: 190,
          height: 50,
          content: '<p style="font-size:18px;">且两侧符号变化</p>',
        },
        {
          id: 'card-body-b',
          type: 'text',
          left: 502,
          top: 380,
          width: 204,
          height: 50,
          content: '<p style="font-size:18px;">凹凸性发生改变</p>',
        },
        {
          id: 'step-heading',
          type: 'text',
          left: 87,
          top: 438,
          width: 240,
          height: 58,
          content: '<p style="font-size:22px;"><strong>关键步骤</strong></p>',
        },
        {
          id: 'step-a',
          type: 'text',
          left: 80,
          top: 380,
          width: 420,
          height: 42,
          content: '<p style="font-size:15px;">① 求 f′(x)=0 得极值候选点</p>',
        },
        {
          id: 'step-b',
          type: 'text',
          left: 500,
          top: 380,
          width: 440,
          height: 42,
          content: '<p style="font-size:15px;">② 求 f″(x)=0 得拐点候选点</p>',
        },
      ],
      { decorate: false },
    );

    const cardBodies = ['card-body-a', 'card-body-b'].map(
      (id) => polished.find((element) => element.id === id)!,
    );
    const heading = polished.find((element) => element.id === 'step-heading')!;
    const steps = ['step-a', 'step-b'].map((id) => polished.find((element) => element.id === id)!);

    expect(Math.min(...steps.map((step) => step.top))).toBeGreaterThan(heading.top);
    for (const step of steps) {
      for (const cardBody of cardBodies) {
        expect(overlaps(step, cardBody)).toBe(false);
      }
    }
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('separates bottom memory heading, left steps, and right callout without overlap', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'summary-a',
          type: 'shape',
          left: 96,
          top: 158,
          width: 476,
          height: 122,
          fill: '#e7f3ff',
        },
        {
          id: 'summary-b',
          type: 'shape',
          left: 572,
          top: 158,
          width: 477,
          height: 122,
          fill: '#fff2c7',
        },
        {
          id: 'summary-c',
          type: 'shape',
          left: 96,
          top: 312,
          width: 476,
          height: 122,
          fill: '#dbf8e7',
        },
        {
          id: 'summary-d',
          type: 'shape',
          left: 572,
          top: 312,
          width: 477,
          height: 122,
          fill: '#fce7f3',
        },
        {
          id: 'divider',
          type: 'shape',
          left: 140,
          top: 430,
          width: 866,
          height: 1,
          fill: '#dddddd',
        },
        {
          id: 'memory-heading',
          type: 'text',
          left: 106,
          top: 450,
          width: 320,
          height: 56,
          content: '<p style="font-size:22px;"><strong>解题步骤与记忆口诀</strong></p>',
        },
        {
          id: 'memory-steps',
          type: 'text',
          left: 60,
          top: 470.5,
          width: 480,
          height: 42,
          content: '<p style="font-size:15px;">步骤：先看系数 a，再求导数 f′(x)</p>',
        },
        {
          id: 'callout-bg',
          type: 'shape',
          left: 520,
          top: 460.5,
          width: 420,
          height: 54,
          fill: '#dff1ff',
        },
        {
          id: 'callout-text',
          type: 'text',
          left: 540,
          top: 470.5,
          width: 380,
          height: 42,
          content: '<p style="font-size:15px;">口诀：开口方向看 a，拐点中心要记牢</p>',
        },
      ],
      { decorate: false },
    );

    const heading = polished.find((element) => element.id === 'memory-heading')!;
    const steps = polished.find((element) => element.id === 'memory-steps')!;
    const calloutBg = polished.find((element) => element.id === 'callout-bg')!;
    const calloutText = polished.find((element) => element.id === 'callout-text')!;

    expect(steps.top).toBeGreaterThan(heading.top);
    expect(calloutText.top).toBeGreaterThan(heading.top);
    expect(overlaps(heading, steps)).toBe(false);
    expect(overlaps(heading, calloutText)).toBe(false);
    expect(calloutBg.top).toBeLessThanOrEqual(calloutText.top);
    expect(calloutBg.top + Number(calloutBg.height)).toBeGreaterThanOrEqual(
      calloutText.top + Number(calloutText.height),
    );
    expect(steps.top + Number(steps.height)).toBeLessThanOrEqual(514.5);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('widens and enlarges compact core-step text in the bottom section', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'card-a',
          type: 'shape',
          left: 56,
          top: 122,
          width: 303,
          height: 163,
          fill: '#dff1ff',
        },
        {
          id: 'card-b',
          type: 'shape',
          left: 381,
          top: 122,
          width: 303,
          height: 163,
          fill: '#fff2c7',
        },
        {
          id: 'card-c',
          type: 'shape',
          left: 706,
          top: 122,
          width: 303,
          height: 163,
          fill: '#dbf8e7',
        },
        {
          id: 'core-heading',
          type: 'text',
          left: 67,
          top: 338,
          width: 230,
          height: 58,
          content: '<p style="font-size:22px;"><strong>核心步骤</strong></p>',
        },
        {
          id: 'core-steps',
          type: 'text',
          left: 244,
          top: 404,
          width: 365,
          height: 48,
          content:
            '<p style="font-size:12px;">① 求导得二次函数 f′(x)<br/>② 解 f′(x)>0 和 f′(x)<0，确定单调区间<br/>③ 令 f′(x)=0 解出候选极值点</p>',
        },
      ],
      { decorate: false },
    );

    const heading = polished.find((element) => element.id === 'core-heading')!;
    const steps = polished.find(
      (element) => element.id === 'core-steps',
    ) as (typeof polished)[number] & Record<string, unknown>;

    expect(steps.top).toBeGreaterThan(heading.top);
    expect(steps.left).toBeLessThanOrEqual(105);
    expect(steps.width).toBeGreaterThanOrEqual(760);
    expect(String(steps.content)).toContain('font-size:18px');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('repairs card text ownership when a generated multi-card row stacks all labels in one column', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 72,
          content: '<p style="font-size:36px;"><strong>What is a Quadratic Function?</strong></p>',
        },
        {
          id: 'subtitle',
          type: 'text',
          left: 60,
          top: 128,
          width: 880,
          height: 53,
          content:
            '<p style="font-size:18px;">A polynomial function of degree 2 - the curve family of algebra</p>',
        },
        {
          id: 'card-a',
          type: 'shape',
          left: 60,
          top: 228,
          width: 280,
          height: 260,
          fill: '#e8f0fe',
        },
        {
          id: 'card-b',
          type: 'shape',
          left: 360,
          top: 228,
          width: 280,
          height: 271,
          fill: '#fef3e2',
        },
        {
          id: 'card-c',
          type: 'shape',
          left: 660,
          top: 228,
          width: 280,
          height: 260,
          fill: '#e6f4ed',
        },
        {
          id: 'icon-a',
          type: 'text',
          left: 130,
          top: 243,
          width: 140,
          height: 57,
          content: '<p style="font-size:24px; text-align:center;">A</p>',
        },
        {
          id: 'heading-a',
          type: 'text',
          left: 80,
          top: 308,
          width: 240,
          height: 47,
          content: '<p style="font-size:20px; text-align:center;"><strong>Degree 2</strong></p>',
        },
        {
          id: 'body-a',
          type: 'text',
          left: 80,
          top: 363,
          width: 240,
          height: 103,
          content:
            '<p style="font-size:18px; text-align:center;">Highest power of the variable is 2</p><p style="font-size:18px; text-align:center;">Example: x², 3x²</p>',
        },
        {
          id: 'icon-b',
          type: 'text',
          left: 130,
          top: 243,
          width: 140,
          height: 57,
          content: '<p style="font-size:24px; text-align:center;">B</p>',
        },
        {
          id: 'heading-b',
          type: 'text',
          left: 80,
          top: 308,
          width: 240,
          height: 47,
          content:
            '<p style="font-size:20px; text-align:center;"><strong>General Form</strong></p>',
        },
        {
          id: 'formula-b',
          type: 'latex',
          left: 290,
          top: 368,
          width: 420,
          height: 62,
          latex: 'f(x)=ax^2+bx+c',
        },
        {
          id: 'where-b',
          type: 'text',
          left: 390,
          top: 438,
          width: 220,
          height: 53,
          content: '<p style="font-size:18px; text-align:center;">where a != 0</p>',
        },
        {
          id: 'icon-c',
          type: 'text',
          left: 130,
          top: 243,
          width: 140,
          height: 57,
          content: '<p style="font-size:24px; text-align:center;">C</p>',
        },
        {
          id: 'heading-c',
          type: 'text',
          left: 80,
          top: 308,
          width: 240,
          height: 47,
          content:
            '<p style="font-size:20px; text-align:center;"><strong>Parabola Graph</strong></p>',
        },
        {
          id: 'body-c',
          type: 'text',
          left: 80,
          top: 363,
          width: 240,
          height: 103,
          content:
            '<p style="font-size:18px; text-align:center;">Symmetric U-shaped curve</p><p style="font-size:18px; text-align:center;">Opens up or down</p>',
        },
      ],
      { title: 'What is a Quadratic Function?', decorate: false },
    );

    const headingA = polished.find((element) => element.id === 'heading-a')!;
    const headingB = polished.find((element) => element.id === 'heading-b')!;
    const headingC = polished.find((element) => element.id === 'heading-c')!;
    const formula = polished.find((element) => element.id === 'formula-b')!;

    expect(headingA.left).toBeLessThan(340);
    expect(headingB.left).toBeGreaterThanOrEqual(360);
    expect(headingB.left + headingB.width).toBeLessThanOrEqual(640);
    expect(headingC.left).toBeGreaterThanOrEqual(660);
    expect(formula.left).toBeGreaterThanOrEqual(360);
    expect(formula.left + formula.width).toBeLessThanOrEqual(640);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rewrites crowded cubic introduction pages into separated review and formula panels', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 70,
          content: '<p style="font-size:32px;"><strong>三次函数引入</strong></p>',
        },
        {
          id: 'known-linear',
          type: 'text',
          left: 80,
          top: 222,
          width: 240,
          height: 53,
          content: '<p style="font-size:18px;"><strong>一次函数</strong></p>',
        },
        {
          id: 'known-quadratic',
          type: 'text',
          left: 380,
          top: 222,
          width: 240,
          height: 53,
          content: '<p style="font-size:18px;"><strong>二次函数</strong></p>',
        },
        {
          id: 'problem',
          type: 'text',
          left: 80,
          top: 426,
          width: 840,
          height: 64,
          content:
            '<p style="font-size:18px;"><strong>问题：</strong> 无盖长方体盒子容积V与底面边长x的关系中出现了x³项。</p>',
        },
        {
          id: 'general-form-heading',
          type: 'text',
          left: 60,
          top: 393,
          width: 400,
          height: 56,
          content: '<p style="font-size:20px;"><strong>三、三次函数的一般形式</strong></p>',
        },
        {
          id: 'formula',
          type: 'latex',
          left: 120,
          top: 394.5,
          width: 760,
          height: 118,
          latex: 'f(x) = ax^3 + bx^2 + cx + d \\quad (a \\neq 0)',
        },
      ],
      { title: '三次函数引入', decorate: false },
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_cubic_intro_'))).toBe(
      true,
    );
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rewrites crowded cubic graph feature charts into a clean schematic layout', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 70,
          content: '<p style="font-size:32px;"><strong>三次函数的图像特征</strong></p>',
        },
        {
          id: 'trend',
          type: 'text',
          left: 90,
          top: 226,
          width: 420,
          height: 50,
          content: '<p style="font-size:20px;"><strong>走势方向：</strong>由首项系数 a 决定</p>',
        },
        {
          id: 'symmetry',
          type: 'text',
          left: 530,
          top: 226,
          width: 420,
          height: 50,
          content: '<p style="font-size:20px;"><strong>对称性：</strong>关于拐点中心对称</p>',
        },
        {
          id: 'chart',
          type: 'chart',
          left: 60,
          top: 352.5,
          width: 500,
          height: 160,
          chartType: 'line',
          data: {
            labels: ['-2', '-1', '0', '1', '2'],
            legends: ['a = 1 (y = x³)', 'a = -1 (y = -x³)'],
            series: [
              [-8, -1, 0, 1, 8],
              [8, 1, 0, -1, -8],
            ],
          },
          themeColors: ['#5b9bd5', '#ed7d31'],
        },
        {
          id: 'intersection-note',
          type: 'text',
          left: 60,
          top: 470.5,
          width: 880,
          height: 42,
          content:
            '<p style="font-size:18px;">图像与 x 轴交点：最多 3 个 ｜ 与 y 轴交点：(0, d)</p>',
        },
      ],
      { title: '三次函数的图像特征', decorate: false },
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_cubic_graph_'))).toBe(
      true,
    );
    expect(polished.some((element) => element.type === 'chart')).toBe(false);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('separates cubic coefficient formula from the explanatory note panel', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 72,
          content: '<p style="font-size:32px;"><strong>三次函数的系数影响</strong></p>',
        },
        {
          id: 'subtitle',
          type: 'text',
          left: 60,
          top: 128,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">探索系数 a、b、c、d 如何改变函数图像形态</p>',
        },
        {
          id: 'card-a',
          type: 'shape',
          left: 60,
          top: 238,
          width: 205,
          height: 140,
          fill: '#e3f2fd',
        },
        {
          id: 'card-a-text',
          type: 'text',
          left: 85,
          top: 268,
          width: 155,
          height: 77,
          content: '<p style="font-size:18px;"><strong>系数 a</strong><br/>开口与陡峭</p>',
        },
        {
          id: 'card-b',
          type: 'shape',
          left: 285,
          top: 238,
          width: 205,
          height: 140,
          fill: '#e8f5e9',
        },
        {
          id: 'card-b-text',
          type: 'text',
          left: 310,
          top: 268,
          width: 155,
          height: 77,
          content: '<p style="font-size:18px;"><strong>系数 b</strong><br/>平移与弯曲</p>',
        },
        {
          id: 'card-c',
          type: 'shape',
          left: 510,
          top: 238,
          width: 205,
          height: 140,
          fill: '#fff3e0',
        },
        {
          id: 'card-c-text',
          type: 'text',
          left: 535,
          top: 268,
          width: 155,
          height: 77,
          content: '<p style="font-size:18px;"><strong>系数 c</strong><br/>原点斜率</p>',
        },
        {
          id: 'card-d',
          type: 'shape',
          left: 735,
          top: 238,
          width: 205,
          height: 140,
          fill: '#fce4ec',
        },
        {
          id: 'card-d-text',
          type: 'text',
          left: 760,
          top: 268,
          width: 155,
          height: 77,
          content: '<p style="font-size:18px;"><strong>系数 d</strong><br/>上下平移</p>',
        },
        {
          id: 'formula',
          type: 'latex',
          left: 290,
          top: 428,
          width: 420,
          height: 80,
          latex: 'f(x) = ax^3 + bx^2 + cx + d',
        },
        {
          id: 'note-bg',
          type: 'shape',
          left: 500,
          top: 412.5,
          width: 440,
          height: 102,
          fill: '#f5f5f5',
        },
        {
          id: 'note',
          type: 'text',
          left: 520,
          top: 432,
          width: 400,
          height: 77,
          content:
            '<p style="font-size:18px;">• a > 0：两端上升 | a < 0：两端下降<br/>• c 控制 x → 0 附近切线斜率</p>',
        },
      ],
      { title: '探索三次函数的系数影响', decorate: false },
    );

    expect(polished.some((element) => element.id?.startsWith('polish_ref_cubic_coeff_'))).toBe(
      true,
    );
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('rewrites cubic summary formula pages with aligned flow steps', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 76,
          content: '<p style="font-size:30px;"><strong>总结与关键公式</strong></p>',
        },
        {
          id: 'formula-heading',
          type: 'text',
          left: 80,
          top: 178,
          width: 380,
          height: 48,
          content: '<p style="font-size:20px;"><strong>核心公式</strong></p>',
        },
        {
          id: 'formula-a',
          type: 'latex',
          left: 120,
          top: 234,
          width: 388,
          height: 66,
          latex: 'f(x) = ax^3 + bx^2 + cx + d \\quad (a \\neq 0)',
        },
        {
          id: 'formula-b',
          type: 'latex',
          left: 140,
          top: 308,
          width: 378,
          height: 66,
          latex: "f'(x) = 3ax^2 + 2bx + c = 0",
        },
        {
          id: 'formula-c',
          type: 'latex',
          left: 120,
          top: 382,
          width: 398,
          height: 71,
          latex: 'x = -\\frac{b}{3a}',
        },
        {
          id: 'flow-heading',
          type: 'text',
          left: 540,
          top: 178,
          width: 380,
          height: 51,
          content: '<p style="font-size:20px;"><strong>解题流程</strong></p>',
        },
        {
          id: 'step-1',
          type: 'text',
          left: 550,
          top: 237,
          width: 360,
          height: 38,
          content: '<p style="font-size:18px;">① 求导数 f\'(x) = 3ax² + 2bx + c</p>',
        },
        {
          id: 'step-2',
          type: 'text',
          left: 550,
          top: 283,
          width: 360,
          height: 38,
          content: '<p style="font-size:18px;">② 解方程得极值点与拐点</p>',
        },
        {
          id: 'step-3',
          type: 'text',
          left: 550,
          top: 329,
          width: 360,
          height: 38,
          content: '<p style="font-size:18px;">③ 列表分析单调区间</p>',
        },
        {
          id: 'step-4',
          type: 'text',
          left: 550,
          top: 375,
          width: 360,
          height: 38,
          content: '<p style="font-size:18px;">④ 根据 a 符号判断走势</p>',
        },
        {
          id: 'step-5',
          type: 'text',
          left: 550,
          top: 421,
          width: 360,
          height: 53,
          content: '<p style="font-size:18px;">⑤ 画草图，标注极值与拐点</p>',
        },
      ],
      { title: '总结与关键公式', decorate: false },
    );

    const flowSteps = polished.find(
      (element) => element.id === 'polish_ref_cubic_summary_flow_steps',
    ) as ((typeof polished)[number] & Record<string, unknown>) | undefined;

    expect(polished.some((element) => element.id?.startsWith('polish_ref_cubic_summary_'))).toBe(
      true,
    );
    expect(flowSteps).toBeDefined();
    expect(flowSteps?.left).toBe(568);
    expect(flowSteps?.width).toBe(300);
    expect(String(flowSteps?.content ?? '')).toContain('font-size:18px');
    expect(String(flowSteps?.content ?? '')).toContain('① 求导');
    expect(String(flowSteps?.content ?? '')).toContain('⑤ 画草图');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('repairs composite step-flow cards when stacked labels belong to upper cards and color strips', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 72,
          content: '<p style="font-size:36px;"><strong>Cubic monotonicity and extrema</strong></p>',
        },
        {
          id: 'section-heading',
          type: 'text',
          left: 60,
          top: 308,
          width: 300,
          height: 76,
          content: '<p style="font-size:24px;"><strong>Extrema decision steps</strong></p>',
        },
        {
          id: 'upper-a',
          type: 'shape',
          left: 60,
          top: 383,
          width: 280,
          height: 130,
          fill: '#eaf2f8',
        },
        {
          id: 'step-a',
          type: 'text',
          left: 80,
          top: 398,
          width: 240,
          height: 63,
          content: '<p style="font-size:18px;">1. Differentiate<br/>Compute f prime and Delta</p>',
        },
        {
          id: 'upper-b',
          type: 'shape',
          left: 360,
          top: 383,
          width: 280,
          height: 130,
          fill: '#eaf2f8',
        },
        {
          id: 'step-b',
          type: 'text',
          left: 80,
          top: 398,
          width: 240,
          height: 63,
          content: '<p style="font-size:18px;">2. Solve roots<br/>Set f prime equal to zero</p>',
        },
        {
          id: 'upper-c',
          type: 'shape',
          left: 660,
          top: 383,
          width: 280,
          height: 130,
          fill: '#eaf2f8',
        },
        {
          id: 'step-c',
          type: 'text',
          left: 80,
          top: 398,
          width: 240,
          height: 63,
          content:
            '<p style="font-size:18px;">3. Judge signs<br/>Confirm intervals and extrema</p>',
        },
        {
          id: 'strip-a',
          type: 'shape',
          left: 60,
          top: 452.5,
          width: 280,
          height: 60,
          fill: '#1abc9c',
        },
        {
          id: 'strip-caption',
          type: 'text',
          left: 80,
          top: 468.5,
          width: 240,
          height: 30,
          content: '<p style="font-size:18px;">Delta and extrema count</p>',
        },
        {
          id: 'strip-label-a',
          type: 'text',
          left: 80,
          top: 468.5,
          width: 240,
          height: 30,
          content: '<p style="font-size:18px;">Delta > 0: two extrema</p>',
        },
        {
          id: 'strip-b',
          type: 'shape',
          left: 360,
          top: 452.5,
          width: 280,
          height: 60,
          fill: '#f39c12',
        },
        {
          id: 'strip-label-b',
          type: 'text',
          left: 80,
          top: 468.5,
          width: 240,
          height: 30,
          content: '<p style="font-size:18px;">Delta = 0: one extrema</p>',
        },
        {
          id: 'strip-c',
          type: 'shape',
          left: 660,
          top: 452.5,
          width: 280,
          height: 60,
          fill: '#e74c3c',
        },
        {
          id: 'strip-label-c',
          type: 'text',
          left: 80,
          top: 468.5,
          width: 240,
          height: 30,
          content: '<p style="font-size:18px;">Delta < 0: no extrema</p>',
        },
      ],
      { title: 'Cubic monotonicity and extrema', decorate: false },
    );

    const stepA = polished.find((element) => element.id === 'step-a')!;
    const stepB = polished.find((element) => element.id === 'step-b')!;
    const stepC = polished.find((element) => element.id === 'step-c')!;
    const labelA = polished.find((element) => element.id === 'strip-label-a')!;
    const labelB = polished.find((element) => element.id === 'strip-label-b')!;
    const labelC = polished.find((element) => element.id === 'strip-label-c')!;
    const caption = polished.find((element) => element.id === 'strip-caption')!;

    expect(stepA.left).toBeLessThan(340);
    expect(stepB.left).toBeGreaterThanOrEqual(360);
    expect(stepB.left + stepB.width).toBeLessThanOrEqual(640);
    expect(stepC.left).toBeGreaterThanOrEqual(660);
    expect(labelA.left).toBeLessThan(340);
    expect(labelB.left).toBeGreaterThanOrEqual(360);
    expect(labelB.left + labelB.width).toBeLessThanOrEqual(640);
    expect(labelC.left).toBeGreaterThanOrEqual(660);
    expect(caption.top + Number(caption.height ?? 0)).toBeLessThanOrEqual(stepA.top);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('quality gate rebuilds pages that only contain generic template labels', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 56,
          width: 860,
          height: 64,
          content: '<p style="font-size:34px;"><strong>Function download workflow</strong></p>',
        },
        {
          id: 'shape_card_a',
          type: 'shape',
          left: 80,
          top: 180,
          width: 250,
          height: 210,
          fill: '#f3f7ff',
        },
        {
          id: 'text_perspective_a',
          type: 'text',
          left: 104,
          top: 210,
          width: 190,
          height: 34,
          content: '<p style="font-size:18px;">Perspective A</p>',
        },
        {
          id: 'shape_card_b',
          type: 'shape',
          left: 374,
          top: 180,
          width: 250,
          height: 210,
          fill: '#f3f7ff',
        },
        {
          id: 'text_core',
          type: 'text',
          left: 398,
          top: 210,
          width: 190,
          height: 34,
          content: '<p style="font-size:18px;">Core Feature</p>',
        },
        {
          id: 'shape_card_c',
          type: 'shape',
          left: 668,
          top: 180,
          width: 250,
          height: 210,
          fill: '#f3f7ff',
        },
        {
          id: 'text_step',
          type: 'text',
          left: 692,
          top: 210,
          width: 190,
          height: 34,
          content: '<p style="font-size:18px;">Step 1</p>',
        },
      ],
      {
        title: 'Download workflow',
        keyPoints: [
          'Choose the target resource and verify its source.',
          'Start the download and watch the progress state.',
          'Open the saved file after the task finishes.',
        ],
        order: 2,
        decorate: false,
      },
    );

    const plain = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(plain).not.toMatch(/Perspective A|Core Feature|Step 1/);
    expect(plain).toMatch(/target resource|download|saved file/i);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('quality gate expands table-first pages instead of leaving a tiny table in a corner', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 62,
          top: 54,
          width: 860,
          height: 66,
          content: '<p style="font-size:34px;"><strong>Parameter comparison table</strong></p>',
        },
        {
          id: 'text_caption',
          type: 'text',
          left: 620,
          top: 260,
          width: 230,
          height: 32,
          content: '<p style="font-size:18px;">Comparison table</p>',
        },
        {
          id: 'table_data',
          type: 'table',
          left: 620,
          top: 298,
          width: 230,
          height: 96,
          data: [
            ['a', 'effect'],
            ['positive', 'opens up'],
            ['negative', 'opens down'],
          ],
        },
        {
          id: 'text_body',
          type: 'text',
          left: 86,
          top: 210,
          width: 360,
          height: 96,
          content:
            '<p style="font-size:19px;">Use the table to compare how parameters change the graph.</p>',
        },
      ],
      {
        title: 'Parameter comparison table',
        keyPoints: ['Compare parameter signs.', 'Read graph changes from the table.'],
        order: 3,
        decorate: false,
      },
    );

    const table = polished.find((element) => element.type === 'table')!;

    expect(table.width).toBeGreaterThanOrEqual(488);
    expect(Number(table.height ?? 0)).toBeGreaterThanOrEqual(218);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('quality gate does not return overlapping readable text blocks', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'title',
          type: 'text',
          left: 60,
          top: 56,
          width: 860,
          height: 64,
          content: '<p style="font-size:34px;"><strong>Derivative rules</strong></p>',
        },
        {
          id: 'text_a',
          type: 'text',
          left: 120,
          top: 220,
          width: 520,
          height: 130,
          content:
            '<p style="font-size:19px;">Power rule: reduce the exponent by one and multiply by the original exponent.</p>',
        },
        {
          id: 'text_b',
          type: 'text',
          left: 150,
          top: 250,
          width: 520,
          height: 130,
          content:
            '<p style="font-size:19px;">Chain rule: keep the outside derivative and multiply by the inside derivative.</p>',
        },
        {
          id: 'text_c',
          type: 'text',
          left: 180,
          top: 280,
          width: 520,
          height: 130,
          content:
            '<p style="font-size:19px;">Product rule: differentiate each factor once and add the two products.</p>',
        },
      ],
      {
        title: 'Derivative rules',
        keyPoints: ['Power rule', 'Chain rule', 'Product rule'],
        order: 4,
        decorate: false,
      },
    );

    expect(auditSlideLayout(polished)).toEqual([]);
    const readable = polished.filter((element) => element.type === 'text');
    for (let i = 0; i < readable.length; i += 1) {
      for (let j = i + 1; j < readable.length; j += 1) {
        expect(overlaps(readable[i], readable[j])).toBe(false);
      }
    }
  });

  it('keeps Java primitive type cards aligned and keeps bottom text inside safe boxes', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>Java 基础语法：变量与数据类型</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">Java 是强类型语言，变量必须先声明后使用</p>',
        },
        {
          id: 'text_overview',
          type: 'text',
          left: 80,
          top: 220,
          width: 760,
          height: 42,
          content: '<p style="font-size:18px;"><strong>基本数据类型（8种）</strong></p>',
        },
        {
          id: 'text_int_heading',
          type: 'text',
          left: 80,
          top: 274,
          width: 760,
          height: 38,
          content: '<p style="font-size:18px;">整数型</p>',
        },
        {
          id: 'text_int_body',
          type: 'text',
          left: 80,
          top: 326,
          width: 760,
          height: 38,
          content: '<p style="font-size:18px;">byte, short, int, long</p>',
        },
        {
          id: 'text_float_heading',
          type: 'text',
          left: 80,
          top: 378,
          width: 760,
          height: 38,
          content: '<p style="font-size:18px;">浮点型</p>',
        },
        {
          id: 'text_float_body',
          type: 'text',
          left: 80,
          top: 430,
          width: 760,
          height: 38,
          content: '<p style="font-size:18px;">float, double</p>',
        },
        {
          id: 'text_rest',
          type: 'text',
          left: 80,
          top: 482,
          width: 760,
          height: 38,
          content: '<p style="font-size:18px;">char, boolean 也属于基本类型</p>',
        },
      ],
      {
        title: 'Java 基础语法：变量与数据类型',
        keyPoints: ['整数型：byte, short, int, long', '浮点型：float, double', '字符与布尔类型'],
        order: 2,
        decorate: false,
      },
    );

    const cardTitles = polished.filter((element) =>
      element.id?.startsWith('polish_ref_canonical_v1_card_title_'),
    );
    const thirdBody = polished.find(
      (element) => element.id === 'polish_ref_canonical_v1_card_body_2',
    )!;
    const thirdCard = polished.find((element) => element.id === 'polish_ref_canonical_v1_card_2')!;
    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(cardTitles).toHaveLength(3);
    expect(
      new Set(
        cardTitles.map(
          (element) =>
            String((element as Record<string, unknown>).content ?? '').match(
              /font-size:(\d+)px/,
            )?.[1],
        ),
      ),
    ).toEqual(new Set(['22']));
    expect(combinedText).toContain('整数型');
    expect(combinedText).toContain('byte, short, int, long');
    expect(combinedText).toContain('浮点型');
    expect(combinedText).toContain('float, double');
    expect(combinedText).not.toContain('要点 2');
    expect(thirdBody.top + Number(thirdBody.height ?? 0)).toBeLessThanOrEqual(
      thirdCard.top + Number(thirdCard.height ?? 0),
    );
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('does not truncate do-while into a broken token on loop slides', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>控制流程：循环</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">for 循环</p>',
        },
        {
          id: 'text_for_title',
          type: 'text',
          left: 80,
          top: 220,
          width: 760,
          height: 42,
          content: '<p style="font-size:18px;"><strong>要点一</strong></p>',
        },
        {
          id: 'text_for_body',
          type: 'text',
          left: 80,
          top: 274,
          width: 760,
          height: 58,
          content: '<p style="font-size:18px;">for (初始化; 条件; 迭代) { // 循环体 }</p>',
        },
        {
          id: 'text_order_title',
          type: 'text',
          left: 80,
          top: 346,
          width: 760,
          height: 42,
          content: '<p style="font-size:18px;"><strong>要点二</strong></p>',
        },
        {
          id: 'text_order_body',
          type: 'text',
          left: 80,
          top: 398,
          width: 760,
          height: 58,
          content: '<p style="font-size:18px;">初始化 → 条件判断 → 循环体 → 迭代 → 条件判断...</p>',
        },
        {
          id: 'text_while',
          type: 'text',
          left: 80,
          top: 466,
          width: 760,
          height: 42,
          content:
            '<p style="font-size:18px;">while 与 do-while：while 先判断，do-while 至少执行一次</p>',
        },
      ],
      {
        title: '控制流程：循环',
        keyPoints: ['for 循环', 'while 与 do-while', '循环执行顺序'],
        order: 3,
        decorate: false,
      },
    );

    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(combinedText).toContain('do-while');
    expect(combinedText).not.toMatch(/do-whi(?!le)/i);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('expands text boxes that would be clipped by real browser rendering', () => {
    const longBody =
      'Java 的变量声明需要同时关注类型、变量名、初始值和作用域；如果这些信息没有放在同一张概念卡片中，学生很难建立稳定的语法结构。';
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>Java 变量声明</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">变量声明的核心组成</p>',
        },
        {
          id: 'text_a_title',
          type: 'text',
          left: 80,
          top: 220,
          width: 760,
          height: 42,
          content: '<p style="font-size:18px;"><strong>变量类型</strong></p>',
        },
        {
          id: 'text_a_body',
          type: 'text',
          left: 80,
          top: 274,
          width: 760,
          height: 58,
          content: `<p style="font-size:18px;">${longBody}</p>`,
        },
        {
          id: 'text_b_title',
          type: 'text',
          left: 80,
          top: 346,
          width: 760,
          height: 42,
          content: '<p style="font-size:18px;"><strong>变量名</strong></p>',
        },
        {
          id: 'text_b_body',
          type: 'text',
          left: 80,
          top: 398,
          width: 760,
          height: 58,
          content: '<p style="font-size:18px;">变量名用于在后续代码中访问这块数据。</p>',
        },
      ],
      {
        title: 'Java 变量声明',
        keyPoints: ['变量类型', '变量名', '初始值与作用域'],
        order: 2,
        decorate: false,
      },
    );

    const longBodyElement = polished.find(
      (element) => element.id === 'polish_ref_canonical_v1_card_body_0',
    )!;

    expect(Number(longBodyElement.height ?? 0)).toBeGreaterThan(88);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('adds deterministic visual diagrams for sparse Redis data structure pages', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 72,
          top: 62,
          width: 840,
          height: 70,
          content:
            '<p style="font-size:34px;"><strong>核心数据结构：它们是构建块的钥匙</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 72,
          top: 150,
          width: 840,
          height: 42,
          content: '<p style="font-size:22px;">五种最常用的 Redis 数据结构及典型应用场景</p>',
        },
        {
          id: 'shape_card_0',
          type: 'shape',
          left: 82,
          top: 232,
          width: 256,
          height: 198,
          fill: '#f8fafc',
        },
        {
          id: 'text_card_0',
          type: 'text',
          left: 118,
          top: 326,
          width: 180,
          height: 42,
          content: '<p style="font-size:18px;">1 Set</p>',
        },
        {
          id: 'shape_card_1',
          type: 'shape',
          left: 372,
          top: 232,
          width: 256,
          height: 198,
          fill: '#f8fafc',
        },
        {
          id: 'text_card_1',
          type: 'text',
          left: 410,
          top: 326,
          width: 180,
          height: 42,
          content: '<p style="font-size:18px;">2 Sorted Set</p>',
        },
        {
          id: 'shape_card_2',
          type: 'shape',
          left: 662,
          top: 232,
          width: 256,
          height: 198,
          fill: '#f8fafc',
        },
        {
          id: 'text_card_2',
          type: 'text',
          left: 700,
          top: 326,
          width: 180,
          height: 58,
          content: '<p style="font-size:18px;">3 Set（集合）：无序、唯一的数据集合</p>',
        },
      ],
      {
        title: '核心数据结构：它们是构建块的钥匙',
        keyPoints: ['Redis 数据结构', 'Set', 'Sorted Set'],
        order: 2,
        decorate: false,
      },
    );

    const ids = polished.map((element) => element.id ?? '');
    const combinedText = polished
      .map((element) => String((element as Record<string, unknown>).content ?? ''))
      .join(' ');

    expect(ids.some((id) => id.startsWith('polish_ref_redis_ds_visual_'))).toBe(false);
    expect(ids).toContain('polish_ref_redis_ds_overview_table');
    expect(ids).toContain('polish_ref_redis_ds_scenario_table');
    const tableText = polished
      .filter((element) =>
        ['polish_ref_redis_ds_overview_table', 'polish_ref_redis_ds_scenario_table'].includes(
          element.id ?? '',
        ),
      )
      .flatMap(
        (element) =>
          ((element as Record<string, unknown>).data as
            | Array<Array<{ text?: string }>>
            | undefined) ?? [],
      )
      .flatMap((row) => row.map((cell) => cell.text ?? ''))
      .join(' ');
    expect(combinedText).toContain('五种结构对照');
    expect(combinedText).toContain('按场景选择');
    expect(tableText).toContain('单值与计数');
    expect(tableText).toContain('顺序处理');
    expect(tableText).toContain('对象与集合');
    expect(tableText).toContain('String');
    expect(tableText).toContain('List');
    expect(tableText).toContain('Hash');
    expect(tableText).toContain('Set');
    expect(tableText).toContain('Sorted Set');
    expect(tableText).toContain('排行榜');
    const redisColors = polished
      .filter((element) => element.id?.startsWith('polish_ref_redis_ds_'))
      .flatMap((element) => [
        String((element as Record<string, unknown>).fill ?? ''),
        String((element as Record<string, unknown>).color ?? ''),
        String((element as Record<string, unknown>).defaultColor ?? ''),
      ])
      .join(' ')
      .toLowerCase();
    expect(redisColors).not.toContain('#f97316');
    expect(redisColors).not.toContain('#fff7ed');
    expect(redisColors).not.toContain('#f59e0b');
    expect(auditSlideLayout(polished)).toEqual([]);
    expect(auditSlideLayout(polished, { includeRichness: true })).toEqual([]);
  });

  it('uses different Redis structure layouts for focused pages instead of repeating overview', () => {
    const focusedPages = [
      ['string', 'String：键值缓存与计数器'],
      ['list', 'List：有序列表的实现'],
      ['hash', 'Hash：对象字段的存储'],
      ['set', 'Set：集合去重与标签'],
      ['zset', 'Sorted Set：排行榜排序'],
    ] as const;

    const signatures = focusedPages.map(([focus, title], index) => {
      const polished = polishSlideElements(
        [
          {
            id: 'text_title',
            type: 'text',
            left: 72,
            top: 62,
            width: 840,
            height: 70,
            content: `<p style="font-size:34px;"><strong>${title}</strong></p>`,
          },
          {
            id: 'text_subtitle',
            type: 'text',
            left: 72,
            top: 150,
            width: 840,
            height: 42,
            content: '<p style="font-size:22px;">Redis 数据结构及应用场景</p>',
          },
          {
            id: 'text_body',
            type: 'text',
            left: 82,
            top: 244,
            width: 760,
            height: 72,
            content: `<p style="font-size:18px;">Redis ${title} 的核心用法和典型场景</p>`,
          },
        ],
        {
          title,
          keyPoints: ['Redis 数据结构', title],
          order: index + 1,
          decorate: false,
        },
      );

      const ids = polished.map((element) => element.id ?? '');
      const redisColors = polished
        .filter((element) => element.id?.startsWith('polish_ref_redis_ds_'))
        .flatMap((element) => [
          String((element as Record<string, unknown>).fill ?? ''),
          String((element as Record<string, unknown>).color ?? ''),
          String((element as Record<string, unknown>).defaultColor ?? ''),
        ])
        .join(' ')
        .toLowerCase();

      expect(ids.some((id) => id.startsWith(`polish_ref_redis_ds_focus_${focus}_`))).toBe(true);
      expect(ids.some((id) => id.startsWith('polish_ref_redis_ds_visual_connector_'))).toBe(false);
      expect(redisColors).not.toContain('#f97316');
      expect(redisColors).not.toContain('#fff7ed');
      expect(redisColors).not.toContain('#f59e0b');
      expect(auditSlideLayout(polished)).toEqual([]);

      return ids.find((id) => id.startsWith(`polish_ref_redis_ds_focus_${focus}_`)) ?? '';
    });

    expect(new Set(signatures).size).toBe(focusedPages.length);
  });

  it('does not force Redis choice practice or summary pages into the repeated overview layout', () => {
    const genericPages = [
      ['Redis 数据结构选择指南', '先判断读写模式、排序需求和去重需求，再选择合适结构。'],
      ['Redis 最佳实践', '围绕命名规范、过期策略、数据规模和监控排查组织内容。'],
      ['Redis 数据结构总结', '回顾本课关键要点，把结构选择迁移到真实项目场景。'],
      ['课后延伸与资源', '使用 DEBUG OBJECT 观察 Hash 从 listpack 切换到 dict 的条件。'],
    ] as const;

    for (const [title, body] of genericPages) {
      const polished = polishSlideElements(
        [
          {
            id: 'text_title',
            type: 'text',
            left: 72,
            top: 62,
            width: 840,
            height: 70,
            content: `<p style="font-size:34px;"><strong>${title}</strong></p>`,
          },
          {
            id: 'text_subtitle',
            type: 'text',
            left: 72,
            top: 150,
            width: 840,
            height: 42,
            content: '<p style="font-size:22px;">Redis 数据结构课堂讲解</p>',
          },
          {
            id: 'text_body',
            type: 'text',
            left: 82,
            top: 244,
            width: 760,
            height: 72,
            content: `<p style="font-size:20px;">${body}</p>`,
          },
        ],
        {
          title,
          keyPoints: ['Redis 数据结构', '选择原则', '课堂总结'],
          order: 8,
          decorate: false,
        },
      );

      const redisReferenceIds = polished
        .map((element) => element.id ?? '')
        .filter((id) => id.startsWith('polish_ref_redis_'));

      expect(redisReferenceIds).toEqual([]);
      expect(auditSlideLayout(polished)).toEqual([]);
    }
  });

  it('uses semantic Redis internal diagrams instead of plain text blocks', () => {
    const cases = [
      {
        title: '开篇：Redis 为什么这么快？ / String 类型与 SDS',
        body: [
          '高性能根源：基于内存读写，单线程无锁竞争，底层数据结构精心设计。',
          'String 使用场景：缓存文本、整数计数器、设置过期缓存。',
          'String vs C 字符串：C 用结束符，SDS 存长度并支持二进制安全。',
          'SDS 核心优势：预分配空间，惰性释放，减少扩容开销。',
        ],
        expectedPrefix: 'polish_ref_redis_internal_sds_',
        expectedLayoutMarker: 'polish_ref_redis_internal_sds_layout_memory_band',
      },
      {
        title: 'String：最通用的数据结构 / SDS 内部实现',
        body: [
          'String 使用 SET/GET 保存文本、数字和序列化对象。',
          'SDS 是 Redis String 的底层表示，记录长度、容量和字节数组。',
          'INCR 和 DECR 适合计数器场景。',
          'EXPIRE 可以给临时缓存设置过期时间。',
        ],
        expectedPrefix: 'polish_ref_redis_internal_sds_',
        expectedLayoutMarker: 'polish_ref_redis_internal_sds_layout_memory_band',
      },
      {
        title: 'List 类型与 quicklist',
        body: [
          'List 底层使用 quicklist，将多个 listpack 通过双向链表组织起来。',
          '两端操作：LPUSH 和 RPOP 主要操作链表两端，适合队列模型。',
          '内存优化：listpack 让多个小元素连续存放，减少指针开销。',
          '典型场景：消息队列、时间线、任务缓冲都需要顺序访问。',
        ],
        expectedPrefix: 'polish_ref_redis_internal_list_',
        expectedLayoutMarker: 'polish_ref_redis_internal_list_layout_left_diagram',
      },
      {
        title: 'Hash 类型与 dict',
        body: [
          'Hash 把一个对象拆成多个 field/value 字段，适合保存用户资料。',
          '小对象会使用 listpack 紧凑存储，字段多后切换为 dict。',
          'dict 可以快速定位 field，常见读写接近 O(1)。',
          '课堂总结：Hash 的关键不是大块文本，而是对象字段的局部更新。',
        ],
        expectedPrefix: 'polish_ref_redis_internal_hash_',
        expectedLayoutMarker: 'polish_ref_redis_internal_hash_layout_split_left',
      },
      {
        title: 'Set 类型与 intset / dict',
        body: [
          '编码选择依据：整数且少量使用 intset，其他情况自动升级为 dict。',
          'intset 特点：连续内存、有序存储、查找 O(log n)。',
          'dict 特点：哈希表实现，支持任意类型，平均 O(1)。',
          '课堂总结：升级对应用透明，重点是理解编码切换条件。',
        ],
        expectedPrefix: 'polish_ref_redis_internal_set_',
        expectedLayoutMarker: 'polish_ref_redis_internal_set_layout_center_stage',
      },
      {
        title: 'ZSet 类型与 skiplist + dict',
        body: [
          '典型使用场景：排行榜按分数排序取前 N 名，实时比分快速查询分数。',
          '关键命令与耗时：ZSCORE 走哈希表，ZRANGE 和 ZRANK 走跳表。',
          '常见易错点：误以为 ZSet 只使用跳表实现。',
          '课堂总结：跳表负责排序范围操作，哈希表负责快速定位。',
        ],
        expectedPrefix: 'polish_ref_redis_internal_zset_',
        expectedLayoutMarker: 'polish_ref_redis_internal_zset_layout_rank_stage',
      },
    ] as const;
    const focusLayoutMarkers = new Map<string, string>();

    for (const [caseIndex, item] of cases.entries()) {
      const polished = polishSlideElements(
        [
          {
            id: 'text_title',
            type: 'text',
            left: 60,
            top: 48,
            width: 880,
            height: 64,
            content: `<p style="font-size:32px;"><strong>${item.title}</strong></p>`,
          },
          {
            id: 'text_subtitle',
            type: 'text',
            left: 60,
            top: 116,
            width: 880,
            height: 46,
            content: '<p style="font-size:20px;">Redis 内部编码与结构关系</p>',
          },
          ...item.body.map((content, index) => ({
            id: `text_body_${index}`,
            type: 'text' as const,
            left: index % 2 === 0 ? 60 : 520,
            top: index < 2 ? 190 : 316,
            width: 420,
            height: 106,
            content: `<p style="font-size:20px;">${content}</p>`,
          })),
        ],
        {
          title: item.title,
          keyPoints: item.body,
          order: caseIndex + 1,
          decorate: false,
        },
      );

      const ids = polished.map((element) => element.id ?? '');

      expect(
        ids.some((id) => id.startsWith(item.expectedPrefix)),
        `${item.title}: ${ids
          .filter((id) => id.startsWith('polish_ref_'))
          .slice(0, 6)
          .join(', ')}`,
      ).toBe(true);
      expect(ids.some((id) => id.startsWith('polish_ref_canonical_v'))).toBe(false);
      expect(ids).toContain(item.expectedLayoutMarker);
      expect(ids.some((id) => id.startsWith('polish_deck_signature_'))).toBe(false);
      expect(auditSlideLayout(polished)).toEqual([]);
      focusLayoutMarkers.set(item.expectedPrefix, item.expectedLayoutMarker);

      if (item.expectedPrefix === 'polish_ref_redis_internal_sds_') {
        expect(ids).not.toContain('polish_ref_redis_internal_sds_visual_bar');
        expect(ids).not.toContain('polish_ref_redis_internal_sds_sds_rule');
        expect(ids).not.toContain('polish_ref_redis_internal_sds_layout_bottom_rule');
        const sdsNote = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_sds_sds_note',
        )!;
        expect(String(sdsNote.content)).toMatch(/font-size:22px/);
        expect(String(sdsNote.content)).toContain('长度单独记录');

        const detailRows = polished.filter((element) =>
          element.id?.startsWith('polish_ref_redis_internal_sds_detail_row_text_'),
        );
        expect(detailRows).toHaveLength(4);
        expect(new Set(detailRows.map((element) => Number(element.width))).size).toBe(1);
        expect(
          Math.min(...detailRows.map((element) => Number(element.width))),
        ).toBeGreaterThanOrEqual(360);
        expect(new Set(detailRows.map((element) => Math.round(Number(element.top)))).size).toBe(2);

        const bottomBand = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_sds_layout_bottom_band',
        )!;
        expect(Number(bottomBand.width)).toBeGreaterThanOrEqual(800);
        expect(Number(bottomBand.height)).toBeGreaterThanOrEqual(120);
        expect(
          Math.max(...detailRows.map((element) => Number(element.left) + Number(element.width))),
        ).toBeLessThanOrEqual(Number(bottomBand.left) + Number(bottomBand.width));
        expect(
          Math.min(...detailRows.map((element) => Number(element.left))),
        ).toBeGreaterThanOrEqual(Number(bottomBand.left));
      }

      if (item.expectedPrefix === 'polish_ref_redis_internal_set_') {
        const upgradeBox = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_set_upgrade_box',
        )!;
        const upgradeLabel = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_set_upgrade_label',
        )!;
        const intsetBox = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_set_intset_box',
        )!;
        const dictBox = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_set_dict_box',
        )!;

        expect(Number(upgradeBox.top)).toBe(Number(intsetBox.top));
        expect(Number(dictBox.top)).toBe(Number(intsetBox.top));
        expect(Number(upgradeBox.width)).toBe(Number(intsetBox.width));
        expect(Number(dictBox.width)).toBe(Number(intsetBox.width));
        expect(Number(upgradeBox.height)).toBe(Number(intsetBox.height));
        expect(Number(dictBox.height)).toBe(Number(intsetBox.height));
        expect(Number(upgradeLabel.left)).toBeGreaterThanOrEqual(Number(upgradeBox.left));
        expect(Number(upgradeLabel.left) + Number(upgradeLabel.width)).toBeLessThanOrEqual(
          Number(upgradeBox.left) + Number(upgradeBox.width),
        );
        expect(Number(upgradeBox.left)).toBeGreaterThan(Number(intsetBox.left));
        expect(Number(upgradeBox.left) + Number(upgradeBox.width)).toBeLessThan(
          Number(dictBox.left),
        );
        expect(ids).not.toContain('polish_ref_redis_internal_set_layout_left_rule');
        expect(ids).not.toContain('polish_ref_redis_internal_set_layout_right_rule');
      }

      if (item.expectedPrefix === 'polish_ref_redis_internal_zset_') {
        const skiplistPanel = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_zset_skiplist_panel',
        )!;
        const dictPanel = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_zset_dict_panel',
        )!;
        const dictLabel = polished.find(
          (element) => element.id === 'polish_ref_redis_internal_zset_dict_label',
        )!;

        expect(Number(skiplistPanel.width)).toBeGreaterThanOrEqual(260);
        expect(skiplistPanel.fill).toBe('#f8fbff');
        expect(Number(dictPanel.width)).toBeGreaterThanOrEqual(150);
        expect(Number(dictLabel.width)).toBeGreaterThanOrEqual(110);
        expect(String(dictLabel.content)).toMatch(/font-size:2[01]px/);
        expect(ids.some((id) => id.startsWith('polish_ref_redis_internal_zset_visual_dot_'))).toBe(
          false,
        );
        expect(
          ids.some((id) => id.startsWith('polish_ref_redis_internal_zset_skiplist_node_')),
        ).toBe(false);
        expect(
          ids.filter((id) => id.startsWith('polish_ref_redis_internal_zset_skiplist_lane_')),
        ).toHaveLength(2);
      }
    }

    expect(new Set(focusLayoutMarkers.values()).size).toBe(focusLayoutMarkers.size);
  });

  it('does not treat Python list or function lessons as Redis internal structure pages', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 64,
          content: '<p style="font-size:32px;"><strong>函数：定义与调用</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 116,
          width: 880,
          height: 46,
          content: '<p style="font-size:20px;">用代码块实现复用，完成订单金额计算</p>',
        },
        {
          id: 'text_body_1',
          type: 'text',
          left: 70,
          top: 198,
          width: 390,
          height: 96,
          content:
            '<p style="font-size:20px;">Python 函数用 def 定义，把重复逻辑封装成可调用的代码块。</p>',
        },
        {
          id: 'text_body_2',
          type: 'text',
          left: 520,
          top: 198,
          width: 390,
          height: 96,
          content:
            '<p style="font-size:20px;">参数可以接收数字、字符串或 list 列表，返回值用于后续计算。</p>',
        },
        {
          id: 'text_body_3',
          type: 'text',
          left: 70,
          top: 326,
          width: 390,
          height: 96,
          content:
            '<p style="font-size:20px;">练习时先写 add/subtract 函数，再用 if-elif 判断用户选择。</p>',
        },
      ],
      {
        title: '函数：定义与调用',
        keyPoints: ['def 定义函数', '参数可以接收数字、字符串或 list 列表', '返回值用于后续计算'],
        order: 15,
        decorate: false,
      },
    );

    const ids = polished.map((element) => element.id ?? '');
    const combinedText = polished.map((element) => String(element.content ?? '')).join(' ');

    expect(ids.some((id) => id.startsWith('polish_ref_redis_internal_'))).toBe(false);
    expect(combinedText).not.toMatch(/quicklist|listpack|LPUSH|RPOP|SDS/i);
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('keeps all four setup steps visible when the slide promises four steps', () => {
    const polished = polishSlideElements(
      [
        {
          id: 'text_title',
          type: 'text',
          left: 60,
          top: 48,
          width: 880,
          height: 68,
          content: '<p style="font-size:32px;"><strong>安装与运行环境设置</strong></p>',
        },
        {
          id: 'text_subtitle',
          type: 'text',
          left: 60,
          top: 124,
          width: 880,
          height: 56,
          content: '<p style="font-size:20px;">从下载到验证，四步完成 Python 环境搭建</p>',
        },
        ...[
          '1. 下载安装包：从 Python 官网选择适合系统的安装包。',
          '2. 安装配置：勾选 Add Python to PATH 后继续安装。',
          '3. 编写代码：新建 hello.py 并写入 print("Hello Python")。',
          '4. 运行验证：在终端执行 python hello.py 检查输出。',
        ].map((content, index) => ({
          id: `text_step_${index + 1}`,
          type: 'text' as const,
          left: 70,
          top: 206 + index * 70,
          width: 760,
          height: 54,
          content: `<p style="font-size:18px;">${content}</p>`,
        })),
      ],
      {
        title: '安装与运行环境设置',
        keyPoints: ['1. 下载安装包', '2. 安装配置', '3. 编写代码', '4. 运行验证'],
        order: 2,
        decorate: false,
      },
    );

    const stepTexts = polished.filter(
      (element) =>
        element.type === 'text' && element.id?.startsWith('polish_ref_canonical_steps_v1_step_'),
    );
    const combinedText = polished.map((element) => String(element.content ?? '')).join(' ');

    expect(stepTexts).toHaveLength(4);
    expect(combinedText).toContain('运行验证');
    expect(combinedText).not.toContain('课堂抓手');
    expect(auditSlideLayout(polished)).toEqual([]);
  });

  it('adds deck-level visual signatures so repeated reference layouts do not look identical', () => {
    const signatures = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((order) => {
      const polished = polishSlideElements(
        [
          {
            id: 'text_title',
            type: 'text',
            left: 72,
            top: 62,
            width: 840,
            height: 70,
            content: `<p style="font-size:34px;"><strong>Redis 数据结构总览 ${order}</strong></p>`,
          },
          {
            id: 'text_subtitle',
            type: 'text',
            left: 72,
            top: 150,
            width: 840,
            height: 42,
            content: '<p style="font-size:22px;">Redis 五种常见数据结构的对照关系</p>',
          },
          {
            id: 'text_body',
            type: 'text',
            left: 82,
            top: 244,
            width: 760,
            height: 72,
            content:
              '<p style="font-size:18px;">String、List、Hash、Set、Sorted Set 都要结合业务场景选择。</p>',
          },
        ],
        {
          title: `Redis 数据结构总览 ${order}`,
          keyPoints: [
            'String 键值缓存',
            'List 队列',
            'Hash 对象字段',
            'Set 去重',
            'Sorted Set 排行榜',
          ],
          order,
          decorate: false,
        },
      );

      const signatureId = polished.find((element) =>
        element.id?.startsWith('polish_deck_signature_v'),
      )?.id;

      expect(signatureId).toBeTruthy();
      expect(auditSlideLayout(polished)).toEqual([]);
      return signatureId?.match(/polish_deck_signature_v\d+/)?.[0];
    });

    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

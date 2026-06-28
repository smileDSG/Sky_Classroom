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
          id: 'title',
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
          id: 'title',
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
});

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
});

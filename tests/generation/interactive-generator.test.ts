import { describe, expect, it } from 'vitest';
import { auditInteractiveHtml } from '@/lib/generation/scene-content/interactive-generator';

const PAD = `<!-- ${'x'.repeat(400)} -->`;

const wrap = (body: string, head = '') => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>widget</title>
${PAD}
${head}
</head>
<body>
${body}
</body>
</html>`;

const baseHtml = (extraBody = '') =>
  wrap(`<div style="display:flex;flex-direction:row">
  <div id="controls">${extraBody}
    <input id="speed-slider" type="range" min="0" max="100">
    <button id="start-btn">启动</button>
  </div>
  <div id="visual">
    <canvas id="canvas" width="600" height="400"></canvas>
  </div>
</div>`);

describe('auditInteractiveHtml', () => {
  it('accepts a well-formed simulation widget', () => {
    expect(auditInteractiveHtml(baseHtml(), 'simulation')).toEqual([]);
  });

  it('accepts a game widget without canvas/svg (visual gate skipped)', () => {
    const html = wrap(
      `<button onclick="start()">开始游戏</button>
<div id="board"></div>`,
    );
    expect(auditInteractiveHtml(html, 'game')).toEqual([]);
  });

  it('rejects html without a visual element for simulation', () => {
    const html = wrap(
      `<input id="x" type="range">
<button>run</button>`,
    );
    const problems = auditInteractiveHtml(html, 'simulation');
    expect(problems.some((p) => p.includes('no visual element'))).toBe(true);
  });

  it('rejects html without interactive controls', () => {
    const html = wrap(`<canvas id="c" width="100" height="100"></canvas>`);
    const problems = auditInteractiveHtml(html, 'simulation');
    expect(problems.some((p) => p.includes('no interactive controls'))).toBe(true);
  });

  it('rejects duplicated documents', () => {
    const problems = auditInteractiveHtml(baseHtml() + baseHtml(), 'simulation');
    expect(problems.some((p) => p.includes('exactly one <!DOCTYPE'))).toBe(true);
    expect(problems.some((p) => p.includes('exactly one <html>'))).toBe(true);
  });

  it('rejects whole-page 3D perspective tilt', () => {
    const html = wrap(
      `<input type="range"><button>run</button>
<canvas id="c" width="100" height="100"></canvas>`,
      `<style>body { transform: perspective(800px) rotateY(4deg); }</style>`,
    );
    const problems = auditInteractiveHtml(html, 'simulation');
    expect(problems.some((p) => p.includes('3D perspective'))).toBe(true);
  });

  it('rejects fixed-width boxes that overflow the panel', () => {
    const html = wrap(
      `<input type="range"><button>run</button>
<canvas id="c" width="100" height="100"></canvas>`,
      `<style>#app { width: 2000px; }</style>`,
    );
    const problems = auditInteractiveHtml(html, 'simulation');
    expect(problems.some((p) => p.includes('overflow'))).toBe(true);
  });

  it('rejects html that is too short', () => {
    expect(auditInteractiveHtml('<p>hi</p>', 'simulation').length).toBeGreaterThan(0);
  });
});

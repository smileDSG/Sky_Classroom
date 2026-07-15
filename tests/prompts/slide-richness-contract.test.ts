import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

function readTemplate(promptId: string, file: 'system.md' | 'user.md'): string {
  return readFileSync(join(process.cwd(), 'lib', 'prompts', 'templates', promptId, file), 'utf-8');
}

describe('slide richness prompt contract', () => {
  it('keeps outline role cues that feed rich slide generation', () => {
    const system = readTemplate('requirements-to-outlines', 'system.md');
    const user = readTemplate('requirements-to-outlines', 'user.md');
    const combined = `${system}\n${user}`;

    for (const cue of ['[Visual]', '[Focus]', '[Explain]', '[Detail]', '[Apply]']) {
      expect(combined).toContain(cue);
    }
    expect(combined).toContain('Slide Quality Agent');
    expect(combined).toContain('visual anchor');
  });

  it('keeps classroom slide prompts OpenMAIC-first instead of theme-driven', () => {
    const system = readTemplate('slide-content', 'system.md');
    const user = readTemplate('slide-content', 'user.md');
    const combined = `${system}\n${user}`;

    expect(combined).toContain('Slide Content Generator');
    expect(combined).toContain('Generate well-structured slide components');
    expect(combined).toContain('TextElement');
    expect(combined).toContain('ShapeElement');
    expect(combined).toContain('LineElement');
    expect(combined).toContain('LatexElement');
    expect(combined).toContain('TableElement');
    expect(combined).toContain('All TextElement `height` values');
    expect(combined).not.toContain('Course Theme');
    expect(combined).not.toContain('{{themeDirective}}');
    expect(combined).not.toContain('Slide Richness Contract');
    expect(combined).not.toContain('layout recipe');
    expect(combined).not.toContain('minimal colored background boxes');
  });
});

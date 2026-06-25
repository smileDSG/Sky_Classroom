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

  it('keeps slide content requirements for clean OpenMAIC-style visual structure', () => {
    const system = readTemplate('slide-content', 'system.md');
    const user = readTemplate('slide-content', 'user.md');
    const combined = `${system}\n${user}`;

    expect(combined).toContain('Slide Richness Contract');
    expect(combined).toContain('dominant visual anchor');
    expect(combined).toContain('learning text blocks');
    expect(combined).toContain('font hierarchy');
    expect(combined).toContain('white or very light background');
    expect(combined).toContain('thin dividers');
    expect(combined).toContain('image + text');
    expect(combined).toContain('minimal colored background boxes');
    expect(combined).toContain('No unlabeled abstract visual placeholders');
    expect(combined).toContain('at most one pale panel');
    expect(combined).toContain('No foreground callout may overlap earlier content');
  });
});

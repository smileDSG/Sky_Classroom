import { describe, it, expect } from 'vitest';
import { buildLayer1SystemPrompt, buildLayer1UserPrompt } from '@/lib/slides/agent/planning-agent';
import {
  buildSystemPrompt as buildSectionSystemPrompt,
  buildUserPrompt as buildSectionUserPrompt,
} from '@/lib/slides/agent/section-agent';
import {
  buildSystemPrompt as buildDesignSystemPrompt,
  buildUserPrompt as buildDesignUserPrompt,
} from '@/lib/slides/agent/page-design-agent';
import { buildContentQAUserPrompt } from '@/lib/slides/agent/qa-agent';
import type { DesignDNA } from '@/lib/slides/agent/design-dna';

const mockDesignDNA: DesignDNA = {
  styleName: 'test-style',
  recommended: true,
  mood: 'calm',
  bestFor: ['test'],
  colors: {
    coverBg: 'FFFFFF',
    contentBg: 'FFFFFF',
    accent: '000000',
    accentSecondary: '000000',
    accentLight: 'EEEEEE',
    textPrimary: '000000',
    textBody: '333333',
    textMuted: '666666',
    textOnDark: 'FFFFFF',
  },
  fonts: {
    heading: 'Arial',
    body: 'Arial',
    en: 'Arial',
    headingSize: 40,
    pageTitleSize: 34,
    bodySize: 14,
    captionSize: 10,
  },
  decoration: {
    motif: 'geometric-lines',
    density: 'moderate',
    cornerWeight: 'centered',
  },
  components: {
    cardStyle: 'shadow-only',
    bulletStyle: 'dot',
    pageNumberStyle: 'simple-number',
  },
};

describe('educationLevel prompt injection', () => {
  it('planning layer 1 system prompt includes educationLevel', () => {
    const prompt = buildLayer1SystemPrompt(['concept', 'case'], '', mockDesignDNA, '小学');
    expect(prompt).toContain('本课件面向小学学生设计');
  });

  it('planning layer 1 system prompt omits educationLevel when undefined', () => {
    const prompt = buildLayer1SystemPrompt(['concept', 'case'], '', mockDesignDNA);
    expect(prompt).not.toContain('目标受众');
  });

  it('planning layer 1 user prompt includes educationLevel', () => {
    const prompt = buildLayer1UserPrompt('数学', '初中', 10, 20, '小学');
    expect(prompt).toContain('目标受众：小学');
  });

  it('planning layer 1 user prompt omits educationLevel when undefined', () => {
    const prompt = buildLayer1UserPrompt('数学', '初中', 10, 20);
    expect(prompt).not.toContain('目标受众');
  });

  it('section system prompt includes educationLevel in role', () => {
    const prompt = buildSectionSystemPrompt('物理', '高中', mockDesignDNA, ['concept'], '大学本科');
    expect(prompt).toContain('面向大学本科学生授课');
  });

  it('section system prompt omits educationLevel when undefined', () => {
    const prompt = buildSectionSystemPrompt('物理', '高中', mockDesignDNA, ['concept']);
    expect(prompt).not.toContain('面向undefined学生授课');
    expect(prompt).not.toContain('面向学生授课');
  });

  it('section user prompt includes educationLevel', () => {
    const prompt = buildSectionUserPrompt(
      { sectionId: 1, title: '测试', pages: [] },
      '化学',
      undefined,
      '初中',
    );
    expect(prompt).toContain('目标受众：初中');
  });

  it('page design system prompt includes educationLevel', () => {
    const prompt = buildDesignSystemPrompt(mockDesignDNA, '小学');
    expect(prompt).toContain('本课件面向小学学生');
  });

  it('page design system prompt omits educationLevel when undefined', () => {
    const prompt = buildDesignSystemPrompt(mockDesignDNA);
    expect(prompt).not.toContain('目标受众');
  });

  it('page design user prompt includes educationLevel', () => {
    const prompt = buildDesignUserPrompt(
      1,
      'concept',
      { title: '测试' },
      10,
      mockDesignDNA,
      '研究生',
    );
    expect(prompt).toContain('目标受众: 研究生');
  });

  it('page design user prompt omits educationLevel when undefined', () => {
    const prompt = buildDesignUserPrompt(1, 'concept', { title: '测试' }, 10, mockDesignDNA);
    expect(prompt).not.toContain('目标受众');
  });

  it('qa user prompt includes educationLevel', () => {
    const prompt = buildContentQAUserPrompt('化学', '高中', [], '初中');
    expect(prompt).toContain('目标受众学段：初中');
  });

  it('qa user prompt omits educationLevel when undefined', () => {
    const prompt = buildContentQAUserPrompt('化学', '高中', []);
    expect(prompt).not.toContain('目标受众');
  });
});

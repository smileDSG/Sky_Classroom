import { describe, it, expect } from 'vitest';
import {
  validateDesignDNA,
  getDefaultDesignDNA,
  DEFAULT_COLOR_PALETTE,
  DEFAULT_FONT_PAIR,
} from '@/lib/slides/agent/design-dna';
import { buildThemeFromDesignDNA } from '@/lib/slides/pptx-themes';

const FORBIDDEN_FONTS = ['Microsoft YaHei', 'SimHei', 'SimSun', 'FangSong', 'KaiTi', '宋体', '黑体', '仿宋', '楷体'];

describe('「现代学术」默认母版 · 样式不变量（方案 3.1）', () => {
  it('默认字面对为思源黑体，杜绝雅黑/仿宋等旧字体', () => {
    expect(DEFAULT_FONT_PAIR.heading).toBe('Noto Sans SC');
    expect(DEFAULT_FONT_PAIR.body).toBe('Noto Sans SC');
    const fontNames = [DEFAULT_FONT_PAIR.heading, DEFAULT_FONT_PAIR.body, DEFAULT_FONT_PAIR.en];
    for (const f of FORBIDDEN_FONTS) {
      expect(fontNames.join('|')).not.toMatch(new RegExp(f, 'i'));
    }
  });

  it('字号底线：正文≥24、标题≥36、任何可见文本≥18', () => {
    expect(DEFAULT_FONT_PAIR.bodySize).toBeGreaterThanOrEqual(24);
    expect(DEFAULT_FONT_PAIR.headingSize).toBeGreaterThanOrEqual(36);
    expect(DEFAULT_FONT_PAIR.captionSize).toBeGreaterThanOrEqual(18);
    expect(DEFAULT_FONT_PAIR.pageTitleSize).toBeGreaterThanOrEqual(24);
  });

  it('导出主题的正文/标题字号同步放大到 24pt 级别', () => {
    const theme = buildThemeFromDesignDNA(getDefaultDesignDNA(), 'academic');
    expect(theme.bodyFontSize).toBeGreaterThanOrEqual(24);
    expect(theme.titleFontSize).toBeGreaterThanOrEqual(24);
  });

  it('默认色板为「现代学术」深藏青+金（主/背/强调三角色）', () => {
    expect(DEFAULT_COLOR_PALETTE.coverBg).toBe('1B2A4A');
    expect(DEFAULT_COLOR_PALETTE.contentBg).toBe('FAFAFA');
    expect(DEFAULT_COLOR_PALETTE.accent).toBe('C9A227');
    expect(DEFAULT_COLOR_PALETTE.textBody).toBe('2D3436');
  });

  it('默认 DNA 使用现代学术 tokens，且校验零替换', () => {
    const dna = getDefaultDesignDNA();
    expect(dna.colors.coverBg).toBe(DEFAULT_COLOR_PALETTE.coverBg);
    expect(dna.fonts.heading).toBe(DEFAULT_FONT_PAIR.heading);
    expect(dna.components.cardStyle).toBe('shadow-only');
    const result = validateDesignDNA(dna);
    expect(result.valid).toBe(true);
    expect(result.replacementCount).toBe(0);
  });
});
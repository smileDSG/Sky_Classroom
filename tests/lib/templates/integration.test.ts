import { describe, it, expect } from 'vitest';
import { loadTemplate } from '@/lib/templates/template-parser';
import { selectTemplatePage } from '@/lib/templates/content-mapper';
import {
  replacePlaceholders,
  extractPlaceholderValues,
} from '@/lib/templates/placeholder-replacer';
import { VariableResolver } from '@/lib/templates/variable-resolver';

describe('Template-driven rendering integration', () => {
  const templateDir =
    'C:\\\\Users\\\\11486\\\\Desktop\\\\Kimi_Agent_星穹课堂课件模板\\\\tech_dark_blue';

  it('should load a template manifest and pages', () => {
    const { manifest, pages } = loadTemplate(templateDir);
    expect(manifest.title).toContain('科技深蓝');
    expect(manifest.size).toEqual([1280, 720]);
    expect(Object.keys(pages).length).toBeGreaterThan(0);
    expect(pages.cover).toBeDefined();
    expect(pages.cards).toBeDefined();
  });

  it('should resolve color variables', () => {
    const { manifest } = loadTemplate(templateDir);
    const resolver = new VariableResolver(manifest);
    expect(resolver.resolveColor('$primary')).toBe('#0F1D3D');
    expect(resolver.resolveColor('$accent')).toBe('#00D4FF');
    expect(resolver.resolveColor('#FFFFFF')).toBe('#FFFFFF');
  });

  it('should resolve text styles', () => {
    const { manifest } = loadTemplate(templateDir);
    const resolver = new VariableResolver(manifest);
    const style = resolver.resolveStyle('$title');
    expect(style).not.toBeNull();
    expect(style?.fontSize).toBe(44);
  });

  it('should select correct page for compare content', () => {
    const { pages } = loadTemplate(templateDir);
    const content = { type: 'compare', title: '对比标题' } as any;
    const { pageName } = selectTemplatePage(content, pages);
    expect(pageName).toBe('compare');
  });

  it('should fallback to text page for unknown types', () => {
    const { pages } = loadTemplate(templateDir);
    const content = { type: 'unknown', title: '未知' } as any;
    const { pageName } = selectTemplatePage(content, pages);
    expect(pageName).toBe('text');
  });

  it('should replace placeholders in a page', () => {
    const { pages } = loadTemplate(templateDir);
    const content = {
      type: 'compare',
      title: 'Python vs JavaScript',
      left_title: 'Python',
      left_body: '简洁优雅',
      right_title: 'JavaScript',
      right_body: '全栈通用',
    };
    const { page } = selectTemplatePage(content, pages);
    const values = extractPlaceholderValues(content, 'compare');
    const resolved = replacePlaceholders(page, values);

    const titleEl = resolved.elements.find((el) => el.content?.placeholder === 'title');
    expect(titleEl?.content?.text).toContain('Python vs JavaScript');

    const leftBodyEl = resolved.elements.find((el) => el.content?.placeholder === 'left_body');
    expect(leftBodyEl?.content?.text).toContain('简洁优雅');
  });

  it('should handle new content types (quote, sidebar)', () => {
    const { pages } = loadTemplate(templateDir);
    const quoteContent = { type: 'quote', body: '学而时习之' } as any;
    const { pageName: quotePage } = selectTemplatePage(quoteContent, pages);
    expect(quotePage).toBe('text');

    const sidebarContent = { type: 'sidebar', body: '核心观点', main_body: '正文' } as any;
    const { pageName: sidebarPage } = selectTemplatePage(sidebarContent, pages);
    expect(sidebarPage).toBe('split');
  });
});

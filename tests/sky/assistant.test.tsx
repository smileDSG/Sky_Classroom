/**
 * tests/sky/assistant.test.tsx
 *
 * 测试 Sky Classroom AI 助手组件：
 *   - AssistantFab   (悬浮按钮 + 开关控制)
 *   - AssistantPanel (对话面板)
 *   - AssistantConfig(学科/风格/难度选择器)
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { AssistantFab } from '@/components/sky/assistant/assistant-fab';
import { AssistantPanel } from '@/components/sky/assistant/assistant-panel';
import { AssistantConfig } from '@/components/sky/assistant/assistant-config';

function resetStore() {
  localStorage.clear();
  useSkyClassroomStore.setState({
    isOpen: false,
    subject: '',
    style: 'detailed',
    difficulty: 'high-school',
  });
}

// ── AssistantFab ────────────────────────────────────────────────────

describe('AssistantFab', () => {
  beforeEach(() => {
    resetStore();
  });

  it('默认关闭 → 渲染悬浮按钮，不渲染面板', () => {
    render(<AssistantFab />);

    // FAB button 存在
    const fabButton = screen.getByRole('button', { name: '打开 AI 助手' });
    expect(fabButton).toBeDefined();

    // 面板内容不应该存在
    expect(screen.queryByText('AI 助手')).toBeNull();
    expect(screen.queryByText('助手配置')).toBeNull();
  });

  it('点击打开 → 渲染 AssistantPanel 和 AssistantConfig', () => {
    render(<AssistantFab />);

    // 点击 FAB
    const fabButton = screen.getByRole('button', { name: '打开 AI 助手' });
    fireEvent.click(fabButton);

    // 面板标题出现
    expect(screen.getByText('AI 助手')).toBeDefined();
    // 配置栏出现
    expect(screen.getByText('助手配置')).toBeDefined();
  });
});

// ── AssistantPanel ────────────────────────────────────────────────────

describe('AssistantPanel', () => {
  beforeEach(() => {
    resetStore();
    // 需要 isOpen 为 true 才能看到内容
    useSkyClassroomStore.setState({ isOpen: true });
  });

  it('渲染欢迎消息 — "AI 学习助手"文字出现', () => {
    render(<AssistantPanel />);

    // 欢迎区域包含提示文字（组件内使用 "AI 学习助手" 在欢迎文本中）
    expect(screen.getByText(/AI 学习助手/)).toBeDefined();
  });

  it('快捷提示按钮 — 显示 3 个提示按钮', () => {
    render(<AssistantPanel />);

    expect(screen.getByText(/帮我看看这道/)).toBeDefined();
    expect(screen.getByText(/核心概念/)).toBeDefined();
    expect(screen.getByText('怎么高效复习错题')).toBeDefined();
  });

  it('输入框存在 — textarea 存在', () => {
    render(<AssistantPanel />);

    const textarea = screen.getByPlaceholderText('输入你的问题…');
    expect(textarea).toBeDefined();
    expect(textarea.tagName).toBe('TEXTAREA');
  });
});

// ── AssistantConfig ──────────────────────────────────────────────────

describe('AssistantConfig', () => {
  beforeEach(() => {
    resetStore();
    useSkyClassroomStore.setState({ isOpen: true });
  });

  it('学科选择 — 5 个学科按钮都存在', () => {
    render(<AssistantConfig />);

    const subjects = ['数学', '物理', '化学', '语文', '英语'];
    for (const subject of subjects) {
      expect(screen.getByText(subject)).toBeDefined();
    }
  });

  it('风格选择 — 3 个风格按钮', () => {
    render(<AssistantConfig />);

    expect(screen.getByText('详细')).toBeDefined();
    expect(screen.getByText('简洁')).toBeDefined();
    expect(screen.getByText('启发式')).toBeDefined();
  });

  it('难度选择 — 3 个难度按钮', () => {
    render(<AssistantConfig />);

    expect(screen.getByText('初中')).toBeDefined();
    expect(screen.getByText('高中')).toBeDefined();
    expect(screen.getByText('大学')).toBeDefined();
  });
});

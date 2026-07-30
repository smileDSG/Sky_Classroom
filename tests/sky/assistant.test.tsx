/**
 * tests/sky/assistant.test.tsx
 *
 * 测试 Sky Classroom AI 助手组件：
 *   - AssistantFab   (悬浮按钮 + 开关控制)
 *   - AssistantPanel (对话面板)
 *   - AssistantConfig(学科/风格/难度选择器)
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { AssistantFab } from '@/components/sky/assistant/assistant-fab';
import { AssistantPanel } from '@/components/sky/assistant/assistant-panel';
import { AssistantConfig } from '@/components/sky/assistant/assistant-config';

// ── fetch mock — required for AssistantPanel send tests ──────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ── Mock modules that depend on IndexedDB / settings store ──────
vi.mock('@/lib/utils/model-config', () => ({
  getCurrentModelConfig: () => ({
    providerId: 'openai',
    modelId: 'gpt-4',
    modelString: 'openai:gpt-4',
    apiKey: 'mock-key',
    baseUrl: 'https://api.openai.com',
    providerType: 'openai',
  }),
}));

vi.mock('@/lib/ai/memory-context', () => ({
  retrieveRelevantMemories: vi.fn().mockResolvedValue([{ content: 'CLIENT_PRIVATE_MEMORY' }]),
  buildMemoryContext: vi.fn().mockReturnValue('CLIENT_PRIVATE_MEMORY'),
  injectMemoryIntoPrompt: vi.fn(),
  saveExtractedMemories: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai/memory-extractor', () => ({
  extractMemoriesFromConversation: () => [],
  detectConversationTopic: () => '',
  generateConversationSummary: () => '',
}));

vi.mock('@/lib/storage/dao/assistant-conversation', () => ({
  createConversation: async () => ({ id: 'mock-conv-id' }),
  appendMessage: async () => {},
  appendMessages: async () => {},
  updateSummary: async () => {},
  listConversations: async () => [],
  deleteConversation: async () => {},
  getConversation: async () => null,
}));

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
    const fabButton = screen.getByRole('button', { name: '打开小镜课堂' });
    expect(fabButton).toBeDefined();

    // 面板内容不应该存在
    expect(screen.queryByText('小镜课堂')).toBeNull();
    expect(screen.queryByText('助手配置')).toBeNull();
  });

  it('点击打开 → 渲染 AssistantPanel 和 AssistantConfig', () => {
    render(<AssistantFab />);

    // 点击 FAB
    const fabButton = screen.getByRole('button', { name: '打开小镜课堂' });
    fireEvent.click(fabButton);

    // 面板标题出现
    expect(screen.getByText('小镜课堂')).toBeDefined();
    // 配置栏出现
    expect(screen.getByText('助手配置')).toBeDefined();
  });
});

// ── AssistantPanel ────────────────────────────────────────────────────

describe('AssistantPanel', () => {
  beforeEach(() => {
    resetStore();
    mockFetch.mockReset();
    // 需要 isOpen 为 true 才能看到内容
    useSkyClassroomStore.setState({ isOpen: true });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));
              controller.close();
            },
          }),
          { status: 200 },
        ),
      ),
    );
  });

  it('渲染欢迎消息 — "AI 学习助手"文字出现', () => {
    render(<AssistantPanel />);

    // 欢迎区域包含小镜角色提示文字
    expect(screen.getByText(/遇到不会的题目了/)).toBeDefined();
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

  // ── 交互测试（send / loading / error）───────────────────────────

  it('typing in textarea updates input value', () => {
    render(<AssistantPanel />);

    const textarea = screen.getByPlaceholderText('输入你的问题…');
    fireEvent.change(textarea, { target: { value: 'new message' } });

    expect((textarea as HTMLTextAreaElement).value).toBe('new message');
  });

  it('clicking send with empty input does not trigger fetch', () => {
    render(<AssistantPanel />);

    const sendButton = screen.getByRole('button', { name: '发送消息' });
    fireEvent.click(sendButton);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows loading state while waiting for response', async () => {
    // never-resolving promise → loading stays true indefinitely
    mockFetch.mockReturnValue(new Promise<Response>(() => {}));

    render(<AssistantPanel />);

    const textarea = screen.getByPlaceholderText('输入你的问题…');
    fireEvent.change(textarea, { target: { value: 'test message' } });

    const sendButton = screen.getByRole('button', { name: '发送消息' });
    fireEvent.click(sendButton);

    // loading is set synchronously before the async fetch, so button is disabled right away
    await waitFor(() => {
      expect(sendButton).toBeDisabled();
    });
  });

  it('displays error message on API failure', async () => {
    mockFetch.mockRejectedValue(new Error('请求失败，请重试'));

    render(<AssistantPanel />);

    const textarea = screen.getByPlaceholderText('输入你的问题…');
    fireEvent.change(textarea, { target: { value: 'test question' } });

    const sendButton = screen.getByRole('button', { name: '发送消息' });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(screen.getByText('请求失败，请重试')).toBeDefined();
    });
  });

  it('send button is disabled while loading', async () => {
    mockFetch.mockReturnValue(new Promise<Response>(() => {}));

    render(<AssistantPanel />);

    const textarea = screen.getByPlaceholderText('输入你的问题…');
    fireEvent.change(textarea, { target: { value: 'test message' } });

    const sendButton = screen.getByRole('button', { name: '发送消息' });
    fireEvent.click(sendButton);

    // loading is set synchronously → button disabled attribute present
    await waitFor(() => {
      expect(sendButton).toBeDisabled();
    });
  });

  it('发送时不上传客户端 system prompt 或私有 memory context', async () => {
    render(<AssistantPanel />);
    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: '解释二次函数' } });
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const payload = JSON.parse(String(init?.body));

    expect(payload.messages).toEqual([{ role: 'user', content: '解释二次函数' }]);
    expect(payload).not.toHaveProperty('memoryContext');
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

/**
 * Message Converter Tests
 *
 * Tests for convertMessagesToOpenAI — the function that converts UI messages
 * into OpenAI-format messages for the LLM. Covers:
 * - User message conversion
 * - QA/Discussion assistant messages (JSON array format)
 * - Lecture messages (plain text format — regression test for context injection)
 * - Cross-agent message attribution
 * - Interrupted message annotation
 * - Empty message filtering
 */
import { describe, test, expect } from 'vitest';
import { convertMessagesToOpenAI } from '@/lib/orchestration/summarizers/message-converter';
import type { UIMessage } from 'ai';
import type { ChatMessageMetadata } from '@/lib/types/chat';

// ─── Helpers ───

function userMsg(text: string, metadata?: Partial<ChatMessageMetadata>): UIMessage<ChatMessageMetadata> {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    parts: [{ type: 'text', text }],
    metadata: {
      originalRole: 'user',
      createdAt: Date.now(),
      ...metadata,
    },
  };
}

function assistantMsg(
  parts: UIMessage<ChatMessageMetadata>['parts'],
  metadata?: Partial<ChatMessageMetadata>,
): UIMessage<ChatMessageMetadata> {
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    parts,
    metadata: {
      senderName: 'Teacher',
      originalRole: 'agent',
      createdAt: Date.now(),
      ...metadata,
    },
  };
}

function lectureMsg(texts: string[], metadata?: Partial<ChatMessageMetadata>): UIMessage<ChatMessageMetadata> {
  return {
    id: `lecture-${Date.now()}`,
    role: 'assistant',
    parts: texts.map((text) => ({ type: 'text', text })),
    metadata: {
      senderName: 'Teacher',
      originalRole: 'teacher',
      agentId: 'default-1',
      createdAt: Date.now(),
      ...metadata,
    },
  };
}

// ─── Tests ───

describe('convertMessagesToOpenAI', () => {
  describe('user messages', () => {
    test('converts plain text user message', () => {
      const result = convertMessagesToOpenAI([userMsg('什么是光合作用？')]);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toBe('什么是光合作用？');
    });

    test('concatenates multiple text parts', () => {
      const msg: UIMessage<ChatMessageMetadata> = {
        id: 'u1',
        role: 'user',
        parts: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
        metadata: { originalRole: 'user', createdAt: Date.now() },
      };
      const result = convertMessagesToOpenAI([msg]);
      expect(result[0].content).toBe('Hello \nworld');
    });

    test('includes action results in user message', () => {
      const msg: UIMessage<ChatMessageMetadata> = {
        id: 'u1',
        role: 'user',
        parts: [
          { type: 'text', text: '请解释' },
          {
            type: 'action-spotlight',
            actionName: 'spotlight',
            state: 'result',
            output: { success: true },
          } as unknown as UIMessage<ChatMessageMetadata>['parts'][number],
        ],
        metadata: { senderName: 'You', originalRole: 'user', createdAt: Date.now() },
      };
      const result = convertMessagesToOpenAI([msg]);
      expect(result[0].content).toContain('请解释');
      expect(result[0].content).toContain('[Action spotlight: success]');
    });

    test('adds sender name prefix for discussion messages', () => {
      const result = convertMessagesToOpenAI([
        userMsg('我觉得光合作用很有趣', { senderName: '小明' }),
      ]);
      expect(result[0].content).toContain('[小明]');
      expect(result[0].content).toContain('我觉得光合作用很有趣');
    });

    test('annotates interrupted messages', () => {
      const msg: UIMessage<ChatMessageMetadata> = {
        id: 'u1',
        role: 'user',
        parts: [{ type: 'text', text: '被打断了' }],
        metadata: {
          senderName: 'You',
          originalRole: 'user',
          createdAt: Date.now(),
          interrupted: true,
        },
      };
      const result = convertMessagesToOpenAI([msg]);
      expect(result[0].content).toContain('interrupted');
      expect(result[0].content).toContain('被打断了');
    });
  });

  describe('QA/Discussion assistant messages', () => {
    test('converts text parts to JSON array format', () => {
      const msg = assistantMsg([
        { type: 'text', text: '光合作用是植物将光能转化为化学能的过程。' },
      ]);
      const result = convertMessagesToOpenAI([msg]);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');

      const parsed = JSON.parse(result[0].content);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('text');
      expect(parsed[0].content).toContain('光合作用');
    });

    test('converts action parts to JSON array format', () => {
      const msg = assistantMsg([
        { type: 'text', text: '请看白板' },
        {
          type: 'action-wb_open',
          actionName: 'wb_open',
          state: 'result',
          output: { success: true },
        } as unknown as UIMessage<ChatMessageMetadata>['parts'][number],
      ]);
      const result = convertMessagesToOpenAI([msg]);

      const parsed = JSON.parse(result[0].content);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].type).toBe('text');
      expect(parsed[1].type).toBe('action');
      expect(parsed[1].name).toBe('wb_open');
    });

    test('converts failed action with error message', () => {
      const msg = assistantMsg([
        {
          type: 'action-wb_draw_text',
          actionName: 'wb_draw_text',
          state: 'result',
          output: { success: false, error: 'Canvas not available' },
        } as unknown as UIMessage<ChatMessageMetadata>['parts'][number],
      ]);
      const result = convertMessagesToOpenAI([msg]);

      const parsed = JSON.parse(result[0].content);
      expect(parsed[0].result).toBe('Canvas not available');
    });

    test('converts action with data output', () => {
      const msg = assistantMsg([
        {
          type: 'action-web_search',
          actionName: 'web_search',
          state: 'result',
          output: { success: true, data: { results: ['a', 'b'] } },
        } as unknown as UIMessage<ChatMessageMetadata>['parts'][number],
      ]);
      const result = convertMessagesToOpenAI([msg]);

      const parsed = JSON.parse(result[0].content);
      expect(parsed[0].result).toContain('result:');
    });
  });

  describe('lecture messages (regression: context injection)', () => {
    test('converts lecture message to plain text (not JSON)', () => {
      const msg = lectureMsg(['光合作用是植物利用光能将二氧化碳和水转化为葡萄糖和氧气的过程。']);
      const result = convertMessagesToOpenAI([msg]);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      // Should be plain text, NOT JSON array format
      expect(result[0].content).toBe('光合作用是植物利用光能将二氧化碳和水转化为葡萄糖和氧气的过程。');
      // Should NOT start with '[' (JSON array format used by QA responses)
      expect(result[0].content).not.toMatch(/^\[/);
    });

    test('joins multiple lecture text parts with newlines', () => {
      const msg = lectureMsg([
        '第一段：光合作用的定义。',
        '第二段：光合作用的反应方程式。',
        '第三段：光合作用的意义。',
      ]);
      const result = convertMessagesToOpenAI([msg]);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('第一段');
      expect(result[0].content).toContain('第二段');
      expect(result[0].content).toContain('第三段');
      expect(result[0].content.split('\n')).toHaveLength(3);
    });

    test('filters out action parts from lecture messages', () => {
      const msg: UIMessage<ChatMessageMetadata> = {
        id: 'lecture-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: '请看这个公式' },
          { type: 'action-spotlight', elementId: 'img_1' } as unknown as UIMessage<ChatMessageMetadata>['parts'][number],
          { type: 'text', text: '这是光合作用的方程式' },
        ],
        metadata: {
          senderName: 'Teacher',
          originalRole: 'teacher',
          agentId: 'default-1',
          createdAt: Date.now(),
        },
      };
      const result = convertMessagesToOpenAI([msg]);

      expect(result).toHaveLength(1);
      // Only text parts should be included
      expect(result[0].content).toContain('请看这个公式');
      expect(result[0].content).toContain('这是光合作用的方程式');
      // Should NOT contain action-related content
      expect(result[0].content).not.toContain('spotlight');
    });

    test('handles lecture message with no text parts', () => {
      const msg: UIMessage<ChatMessageMetadata> = {
        id: 'lecture-1',
        role: 'assistant',
        parts: [
          { type: 'action-spotlight', elementId: 'img_1' } as unknown as UIMessage<ChatMessageMetadata>['parts'][number],
        ],
        metadata: {
          senderName: 'Teacher',
          originalRole: 'teacher',
          agentId: 'default-1',
          createdAt: Date.now(),
        },
      };
      const result = convertMessagesToOpenAI([msg]);
      // Should be filtered out (empty content)
      expect(result).toHaveLength(0);
    });

    test('lecture + QA messages are correctly ordered', () => {
      const lecture = lectureMsg(['光合作用的定义是...']);
      const user = userMsg('能举个例子吗？');
      const qaReply = assistantMsg([{ type: 'text', text: '当然可以！比如...' }]);

      const result = convertMessagesToOpenAI([lecture, user, qaReply]);
      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('assistant'); // lecture
      expect(result[1].role).toBe('user'); // question
      expect(result[2].role).toBe('assistant'); // QA reply
    });
  });

  describe('cross-agent attribution', () => {
    test('converts different-agent message to user role with attribution', () => {
      const msg = assistantMsg(
        [{ type: 'text', text: '我觉得这个问题很好' }],
        { agentId: 'student-1', senderName: '小明' },
      );
      const result = convertMessagesToOpenAI([msg], 'teacher-1');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('user');
      expect(result[0].content).toContain('[小明]');
      expect(result[0].content).toContain('我觉得这个问题很好');
    });

    test('keeps same-agent message as assistant role', () => {
      const msg = assistantMsg(
        [{ type: 'text', text: '好的，让我解释一下' }],
        { agentId: 'teacher-1' },
      );
      const result = convertMessagesToOpenAI([msg], 'teacher-1');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
    });
  });

  describe('filtering', () => {
    test('filters out empty messages', () => {
      const msg = assistantMsg([]);
      const result = convertMessagesToOpenAI([msg]);
      expect(result).toHaveLength(0);
    });

    test('filters out user messages with only dots', () => {
      const msg: UIMessage<ChatMessageMetadata> = {
        id: 'a1',
        role: 'user',
        parts: [{ type: 'text', text: '...' }],
        metadata: { originalRole: 'user', createdAt: Date.now() },
      };
      const result = convertMessagesToOpenAI([msg]);
      expect(result).toHaveLength(0);
    });

    test('filters out system messages', () => {
      const msg: UIMessage<ChatMessageMetadata> = {
        id: 'sys1',
        role: 'system' as UIMessage['role'],
        parts: [{ type: 'text', text: 'system message' }],
        metadata: { senderName: 'System', originalRole: 'agent', createdAt: Date.now() },
      } as unknown as UIMessage<ChatMessageMetadata>;
      const result = convertMessagesToOpenAI([msg]);
      expect(result).toHaveLength(0);
    });
  });
});

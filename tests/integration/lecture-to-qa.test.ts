/**
 * Lecture → QA Context Injection Tests
 *
 * End-to-end integration tests verifying that when a user asks a question
 * during a lecture, the lecture context is properly injected into the QA
 * session so the AI can answer about what was just taught.
 *
 * This is a regression test suite for the fix that addressed:
 * "teacher re-lectures or gives irrelevant answers when user asks a question"
 */
import { describe, test, expect } from 'vitest';
import { convertMessagesToOpenAI } from '@/lib/orchestration/summarizers/message-converter';
import type { UIMessage } from 'ai';
import type { ChatMessageMetadata } from '@/lib/types/chat';

// ─── Helpers ───

function makeLectureMessage(texts: string[]): UIMessage<ChatMessageMetadata> {
  return {
    id: `lecture-${Date.now()}`,
    role: 'assistant',
    parts: texts.map((text) => ({ type: 'text', text })),
    metadata: {
      senderName: 'Teacher',
      originalRole: 'teacher',
      agentId: 'default-1',
      createdAt: Date.now(),
    },
  };
}

function makeUserMessage(text: string): UIMessage<ChatMessageMetadata> {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    parts: [{ type: 'text', text }],
    metadata: {
      senderName: 'You',
      originalRole: 'user',
      createdAt: Date.now(),
    },
  };
}

function makeQAResponse(text: string): UIMessage<ChatMessageMetadata> {
  return {
    id: `qa-${Date.now()}`,
    role: 'assistant',
    parts: [{ type: 'text', text }],
    metadata: {
      senderName: 'Teacher',
      originalRole: 'agent',
      createdAt: Date.now(),
    },
  };
}

// ─── Tests ───

describe('Lecture → QA Context Injection', () => {
  describe('convertMessagesToOpenAI handles lecture messages', () => {
    test('lecture message converts to plain text (not JSON array)', () => {
      const lecture = makeLectureMessage([
        '光合作用是植物利用光能将二氧化碳和水转化为葡萄糖和氧气的过程。',
      ]);
      const result = convertMessagesToOpenAI([lecture]);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('assistant');
      // Must be plain text, NOT JSON array format
      expect(result[0].content).toContain('光合作用');
      // Should NOT start with '[' (JSON array format used by QA responses)
      expect(result[0].content).not.toMatch(/^\[/);
    });

    test('multi-part lecture joins with newlines', () => {
      const lecture = makeLectureMessage([
        '首先，光合作用的定义是...',
        '其次，光合作用的反应方程式为...',
        '最后，光合作用的意义在于...',
      ]);
      const result = convertMessagesToOpenAI([lecture]);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('首先');
      expect(result[0].content).toContain('其次');
      expect(result[0].content).toContain('最后');
      expect(result[0].content.split('\n')).toHaveLength(3);
    });

    test('lecture with action parts filters out actions, keeps text only', () => {
      const lecture: UIMessage<ChatMessageMetadata> = {
        id: 'lecture-1',
        role: 'assistant',
        parts: [
          { type: 'text', text: '请看这个图片' },
          {
            type: 'action-spotlight',
            elementId: 'img_1',
          } as unknown as UIMessage<ChatMessageMetadata>['parts'][number],
          { type: 'text', text: '这是叶绿体的结构图' },
        ],
        metadata: {
          senderName: 'Teacher',
          originalRole: 'teacher',
          agentId: 'default-1',
          createdAt: Date.now(),
        },
      };
      const result = convertMessagesToOpenAI([lecture]);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('请看这个图片');
      expect(result[0].content).toContain('这是叶绿体的结构图');
      expect(result[0].content).not.toContain('spotlight');
    });
  });

  describe('full lecture → QA message flow', () => {
    test('lecture + user question + QA response all convert correctly', () => {
      const lecture = makeLectureMessage(['光合作用需要光照、水分和二氧化碳。']);
      const userQ = makeUserMessage('那如果没有光照会怎样？');
      const qaReply = makeQAResponse('如果没有光照，植物无法进行光合作用，会消耗自身的储存能量。');

      const result = convertMessagesToOpenAI([lecture, userQ, qaReply]);

      expect(result).toHaveLength(3);

      // Lecture: plain text assistant message (not JSON array)
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toContain('光合作用需要光照');
      expect(result[0].content).not.toMatch(/^\[/);

      // User question: plain text
      expect(result[1].role).toBe('user');
      expect(result[1].content).toContain('没有光照');

      // QA response: JSON array format (not lecture)
      expect(result[2].role).toBe('assistant');
      const parsed = JSON.parse(result[2].content);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].type).toBe('text');
      expect(parsed[0].content).toContain('没有光照');
    });

    test('multiple lecture segments before question', () => {
      const lecture1 = makeLectureMessage(['第一部分：光合作用的定义。']);
      const lecture2 = makeLectureMessage(['第二部分：光合作用的条件。']);
      const userQ = makeUserMessage('条件具体有哪些？');

      const result = convertMessagesToOpenAI([lecture1, lecture2, userQ]);

      expect(result).toHaveLength(3);
      // Both lectures should be plain text
      expect(result[0].role).toBe('assistant');
      expect(result[1].role).toBe('assistant');
      expect(result[0].content).toContain('定义');
      expect(result[1].content).toContain('条件');
      // User question preserved
      expect(result[2].role).toBe('user');
      expect(result[2].content).toContain('条件具体有哪些');
    });

    test('lecture context is available for LLM to reference', () => {
      const lecture = makeLectureMessage([
        '光合作用的方程式：6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂',
        '这个反应发生在叶绿体中。',
      ]);
      const userQ = makeUserMessage('产物中的氧气是从哪里来的？');

      const result = convertMessagesToOpenAI([lecture, userQ]);

      // The lecture content must be present so the LLM can reference it
      const lectureContent = result[0].content;
      expect(lectureContent).toContain('CO₂');
      expect(lectureContent).toContain('H₂O');
      expect(lectureContent).toContain('叶绿体');

      // User question should be right after
      expect(result[1].content).toContain('氧气');
    });
  });

  describe('no-lecture scenario', () => {
    test('regular QA session without lecture works normally', () => {
      const userQ = makeUserMessage('什么是光合作用？');
      const qaReply = makeQAResponse('光合作用是植物将光能转化为化学能的过程。');

      const result = convertMessagesToOpenAI([userQ, qaReply]);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('user');
      expect(result[1].role).toBe('assistant');

      // QA response should be JSON array format
      const parsed = JSON.parse(result[1].content);
      expect(Array.isArray(parsed)).toBe(true);
    });

    test('empty lecture message does not produce empty assistant message', () => {
      const emptyLecture: UIMessage<ChatMessageMetadata> = {
        id: 'lecture-empty',
        role: 'assistant',
        parts: [],
        metadata: {
          senderName: 'Teacher',
          originalRole: 'teacher',
          agentId: 'default-1',
          createdAt: Date.now(),
        },
      };
      const result = convertMessagesToOpenAI([emptyLecture]);
      expect(result).toHaveLength(0);
    });
  });

  describe('session message injection simulation', () => {
    test('simulates use-chat-sessions lecture context injection', () => {
      // This simulates the logic in use-chat-sessions.ts:
      // When transitioning from lecture to QA, lecture messages are prepended
      const lectureMessages: UIMessage<ChatMessageMetadata>[] = [
        makeLectureMessage(['今天我们学习光合作用。']),
        makeLectureMessage(['光合作用分为光反应和暗反应两个阶段。']),
      ];

      const userQuestion = makeUserMessage('什么是光反应？');

      // Simulate the injection: [...lectureContextMessages, userMessage]
      const sessionMessages = [...lectureMessages, userQuestion];

      const result = convertMessagesToOpenAI(sessionMessages);

      // 2 lectures + 1 question = 3 messages
      expect(result).toHaveLength(3);

      // First two are lecture (plain text assistant)
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toContain('光合作用');
      expect(result[1].role).toBe('assistant');
      expect(result[1].content).toContain('光反应和暗反应');

      // Third is user question
      expect(result[2].role).toBe('user');
      expect(result[2].content).toContain('什么是光反应');
    });

    test('simulates existing QA session with lecture context prepended', () => {
      // Existing QA session already has messages
      const existingQAMessages: UIMessage<ChatMessageMetadata>[] = [
        makeUserMessage('之前的问题'),
        makeQAResponse('之前的回答'),
      ];

      // New lecture context + new question
      const lectureContext = [makeLectureMessage(['新的讲课内容：叶绿体'])];
      const newQuestion = makeUserMessage('叶绿体的结构是什么？');

      // Simulate: [...lectureContextMessages, ...existingSession.messages, userMessage]
      const sessionMessages = [...lectureContext, ...existingQAMessages, newQuestion];

      const result = convertMessagesToOpenAI(sessionMessages);

      expect(result).toHaveLength(4);
      // Lecture is first
      expect(result[0].role).toBe('assistant');
      expect(result[0].content).toContain('叶绿体');
      // Then existing QA
      expect(result[1].role).toBe('user');
      expect(result[2].role).toBe('assistant');
      // Then new question
      expect(result[3].role).toBe('user');
      expect(result[3].content).toContain('叶绿体的结构');
    });
  });
});

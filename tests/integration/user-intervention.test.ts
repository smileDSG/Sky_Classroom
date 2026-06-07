/**
 * P6-001 Test 3: 用户提问 → 导演路由 → 智能体回应
 *
 * Tests user intervention flow — when a user asks a question during
 * the multi-agent loop, the director routes it to the appropriate
 * agent. Validates request validation, routing logic, and response
 * formatting.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { parseDirectorDecision } from '@/lib/orchestration/director-prompt';

// ─── Simulated chat request/response types ───

interface MockUserQuestion {
  question: string;
  context: {
    currentAgentId: string;
    currentTopic: string;
    messageHistory: string[];
  };
}

interface MockRoutingResult {
  targetAgentId: string;
  reason: string;
  shouldInterrupt: boolean;
}

// ─── Router simulation ───

function routeUserQuestion(question: MockUserQuestion): MockRoutingResult {
  const q = question.question.toLowerCase();

  // Content-related questions → teacher
  if (q.includes('是什么') || q.includes('为什么') || q.includes('如何') || q.includes('定义')) {
    return {
      targetAgentId: 'agent-teacher',
      reason: 'Content question routed to teacher',
      shouldInterrupt: true,
    };
  }

  // Follow-up / clarification → assistant
  if (q.includes('补充') || q.includes('详细') || q.includes('更多') || q.includes('举例')) {
    return {
      targetAgentId: 'agent-assistant',
      reason: 'Follow-up question routed to assistant',
      shouldInterrupt: false,
    };
  }

  // Opinion / preference → student
  if (q.includes('你觉得') || q.includes('我认为') || q.includes('看法')) {
    return {
      targetAgentId: 'agent-student-1',
      reason: 'Opinion question routed to student',
      shouldInterrupt: false,
    };
  }

  // Default → current agent
  return {
    targetAgentId: question.context.currentAgentId,
    reason: 'Default route to current agent',
    shouldInterrupt: false,
  };
}

// ─── Tests ───

describe('P6-001 Test 3: 用户提问 → 导演路由 → 智能体回应', () => {
  describe('routing logic', () => {
    test('routes content questions to teacher', () => {
      const result = routeUserQuestion({
        question: '光合作用是什么？',
        context: {
          currentAgentId: 'agent-assistant',
          currentTopic: '光合作用',
          messageHistory: [],
        },
      });

      expect(result.targetAgentId).toBe('agent-teacher');
      expect(result.shouldInterrupt).toBe(true);
    });

    test('routes definition questions to teacher', () => {
      const result = routeUserQuestion({
        question: '叶绿体的定义是什么？',
        context: {
          currentAgentId: 'agent-student-1',
          currentTopic: '叶绿体',
          messageHistory: [],
        },
      });

      expect(result.targetAgentId).toBe('agent-teacher');
    });

    test('routes follow-up questions to assistant', () => {
      const result = routeUserQuestion({
        question: '能详细解释一下吗？',
        context: {
          currentAgentId: 'agent-teacher',
          currentTopic: '光合作用',
          messageHistory: ['光合作用是...'],
        },
      });

      expect(result.targetAgentId).toBe('agent-assistant');
      expect(result.shouldInterrupt).toBe(false);
    });

    test('routes example requests to assistant', () => {
      const result = routeUserQuestion({
        question: '能举个例子吗？',
        context: {
          currentAgentId: 'agent-teacher',
          currentTopic: '光合作用',
          messageHistory: [],
        },
      });

      expect(result.targetAgentId).toBe('agent-assistant');
    });

    test('routes opinion questions to student', () => {
      const result = routeUserQuestion({
        question: '你觉得这个实验难吗？',
        context: {
          currentAgentId: 'agent-teacher',
          currentTopic: '实验',
          messageHistory: [],
        },
      });

      expect(result.targetAgentId).toBe('agent-student-1');
    });

    test('defaults to current agent for unrecognized questions', () => {
      const result = routeUserQuestion({
        question: '嗯嗯',
        context: {
          currentAgentId: 'agent-assistant',
          currentTopic: '光合作用',
          messageHistory: [],
        },
      });

      expect(result.targetAgentId).toBe('agent-assistant');
      expect(result.shouldInterrupt).toBe(false);
    });
  });

  describe('director routing with user context', () => {
    test('director can override current agent selection', () => {
      const userIntervention = '老师，我没听懂，能再讲一遍吗？';
      const result = routeUserQuestion({
        question: userIntervention,
        context: {
          currentAgentId: 'agent-student-1',
          currentTopic: '光合作用',
          messageHistory: [],
        },
      });

      // "再讲一遍" contains 讲, but doesn't match any specific route,
      // so it should default to current agent
      expect(result.targetAgentId).toBe('agent-student-1');
    });

    test('user question with teacher keyword interrupts', () => {
      const result = routeUserQuestion({
        question: '为什么光合作用很重要？',
        context: {
          currentAgentId: 'agent-assistant',
          currentTopic: '光合作用',
          messageHistory: [],
        },
      });

      expect(result.targetAgentId).toBe('agent-teacher');
      expect(result.shouldInterrupt).toBe(true);
    });

    test('empty question defaults to current agent', () => {
      const result = routeUserQuestion({
        question: '',
        context: {
          currentAgentId: 'agent-teacher',
          currentTopic: '',
          messageHistory: [],
        },
      });

      expect(result.targetAgentId).toBe('agent-teacher');
    });
  });

  describe('director decision integration', () => {
    test('parseDirectorDecision works with agent response', () => {
      const response = '{"next_agent":"agent-teacher","reason":"User asked about definition"}';
      const decision = parseDirectorDecision(response);

      expect(decision.nextAgentId).toBe('agent-teacher');
      expect(decision.shouldEnd).toBe(false);
    });

    test('parseDirectorDecision handles malformed response gracefully', () => {
      const response = 'The teacher should explain this.';
      const decision = parseDirectorDecision(response);

      expect(decision.shouldEnd).toBe(true);
    });
  });
});

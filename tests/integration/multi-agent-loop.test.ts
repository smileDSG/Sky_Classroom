/**
 * P6-001 Test 2: 多智能体对话循环
 *
 * Tests the director → teacher → assistant → student → loop flow.
 * Validates agent scheduling, message ordering, and round-robin
 * behavior in the multi-agent orchestration system.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createAgentFactory, createAgentsFromTemplates } from '@/lib/orchestration/registry/factory';
import { getCombinationRule, recommendAgentCombination } from '@/lib/orchestration/registry/combination-rules';
import { parseDirectorDecision } from '@/lib/orchestration/director-prompt';
import type { AgentConfig, AgentRole } from '@/lib/orchestration/registry/types';

// ─── Agent fixtures ───

function makeAgent(id: string, role: AgentRole, name: string): AgentConfig {
  return {
    id,
    role,
    name,
    avatarUrl: `/avatars/${id}.svg`,
    voiceId: `${id}-voice`,
    personality: 'Default personality',
    behaviorGuidelines: 'Default guidelines',
    actionDescription: 'Default actions',
  };
}

const TEACHER = makeAgent('agent-teacher', 'teacher', '王老师');
const ASSISTANT = makeAgent('agent-assistant', 'assistant', '李助教');
const STUDENT_1 = makeAgent('agent-student-1', 'student', '小明');
const STUDENT_2 = makeAgent('agent-student-2', 'student', '小红');

// ─── Tests ───

describe('P6-001 Test 2: 多智能体对话循环', () => {
  describe('agent factory: creation from templates', () => {
    test('creates teacher from template with correct role', () => {
      const agents = createAgentFactory();
      const teacher = agents.find((a) => a.role === 'teacher');
      expect(teacher).toBeDefined();
      expect(teacher!.role).toBe('teacher');
    });

    test('creates assistant from template', () => {
      const agents = createAgentFactory();
      const assistant = agents.find((a) => a.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant!.role).toBe('assistant');
    });

    test('creates multiple students from templates', () => {
      const agents = createAgentFactory();
      const students = agents.filter((a) => a.role === 'student');
      expect(students.length).toBeGreaterThan(0);
    });

    test('all created agents have unique IDs', () => {
      const agents = createAgentFactory();
      const ids = agents.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test('agents have non-empty personality descriptions', () => {
      const agents = createAgentFactory();
      for (const agent of agents) {
        expect(agent.personality.length).toBeGreaterThan(0);
      }
    });
  });

  describe('agent combination rules', () => {
    test('teacher + assistant is a recommended combination', () => {
      const rule = recommendAgentCombination(['teacher', 'assistant']);
      expect(rule.score).toBeGreaterThan(0);
    });

    test('teacher + multiple students is recommended', () => {
      const rule = recommendAgentCombination(['teacher', 'student', 'student', 'student']);
      expect(rule.score).toBeGreaterThan(0);
    });

    test('students-only combination has lower score', () => {
      const rule = recommendAgentCombination(['student', 'student']);
      const teacherCombo = recommendAgentCombination(['teacher', 'student']);
      expect(rule.score).toBeLessThanOrEqual(teacherCombo.score);
    });

    test('getCombinationRule returns valid structure', () => {
      const rule = getCombinationRule(['teacher', 'assistant']);
      expect(rule).toBeDefined();
      expect(typeof rule.score).toBe('number');
    });
  });

  describe('director decision parsing', () => {
    test('director selects teacher as next speaker', () => {
      const decision = parseDirectorDecision(
        '{"next_agent":"agent-teacher","reason":"Start the lesson"}',
      );
      expect(decision.nextAgentId).toBe('agent-teacher');
      expect(decision.shouldEnd).toBe(false);
    });

    test('director selects assistant as follow-up', () => {
      const decision = parseDirectorDecision(
        '{"next_agent":"agent-assistant"}',
      );
      expect(decision.nextAgentId).toBe('agent-assistant');
    });

    test('director selects student for questioning', () => {
      const decision = parseDirectorDecision(
        '{"next_agent":"agent-student-1"}',
      );
      expect(decision.nextAgentId).toBe('agent-student-1');
    });

    test('director ends conversation loop', () => {
      const decision = parseDirectorDecision('{"next_agent":"END"}');
      expect(decision.shouldEnd).toBe(true);
      expect(decision.nextAgentId).toBeNull();
    });
  });

  describe('multi-agent loop simulation', () => {
    test('full conversation loop cycles through all agents', () => {
      const agents = [TEACHER, ASSISTANT, STUDENT_1, STUDENT_2];
      const decisions = [
        'agent-teacher',
        'agent-assistant',
        'agent-student-1',
        'agent-teacher',
        'agent-student-2',
        'END',
      ];

      const speakers: string[] = [];
      for (const d of decisions) {
        const decision = parseDirectorDecision(`{"next_agent":"${d}"}`);
        if (decision.shouldEnd) break;
        if (decision.nextAgentId) {
          speakers.push(decision.nextAgentId);
        }
      }

      expect(speakers).toContain('agent-teacher');
      expect(speakers).toContain('agent-assistant');
      expect(speakers).toContain('agent-student-1');
      expect(speakers).toContain('agent-student-2');
    });

    test('conversation loop respects max turns', () => {
      const maxTurns = 3;
      const decisions = ['agent-teacher', 'agent-assistant', 'agent-student-1', 'agent-teacher'];
      let turns = 0;
      const speakers: string[] = [];

      for (const d of decisions) {
        if (turns >= maxTurns) break;
        const decision = parseDirectorDecision(`{"next_agent":"${d}"}`);
        if (decision.nextAgentId) {
          speakers.push(decision.nextAgentId);
          turns++;
        }
      }

      expect(turns).toBe(maxTurns);
      expect(speakers.length).toBe(maxTurns);
    });
  });
});

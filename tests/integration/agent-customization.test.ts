/**
 * P6-001 Test 8: 智能体自定义 → 创建 → 使用
 *
 * Tests the full agent customization flow — creating custom agents
 * from templates, configuring their behavior, and using them in
 * the classroom.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { createAgentFromTemplate } from '@/lib/orchestration/registry/factory';
import type { AgentConfig, AgentTemplate } from '@/lib/orchestration/registry/types';

// ─── Agent creation simulation ───

function createCustomAgent(overrides: Partial<AgentConfig>): AgentConfig {
  return {
    id: `custom-${Date.now()}`,
    role: 'student',
    name: 'Custom Agent',
    avatarUrl: '/avatars/default.svg',
    voiceId: 'default-voice',
    personality: 'Default personality',
    behaviorGuidelines: 'Default guidelines',
    actionDescription: 'Default actions',
    ...overrides,
  };
}

// ─── Tests ───

describe('P6-001 Test 8: 智能体自定义 → 创建 → 使用', () => {
  describe('agent creation from template', () => {
    test('creates agent from teacher template', () => {
      const agent = createAgentFromTemplate('teacher');
      expect(agent).toBeDefined();
      expect(agent.role).toBe('teacher');
    });

    test('creates agent from assistant template', () => {
      const agent = createAgentFromTemplate('assistant');
      expect(agent).toBeDefined();
      expect(agent.role).toBe('assistant');
    });

    test('created agent has non-empty personality', () => {
      const agent = createAgentFromTemplate('teacher');
      expect(agent.personality.length).toBeGreaterThan(0);
    });

    test('created agent has non-empty behavior guidelines', () => {
      const agent = createAgentFromTemplate('teacher');
      expect(agent.behaviorGuidelines.length).toBeGreaterThan(0);
    });

    test('created agent has unique ID', () => {
      const agent1 = createAgentFromTemplate('teacher');
      const agent2 = createAgentFromTemplate('teacher');
      expect(agent1.id).not.toBe(agent2.id);
    });
  });

  describe('custom agent configuration', () => {
    test('creates custom student agent with specific personality', () => {
      const agent = createCustomAgent({
        name: '好奇的小明',
        personality: 'Always asking questions about science.',
        role: 'student',
      });

      expect(agent.name).toBe('好奇的小明');
      expect(agent.personality).toContain('asking questions');
      expect(agent.role).toBe('student');
    });

    test('creates custom teacher with subject specialization', () => {
      const agent = createCustomAgent({
        name: '物理老师',
        personality: 'Specializes in physics education.',
        role: 'teacher',
      });

      expect(agent.role).toBe('teacher');
      expect(agent.name).toBe('物理老师');
    });

    test('custom agent preserves default fields for unspecified values', () => {
      const agent = createCustomAgent({
        name: 'Test Agent',
      });

      expect(agent.avatarUrl).toBe('/avatars/default.svg');
      expect(agent.voiceId).toBe('default-voice');
      expect(agent.personality).toBe('Default personality');
    });

    test('custom agent ID is unique per creation', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 10; i++) {
        const agent = createCustomAgent({ name: `Agent ${i}` });
        ids.add(agent.id);
      }
      expect(ids.size).toBe(10);
    });
  });

  describe('agent usage in classroom', () => {
    test('custom agent can be added to agent list', () => {
      const agents: AgentConfig[] = [
        createAgentFromTemplate('teacher'),
        createAgentFromTemplate('assistant'),
      ];

      const custom = createCustomAgent({ name: 'Custom Student' });
      agents.push(custom);

      expect(agents).toHaveLength(3);
      expect(agents[2].name).toBe('Custom Student');
    });

    test('custom agent has all required fields for rendering', () => {
      const agent = createCustomAgent({ name: 'Test' });

      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('role');
      expect(agent).toHaveProperty('avatarUrl');
      expect(agent).toHaveProperty('voiceId');
      expect(agent).toHaveProperty('personality');
    });

    test('custom agent can replace default agent', () => {
      const defaults = createAgentFactory();
      const custom = createCustomAgent({
        id: defaults[0].id, // Override ID to replace
        name: 'Replacement',
      });

      const index = defaults.findIndex((a) => a.id === custom.id);
      defaults[index] = custom;

      expect(defaults[index].name).toBe('Replacement');
    });
  });

  describe('agent template system', () => {
    test('available templates include teacher', () => {
      const agent = createAgentFromTemplate('teacher');
      expect(agent.role).toBe('teacher');
    });

    test('available templates include students', () => {
      const templates = ['curious', 'analytical', 'creative', 'note-taker'];
      for (const t of templates) {
        const agent = createAgentFromTemplate(t as 'curious');
        expect(agent).toBeDefined();
      }
    });
  });
});

function createAgentFactory(): AgentConfig[] {
  return [
    createAgentFromTemplate('teacher'),
    createAgentFromTemplate('assistant'),
  ];
}

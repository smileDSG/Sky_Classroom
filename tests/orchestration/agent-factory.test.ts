/**
 * Phase 1 (B-002): Agent factory + templates tests
 *
 * Validates:
 * - All 6 template files exist and are well-formed
 * - AgentFactory creates correct AgentConfig from templates
 * - AgentFactory creates from LLM params with proper defaults
 * - AgentFactory creates custom agents
 * - DEFAULT_AGENTS built from templates matches expected shape
 * - Template registry list/register/remove works
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { AgentFactory, resetAgentFactory } from '@/lib/orchestration/registry/factory';
import { getActionsForRole } from '@/lib/orchestration/registry/types';
import type { AgentConfig, AgentTemplate } from '@/lib/orchestration/registry/types';
import {
  ALL_DEFAULT_TEMPLATES,
  DEFAULT_AGENT_TEMPLATE_MAP,
  teacherTemplate,
  assistantTemplate,
  STUDENT_TEMPLATES,
} from '@/lib/orchestration/registry/templates';

function makeFactory(): AgentFactory {
  resetAgentFactory();
  return new AgentFactory();
}

// ─── Template Existence ───

describe('Phase 1: Templates', () => {
  test('teacher template exists and has required fields', () => {
    expect(teacherTemplate.name).toBe('Teacher');
    expect(teacherTemplate.role).toBe('teacher');
    expect(teacherTemplate.persona).toBeTruthy();
    expect(teacherTemplate.avatar).toBeTruthy();
    expect(teacherTemplate.color).toBeTruthy();
    expect(teacherTemplate.allowedActions.length).toBeGreaterThan(0);
    expect(teacherTemplate.priority).toBe(10);
  });

  test('assistant template exists and has required fields', () => {
    expect(assistantTemplate.name).toBe('Assistant');
    expect(assistantTemplate.role).toBe('assistant');
    expect(assistantTemplate.persona).toBeTruthy();
    expect(assistantTemplate.priority).toBe(7);
  });

  test('all 4 student templates exist', () => {
    const studentIds = ['curious', 'analytical', 'creative', 'note-taker'];
    for (const id of studentIds) {
      expect(STUDENT_TEMPLATES[id]).toBeDefined();
      expect(STUDENT_TEMPLATES[id].role).toBe('student');
      expect(STUDENT_TEMPLATES[id].personaType).toBe(id);
      expect(STUDENT_TEMPLATES[id].persona).toBeTruthy();
    }
  });

  test('ALL_DEFAULT_TEMPLATES contains all 6 templates', () => {
    expect(Object.keys(ALL_DEFAULT_TEMPLATES)).toHaveLength(6);
    expect(ALL_DEFAULT_TEMPLATES.teacher).toBeDefined();
    expect(ALL_DEFAULT_TEMPLATES.assistant).toBeDefined();
    expect(ALL_DEFAULT_TEMPLATES.curious).toBeDefined();
    expect(ALL_DEFAULT_TEMPLATES.analytical).toBeDefined();
    expect(ALL_DEFAULT_TEMPLATES.creative).toBeDefined();
    expect(ALL_DEFAULT_TEMPLATES['note-taker']).toBeDefined();
  });

  test('DEFAULT_AGENT_TEMPLATE_MAP maps 6 IDs to correct templates', () => {
    expect(DEFAULT_AGENT_TEMPLATE_MAP['default-1']).toBe('teacher');
    expect(DEFAULT_AGENT_TEMPLATE_MAP['default-2']).toBe('assistant');
    expect(DEFAULT_AGENT_TEMPLATE_MAP['default-3']).toBe('curious');
    expect(DEFAULT_AGENT_TEMPLATE_MAP['default-4']).toBe('analytical');
    expect(DEFAULT_AGENT_TEMPLATE_MAP['default-5']).toBe('creative');
    expect(DEFAULT_AGENT_TEMPLATE_MAP['default-6']).toBe('note-taker');
  });
});

// ─── Factory: Template Creation ───

describe('AgentFactory: createFromTemplate', () => {
  let factory: AgentFactory;
  beforeEach(() => { factory = makeFactory(); });

  test('creates teacher agent from template', () => {
    const agent = factory.createFromTemplate('teacher', { id: 'test-teacher' });
    expect(agent).not.toBeNull();
    expect(agent!.id).toBe('test-teacher');
    expect(agent!.name).toBe('Teacher');
    expect(agent!.role).toBe('teacher');
    expect(agent!.priority).toBe(10);
    expect(agent!.isDefault).toBe(true);
    expect(agent!.allowedActions).toContain('spotlight');
    expect(agent!.allowedActions).toContain('wb_open');
  });

  test('creates student agent with personaType', () => {
    const agent = factory.createFromTemplate('curious', { id: 't-curious' });
    expect(agent).not.toBeNull();
    expect(agent!.role).toBe('student');
    expect(agent!.personaType).toBe('curious');
    expect(agent!.priority).toBe(5);
  });

  test('overrides template fields', () => {
    const agent = factory.createFromTemplate('teacher', {
      id: 'custom-id',
      name: 'Custom Name',
      priority: 8,
    });
    expect(agent!.id).toBe('custom-id');
    expect(agent!.name).toBe('Custom Name');
    expect(agent!.priority).toBe(8);
    // Un-overridden fields should keep template values
    expect(agent!.role).toBe('teacher');
    expect(agent!.avatar).toBe('/avatars/teacher.png');
  });

  test('returns null for unknown template ID', () => {
    expect(factory.createFromTemplate('nonexistent')).toBeNull();
  });

  test('createDefaults returns correct 6 agents', () => {
    const defaults = factory.createDefaults();
    expect(Object.keys(defaults)).toHaveLength(6);
    expect(defaults['default-1'].role).toBe('teacher');
    expect(defaults['default-2'].role).toBe('assistant');
    expect(defaults['default-3'].role).toBe('student');
    expect(defaults['default-3'].personaType).toBe('curious');
  });
});

// ─── Factory: LLM Creation ───

describe('AgentFactory: createFromLLM', () => {
  let factory: AgentFactory;
  beforeEach(() => { factory = makeFactory(); });

  test('creates agent from LLM params with correct defaults', () => {
    const agent = factory.createFromLLM({
      name: 'Professor Li',
      role: 'teacher',
      persona: 'A strict but fair math teacher.',
    });
    expect(agent.id).toMatch(/^gen-/);
    expect(agent.name).toBe('Professor Li');
    expect(agent.role).toBe('teacher');
    expect(agent.persona).toBe('A strict but fair math teacher.');
    expect(agent.priority).toBe(10);
    expect(agent.isGenerated).toBe(true);
    expect(agent.isDefault).toBe(false);
    expect(agent.allowedActions).toContain('spotlight');
  });

  test('uses fallback avatar and color when not provided', () => {
    const agent = factory.createFromLLM(
      { name: 'Test', role: 'student', persona: '...' },
      '/avatars/fallback.png',
      '#123456',
    );
    expect(agent.avatar).toBe('/avatars/fallback.png');
    expect(agent.color).toBe('#123456');
  });

  test('uses provided avatar and color over fallbacks', () => {
    const agent = factory.createFromLLM(
      { name: 'Test', role: 'student', persona: '...', avatar: '/a.png', color: '#abc' },
      '/fallback.png',
      '#fff',
    );
    expect(agent.avatar).toBe('/a.png');
    expect(agent.color).toBe('#abc');
  });

  test('assigns correct priority by role when not specified', () => {
    expect(factory.createFromLLM({ name: 't', role: 'teacher', persona: '...' }).priority).toBe(10);
    expect(factory.createFromLLM({ name: 'a', role: 'assistant', persona: '...' }).priority).toBe(7);
    expect(factory.createFromLLM({ name: 's', role: 'student', persona: '...' }).priority).toBe(5);
  });

  test('preserves explicitly specified priority', () => {
    const agent = factory.createFromLLM({ name: 'x', role: 'student', persona: '...', priority: 8 });
    expect(agent.priority).toBe(8);
  });

  test('preserves voiceConfig', () => {
    const agent = factory.createFromLLM({
      name: 'VoiceBot',
      role: 'assistant',
      persona: '...',
      voiceConfig: { providerId: 'tts-openai', voiceId: 'nova' },
    });
    expect(agent.voiceConfig).toEqual({ providerId: 'tts-openai', voiceId: 'nova' });
  });
});

// ─── Factory: Custom Creation ───

describe('AgentFactory: createCustom', () => {
  let factory: AgentFactory;
  beforeEach(() => { factory = makeFactory(); });

  test('creates custom agent with specified fields', () => {
    const agent = factory.createCustom({
      name: 'Custom Agent',
      role: 'student',
      persona: 'A custom personality.',
      personaType: 'curious',
      avatar: '/custom.png',
      color: '#ff0000',
      priority: 3,
    });
    expect(agent.id).toMatch(/^custom-/);
    expect(agent.name).toBe('Custom Agent');
    expect(agent.isDefault).toBe(false);
    expect(agent.isGenerated).toBeUndefined();
    expect(agent.personaType).toBe('curious');
    expect(agent.priority).toBe(3);
  });

  test('uses defaults for missing avatar/color', () => {
    const agent = factory.createCustom({ name: 'Min', role: 'assistant', persona: '...' });
    expect(agent.avatar).toBe('/avatars/user.png');
    expect(agent.color).toBe('#888888');
    expect(agent.priority).toBe(5);
  });

  test('uses getActionsForRole when allowedActions not specified', () => {
    const teacher = factory.createCustom({ name: 't', role: 'teacher', persona: '...' });
    expect(teacher.allowedActions).toContain('spotlight');
    const student = factory.createCustom({ name: 's', role: 'student', persona: '...' });
    expect(student.allowedActions).not.toContain('spotlight');
  });

  test('preserves custom allowedActions when provided', () => {
    const agent = factory.createCustom({
      name: 'Limited',
      role: 'student',
      persona: '...',
      allowedActions: ['wb_open', 'wb_close'],
    });
    expect(agent.allowedActions).toEqual(['wb_open', 'wb_close']);
  });
});

// ─── Template Registry ───

describe('AgentFactory: template registry', () => {
  let factory: AgentFactory;
  beforeEach(() => { factory = makeFactory(); });

  test('listTemplates returns all 6 by default', () => {
    expect(factory.listTemplates()).toHaveLength(6);
  });

  test('listTemplates filters by role', () => {
    expect(factory.listTemplates('teacher')).toHaveLength(1);
    expect(factory.listTemplates('assistant')).toHaveLength(1);
    expect(factory.listTemplates('student')).toHaveLength(4);
  });

  test('getTemplate returns template by ID', () => {
    const t = factory.getTemplate('curious');
    expect(t).toBeDefined();
    expect(t!.role).toBe('student');
    expect(t!.personaType).toBe('curious');
  });

  test('registerTemplate adds a new template', () => {
    const newTpl: AgentTemplate = {
      name: 'New Student',
      role: 'student',
      persona: 'A brand new student type.',
      avatar: '/new.png',
      color: '#000',
      allowedActions: [],
      priority: 3,
    };
    factory.registerTemplate('new-type', newTpl);
    expect(factory.getTemplate('new-type')).toBeDefined();
    expect(factory.listTemplates('student')).toHaveLength(5);
  });

  test('removeTemplate removes a template', () => {
    factory.registerTemplate('temp', {
      name: 'Temp', role: 'student', persona: '...', avatar: '', color: '#000', allowedActions: [], priority: 1,
    });
    expect(factory.getTemplate('temp')).toBeDefined();
    factory.removeTemplate('temp');
    expect(factory.getTemplate('temp')).toBeUndefined();
  });
});

// ─── Store Integration ───

describe('AgentFactory: store integration', () => {
  test('createDefaults output matches expected shape for Zustand store', () => {
    const factory = makeFactory();
    const defaults = factory.createDefaults();

    for (const id of ['default-1', 'default-2', 'default-3', 'default-4', 'default-5', 'default-6']) {
      const agent = defaults[id];
      expect(agent).toBeDefined();
      expect(agent.id).toBe(id);
      expect(agent.name).toBeTruthy();
      expect(agent.role).toBeTruthy();
      expect(agent.persona).toBeTruthy();
      expect(agent.avatar).toBeTruthy();
      expect(agent.color).toBeTruthy();
      expect(agent.allowedActions.length).toBeGreaterThan(0);
      expect(agent.priority).toBeGreaterThan(0);
      expect(agent.isDefault).toBe(true);
      expect(agent.createdAt).toBeInstanceOf(Date);
      expect(agent.updatedAt).toBeInstanceOf(Date);
    }

    // Verify role distribution
    const roles = Object.values(defaults).map(a => a.role);
    expect(roles.filter(r => r === 'teacher')).toHaveLength(1);
    expect(roles.filter(r => r === 'assistant')).toHaveLength(1);
    expect(roles.filter(r => r === 'student')).toHaveLength(4);
  });

  test('factory defaults match old DEFAULT_AGENTS structure', () => {
    const factory = makeFactory();
    const defaults = factory.createDefaults();

    // These are the same IDs and roles as the old hardcoded DEFAULT_AGENTS
    const expected = [
      ['default-1', 'teacher'],
      ['default-2', 'assistant'],
      ['default-3', 'student'],
      ['default-4', 'student'],
      ['default-5', 'student'],
      ['default-6', 'student'],
    ];

    for (const [id, role] of expected) {
      expect(defaults[id]).toBeDefined();
      expect(defaults[id].role).toBe(role);
    }
  });
});

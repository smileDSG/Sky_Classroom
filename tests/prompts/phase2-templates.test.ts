/**
 * Phase 2 (B-001): Core template + role + persona tests
 *
 * Validates the new modular prompt system:
 * - Core templates (agent-base, director-base, output-format) exist and load correctly
 * - Role templates (teacher, assistant) contain required sections
 * - Student persona templates (curious, analytical, creative, note-taker) are well-formed
 * - Role loading integrates correctly with prompt-builder
 * - Legacy fallbacks work when new templates are not found
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { buildStructuredPrompt } from '@/lib/orchestration/prompt-builder';
import { buildDirectorPrompt } from '@/lib/orchestration/director-prompt';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { StatelessChatRequest } from '@/lib/types/chat';

const promptsDir = path.join(process.cwd(), 'lib', 'prompts');

// ─── Test Helpers ───

const baseAgent: AgentConfig = {
  id: 't1',
  name: 'Dr. Zhao',
  role: 'teacher',
  persona: 'Engaging physics and math educator.',
  avatar: '',
  color: '#4A90D9',
  allowedActions: ['spotlight', 'laser', 'wb_open', 'wb_draw_text', 'wb_draw_latex', 'wb_close'],
  priority: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  isDefault: true,
};

const slideStoreState: StatelessChatRequest['storeState'] = {
  stage: { id: 's1', name: 'Test', createdAt: 0, updatedAt: 0 },
  scenes: [{
    id: 'sc1', stageId: 's1', type: 'slide', title: 'Slide', order: 0,
    content: { type: 'slide', canvas: { id: 'c1', viewportSize: 1000, viewportRatio: 0.5625, theme: { backgroundColor: '#fff', themeColors: [], fontColor: '#333', fontName: 'Arial' }, elements: [] } },
  }],
  currentSceneId: 'sc1',
  mode: 'autonomous',
  whiteboardOpen: false,
};

// ─── Core Templates ───

describe('core templates', () => {
  test('core/agent-base.md exists and contains key sections', () => {
    const content = fs.readFileSync(path.join(promptsDir, 'core', 'agent-base.md'), 'utf-8');
    expect(content).toContain('# Role');
    expect(content).toContain('{{agentName}}');
    expect(content).toContain('{{persona}}');
    expect(content).toContain('{{roleGuideline}}');
    expect(content).toContain('Core Teaching Principles');
    expect(content).toContain('Output Format');
    expect(content).toContain('Whiteboard Usage');
    expect(content).toContain('Available Actions');
    expect(content).toContain('Current State');
  });

  test('core/director-base.md exists and contains routing rules', () => {
    const content = fs.readFileSync(path.join(promptsDir, 'core', 'director-base.md'), 'utf-8');
    expect(content).toContain('{{agentList}}');
    expect(content).toContain('{{rule1}}');
    expect(content).toContain('next_agent');
    expect(content).toContain('Routing Rules');
    expect(content).toContain('Routing Quality');
    expect(content).toContain('Role Diversity');
    expect(content).toContain('Discussion Progression');
  });

  test('core/output-format.md exists and describes JSON interleaved format', () => {
    const content = fs.readFileSync(path.join(promptsDir, 'core', 'output-format.md'), 'utf-8');
    expect(content).toContain('JSON');
    expect(content).toContain('type');
    expect(content).toContain('action');
    expect(content).toContain('text');
    expect(content).toContain('Interleaving');
  });
});

// ─── Role Templates ───

describe('role templates', () => {
  test('roles/teacher.md contains required sections', () => {
    const content = fs.readFileSync(path.join(promptsDir, 'roles', 'teacher.md'), 'utf-8');
    expect(content).toContain('Lead Teacher');
    expect(content).toContain('Responsibilities');
    expect(content).toContain('Tone');
    expect(content).toContain('Interaction Style');
    expect(content).toContain('Length Constraint');
    expect(content).toContain('Whiteboard Permissions');
    expect(content).toContain('100 characters');
  });

  test('roles/assistant.md contains required sections', () => {
    const content = fs.readFileSync(path.join(promptsDir, 'roles', 'assistant.md'), 'utf-8');
    expect(content).toContain('Teaching Assistant');
    expect(content).toContain('Responsibilities');
    expect(content).toContain('support the lead teacher');
    expect(content).toContain('Length Constraint');
    expect(content).toContain('80 characters');
    expect(content).toContain('Whiteboard Permissions');
    expect(content).toContain('limited whiteboard access');
  });

  test('teacher role contains more whiteboard permissions than assistant', () => {
    const teacher = fs.readFileSync(path.join(promptsDir, 'roles', 'teacher.md'), 'utf-8');
    const assistant = fs.readFileSync(path.join(promptsDir, 'roles', 'assistant.md'), 'utf-8');
    const teacherWb = teacher.indexOf('Whiteboard Permissions');
    const assistantWb = assistant.indexOf('Whiteboard Permissions');
    // Teacher has more whiteboard permissions (longer section)
    const teacherSection = teacher.slice(teacherWb);
    const assistantSection = assistant.slice(assistantWb);
    expect(teacherSection.length).toBeGreaterThan(assistantSection.length);
  });
});

// ─── Student Persona Templates ───

describe('student persona templates', () => {
  const personaFiles = ['curious', 'analytical', 'creative', 'note-taker'];

  for (const persona of personaFiles) {
    test(`student-personas/${persona}.md exists and is well-formed`, () => {
      const content = fs.readFileSync(
        path.join(promptsDir, 'student-personas', `${persona}.md`),
        'utf-8',
      );
      expect(content).not.toBe('');
      expect(content).toContain('# ');
      expect(content).toContain('STUDENT');
      expect(content).toContain('Length Constraint');
      expect(content).toContain('50 characters');
    });
  }

  test('all personas have unique content (not duplicates)', () => {
    const contents = personaFiles.map((p) =>
      fs.readFileSync(path.join(promptsDir, 'student-personas', `${p}.md`), 'utf-8'),
    );
    // Each persona should have a unique title
    const titles = contents.map((c) => c.split('\n')[0]);
    expect(new Set(titles).size).toBe(personaFiles.length);
  });

  test('curious persona emphasizes questions and exploration', () => {
    const content = fs.readFileSync(
      path.join(promptsDir, 'student-personas', 'curious.md'),
      'utf-8',
    );
    expect(content).toMatch(/curious|why|wonder|question/i);
  });

  test('analytical persona emphasizes evidence and comparison', () => {
    const content = fs.readFileSync(
      path.join(promptsDir, 'student-personas', 'analytical.md'),
      'utf-8',
    );
    expect(content).toMatch(/analytical|compare|pattern|evidence|systematic/i);
  });

  test('creative persona emphasizes imagination and lateral thinking', () => {
    const content = fs.readFileSync(
      path.join(promptsDir, 'student-personas', 'creative.md'),
      'utf-8',
    );
    expect(content).toMatch(/creative|imagination|humor|analogy|lateral/i);
  });

  test('note-taker persona emphasizes synthesis and organization', () => {
    const content = fs.readFileSync(
      path.join(promptsDir, 'student-personas', 'note-taker.md'),
      'utf-8',
    );
    expect(content).toMatch(/synthesi|organiz|summar|recap|consolidat/i);
  });
});

// ─── Integration: Role Loading ───

describe('role loading integration', () => {
  test('buildStructuredPrompt with teacher role loads from roles/teacher.md', () => {
    const out = buildStructuredPrompt(baseAgent, slideStoreState);
    // Must load from new modular template
    expect(out).toContain('Lead Teacher');
    // Must contain the full agent prompt structure
    expect(out).toContain('# Role');
    expect(out).toContain(baseAgent.name);
  });

  test('buildStructuredPrompt with assistant role loads from roles/assistant.md', () => {
    const assistant: AgentConfig = { ...baseAgent, role: 'assistant' };
    const out = buildStructuredPrompt(assistant, slideStoreState);
    expect(out).toContain('Teaching Assistant');
    expect(out).not.toContain('Lead Teacher');
  });

  test('buildStructuredPrompt with student role uses roles/student.md', () => {
    // B-002: roles/student.md now exists — uses the new template
    const student: AgentConfig = { ...baseAgent, role: 'student' };
    const out = buildStructuredPrompt(student, slideStoreState);
    expect(out).toContain('Student Role');
    expect(out).toContain('participate actively');
    expect(out.length).toBeGreaterThan(100);
  });

  test('buildDirectorPrompt loads from core/director-base.md', () => {
    const out = buildDirectorPrompt([baseAgent], 'No history', [], 0);
    expect(out).toContain('Routing Rules');
    expect(out).toContain('next_agent');
    expect(out).toContain('Role Diversity');
  });

  test('buildDirectorPrompt with discussion context works correctly', () => {
    const out = buildDirectorPrompt(
      [baseAgent],
      'Some history',
      [],
      0,
      { topic: 'Test discussion' },
    );
    expect(out).toContain('Discussion Mode');
    expect(out).toContain('Test discussion');
  });
});

// ─── Edge Cases ───

describe('edge cases', () => {
  test('buildStructuredPrompt works with empty language directive', () => {
    const state = { ...slideStoreState, stage: { ...slideStoreState.stage!, languageDirective: undefined } };
    const out = buildStructuredPrompt(baseAgent, state);
    expect(out).toBeTruthy();
    expect(out.length).toBeGreaterThan(0);
  });

  test('buildStructuredPrompt handles missing user profile gracefully', () => {
    const out = buildStructuredPrompt(baseAgent, slideStoreState, undefined, undefined, undefined);
    expect(out).toBeTruthy();
    expect(out).not.toContain('# Student Profile');
  });

  test('buildDirectorPrompt with empty agent list produces valid output', () => {
    const out = buildDirectorPrompt([], 'No history', [], 0);
    // With empty agent list, agentList interpolates to empty string
    // but the prompt structure should still be intact
    expect(out).toContain('Available Agents');
    expect(out).toContain('Routing Rules');
  });
});

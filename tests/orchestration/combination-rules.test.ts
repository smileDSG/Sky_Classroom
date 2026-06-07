/**
 * Phase 2 (B-002): Combination rules tests
 *
 * Validates:
 * - All default rules exist and have valid structure
 * - Rule matching logic (findBestRule, findAllMatching)
 * - Recommendation engine produces correct combos
 * - Agent plan builder generates correct role/personaType pairs
 * - Custom rules can be added and removed
 * - agent-profiles.md template exists and is well-formed
 */
import { describe, test, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  CombinationRuleEngine,
  resetRuleEngine,
  DEFAULT_COMBO_RULES,
} from '@/lib/orchestration/registry/combination-rules';
import type { CourseInfo } from '@/lib/orchestration/registry/combination-rules';
import { getAgentFactory } from '@/lib/orchestration/registry/factory';

function makeEngine(): CombinationRuleEngine {
  resetRuleEngine();
  return new CombinationRuleEngine();
}

// ─── Default Rules ───

describe('Combination rules: defaults', () => {
  test('5 default rules exist', () => {
    expect(DEFAULT_COMBO_RULES.length).toBeGreaterThanOrEqual(5);
  });

  test('every rule has required fields', () => {
    for (const rule of DEFAULT_COMBO_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(typeof rule.appliesTo).toBe('function');
      expect(rule.recommendedCombo.teacher).toBe(1);
      expect(rule.recommendedCombo.assistant).toBeGreaterThanOrEqual(0);
      expect(rule.recommendedCombo.students.count).toBeGreaterThanOrEqual(1);
      expect(rule.recommendedCombo.students.preferredTypes.length).toBeGreaterThan(0);
    }
  });

  test('standard rule matches any course', () => {
    const standard = DEFAULT_COMBO_RULES.find((r) => r.id === 'standard')!;
    expect(standard.appliesTo({ name: 'Anything' })).toBe(true);
    expect(standard.appliesTo({ name: 'Math 101', sceneTypes: ['slide', 'quiz'], sceneCount: 10 })).toBe(true);
  });
});

// ─── Rule Engine ───

describe('CombinationRuleEngine', () => {
  let engine: CombinationRuleEngine;
  beforeEach(() => { engine = makeEngine(); });

  test('findBestRule returns standard for generic course', () => {
    const rule = engine.findBestRule({ name: 'Generic Course' });
    expect(rule.id).toBe('standard');
  });

  test('findBestRule returns minimal for short course', () => {
    const rule = engine.findBestRule({ name: 'Quick Intro', sceneCount: 3 });
    expect(rule.id).toBe('minimal');
  });

  test('findBestRule returns workshop for interactive course', () => {
    const rule = engine.findBestRule({
      name: 'Physics Lab',
      sceneTypes: ['slide', 'interactive', 'quiz'],
      hasPBL: false,
    });
    expect(rule.id).toBe('workshop');
  });

  test('findBestRule returns workshop for PBL course', () => {
    const rule = engine.findBestRule({
      name: 'Engineering Design',
      sceneTypes: ['pbl'],
      hasPBL: true,
    });
    expect(rule.id).toBe('workshop');
  });

  test('findBestRule returns assessment for quiz course', () => {
    const rule = engine.findBestRule({
      name: 'Final Exam Prep',
      sceneTypes: ['slide', 'quiz'],
      hasQuiz: true,
      sceneCount: 6,
    });
    expect(rule.id).toBe('assessment');
  });

  test('findBestRule returns discussion-heavy for long slide-only course', () => {
    const rule = engine.findBestRule({
      name: 'Philosophy Seminar',
      sceneTypes: ['slide', 'slide', 'slide', 'slide', 'slide', 'slide'],
      sceneCount: 6,
    });
    expect(rule.id).toBe('discussion-heavy');
  });

  test('findAllMatching returns all applicable rules', () => {
    const matches = engine.findAllMatching({
      name: 'Physics Lab',
      sceneTypes: ['slide', 'interactive', 'quiz'],
      sceneCount: 8,
    });
    // Should match: standard, workshop, assessment
    const ids = matches.map((r) => r.id);
    expect(ids).toContain('standard');
    expect(ids).toContain('workshop');
    expect(ids).toContain('assessment');
  });

  test('recommend returns the combo from best matching rule', () => {
    const combo = engine.recommend({ name: 'Quick Intro', sceneCount: 3 });
    expect(combo.teacher).toBe(1);
    expect(combo.assistant).toBe(0);
    expect(combo.students.count).toBe(2);
  });

  test('recommend for standard course includes assistant', () => {
    const combo = engine.recommend({ name: 'Standard Course', sceneCount: 8 });
    expect(combo.teacher).toBe(1);
    expect(combo.assistant).toBe(1);
    expect(combo.students.count).toBe(3);
  });
});

// ─── Agent Plan Builder ───

describe('CombinationRuleEngine: buildAgentPlan', () => {
  let engine: CombinationRuleEngine;
  beforeEach(() => { engine = makeEngine(); });

  const studentTemplates = getAgentFactory().listTemplates('student');

  test('builds correct plan for standard course', () => {
    const plan = engine.buildAgentPlan({ name: 'Standard' }, studentTemplates);
    expect(plan).toHaveLength(5); // 1 teacher + 1 assistant + 3 students
    expect(plan[0]).toEqual({ role: 'teacher' });
    expect(plan[1]).toEqual({ role: 'assistant' });
    expect(plan[2].role).toBe('student');
    expect(plan[2].personaType).toBeTruthy();
  });

  test('builds correct plan for minimal course', () => {
    const plan = engine.buildAgentPlan({ name: 'Minimal', sceneCount: 3 }, studentTemplates);
    expect(plan).toHaveLength(3); // 1 teacher + 0 assistant + 2 students
    expect(plan.filter((p) => p.role === 'teacher')).toHaveLength(1);
    expect(plan.filter((p) => p.role === 'assistant')).toHaveLength(0);
    expect(plan.filter((p) => p.role === 'student')).toHaveLength(2);
  });

  test('builds correct plan for workshop course', () => {
    const plan = engine.buildAgentPlan(
      { name: 'Workshop', sceneTypes: ['interactive'], hasPBL: true },
      studentTemplates,
    );
    expect(plan).toHaveLength(6); // 1 teacher + 2 assistants + 3 students
    expect(plan.filter((p) => p.role === 'assistant')).toHaveLength(2);
  });

  test('student personas cycle when more students than preferred types', () => {
    // Create engine with custom rule first so it matches before standard
    const customEngine = new CombinationRuleEngine([
      {
        id: 'test-cycling',
        name: 'Cycling Test',
        description: '...',
        appliesTo: () => true,
        recommendedCombo: {
          teacher: 1,
          assistant: 0,
          students: { count: 4, preferredTypes: ['curious'] },
        },
      },
      ...DEFAULT_COMBO_RULES,
    ]);
    const plan = customEngine.buildAgentPlan({ name: 'CycleTest' }, studentTemplates);
    const students = plan.filter((p) => p.role === 'student');
    expect(students).toHaveLength(4);
    // All should have curious personaType (since it's the only preferred)
    expect(students.every((s) => s.personaType === 'curious')).toBe(true);
  });
});

// ─── Custom Rules ───

describe('CombinationRuleEngine: custom rules', () => {
  let engine: CombinationRuleEngine;
  beforeEach(() => { engine = makeEngine(); });

  test('addRule inserts custom rule', () => {
    engine.addRule({
      id: 'custom',
      name: 'Custom',
      description: '...',
      appliesTo: () => false,
      recommendedCombo: { teacher: 1, assistant: 1, students: { count: 5, preferredTypes: [] } },
    });
    expect(engine.listRules().some((r) => r.id === 'custom')).toBe(true);
  });

  test('removeRule deletes a rule', () => {
    engine.addRule({
      id: 'temp',
      name: 'Temp',
      description: '...',
      appliesTo: () => false,
      recommendedCombo: { teacher: 1, assistant: 0, students: { count: 1, preferredTypes: [] } },
    });
    expect(engine.listRules().some((r) => r.id === 'temp')).toBe(true);
    engine.removeRule('temp');
    expect(engine.listRules().some((r) => r.id === 'temp')).toBe(false);
  });

  test('custom rule takes priority when it matches first', () => {
    // Add a custom rule before standard that matches a specific condition
    const customRules = [
      {
        id: 'custom-first',
        name: 'Custom First',
        description: '...',
        appliesTo: (c: CourseInfo) => c.name === 'Special Course',
        recommendedCombo: { teacher: 1, assistant: 3, students: { count: 1, preferredTypes: ['creative'] } },
      },
      ...engine.listRules(),
    ];
    const customEngine = new CombinationRuleEngine(customRules);

    const rule = customEngine.findBestRule({ name: 'Special Course' });
    expect(rule.id).toBe('custom-first');
    expect(rule.recommendedCombo.assistant).toBe(3);
  });
});

// ─── agent-profiles.md Template ───

describe('agent-profiles.md template', () => {
  const templatePath = path.join(
    process.cwd(), 'lib', 'prompts', 'generators', 'agent-profiles.md',
  );

  test('template exists', () => {
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  test('contains key sections', () => {
    const content = fs.readFileSync(templatePath, 'utf-8');
    expect(content).toContain('{{languageDirective}}');
    expect(content).toContain('{{courseName}}');
    expect(content).toContain('{{availableAvatars}}');
    expect(content).toContain('{{availableColors}}');
    expect(content).toContain('{{#if hasVoices}}');
    expect(content).toContain('{{#if recommendedCombo}}');
    expect(content).toContain('Agent Design Principles');
    expect(content).toContain('Curious');
    expect(content).toContain('Analytical');
    expect(content).toContain('Creative');
    expect(content).toContain('Note-taker');
    expect(content).toContain('Output Format');
  });

  test('returns valid JSON structure specification', () => {
    const content = fs.readFileSync(templatePath, 'utf-8');
    expect(content).toContain('"agents"');
    expect(content).toContain('"role"');
    expect(content).toContain('"persona"');
  });
});

/**
 * Agent Combination Rules
 *
 * Recommends teacher/assistant/student role combinations based on
 * course information. Used by the AgentFactory to suggest optimal
 * agent counts and student persona distributions.
 */
import type { AgentTemplate } from './types';

// ==================== Types ====================

export interface CourseInfo {
  name: string;
  description?: string;
  sceneTypes?: string[];
  sceneCount?: number;
  hasQuiz?: boolean;
  hasPBL?: boolean;
}

export interface RecommendedCombo {
  teacher: number;       // Always 1
  assistant: number;     // 0-2
  students: {
    count: number;        // 1-4
    preferredTypes: string[];  // Persona type IDs
  };
}

export interface ComboRule {
  id: string;
  name: string;
  description: string;
  /** Returns true if this rule applies to the given course. */
  appliesTo: (courseInfo: CourseInfo) => boolean;
  recommendedCombo: RecommendedCombo;
}

// ==================== Default Rules ====================

export const DEFAULT_COMBO_RULES: ComboRule[] = [
  {
    id: 'minimal',
    name: 'Minimal Classroom',
    description: 'For short courses (≤3 scenes). Fewer agents for focused learning.',
    appliesTo: (c) => (c.sceneCount ?? 99) <= 3,
    recommendedCombo: {
      teacher: 1,
      assistant: 0,
      students: { count: 2, preferredTypes: ['curious', 'note-taker'] },
    },
  },
  {
    id: 'workshop',
    name: 'Hands-on Workshop',
    description:
      'For interactive/practical courses. More assistants to support hands-on work, creative students to energize.',
    appliesTo: (c) =>
      (c.sceneTypes?.some((t) => t === 'interactive' || t === 'pbl') ?? false) || (c.hasPBL ?? false),
    recommendedCombo: {
      teacher: 1,
      assistant: 2,
      students: {
        count: 3,
        preferredTypes: ['creative', 'curious', 'analytical'],
      },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal Classroom',
    description: 'For short courses (≤3 scenes). Fewer agents for focused learning.',
    appliesTo: (c) => (c.sceneCount ?? 99) <= 3,
    recommendedCombo: {
      teacher: 1,
      assistant: 0,
      students: {
        count: 2,
        preferredTypes: ['curious', 'note-taker'],
      },
    },
  },
  {
    id: 'discussion-heavy',
    name: 'Discussion Seminar',
    description:
      'For discussion-oriented courses. No assistant, more diverse student voices.',
    appliesTo: (c) => (c.sceneTypes?.every((t) => t === 'slide') ?? false) && (c.sceneCount ?? 0) > 5,
    recommendedCombo: {
      teacher: 1,
      assistant: 0,
      students: {
        count: 4,
        preferredTypes: ['analytical', 'creative', 'curious', 'note-taker'],
      },
    },
  },
  {
    id: 'assessment',
    name: 'Quiz/Assessment Focus',
    description: 'For courses with quizzes. Assistant helps with grading context, analytical student promotes critical thinking.',
    appliesTo: (c) => c.hasQuiz ?? (c.sceneTypes?.includes('quiz') ?? false),
    recommendedCombo: {
      teacher: 1,
      assistant: 1,
      students: { count: 2, preferredTypes: ['analytical', 'curious'] },
    },
  },
  {
    id: 'standard',
    name: 'Standard Classroom',
    description:
      '1 teacher + 1 assistant + 3 diverse students. Balanced mix of curiosity, analysis, and note-taking.',
    appliesTo: () => true,
    recommendedCombo: {
      teacher: 1,
      assistant: 1,
      students: { count: 3, preferredTypes: ['curious', 'analytical', 'note-taker'] },
    },
  },
];

// ==================== Rule Engine ====================

export class CombinationRuleEngine {
  private rules: ComboRule[];

  constructor(rules?: ComboRule[]) {
    this.rules = rules ?? [...DEFAULT_COMBO_RULES];
  }

  /** Add a custom rule. */
  addRule(rule: ComboRule): void {
    this.rules.push(rule);
  }

  /** Remove a rule by ID. */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  /** List all rules. */
  listRules(): ComboRule[] {
    return [...this.rules];
  }

  /**
   * Find the best matching rule for a course.
   * Rules are checked in order; the first matching rule wins.
   */
  findBestRule(courseInfo: CourseInfo): ComboRule {
    // Return the first matching rule, or the standard rule as fallback
    for (const rule of this.rules) {
      if (rule.appliesTo(courseInfo)) {
        return rule;
      }
    }
    // Should never reach here — 'standard' rule always matches
    return this.rules[0];
  }

  /**
   * Find all rules that match a course.
   */
  findAllMatching(courseInfo: CourseInfo): ComboRule[] {
    return this.rules.filter((r) => r.appliesTo(courseInfo));
  }

  /**
   * Recommend agent counts and preferred student persona types
   * for a given course.
   */
  recommend(courseInfo: CourseInfo): RecommendedCombo {
    return this.findBestRule(courseInfo).recommendedCombo;
  }

  /**
   * Produce a concrete agent generation plan: list of (role, personaType) pairs.
   */
  buildAgentPlan(
    courseInfo: CourseInfo,
    studentTemplates: AgentTemplate[],
  ): Array<{ role: string; personaType?: string }> {
    const combo = this.recommend(courseInfo);

    const plan: Array<{ role: string; personaType?: string }> = [];
    plan.push({ role: 'teacher' });

    for (let i = 0; i < combo.assistant; i++) {
      plan.push({ role: 'assistant' });
    }

    // Assign preferred student persona types, cycling if needed
    for (let i = 0; i < combo.students.count; i++) {
      const preferred =
        combo.students.preferredTypes[i % combo.students.preferredTypes.length];
      // Verify this persona type actually exists in available templates
      const exists = studentTemplates.some((t) => t.personaType === preferred);
      plan.push({ role: 'student', personaType: exists ? preferred : undefined });
    }

    return plan;
  }
}

// ==================== Singleton ====================

let _engine: CombinationRuleEngine | null = null;

export function getRuleEngine(): CombinationRuleEngine {
  if (!_engine) {
    _engine = new CombinationRuleEngine();
  }
  return _engine;
}

export function resetRuleEngine(): void {
  _engine = null;
}

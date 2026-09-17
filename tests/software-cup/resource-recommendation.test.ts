import { describe, expect, it } from 'vitest';
import {
  buildResourceRecommendations,
  recommendationLabel,
  recommendedTypeOrder,
} from '@/lib/software-cup/resource-recommendation';
import type { SoftwareCupStudentProfile } from '@/lib/software-cup/demo-service';

function makeProfile(overrides: {
  weakPoints?: string[];
  cognitiveStyle?: string;
  resourcePreference?: string[];
  learningPace?: string;
  errorPatterns?: string[];
}): SoftwareCupStudentProfile {
  const dim = {
    majorBackground: { value: '软件工程大二学生', confidence: 0.9, evidence: [] },
    learningGoal: { value: '两周内补上机器学习基础', confidence: 0.9, evidence: [] },
    knowledgeBase: {
      strongPoints: ['Python'],
      weakPoints: overrides.weakPoints ?? ['过拟合', '模型评估'],
      confidence: 0.8,
      evidence: [],
    },
    cognitiveStyle: {
      value: overrides.cognitiveStyle ?? '概念讲解为主',
      confidence: 0.8,
      evidence: [],
    },
    errorPatternPreference: {
      value: overrides.errorPatterns ?? [],
      confidence: 0.7,
      evidence: [],
    },
    resourcePreference: {
      value: overrides.resourcePreference ?? [],
      confidence: 0.8,
      evidence: [],
    },
    learningPace: { value: overrides.learningPace ?? '', confidence: 0.8, evidence: [] },
    currentLearningState: { value: '补强中', confidence: 0.6, evidence: [] },
  };
  return {
    userId: 'test',
    profileVersion: 'v0.0.1',
    lastUpdated: '',
    dimensions: dim,
    updatePolicy: {},
  };
}

function byType(recommendations: ReturnType<typeof buildResourceRecommendations>) {
  return Object.fromEntries(recommendations.map((item) => [item.type, item]));
}

describe('resource-recommendation', () => {
  it('returns all four closed-loop resource types in a stable order', () => {
    const result = buildResourceRecommendations(makeProfile({}));
    expect(result.map((item) => item.type)).toEqual([
      'markdown_lecture',
      'self_check',
      'learning_path',
      'mind_map',
    ]);
  });

  it('marks lecture and self_check as critical when weak points exist', () => {
    const result = byType(buildResourceRecommendations(makeProfile({ weakPoints: ['过拟合'] })));
    expect(result.markdown_lecture.priority).toBe('critical');
    expect(result.self_check.priority).toBe('critical');
  });

  it('marks lecture as recommended (not critical) when there are no weak points', () => {
    const result = byType(buildResourceRecommendations(makeProfile({ weakPoints: [] })));
    expect(result.markdown_lecture.priority).toBe('recommended');
  });

  it('boosts mind_map when the student prefers visual expression', () => {
    const plain = byType(buildResourceRecommendations(makeProfile({})));
    const visual = byType(
      buildResourceRecommendations(makeProfile({ cognitiveStyle: '图解 + 框架驱动' })),
    );

    expect(plain.mind_map.priority).toBe('optional');
    expect(visual.mind_map.priority).toBe('recommended');
    expect(visual.mind_map.score).toBeGreaterThan(plain.mind_map.score);
  });

  it('references code/case preference in the lecture reasons', () => {
    const result = byType(
      buildResourceRecommendations(makeProfile({ resourcePreference: ['图解讲义', '代码实操'] })),
    );
    expect(result.markdown_lecture.reasons.join()).toMatch(/代码案例驱动/);
  });

  it('mark learning_path as critical when learning pace is provided', () => {
    const result = byType(
      buildResourceRecommendations(makeProfile({ learningPace: '每天 45 分钟' })),
    );
    expect(result.learning_path.priority).toBe('critical');
    expect(result.learning_path.reasons.join()).toMatch(/每天 45 分钟/);
  });

  it('keeps reasons evidence-backed from the profile', () => {
    const result = byType(
      buildResourceRecommendations(
        makeProfile({ weakPoints: ['过拟合'], errorPatterns: ['概念混淆'] }),
      ),
    );
    expect(Object.values(result).every((item) => item.reasons.length > 0)).toBe(true);
    expect(result.self_check.evidence.join()).toMatch(/过拟合/);
  });

  it('sorts recommendedTypeOrder by descending score', () => {
    const order = recommendedTypeOrder(makeProfile({ weakPoints: ['过拟合', '模型评估', 'RAG'] }));
    const scoreOf = Object.fromEntries(
      buildResourceRecommendations(makeProfile({ weakPoints: ['过拟合', '模型评估', 'RAG'] })).map(
        (item) => [item.type, item.score],
      ),
    );
    for (let i = 1; i < order.length; i += 1) {
      expect(scoreOf[order[i - 1]]).toBeGreaterThanOrEqual(scoreOf[order[i]]);
    }
  });

  it('exposes human-readable priority labels', () => {
    expect(recommendationLabel('critical')).toBe('优先生成');
    expect(recommendationLabel('recommended')).toBe('建议生成');
    expect(recommendationLabel('optional')).toBe('可选生成');
  });
});

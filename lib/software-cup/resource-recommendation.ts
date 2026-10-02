/**
 * 学习包工坊 — 画像驱动的资源类型推荐
 *
 * 纯函数：输入学生画像，输出对 4 类学习包资源（讲义 / 导图 / 自查清单 / 学习路径）
 * 各自的推荐优先级、评分、个性化理由与画像依据。不依赖运行时数据，便于单测。
 */

import type {
  CourseResourceType,
  SoftwareCupStudentProfile,
} from '@/lib/software-cup/demo-service';

export type RecommendationPriority = 'critical' | 'recommended' | 'optional';

/** 推荐函数仅依赖学生画像的维度数据，任何「包含相同 dimensions 的对象」皆可驱动 */
export type RecommendationProfile = Pick<SoftwareCupStudentProfile, 'dimensions'>;

export interface ResourceRecommendation {
  type: CourseResourceType;
  priority: RecommendationPriority;
  score: number;
  reasons: string[];
  /** 支撑该推荐的具体画像字段取值（原文引用，用于界面展示“依据”） */
  evidence: string[];
}

export const RECOMMENDATION_TYPE_ORDER: CourseResourceType[] = [
  'markdown_lecture',
  'self_check',
  'learning_path',
  'mind_map',
];

const PRIORITY_LABEL: Record<RecommendationPriority, string> = {
  critical: '优先生成',
  recommended: '建议生成',
  optional: '可选生成',
};

export function recommendationLabel(priority: RecommendationPriority): string {
  return PRIORITY_LABEL[priority];
}

function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((word) => text.includes(word));
}

function hasAnyInList(list: string[] | undefined, keywords: string[]): boolean {
  return (list ?? []).some((item) => hasAny(item, keywords));
}

/** 认知/资源偏好中是否偏向图解、可视化表达 */
function prefersVisual(profile: RecommendationProfile): boolean {
  const style = profile.dimensions.cognitiveStyle.value;
  const pref = profile.dimensions.resourcePreference.value;
  return (
    hasAny(style, ['图解', '视觉', '画', '框架', '结构']) || hasAnyInList(pref, ['图解', '导图'])
  );
}

/** 认知/资源偏好中是否偏向代码、案例驱动 */
function prefersCode(profile: RecommendationProfile): boolean {
  const style = profile.dimensions.cognitiveStyle.value;
  const pref = profile.dimensions.resourcePreference.value;
  return hasAny(style, ['代码', '案例', '实操']) || hasAnyInList(pref, ['代码', '案例', '实操']);
}

/**
 * 根据学生画像计算各种资源类型的推荐。
 * 规则为启发式：以「闭环是否必需」+「画像契合」共同决定优先级，理由与依据均引用画像原文。
 */
export function buildResourceRecommendations(
  profile: RecommendationProfile,
): ResourceRecommendation[] {
  const d = profile.dimensions;
  const weakPoints = d.knowledgeBase.weakPoints ?? [];
  const pace = d.learningPace.value;

  const byType = new Map<CourseResourceType, ResourceRecommendation>();

  // ── 讲义：薄弱点精讲，几乎总是闭环刚需 ─────────────────────
  {
    const reasons: string[] = [];
    const evidence: string[] = [];
    if (weakPoints.length > 0) {
      reasons.push(`把薄弱点「${weakPoints.join('、')}」概念逐个讲透`);
      evidence.push(`薄弱点：${weakPoints.join('、')}`);
    }
    if (prefersCode(profile)) {
      reasons.push('你习惯代码案例驱动，讲义会穿插可运行示例与代码对照');
      evidence.push(`认知风格：${d.cognitiveStyle.value}`);
    }
    if (reasons.length === 0) reasons.push('基于当前画像建立核心概念框架');

    const score = 0.78 + Math.min(weakPoints.length, 3) * 0.06 + (prefersCode(profile) ? 0.04 : 0);
    byType.set('markdown_lecture', {
      type: 'markdown_lecture',
      priority: weakPoints.length >= 1 ? 'critical' : 'recommended',
      score: clamp(score),
      reasons,
      evidence,
    });
  }

  // ── 自查清单：先判定掌握程度，避免盲目刷题 ─────────────────
  {
    const reasons: string[] = [];
    const evidence: string[] = [];
    if (weakPoints.length > 0) {
      reasons.push(`先对新知识点逐条自查「能做到 / 还不行」，再决定该练哪一块`);
      evidence.push(`薄弱点：${weakPoints.join('、')}`);
    }
    const errorHints = d.errorPatternPreference.value ?? [];
    if (errorHints.length > 0) {
      reasons.push(`针对容易「${errorHints[0]}」的误区做对照，帮助识别假掌握`);
      evidence.push(`易错模式：${errorHints.join('、')}`);
    }
    if (reasons.length === 0) reasons.push('把整轮学习变成可自检、可验证的闭环');

    byType.set('self_check', {
      type: 'self_check',
      priority: 'critical',
      score: clamp(0.85 + (errorHints.length > 0 ? 0.08 : 0)),
      reasons,
      evidence,
    });
  }

  // ── 学习路径：把学/练/复盘排进可用时间 ─────────────────────
  {
    const reasons: string[] = [];
    const evidence: string[] = [];
    if (pace) {
      reasons.push(`按你的节奏「${pace}」把学 → 查 → 练 → 复盘排成一个可执行顺序`);
      evidence.push(`学习节奏：${pace}`);
    }
    const goal = d.learningGoal.value;
    if (goal) {
      reasons.push(`围绕目标「${goal}」安排先后与每日投入`);
      evidence.push(`学习目标：${goal}`);
    }
    if (reasons.length === 0) reasons.push('排好学习顺序并衔接练 / 复盘环节');

    byType.set('learning_path', {
      type: 'learning_path',
      priority: pace ? 'critical' : 'recommended',
      score: clamp(0.82 + (pace ? 0.08 : 0)),
      reasons,
      evidence,
    });
  }

  // ── 导图：结构梳理，依赖画像里的视觉偏好与弱项密集度 ────────
  {
    const reasons: string[] = [];
    const evidence: string[] = [];
    if (prefersVisual(profile)) {
      reasons.push('你偏好图解式表达，导图能一眼看清知识点之间的前置关系');
      evidence.push(`认知风格：${d.cognitiveStyle.value}`);
    } else if (weakPoints.length >= 3) {
      reasons.push(`薄弱点较多（${weakPoints.length} 个），先把彼此脉络理清再逐个击破`);
      evidence.push(`薄弱点：${weakPoints.join('、')}`);
    }
    if (reasons.length === 0) reasons.push('补充一张整体结构图，便于回看定位');

    const visual = prefersVisual(profile);
    const dense = weakPoints.length >= 3;
    byType.set('mind_map', {
      type: 'mind_map',
      priority: visual || dense ? 'recommended' : 'optional',
      score: clamp(0.6 + (visual ? 0.16 : 0) + (dense ? 0.1 : 0)),
      reasons,
      evidence,
    });
  }

  return RECOMMENDATION_TYPE_ORDER.map((type) => byType.get(type) as ResourceRecommendation);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

/** 推荐排序后的类型清单（优先生成在前），供界面引导使用 */
export function recommendedTypeOrder(profile: RecommendationProfile): CourseResourceType[] {
  return buildResourceRecommendations(profile)
    .slice()
    .sort((a, b) => b.score - a.score)
    .map((item) => item.type);
}

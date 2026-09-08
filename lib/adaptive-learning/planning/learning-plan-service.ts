/**
 * Learning plan service.
 *
 * Consumes a planning projection and generates a structured, learner-specific
 * learning plan. File-system and LLM dependencies are injected so the core
 * logic remains deterministic and testable.
 */

import type { PlanningProfileProjection } from '@/lib/adaptive-learning/contracts';
import type { LearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';

export interface KnowledgeChunk {
  source: string;
  title: string;
  course: string;
  tags: string[];
  content: string;
  wordCount: number;
  score: number;
}

export interface DailyTask {
  day: string;
  topic: string;
  materials: string[];
  minutes: number;
}

export interface WeeklyPlan {
  week: number;
  goal: string;
  dailyTasks: DailyTask[];
}

export interface LearningPlanMaterial {
  title: string;
  source: string;
}

export interface LearningPlanResult {
  goal: string;
  strategy: string;
  weeklyPlans: WeeklyPlan[];
  materials: LearningPlanMaterial[];
}

export interface GenerateLearningPlanInput {
  projection: PlanningProfileProjection;
  goalTopic?: string;
  learnerDecision?: LearnerDecision;
}

export interface LearningPlanDependencies {
  retrieveChunks(projection: PlanningProfileProjection, topK: number): Promise<KnowledgeChunk[]>;
  generatePlan(systemPrompt: string, userPrompt: string): Promise<string>;
}

function buildSystemPrompt(): string {
  return `你是一位资深学习规划专家。请根据学生画像和提供的参考资料，生成一份具体、可执行的学习计划。

要求：
1. 计划必须针对学生的薄弱点或目标主题重点突破。
2. 每周总时长不超过学生设定的每周可用时间。
3. 每天的任务要具体，包含学习主题、参考材料和练习建议。
4. 必须引用参考资料中的具体标题。
5. 输出为 JSON 格式，结构清晰，不要包含 Markdown 代码块标记。
6. 如果参考资料不足，请在 JSON 中正常返回计划并明确指出缺少资料。

输出 JSON 结构：
{
  "goal": "学习目标",
  "strategy": "总体策略",
  "weeklyPlans": [
    {
      "week": 1,
      "goal": "本周目标",
      "dailyTasks": [
        { "day": "mon", "topic": "主题", "materials": ["资料标题"], "minutes": 45 }
      ]
    }
  ],
  "materials": [
    { "title": "资料标题", "source": "资料来源路径" }
  ]
}`;
}

function buildUserPrompt(
  projection: PlanningProfileProjection,
  chunks: KnowledgeChunk[],
  goalTopic?: string,
): string {
  const { data } = projection;
  const domain = data.activeDomain;
  const availability = data.availability;

  const goalText = goalTopic ?? domain.targetNodeIds?.join('、') ?? '提升学科能力';
  const examInfo = domain.examDate ? `，考试日期：${domain.examDate}` : '';
  const scoreInfo =
    domain.targetScore !== undefined && domain.scoreScaleMax !== undefined
      ? `，目标分数：${domain.targetScore}/${domain.scoreScaleMax}`
      : '';

  const chunksText = chunks
    .map(
      (c, i) =>
        `--- 资料 ${i + 1} ---\n标题：${c.title}\n学科：${c.course}\n标签：${c.tags.join(', ')}\n来源：${c.source}\n内容：\n${c.content.slice(0, 1200)}\n`,
    )
    .join('\n');

  const targetKnowledgeText = data.targetKnowledge
    .map(
      (k) =>
        `- ${k.nodeId}（掌握度 ${(k.mastery * 100).toFixed(0)}%，置信度 ${(k.confidence * 100).toFixed(0)}%）`,
    )
    .join('\n');

  return `学习者画像：
- 学段：${domain.educationStage}
- 年级：${domain.gradeLevel}
- 学科：${domain.subjectId}
- 教材包：${domain.curriculumPackId} / ${domain.curriculumPackVersion}
- 规划模式：${data.planningMode}
- 目标主题：${goalText}${examInfo}${scoreInfo}
- 每周可用时间：${availability.weeklyAvailableMinutes} 分钟
- 单次学习时长：${availability.preferredSessionMinutes} 分钟
- 偏好内容形式：${data.contentFormatPreferences.join(', ')}
- 休息日：${availability.restDays.join(', ')}
- 每日上限：${availability.maxDailyMinutes} 分钟
- 教师锁定节点：${data.teacherLockedNodeIds.join(', ') || '无'}

目标知识状态：
${targetKnowledgeText || '- 暂无明确目标知识状态'}

最近参与度：
- 近 7 天学习 ${data.engagementSummary.studyMinutes7d} 分钟
- 近 7 天活跃 ${data.engagementSummary.activeDays7d} 天

参考资料：
${chunksText || '（未找到相关资料）'}

请生成学习计划。`;
}

export async function generateLearningPlan(
  input: GenerateLearningPlanInput,
  deps: LearningPlanDependencies,
): Promise<LearningPlanResult> {
  const { projection, goalTopic, learnerDecision } = input;
  const chunks = await deps.retrieveChunks(projection, 12);

  const systemPrompt = buildSystemPrompt();
  const adaptiveGoalTopic = learnerDecision
    ? `${goalTopic ?? ''} [action=${learnerDecision.action}; difficulty=${learnerDecision.difficulty}; duration=${learnerDecision.durationMinutes}min; questions=${learnerDecision.questionCount}; reasons=${learnerDecision.reasonCodes.join(',')}]`
    : goalTopic;
  const userPrompt = buildUserPrompt(projection, chunks, adaptiveGoalTopic);
  const raw = await deps.generatePlan(systemPrompt, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('学习计划解析失败');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('学习计划解析失败');
  }

  if (chunks.length === 0 && !goalTopic) {
    throw new Error('未找到匹配资料');
  }

  const result = parsed as Record<string, unknown>;
  const goal = typeof result.goal === 'string' ? result.goal : '攻克学习目标';
  const strategy = typeof result.strategy === 'string' ? result.strategy : '系统学习，逐步突破';

  const weeklyPlans: WeeklyPlan[] = Array.isArray(result.weeklyPlans)
    ? result.weeklyPlans.map((week: unknown, index: number) => {
        const w = week as Record<string, unknown>;
        return {
          week: typeof w.week === 'number' ? w.week : index + 1,
          goal: typeof w.goal === 'string' ? w.goal : `第 ${index + 1} 周目标`,
          dailyTasks: Array.isArray(w.dailyTasks)
            ? w.dailyTasks.map((task: unknown) => {
                const t = task as Record<string, unknown>;
                return {
                  day: typeof t.day === 'string' ? t.day : 'mon',
                  topic: typeof t.topic === 'string' ? t.topic : '复习内容',
                  materials: Array.isArray(t.materials)
                    ? t.materials.filter((m): m is string => typeof m === 'string')
                    : [],
                  minutes:
                    typeof t.minutes === 'number'
                      ? t.minutes
                      : projection.data.availability.preferredSessionMinutes,
                };
              })
            : [],
        };
      })
    : [];

  const materials: LearningPlanMaterial[] = Array.isArray(result.materials)
    ? result.materials
        .map((m: unknown) => {
          const material = m as Record<string, unknown>;
          return {
            title: typeof material.title === 'string' ? material.title : '未命名资料',
            source: typeof material.source === 'string' ? material.source : '',
          };
        })
        .filter((m) => m.title)
    : chunks.map((c) => ({ title: c.title, source: c.source }));

  return {
    goal,
    strategy,
    weeklyPlans,
    materials:
      materials.length > 0 ? materials : chunks.map((c) => ({ title: c.title, source: c.source })),
  };
}

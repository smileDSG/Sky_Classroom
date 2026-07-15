/**
 * D-002 Lesson Planner — Prompt Templates
 */

export const LESSON_SYSTEM_PROMPT = `You are an expert adaptive teaching planner. Given a student's learning profile and a teaching topic, generate a structured lesson plan with appropriate sections, depth, and timing. Output must be valid JSON matching the specified schema.`;

export function buildLessonPlannerPrompt(
  profile: {
    masteryBySubject: Record<string, number>;
    masteryByKnowledge: Record<string, number>;
    weakPoints: string[];
    strongPoints: string[];
    errorPatterns: { knowledgePoint: string; errorType: string; frequency: number }[];
    totalQuestions: number;
    totalCorrect: number;
    recentQuizPerformance?: {
      overallAccuracy: number;
      accuracyByKnowledge: Record<string, number>;
      topErrorCauses: string[];
      recommendedDepthShift: 'deeper' | 'shallower' | 'maintain';
    };
  },
  topic: string,
  diagnosticResult?: { accuracy: number; weakPrerequisites: string[]; recommendedDepth: string },
): string {
  const weakKps = profile.weakPoints.slice(0, 5);
  const strongKps = profile.strongPoints.slice(0, 5);
  const topErrors = profile.errorPatterns.sort((a, b) => b.frequency - a.frequency).slice(0, 3);

  const masteryForTopic = profile.masteryByKnowledge[topic] ?? 50;

  const weakInfo =
    weakKps.length > 0 ? `\n薄弱知识点（掌握度<30）：${weakKps.join('、')}` : '\n无明显薄弱知识点';
  const strongInfo =
    strongKps.length > 0
      ? `\n强势知识点（掌握度>80）：${strongKps.join('、')}`
      : '\n无明显强势知识点';

  const errorInfo =
    topErrors.length > 0
      ? `\n高频错误模式：\n${topErrors.map((e) => `  - ${e.knowledgePoint}：${e.errorType}（${e.frequency}次）`).join('\n')}`
      : '\n无明显错误模式';

  const recentPerformanceInfo = profile.recentQuizPerformance
    ? `\n近期答题表现（最近7天）：\n  - 整体正确率：${profile.recentQuizPerformance.overallAccuracy}%\n  - 高频错因：${profile.recentQuizPerformance.topErrorCauses.join('、') || '无'}\n  - 建议深度调整：${profile.recentQuizPerformance.recommendedDepthShift === 'shallower' ? '降低（学生近期表现较弱，需夯实基础）' : profile.recentQuizPerformance.recommendedDepthShift === 'deeper' ? '提升（学生近期表现优秀，可适当拔高）' : '保持'}`
    : '';

  const overallAccuracy =
    profile.totalQuestions > 0
      ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100)
      : 0;

  const diagnosticInfo = diagnosticResult
    ? `\n\n## 课前诊断结果\n- 前置知识检测正确率：${diagnosticResult.accuracy}%\n- 薄弱前置知识点：${diagnosticResult.weakPrerequisites.join('、') || '无'}\n- 建议授课深度：${diagnosticResult.recommendedDepth === 'basic' ? '基础（前置知识薄弱，需先回顾基础）' : diagnosticResult.recommendedDepth === 'advanced' ? '进阶（前置知识扎实，可直接深入）' : '标准'}\n\n请在授课计划的首个 section 增加「前置知识回顾」，针对上述薄弱前置知识点进行快速回顾。`
    : '';

  return `请为以下学生生成关于「${topic}」的授课计划。${diagnosticInfo}

## 学生学情
- 总做题数：${profile.totalQuestions}
- 正确数：${profile.totalCorrect}（正确率 ${overallAccuracy}%）
- 本题目主题掌握度：${masteryForTopic}%
${weakInfo}
${strongInfo}
${errorInfo}${recentPerformanceInfo}

## 内容深度策略
根据掌握度调整每个知识点的深度：
- 掌握度 < 30%：basic（基础概念讲解，类比举例，详细推导）
- 掌握度 30%-70%：intermediate（重点强化，易错点提醒，变式训练）
- 掌握度 > 70%：advanced（拓展提升，综合应用，竞赛级题目）

## 输出要求
返回 JSON 格式的课程计划，结构如下：
{
  "title": "课程标题",
  "sections": [
    {
      "id": "section-1",
      "title": "章节标题",
      "contentType": "explanation|example|diagram|quiz",
      "depth": "basic|intermediate|advanced",
      "knowledgePoints": ["知识点1", "知识点2"],
      "estimatedDuration": 10,
      "hasQuiz": true
    }
  ],
  "focusPoints": ["重点知识点1"],
  "estimatedDuration": 25
}

要求：
1. 至少包含 3 个 section
2. 薄弱知识点优先安排，深度设为 basic
3. 每个知识节点后插入随堂测（quiz 类型）
4. 总时长控制在 15-40 分钟
5. focusPoints 列出 2-4 个需要重点强化的知识点`;
}

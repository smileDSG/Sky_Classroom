import type { LearnerPreferences } from '@/lib/adaptive-learning/contracts';
import type { DueReviewItem, RecentLearningRecord, WeakPointSummary } from '@/lib/cloud-mind/types';
import type { LearningPath, LearningStatsResponse } from '@/lib/teaching/learning-path-types';

export interface AdminLearningDashboardDemo {
  stats: LearningStatsResponse & { learnerProfile: LearnerPreferences };
  learningPath: LearningPath;
  dueReviews: DueReviewItem[];
  recentRecords: RecentLearningRecord[];
  knowledgeTopics: WeakPointSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function createAdminLearningDashboardDemo(now = Date.now()): AdminLearningDashboardDemo {
  return {
    stats: {
      todayStudyMinutes: 47,
      streakDays: 18,
      masteryPercent: 77,
      checkedInToday: true,
      problemsAttempted: 186,
      problemsCorrect: 145,
      scenesCompleted: 24,
      learnerProfile: {
        userId: 'admin-default',
        preferredLanguage: 'zh-CN',
        contentFormatPreferences: ['diagram', 'worked-example', 'interactive'],
        explanationDepth: 'detailed',
        learningPace: 'standard',
        stepByStepMode: 'when-needed',
        interactionTone: 'professional',
        assistantName: '知行助教',
        preferenceNotes: '优先使用高中与大学知识，结合公式推导、代码和多智能体课堂案例。',
        privacy: {
          conversationMemory: 'persistent',
          optionalBehaviorSignals: true,
          privateKnowledgeRetrieval: true,
        },
        version: 3,
        schemaVersion: '1.0.0',
        updatedAt: new Date(now).toISOString(),
        updatedBy: 'system',
      },
    },
    learningPath: {
      id: 'admin-openmaic-learning-path',
      userId: 'admin-default',
      title: '天空课堂多智能体进阶路径',
      createdAt: now - 18 * DAY_MS,
      updatedAt: now - 2 * 60 * 60 * 1000,
      nodes: [
        {
          id: 'senior-calculus',
          topic: '高中函数、导数与课堂可视化',
          knowledgePoints: ['高中函数与导数', '切线与极值'],
          estimatedSections: 3,
          prerequisites: [],
          status: 'completed',
          masteryBefore: 65,
          masteryAfter: 88,
        },
        {
          id: 'senior-electromagnetism',
          topic: '高中电磁感应原理与实验探究',
          knowledgePoints: ['高中电磁感应', '楞次定律'],
          estimatedSections: 3,
          prerequisites: ['senior-calculus'],
          status: 'completed',
          masteryBefore: 42,
          masteryAfter: 58,
        },
        {
          id: 'university-linear-algebra',
          topic: '大学线性代数与知识图谱表示',
          knowledgePoints: ['矩阵与特征值', '向量空间'],
          estimatedSections: 4,
          prerequisites: ['senior-calculus'],
          status: 'in_progress',
          masteryBefore: 68,
        },
        {
          id: 'openmaic-orchestration',
          topic: '天空课堂多智能体课堂编排',
          knowledgePoints: ['LangGraph', '教师与同伴智能体', '圆桌讨论'],
          estimatedSections: 4,
          prerequisites: ['university-linear-algebra'],
          status: 'pending',
        },
        {
          id: 'openmaic-rag',
          topic: 'RAG 课程知识库与证据检索',
          knowledgePoints: ['向量检索', '知识库', '证据引用'],
          estimatedSections: 3,
          prerequisites: ['openmaic-orchestration'],
          status: 'pending',
        },
        {
          id: 'openmaic-slides',
          topic: 'AI 课件生成、课堂演播与质量检查',
          knowledgePoints: ['课件规划', '页面设计', 'QA 智能体'],
          estimatedSections: 5,
          prerequisites: ['openmaic-rag'],
          status: 'pending',
        },
      ],
    },
    dueReviews: [
      {
        id: 'review-electromagnetism',
        kind: 'mistake',
        title: '电磁感应方向判断与楞次定律',
        knowledgePoints: ['高中电磁感应'],
        dueAt: now + 3 * 60 * 60 * 1000,
        href: '/sky/learning',
      },
      {
        id: 'review-multivariable-calculus',
        kind: 'mistake',
        title: '多元函数偏导数与梯度',
        knowledgePoints: ['大学高等数学：多元微积分'],
        dueAt: now + DAY_MS,
        href: '/sky/learning',
      },
      {
        id: 'review-rag-agent',
        kind: 'memory-card',
        title: 'RAG 检索链与智能体工具调用',
        knowledgePoints: ['大学人工智能：RAG 与智能体'],
        dueAt: now + 2 * DAY_MS,
        href: '/sky/cloud-mind/memory',
      },
    ],
    knowledgeTopics: [
      {
        knowledgePoint: '高中数学：函数、导数与极值',
        mastery: 88,
        recentMistakeCount: 12,
        actionHref: '/sky/learning/profile-dashboard',
      },
      {
        knowledgePoint: '高中物理：电磁感应与楞次定律',
        mastery: 76,
        recentMistakeCount: 9,
        actionHref: '/sky/learning/profile-dashboard',
      },
      {
        knowledgePoint: '高中化学：化学平衡与反应速率',
        mastery: 71,
        recentMistakeCount: 7,
        actionHref: '/sky/learning/profile-dashboard',
      },
      {
        knowledgePoint: '大学数学：线性代数与特征值',
        mastery: 82,
        recentMistakeCount: 11,
        actionHref: '/sky/learning/profile-dashboard',
      },
      {
        knowledgePoint: '大学计算机：算法设计与动态规划',
        mastery: 68,
        recentMistakeCount: 8,
        actionHref: '/sky/learning/profile-dashboard',
      },
      {
        knowledgePoint: '大学人工智能：RAG 与多智能体',
        mastery: 79,
        recentMistakeCount: 10,
        actionHref: '/sky/learning/profile-dashboard',
      },
    ],
    recentRecords: [
      {
        id: 'activity-agent-roundtable',
        source: 'knowledge',
        title: '完成多智能体圆桌课堂',
        detail: '教师、同伴与评审智能体围绕“生成式 AI 伦理”完成 3 轮讨论',
        createdAt: now - 2 * 60 * 60 * 1000,
        href: '/sky',
      },
      {
        id: 'activity-linear-algebra-slides',
        source: 'slides',
        title: '生成《矩阵与特征值》互动课件',
        detail: '完成规划、页面设计、QA 检查，共 18 页',
        createdAt: now - DAY_MS,
        href: '/sky/cloud-mind/slides',
      },
      {
        id: 'activity-electromagnetism-quiz',
        source: 'quiz',
        title: '高中电磁感应诊断测验',
        detail: '完成 12 题，答对 9 题，正确率 75%',
        createdAt: now - 3 * DAY_MS,
        href: '/sky/cloud-mind/quiz',
      },
      {
        id: 'activity-rag-practice',
        source: 'knowledge',
        title: 'RAG 课程知识库检索练习',
        detail: '完成分块、向量检索与证据引用实验',
        createdAt: now - 5 * DAY_MS,
        href: '/sky/cloud-mind/course-studio',
      },
      {
        id: 'activity-calculus-review',
        source: 'memory',
        title: '复习函数与导数记忆卡',
        detail: '复习 16 张，掌握 13 张',
        createdAt: now - 8 * DAY_MS,
        href: '/sky/cloud-mind/memory',
      },
      {
        id: 'activity-ai-course',
        source: 'profile',
        title: '更新人工智能课程学习画像',
        detail: '新增机器学习、RAG、多智能体编排 3 个大学知识方向',
        createdAt: now - 11 * DAY_MS,
        href: '/sky/learning/profile-dashboard',
      },
    ],
  };
}

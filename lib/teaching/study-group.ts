/**
 * Study Group — Multi-agent discussion context builder for teaching jobs.
 *
 * Extracts a condensed summary from a completed TeachingJob and creates
 * student persona agent configs for an AI study group discussion.
 */

import type { TeachingJob } from '@/lib/server/teaching-job-store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { StudentProfile } from '@/lib/student/profile-types';
import { buildProfileContextPrompt } from '@/lib/student/profile-prompts';
import { nanoid } from 'nanoid';

export interface StudyGroupContext {
  topic: string;
  summary: string;
  focusPoints: string[];
  sectionTitles: string[];
}

export interface StudyGroupSetup {
  sessionId: string;
  context: StudyGroupContext;
  agents: AgentConfig[];
  discussionTopic: string;
  discussionPrompt: string;
}

const MAX_SUMMARY_LENGTH = 1500;

/**
 * Build a study group context from a completed teaching job.
 * Extracts title, focus points, section titles, and a content summary.
 */
export function buildStudyGroupContext(job: TeachingJob): StudyGroupContext {
  const plan = job.plan;
  const sections = job.sections ?? [];

  const sectionTitles = sections.map((s) => s.section.title);

  // Build a condensed summary from chunk content
  let summary = `主题：${plan?.title || job.topic}\n`;
  summary += `核心知识点：${(plan?.focusPoints ?? [job.topic]).join('、')}\n\n`;

  for (const { section, chunks } of sections.slice(0, 6)) {
    summary += `【${section.title}】\n`;
    const textChunks = chunks
      .filter((c) => c.type === 'text' || c.type === 'formula' || c.type === 'example')
      .map((c) => c.content)
      .join('\n');
    // Truncate each section to ~200 chars
    summary += textChunks.slice(0, 200) + (textChunks.length > 200 ? '...' : '');
    summary += '\n\n';
  }

  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = summary.slice(0, MAX_SUMMARY_LENGTH) + '...';
  }

  return {
    topic: plan?.title || job.topic,
    summary,
    focusPoints: plan?.focusPoints ?? [job.topic],
    sectionTitles,
  };
}

/**
 * Create student persona agents for the study group.
 * When a profile is provided, agents are tuned to the student's weak/strong points.
 */
export function createStudyGroupAgents(topic: string, profile?: StudentProfile): AgentConfig[] {
  const now = new Date();
  const base: Omit<AgentConfig, 'id' | 'persona'> = {
    name: '',
    role: 'student',
    avatar: '',
    color: '',
    allowedActions: [],
    priority: 5,
    createdAt: now,
    updatedAt: now,
    isDefault: false,
    isGenerated: true,
  };

  const weakPoints = profile?.weakPoints.slice(0, 3) ?? [];
  const errorPatterns =
    profile?.errorPatterns.sort((a, b) => b.frequency - a.frequency).slice(0, 2) ?? [];

  const weakHint =
    weakPoints.length > 0
      ? `这位同学最近在这些知识点上比较薄弱：${weakPoints.join('、')}。讨论时请多举例子、放慢节奏，主动确认理解。`
      : '';
  const errorHint =
    errorPatterns.length > 0
      ? `TA 容易在 ${errorPatterns.map((e) => `${e.knowledgePoint}（${e.errorType}）`).join('、')} 上出错，讨论中请针对性提醒。`
      : '';
  const strongHint = profile?.strongPoints.length
    ? `TA 已经掌握：${profile.strongPoints.slice(0, 3).join('、')}，可以适度关联已学内容。`
    : '';

  const contextHints = [weakHint, errorHint, strongHint].filter(Boolean).join('\n');

  return [
    {
      ...base,
      id: `study-group-curious-${nanoid(4)}`,
      name: '小萌',
      persona:
        `你是一位充满好奇心的 AI 同学，正在和伙伴们一起讨论「${topic}」。\n` +
        `你总爱追根究底，喜欢问"为什么"和"然后呢"。发言风格活泼、口语化，会主动提出疑问，引导大家深入思考。` +
        `每次发言控制在 2-3 句话，不要长篇大论。\n\n${contextHints}`,
      avatar: '/avatars/student-curious-new.jpg',
      color: '#f97316',
      personaType: 'curious',
    },
    {
      ...base,
      id: `study-group-analytical-${nanoid(4)}`,
      name: '智也',
      persona:
        `你是一位擅长逻辑分析的 AI 同学，正在和伙伴们一起讨论「${topic}」。\n` +
        `你善于拆解问题的步骤，找出规律，用清晰条理的方式表达观点。发言冷静理性，喜欢用"首先...其次..."的结构。` +
        `每次发言控制在 2-3 句话，不要长篇大论。\n\n${contextHints}`,
      avatar: '/avatars/student-meme-new.jpg',
      color: '#14b8a6',
      personaType: 'analytical',
    },
    {
      ...base,
      id: `study-group-note-taker-${nanoid(4)}`,
      name: '凛',
      persona:
        `你是一位善于总结的 AI 同学，正在和伙伴们一起讨论「${topic}」。\n` +
        `你擅长把大家零散的观点归纳成清晰的要点，会及时提炼关键结论。发言简洁有条理，喜欢用"总结一下"、"核心要点是"。` +
        `每次发言控制在 2-3 句话，不要长篇大论。\n\n${contextHints}`,
      avatar: '/avatars/student-glasses-new.jpg',
      color: '#3b82f6',
      personaType: 'note-taker',
    },
  ];
}

/**
 * Build the full discussion prompt for the director.
 */
export function buildDiscussionPrompt(
  context: StudyGroupContext,
  profile?: StudentProfile,
): string {
  const profileContext = profile
    ? `\n\n${buildProfileContextPrompt(profile, {
        maxWeakPoints: 3,
        maxErrorPatterns: 2,
        includeRecent: false,
      })}`
    : '';

  return (
    `我们今天要讨论的主题是「${context.topic}」。\n\n` +
    `内容摘要：\n${context.summary}${profileContext}\n\n` +
    `讨论规则：\n` +
    `1. 每位同学轮流发言，分享自己对知识点的理解或疑问\n` +
    `2. 可以互相补充、质疑、举例说明\n` +
    `3. 保持友好、鼓励的学习氛围\n` +
    `4. 当人类同学（用户）发言时，优先回应用户的问题\n` +
    `5. 讨论要针对上述学情：薄弱知识点多举例、易错点重点提醒、已掌握知识点适度拔高\n` +
    `6. 讨论结束时，由笔记型同学做简要总结`
  );
}

/**
 * Build a complete study group setup from a teaching job.
 */
export function buildStudyGroupSetup(job: TeachingJob, profile?: StudentProfile): StudyGroupSetup {
  const context = buildStudyGroupContext(job);
  const agents = createStudyGroupAgents(context.topic, profile);
  const discussionPrompt = buildDiscussionPrompt(context, profile);

  return {
    sessionId: nanoid(10),
    context,
    agents,
    discussionTopic: context.topic,
    discussionPrompt,
  };
}

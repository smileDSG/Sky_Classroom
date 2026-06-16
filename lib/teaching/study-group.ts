/**
 * Study Group — Multi-agent discussion context builder for teaching jobs.
 *
 * Extracts a condensed summary from a completed TeachingJob and creates
 * student persona agent configs for an AI study group discussion.
 */

import type { TeachingJob } from '@/lib/server/teaching-job-store';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
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
 */
export function createStudyGroupAgents(topic: string): AgentConfig[] {
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

  return [
    {
      ...base,
      id: `study-group-curious-${nanoid(4)}`,
      name: '小萌',
      persona:
        `你是一位充满好奇心的 AI 同学，正在和伙伴们一起讨论「${topic}」。\n` +
        `你总爱追根究底，喜欢问"为什么"和"然后呢"。发言风格活泼、口语化，会主动提出疑问，引导大家深入思考。` +
        `每次发言控制在 2-3 句话，不要长篇大论。`,
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
        `每次发言控制在 2-3 句话，不要长篇大论。`,
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
        `每次发言控制在 2-3 句话，不要长篇大论。`,
      avatar: '/avatars/student-glasses-new.jpg',
      color: '#3b82f6',
      personaType: 'note-taker',
    },
  ];
}

/**
 * Build the full discussion prompt for the director.
 */
export function buildDiscussionPrompt(context: StudyGroupContext): string {
  return (
    `我们今天要讨论的主题是「${context.topic}」。\n\n` +
    `内容摘要：\n${context.summary}\n\n` +
    `讨论规则：\n` +
    `1. 每位同学轮流发言，分享自己对知识点的理解或疑问\n` +
    `2. 可以互相补充、质疑、举例说明\n` +
    `3. 保持友好、鼓励的学习氛围\n` +
    `4. 当人类同学（用户）发言时，优先回应用户的问题\n` +
    `5. 讨论结束时，由笔记型同学做简要总结`
  );
}

/**
 * Build a complete study group setup from a teaching job.
 */
export function buildStudyGroupSetup(job: TeachingJob): StudyGroupSetup {
  const context = buildStudyGroupContext(job);
  const agents = createStudyGroupAgents(context.topic);
  const discussionPrompt = buildDiscussionPrompt(context);

  return {
    sessionId: nanoid(10),
    context,
    agents,
    discussionTopic: context.topic,
    discussionPrompt,
  };
}

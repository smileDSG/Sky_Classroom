/**
 * 轻量学习计划生成脚本
 *
 * 基于统一学习者画像的规划投影，从 data/crawled 召回资料并调用 LLM
 * 生成结构化学习计划。
 *
 * 用法：
 *   npx tsx scripts/generate-learning-plan.ts --subject math --weak "function,derivative" --goal "高考数学130" --grade senior --hours 10 --weeks 4
 *   npx tsx scripts/generate-learning-plan.ts --profile profile.json --output plan.md
 */

import { promises as fs } from 'fs';
import path from 'path';
import { buildPlanningProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { generateLearningPlan } from '@/lib/adaptive-learning/planning/learning-plan-service';
import { retrieveChunksForPlanning } from '@/lib/adaptive-learning/planning/retrieve-chunks';
import { generatePlanWithLLM } from '@/lib/adaptive-learning/planning/generate-plan';
import type { DomainLearnerProfile, LearnerPreferences } from '@/lib/adaptive-learning/contracts';

/**
 * 为脚本加载 .env.local 中的环境变量。
 * 不依赖 dotenv 包，直接解析 KEY=VALUE 格式。
 */
async function loadEnvLocal(): Promise<void> {
  const envPath = path.resolve('.env.local');
  try {
    const text = await fs.readFile(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local 不存在时忽略
  }
}

interface RawLearnerProfile {
  grade: 'junior' | 'senior' | 'university' | string;
  subjects: string[];
  weakPoints: string[];
  goals: string;
  weeklyHours: number;
  weeks?: number;
  examDate?: string;
}

interface CliOptions {
  profilePath?: string;
  subject?: string;
  weak?: string;
  goal?: string;
  grade?: string;
  hours?: number;
  weeks?: number;
  examDate?: string;
  dataDir: string;
  output: string;
  topK: number;
  model: string;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dataDir: 'data/crawled',
    output: 'learning-plan.md',
    topK: 12,
    model: 'deepseek:deepseek-v4-pro',
  };

  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    const value = args[i + 1];
    if (key === '--profile' && value) {
      options.profilePath = value;
      i += 1;
    } else if (key === '--subject' && value) {
      options.subject = value;
      i += 1;
    } else if (key === '--weak' && value) {
      options.weak = value;
      i += 1;
    } else if (key === '--goal' && value) {
      options.goal = value;
      i += 1;
    } else if (key === '--grade' && value) {
      options.grade = value;
      i += 1;
    } else if (key === '--hours' && value) {
      options.hours = parseInt(value, 10);
      i += 1;
    } else if (key === '--weeks' && value) {
      options.weeks = parseInt(value, 10);
      i += 1;
    } else if (key === '--exam-date' && value) {
      options.examDate = value;
      i += 1;
    } else if (key === '--data-dir' && value) {
      options.dataDir = value;
      i += 1;
    } else if (key === '--output' && value) {
      options.output = value;
      i += 1;
    } else if (key === '--top-k' && value) {
      options.topK = parseInt(value, 10);
      i += 1;
    } else if (key === '--model' && value) {
      options.model = value;
      i += 1;
    }
  }

  return options;
}

async function loadProfile(options: CliOptions): Promise<RawLearnerProfile> {
  if (options.profilePath) {
    const text = await fs.readFile(path.resolve(options.profilePath), 'utf8');
    const parsed = JSON.parse(text) as Partial<RawLearnerProfile>;
    if (!parsed.subjects || parsed.subjects.length === 0) {
      throw new Error('profile 必须包含 subjects 字段');
    }
    if (!parsed.weeklyHours) {
      throw new Error('profile 必须包含 weeklyHours 字段');
    }
    return parsed as RawLearnerProfile;
  }

  if (!options.subject || !options.weak || !options.goal || !options.grade || !options.hours) {
    throw new Error(
      '请提供完整参数：--subject, --weak, --goal, --grade, --hours；或使用 --profile profile.json',
    );
  }

  return {
    grade: options.grade,
    subjects: options.subject
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    weakPoints: options.weak
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    goals: options.goal,
    weeklyHours: options.hours,
    weeks: options.weeks ?? 4,
    examDate: options.examDate,
  };
}

function mapGradeToEducationStage(grade: string): {
  educationStage: DomainLearnerProfile['educationStage'];
  gradeLevel: string;
} {
  const g = grade.toLowerCase();
  if (g.includes('primary') || g.includes('小学')) {
    return { educationStage: 'primary', gradeLevel: grade };
  }
  if (g.includes('junior') || g.includes('初中')) {
    return { educationStage: 'junior-high', gradeLevel: grade };
  }
  if (g.includes('senior') || g.includes('高中')) {
    return { educationStage: 'senior-high', gradeLevel: 'grade-12' };
  }
  if (g.includes('university') || g.includes('大学')) {
    return { educationStage: 'undergraduate', gradeLevel: grade };
  }
  return { educationStage: 'other', gradeLevel: grade };
}

function buildPreferences(): LearnerPreferences {
  const now = new Date().toISOString();
  return {
    userId: 'cli-user',
    preferredLanguage: 'zh-CN',
    contentFormatPreferences: ['text', 'worked-example'],
    explanationDepth: 'detailed',
    learningPace: 'standard',
    stepByStepMode: 'when-needed',
    interactionTone: 'encouraging',
    assistantName: '小云',
    preferenceNotes: 'Generated by CLI script',
    privacy: {
      conversationMemory: 'session',
      optionalBehaviorSignals: false,
      privateKnowledgeRetrieval: false,
    },
    version: 1,
    schemaVersion: '1.0.0',
    updatedAt: now,
    updatedBy: 'system',
  };
}

function buildDomainProfile(raw: RawLearnerProfile): DomainLearnerProfile {
  const now = new Date().toISOString();
  const { educationStage, gradeLevel } = mapGradeToEducationStage(raw.grade);
  const subjectId = raw.subjects[0] ?? 'math';
  const weeklyAvailableMinutes = raw.weeklyHours * 60;
  const dailyMinutes = Math.min(180, Math.max(30, Math.floor(weeklyAvailableMinutes / 6)));

  const base: DomainLearnerProfile = {
    id: 'default',
    userId: 'cli-user',
    subjectId,
    educationStage,
    gradeLevel,
    curriculumPackId: `${subjectId}-default`,
    curriculumPackVersion: '1.0.0',
    weeklyAvailableMinutes,
    dailyAvailability: {
      mon: dailyMinutes,
      tue: dailyMinutes,
      wed: dailyMinutes,
      thu: dailyMinutes,
      fri: dailyMinutes,
      sat: Math.floor(dailyMinutes / 2),
      sun: 0,
    },
    preferredSessionMinutes: 45,
    constraints: {
      restDays: ['sun'],
      maxDailyMinutes: 180,
      teacherLockedNodeIds: [],
    },
    status: 'active',
    version: 1,
    schemaVersion: '1.0.0',
    createdAt: now,
    updatedAt: now,
  };

  if (raw.examDate) {
    base.examSystem = 'gaokao';
    base.examDate = raw.examDate;
    base.targetScore = 130;
    base.scoreScaleMax = 150;
  } else {
    base.targetNodeIds = raw.weakPoints;
    base.horizonDays = raw.weeks ? raw.weeks * 7 : 28;
  }

  return base;
}

function formatPlanAsMarkdown(plan: {
  goal: string;
  strategy: string;
  weeklyPlans: {
    week: number;
    goal: string;
    dailyTasks: { day: string; topic: string; materials: string[]; minutes: number }[];
  }[];
  materials: { title: string; source: string }[];
}): string {
  const lines: string[] = [];
  lines.push(`# ${plan.goal}`);
  lines.push('');
  lines.push(`## 总体策略`);
  lines.push(plan.strategy);
  lines.push('');

  for (const week of plan.weeklyPlans) {
    lines.push(`## 第 ${week.week} 周：${week.goal}`);
    lines.push('');
    for (const task of week.dailyTasks) {
      lines.push(`- **${task.day}**：${task.topic}（${task.minutes} 分钟）`);
      if (task.materials.length > 0) {
        lines.push(`  - 资料：${task.materials.join('、')}`);
      }
    }
    lines.push('');
  }

  lines.push('## 推荐资料清单');
  lines.push('');
  for (const material of plan.materials) {
    lines.push(`- ${material.title}（${material.source}）`);
  }

  return lines.join('\n');
}

async function main() {
  await loadEnvLocal();
  const options = parseArgs();
  const raw = await loadProfile(options);

  const preferences = buildPreferences();
  const domainProfile = buildDomainProfile(raw);

  const projection = buildPlanningProjection({
    userId: 'cli-user',
    snapshotId: `snapshot:cli-user:v${preferences.version}:w0`,
    profileVersion: preferences.version,
    eventWatermark: 0,
    preferences,
    domainProfile,
    planningMode: domainProfile.examDate && domainProfile.targetScore ? 'exam' : 'mastery',
    knowledgeStatus: 'no-evidence',
    targetKnowledge: [],
    engagementSummary: { studyMinutes7d: 0, activeDays7d: 0 },
  });

  console.log('正在生成学习计划...');
  const plan = await generateLearningPlan(
    { projection, goalTopic: raw.goals },
    {
      retrieveChunks: (p, topK) => retrieveChunksForPlanning(p, topK, options.dataDir),
      generatePlan: (systemPrompt, userPrompt) =>
        generatePlanWithLLM(systemPrompt, userPrompt, { model: options.model }),
    },
  );

  const markdown = formatPlanAsMarkdown(plan);
  const outputPath = path.resolve(options.output);
  await fs.writeFile(outputPath, markdown, 'utf8');
  console.log(`学习计划已保存至：${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

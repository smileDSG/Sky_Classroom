import 'server-only';

import { promises as fs } from 'fs';
import path from 'path';

import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { searchAiIntroCourse, type AiIntroSearchHit } from '@/lib/course-knowledge/ai-intro-loader';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { createLogger } from '@/lib/logger';
import { getServerStorage } from '@/lib/server/server-storage';
import { resolveSolverModel } from '@/lib/solve/solver-constants';
import {
  reviewGeneratedResources,
  type ResourceQualityCheck,
} from '@/lib/software-cup/quality-review';
import { buildP2Enhancements, type P2Enhancements } from '@/lib/software-cup/p2-long-term-learning';
import {
  buildConversationProfileFromSignals,
  createProfileSignalDAO,
  type ConversationProfileSummary,
  type ProfileSignal,
} from '@/lib/student/profile-signals';
import type { ThinkingConfig } from '@/lib/types/provider';

const log = createLogger('SoftwareCupDemo');

const DISABLE_THINKING: ThinkingConfig = { mode: 'disabled', enabled: false };

/**
 * 学习包工坊支持的 4 种资源类型（学→查→练→复盘 四阶段产物）。
 * 练习、复盘环节外包给出题引擎与错题复盘，包内不埋题。
 * 客户端按需选择，服务端只对所选类型生成，不再一锅端全量生成。
 */
export const COURSE_RESOURCE_TYPES = [
  'markdown_lecture',
  'mind_map',
  'self_check',
  'learning_path',
] as const;

export type CourseResourceType = (typeof COURSE_RESOURCE_TYPES)[number];

export function isCourseResourceType(value: string): value is CourseResourceType {
  return (COURSE_RESOURCE_TYPES as readonly string[]).includes(value);
}

function normalizeResourceTypes(values: string[] | undefined): string[] {
  return Array.isArray(values) ? Array.from(new Set(values.filter(isCourseResourceType))) : [];
}

export type SafetyRiskLevel = 'low' | 'medium' | 'high';
export type AgentStatus = 'pending' | 'running' | 'completed' | 'need_review';

export interface ProfileDimension<T> {
  value: T;
  confidence: number;
  evidence: string[];
}

export interface SoftwareCupStudentProfile {
  userId: string;
  sourceInput?: string;
  profileVersion: string;
  lastUpdated: string;
  dimensions: {
    majorBackground: ProfileDimension<string>;
    learningGoal: ProfileDimension<string>;
    knowledgeBase: {
      strongPoints: string[];
      weakPoints: string[];
      confidence: number;
      evidence: string[];
    };
    cognitiveStyle: ProfileDimension<string>;
    errorPatternPreference: ProfileDimension<string[]>;
    resourcePreference: ProfileDimension<string[]>;
    learningPace: ProfileDimension<string>;
    currentLearningState: ProfileDimension<string>;
  };
  updatePolicy: Record<string, string>;
}

export interface SafetyCheckResult {
  passed: boolean;
  riskLevel: SafetyRiskLevel;
  categories: string[];
  action: 'allow' | 'rewrite_as_tutoring' | 'reject' | 'need_review';
  message: string;
}

export interface AgentTraceItem {
  agent: string;
  status: AgentStatus;
  output: string;
  progress?: number;
}

export interface GeneratedResource {
  id: string;
  type: string;
  title: string;
  generationSource?: 'demo' | 'llm_rag';
  personalizationReason?: string;
  sourceCitations: string[];
  contentPreview?: string;
  format?: string;
  content?: string;
  downloadFileName?: string;
  trust: {
    confidence: number;
    status: string;
  };
  qualityReview?: ResourceQualityCheck;
}

export interface LearningPathNode {
  dayRange: string;
  goal: string;
  resources: string[];
  reason: string;
}

export interface ReviewResult {
  passed: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
  resourceChecks?: ResourceQualityCheck[];
}

export interface SoftwareCupGenerationResult {
  demoId: string;
  jobId: string;
  status: 'completed';
  progress: number;
  generationMode: 'llm_rag' | 'demo_fallback';
  llmGeneration?: {
    used: boolean;
    reason?: string;
    model?: string;
  };
  courseId: string;
  generatedAt: string;
  studentProfile: SoftwareCupStudentProfile;
  safety: SafetyCheckResult;
  courseHits: AiIntroSearchHit[];
  agentTrace: AgentTraceItem[];
  resources: GeneratedResource[];
  learningPath: LearningPathNode[];
  reviewResult: ReviewResult;
  p2Enhancements: P2Enhancements;
}

export interface SoftwareCupProgress {
  step: 'safety' | 'profile' | 'search' | 'generate' | 'review' | 'path';
  progress: number;
  message: string;
}

export interface RunSoftwareCupGenerationOptions {
  userId?: string;
  profileSignals?: ProfileSignal[];
  enableLlm?: boolean;
  /** 仅生成指定的资源类型；为空时生成全部 4 类（用于兼容既有调用）。 */
  resourceTypes?: string[];
  onProgress?: (progress: SoftwareCupProgress) => void | Promise<void>;
}

interface LlmResourcePatch {
  id?: string;
  type?: string;
  title?: string;
  content?: string;
  contentPreview?: string;
  personalizationReason?: string;
  sourceCitations?: string[];
}

interface LlmReviewPatch {
  confidence?: number;
  issues?: string[];
  suggestions?: string[];
}

interface LlmCourseStudioResponse {
  resources?: LlmResourcePatch[];
  reviewResult?: LlmReviewPatch;
}

interface LlmRagEnhancement {
  resources: GeneratedResource[];
  used: boolean;
  reason?: string;
  model?: string;
  reviewPatch?: LlmReviewPatch;
}

const DEMO_ROOT = path.join(process.cwd(), 'data', 'demo', 'software-cup');
const COURSE_KNOWLEDGE_ROOT = path.join(process.cwd(), 'data', 'course-knowledge', 'ai-intro');

async function readJson<T>(fileName: string): Promise<T> {
  const text = await fs.readFile(path.join(DEMO_ROOT, fileName), 'utf8');
  return JSON.parse(text) as T;
}

export async function getDefaultSoftwareCupInput(): Promise<string> {
  return fs.readFile(path.join(DEMO_ROOT, 'student-input.txt'), 'utf8');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toSafeFileName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64);
  return normalized || 'learning-resource';
}

function toDownloadFileName(resource: GeneratedResource): string {
  return `${toSafeFileName(resource.title || resource.id)}.md`;
}

function resolveCourseKnowledgeFile(file: string | undefined): string | null {
  if (!file) return null;
  const normalized = file
    .replace(/\\/g, '/')
    .replace(/^data\/course-knowledge\/ai-intro\//, '')
    .replace(/^\/+/, '');

  if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) return null;

  const root = path.resolve(COURSE_KNOWLEDGE_ROOT);
  const candidate = path.resolve(root, normalized);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return null;
  return candidate;
}

async function readCourseKnowledgeFile(file: string | undefined): Promise<string | null> {
  const resolved = resolveCourseKnowledgeFile(file);
  if (!resolved) return null;

  try {
    return await fs.readFile(resolved, 'utf8');
  } catch {
    return null;
  }
}

async function readResourceSources(
  resource: GeneratedResource,
): Promise<Array<{ file: string; content: string }>> {
  const files = unique(resource.sourceCitations.filter((source) => source.endsWith('.md')));
  const pairs = await Promise.all(
    files.map(async (file) => {
      const content = await readCourseKnowledgeFile(file);
      return content ? { file, content } : null;
    }),
  );
  return pairs.filter((item): item is { file: string; content: string } => Boolean(item));
}

function compactMarkdownExcerpt(content: string, maxChars = 1400): string {
  return content
    .replace(/^# .+$/m, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars)
    .trim();
}

function profileMarkdown(profile: SoftwareCupStudentProfile): string {
  return [
    `- 专业背景：${profile.dimensions.majorBackground.value}`,
    `- 学习目标：${profile.dimensions.learningGoal.value}`,
    `- 当前薄弱点：${profile.dimensions.knowledgeBase.weakPoints.join('、')}`,
    `- 资源偏好：${profile.dimensions.resourcePreference.value.join('、')}`,
    `- 学习节奏：${profile.dimensions.learningPace.value}`,
  ].join('\n');
}

function citationsMarkdown(resource: GeneratedResource): string {
  return resource.sourceCitations.map((source) => `- ${source}`).join('\n');
}

function buildLectureContent(
  resource: GeneratedResource,
  profile: SoftwareCupStudentProfile,
  sources: Array<{ file: string; content: string }>,
): string {
  const sourceSections = sources
    .slice(0, 3)
    .map(
      (source) =>
        `## 课程来源摘录：${source.file}\n\n${compactMarkdownExcerpt(source.content, 1200)}`,
    )
    .join('\n\n');

  return [
    `# ${resource.title}`,
    '',
    '## 学习画像',
    profileMarkdown(profile),
    '',
    '## 推荐理由',
    resource.personalizationReason ?? '系统根据当前薄弱点和课程知识库生成这份讲义。',
    '',
    '## 学习目标',
    '- 区分训练集、验证集、测试集与泛化能力。',
    '- 能解释过拟合、欠拟合和评价指标之间的关系。',
    '- 理解 RAG 为什么需要检索来源、引用和低置信度处理。',
    '',
    sourceSections || '## 核心讲解\n\n围绕当前薄弱点建立概念框架，再通过练习、案例和复盘形成闭环。',
    '',
    '## 学习任务',
    '1. 用自己的话解释一个模型为什么会在训练集表现好、测试集表现差。',
    '2. 选择一个评价指标，并说明它适合什么数据分布。',
    '3. 画出 RAG 的检索、生成、引用和复核流程。',
    '',
    '## 来源',
    citationsMarkdown(resource),
  ].join('\n');
}

function buildMindMapContent(
  resource: GeneratedResource,
  profile: SoftwareCupStudentProfile,
): string {
  return [
    `# ${resource.title}`,
    '',
    '## Mermaid 导图',
    '',
    '```mermaid',
    resource.content ?? 'mindmap\n  root((学习资料))',
    '```',
    '',
    '## 使用方式',
    `围绕 ${normalizeTopicText(profile.dimensions.knowledgeBase.weakPoints)} 从“概念-诊断-实践”三个层次复习。`,
    '',
    '## 复盘问题',
    '- 哪个节点是当前最不稳定的知识点？',
    '- 这个节点对应哪一条课程来源？',
    '- 下一次练习要验证什么？',
    '',
    '## 来源',
    citationsMarkdown(resource),
  ].join('\n');
}

function buildSelfCheckContent(
  resource: GeneratedResource,
  profile: SoftwareCupStudentProfile,
): string {
  const weakPoints = profile.dimensions.knowledgeBase.weakPoints;
  const points = weakPoints.length > 0 ? weakPoints : ['核心概念'];
  const checklist = points
    .map(
      (point) =>
        `### ${point}\n` +
        [0, 1, 2]
          .map(
            (index) =>
              `- [ ] ${['能用自己的话讲清它的核心含义', '能说出它在课程中的前置与后继关系', '能判断一个例子是否真正涉及它'][index]}`,
          )
          .join('\n'),
    )
    .join('\n\n');

  return [
    `# ${resource.title}`,
    '',
    '## 使用说明',
    '逐条判断：能做到就勾选，做不到就标记为待复学。本清单只用于自查定位薄弱点，不替代正式答题与出题引擎练习。',
    '',
    '## 常见错因对照',
    '- 概念边界混淆：把 A 与看似相近但不同的 B 混为一谈。',
    '- 前置缺失：缺少训练集/验证集等前置概念支撑。',
    '- 流程连接弱：能背概念但连不起来整体步骤。',
    '',
    '## 按薄弱点自查',
    checklist,
    '',
    '## 来源',
    citationsMarkdown(resource),
  ].join('\n');
}

function buildLearningPathContent(
  resource: GeneratedResource,
  profile: SoftwareCupStudentProfile,
): string {
  const topic = normalizeTopicText(profile.dimensions.knowledgeBase.weakPoints);
  return [
    `# ${resource.title}`,
    '',
    '## 学习闭环（学 → 查 → 练 → 复盘）',
    '这套学习包按以下顺序使用。练习与复盘通过平台既有功能完成，包内不内置题目。',
    '',
    '### 1. 学：建立概念',
    `先用「${topic} 个性化讲义」理解概念边界，再用「知识结构导图」定位薄弱点与前置关系。`,
    '',
    '### 2. 查：逐条自查',
    '打开「薄弱点自查清单」，逐条判断自己“能做到”还是“还不行”，定位真正薄弱的点。',
    '',
    '### 3. 练：跳转出题引擎',
    '打开平台出题引擎（`/sky/cloud-mind/quiz`），把自查后仍薄弱的点作为出题主题进行针对性练习。',
    '',
    '### 4. 复盘：跳转错题复盘',
    '练习后到错题画像与学习计划（`/sky/learning`）查看解析与复习安排，把新错因回写并更新后续学习顺序。',
    '',
    '## 推荐顺序',
    '个性化讲义 → 知识结构导图 → 薄弱点自查清单 → 出题练习 → 错题复盘',
    '',
    '## 来源',
    citationsMarkdown(resource),
  ].join('\n');
}

function buildFallbackContent(
  resource: GeneratedResource,
  profile: SoftwareCupStudentProfile,
  sources: Array<{ file: string; content: string }>,
): string {
  const sourceText = sources
    .map((source) => `## ${source.file}\n\n${compactMarkdownExcerpt(source.content, 1600)}`)
    .join('\n\n');
  return [
    `# ${resource.title}`,
    '',
    '## 学习画像',
    profileMarkdown(profile),
    '',
    '## 内容',
    resource.content ??
      resource.contentPreview ??
      resource.personalizationReason ??
      '系统已生成学习材料。',
    '',
    sourceText,
    '',
    '## 来源',
    citationsMarkdown(resource),
  ].join('\n');
}

async function buildResourceContent(
  resource: GeneratedResource,
  profile: SoftwareCupStudentProfile,
): Promise<string> {
  const sources = await readResourceSources(resource);

  if (resource.type === 'markdown_lecture') return buildLectureContent(resource, profile, sources);
  if (resource.type === 'mind_map') return buildMindMapContent(resource, profile);
  if (resource.type === 'self_check') return buildSelfCheckContent(resource, profile);
  if (resource.type === 'learning_path') return buildLearningPathContent(resource, profile);

  return buildFallbackContent(resource, profile, sources);
}

async function hydrateResourceArtifacts(
  resources: GeneratedResource[],
  profile: SoftwareCupStudentProfile,
): Promise<GeneratedResource[]> {
  return Promise.all(
    resources.map(async (resource) => {
      const content = await buildResourceContent(resource, profile);
      return {
        ...resource,
        content,
        downloadFileName: toDownloadFileName(resource),
      };
    }),
  );
}

function stringifyProfileForPrompt(profile: SoftwareCupStudentProfile): string {
  return JSON.stringify({
    learningGoal: profile.dimensions.learningGoal.value,
    weakPoints: profile.dimensions.knowledgeBase.weakPoints,
    strongPoints: profile.dimensions.knowledgeBase.strongPoints,
    resourcePreference: profile.dimensions.resourcePreference.value,
    cognitiveStyle: profile.dimensions.cognitiveStyle.value,
    learningPace: profile.dimensions.learningPace.value,
    currentLearningState: profile.dimensions.currentLearningState.value,
  });
}

async function buildRagContext(courseHits: AiIntroSearchHit[]): Promise<string> {
  const contextItems = await Promise.all(
    courseHits.slice(0, 6).map(async (hit, index) => {
      const fullText = await readCourseKnowledgeFile(hit.document.file);
      const excerpt = compactMarkdownExcerpt(fullText || hit.snippet, 1200);
      return [
        `Source ${index + 1}`,
        `title: ${hit.document.title}`,
        `kind: ${hit.document.kind}`,
        `file: ${hit.document.file}`,
        `score: ${hit.score}`,
        `excerpt: ${excerpt}`,
      ].join('\n');
    }),
  );

  return contextItems.join('\n\n---\n\n');
}

function buildResourceBrief(resources: GeneratedResource[]): string {
  return JSON.stringify(
    resources.map((resource) => ({
      id: resource.id,
      type: resource.type,
      title: resource.title,
      contentPreview: resource.contentPreview,
      sourceCitations: resource.sourceCitations,
    })),
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isUsefulResourcePatch(patch: LlmResourcePatch | undefined): patch is LlmResourcePatch {
  if (!patch) return false;
  return Boolean(
    patch.title?.trim() ||
    patch.content?.trim() ||
    patch.contentPreview?.trim() ||
    patch.personalizationReason?.trim(),
  );
}

function mergeLlmResourcePatches(
  resources: GeneratedResource[],
  patches: LlmResourcePatch[],
  courseHits: AiIntroSearchHit[],
): { resources: GeneratedResource[]; applied: number } {
  const citationsFromRag = courseHits.map((hit) => hit.document.file).filter(Boolean);
  const patchesById = new Map(
    patches.filter((patch) => patch.id).map((patch) => [patch.id as string, patch]),
  );
  const patchesByType = new Map(
    patches.filter((patch) => patch.type).map((patch) => [patch.type as string, patch]),
  );
  let applied = 0;

  const merged = resources.map((resource, index) => {
    const patch =
      patchesById.get(resource.id) ?? patchesByType.get(resource.type) ?? patches[index];
    if (!isUsefulResourcePatch(patch)) {
      return { ...resource, generationSource: 'demo' as const };
    }

    applied += 1;
    return {
      ...resource,
      generationSource: 'llm_rag' as const,
      title: patch.title?.trim() || resource.title,
      content: patch.content?.trim() || resource.content,
      contentPreview: patch.contentPreview?.trim() || resource.contentPreview,
      personalizationReason: patch.personalizationReason?.trim() || resource.personalizationReason,
      sourceCitations: unique([
        ...resource.sourceCitations,
        ...citationsFromRag,
        ...toStringArray(patch.sourceCitations),
      ]).slice(0, 8),
      trust: {
        ...resource.trust,
        status: resource.trust.status === 'verified' ? 'verified_with_llm' : resource.trust.status,
      },
    };
  });

  return { resources: merged, applied };
}

function normalizeReviewPatch(value: unknown): LlmReviewPatch | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const review = value as Record<string, unknown>;
  return {
    confidence: typeof review.confidence === 'number' ? review.confidence : undefined,
    issues: toStringArray(review.issues),
    suggestions: toStringArray(review.suggestions),
  };
}

async function enhanceResourcesWithLlmRag(params: {
  input: string;
  profile: SoftwareCupStudentProfile;
  courseHits: AiIntroSearchHit[];
  resources: GeneratedResource[];
}): Promise<LlmRagEnhancement> {
  try {
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);
    const ragContext = await buildRagContext(params.courseHits);
    const prompt = [
      'You are the Course Studio resource generation agent.',
      'Generate grounded learning resources for a student. Use only the retrieved course evidence below for factual claims.',
      'Return JSON only. Schema:',
      '{ "resources": [{ "id": string, "type": string, "title": string, "contentPreview": string, "content": string, "personalizationReason": string, "sourceCitations": string[] }], "reviewResult": { "confidence": number, "issues": string[], "suggestions": string[] } }',
      '',
      'Student request:',
      params.input,
      '',
      'Student profile:',
      stringifyProfileForPrompt(params.profile),
      '',
      'Retrieved course evidence:',
      ragContext || 'No matching course evidence was retrieved.',
      '',
      'Resource slots to fill:',
      buildResourceBrief(params.resources),
      '',
      'Rules:',
      '- Keep each resource grounded in sourceCitations.',
      '- Preserve each resource id and type when possible.',
      '- Write content in Chinese unless the source terms are English.',
      '- Prefer concise, classroom-ready Markdown.',
    ].join('\n');

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.4,
        maxOutputTokens: 6000,
      },
      'software-cup-course-studio-rag',
      { retries: 1, timeoutMs: 25000 },
      DISABLE_THINKING,
      'You generate cited learning resources from retrieved course evidence. Return valid JSON only.',
    );

    const parsed = parseJsonResponse<LlmCourseStudioResponse>(result.text || '');
    const patches = Array.isArray(parsed?.resources) ? parsed.resources : [];
    const { resources, applied } = mergeLlmResourcePatches(
      params.resources,
      patches,
      params.courseHits,
    );

    if (applied === 0) {
      // 信任底线：模型没有产出任何可用资源时绝不回退到 demo 假料，明确抛错交由上层处理。
      throw new Error('生成模型未输出可用的学习资源，请重试。');
    }

    return {
      resources,
      used: true,
      model: `${modelConfig.providerId}:${modelConfig.modelId}`,
      reviewPatch: normalizeReviewPatch(parsed?.reviewResult),
    };
  } catch (error) {
    // 不再静默降级到 demo 资源：把错误抛给调用方，最终让任务进入 failed 态 + 可重试。
    log.warn('Course Studio LLM RAG generation failed:', error);
    throw error;
  }
}

function inferMajor(input: string): string {
  const majorMatch = input.match(/我是(.{2,18}?)(大[一二三四]|学生|同学)/);
  if (majorMatch?.[1]) return `${majorMatch[1]}${majorMatch[2]}`;
  if (input.includes('软件工程')) return '软件工程学生';
  if (input.includes('人工智能')) return '人工智能相关专业学生';
  return '高校计算机相关专业学生';
}

function inferWeakPoints(input: string): string[] {
  const candidates = [
    ['搜索算法', /搜索算法|启发式搜索|A\*|BFS|DFS|路径搜索/i],
    ['线性代数', /线性代数|矩阵|向量/],
    ['过拟合', /过拟合|泛化/],
    ['模型评估', /模型评估|评价指标|准确率|召回率|F1/i],
    ['RAG', /RAG|检索增强|向量检索/i],
    ['智能体', /智能体|Agent/i],
    ['代码实践', /代码|实操|实验|Python/i],
  ] as const;

  const weakPoints = candidates
    .filter(([, pattern]) => pattern.test(input))
    .map(([label]) => label);

  return unique(weakPoints.length > 0 ? weakPoints : ['机器学习基础', '模型评估', 'RAG']);
}

function inferResourcePreference(input: string): string[] {
  const preferences: string[] = [];
  if (/图解|图|导图|可视化/.test(input)) preferences.push('图解讲义', '思维导图');
  if (/代码|Python|实操|案例/i.test(input)) preferences.push('代码实操案例');
  if (/题|练习|刷题/.test(input)) preferences.push('分层练习题');
  if (/PPT|课件/i.test(input)) preferences.push('PPT 大纲');
  if (/视频|动画/.test(input)) preferences.push('短视频脚本');
  return unique(preferences.length > 0 ? preferences : ['图解讲义', '分层练习题', '代码实操案例']);
}

function inferGoal(input: string): string {
  const explicitGoalMatch = input.match(/学习目标[:：]\s*(.{4,80}?)(\n|。|，|,|$)/);
  if (explicitGoalMatch?.[1]) return explicitGoalMatch[1].trim();
  const goalMatch = input.match(/希望(.{4,60}?)(。|，|,|$)/);
  if (goalMatch?.[1]) return goalMatch[1].replace(/^能?/, '').trim();
  if (input.includes('两周')) return '两周内补强机器学习基础和大模型智能体';
  return '系统掌握人工智能导论核心知识并完成实践任务';
}

function inferPace(input: string): string {
  const paceMatch = input.match(/每天.{0,8}?(\d+)\s*分钟/);
  if (paceMatch?.[1]) return `每天约 ${paceMatch[1]} 分钟`;
  if (input.includes('两周')) return '两周完成一轮补强';
  return '按章节逐步推进';
}

function normalizeTopicText(values: string[], fallback = '人工智能导论'): string {
  const topics = unique(values).slice(0, 3);
  return topics.length > 0 ? topics.join('、') : fallback;
}

function toProfileDimension<T>(field: {
  value: T;
  confidence: number;
  evidence: string[];
}): ProfileDimension<T> {
  return {
    value: field.value,
    confidence: field.confidence,
    evidence: field.evidence,
  };
}

function mergeConversationProfile(
  profile: SoftwareCupStudentProfile,
  conversationProfile: ConversationProfileSummary,
): SoftwareCupStudentProfile {
  if (Object.keys(conversationProfile).length === 0) return profile;

  const dimensions = profile.dimensions;
  return {
    ...profile,
    dimensions: {
      ...dimensions,
      majorBackground: conversationProfile.majorBackground
        ? toProfileDimension(conversationProfile.majorBackground)
        : dimensions.majorBackground,
      learningGoal: conversationProfile.learningGoal
        ? toProfileDimension(conversationProfile.learningGoal)
        : dimensions.learningGoal,
      knowledgeBase: conversationProfile.knowledgeBase
        ? {
            strongPoints: conversationProfile.knowledgeBase.strongPoints,
            weakPoints: conversationProfile.knowledgeBase.weakPoints,
            confidence: conversationProfile.knowledgeBase.confidence,
            evidence: conversationProfile.knowledgeBase.evidence,
          }
        : dimensions.knowledgeBase,
      cognitiveStyle: conversationProfile.cognitiveStyle
        ? toProfileDimension(conversationProfile.cognitiveStyle)
        : dimensions.cognitiveStyle,
      errorPatternPreference: conversationProfile.errorPatternPreference
        ? toProfileDimension(conversationProfile.errorPatternPreference)
        : dimensions.errorPatternPreference,
      resourcePreference: conversationProfile.resourcePreference
        ? toProfileDimension(conversationProfile.resourcePreference)
        : dimensions.resourcePreference,
      learningPace: conversationProfile.learningPace
        ? toProfileDimension(conversationProfile.learningPace)
        : dimensions.learningPace,
      currentLearningState: conversationProfile.currentLearningState
        ? toProfileDimension(conversationProfile.currentLearningState)
        : dimensions.currentLearningState,
    },
  };
}

async function resolveProfileSignals(
  options: RunSoftwareCupGenerationOptions,
): Promise<ProfileSignal[]> {
  if (options.profileSignals) return options.profileSignals;
  if (!options.userId) return [];

  try {
    const storage = await getServerStorage();
    const profileSignalDAO = createProfileSignalDAO(storage);
    return await profileSignalDAO.listByUser(options.userId);
  } catch {
    return [];
  }
}

function personalizeResourceTitle(resource: GeneratedResource, topics: string[]): string {
  const topicText = normalizeTopicText(topics);
  const titles: Record<string, string> = {
    markdown_lecture: `${topicText} 个性化讲义`,
    mind_map: `${topicText} 知识结构导图`,
    self_check: `${topicText} 薄弱点自查清单`,
    learning_path: `${topicText} 学习路径与跳转指引`,
  };
  return titles[resource.type] ?? resource.title;
}

function personalizeResources(
  resources: GeneratedResource[],
  profile: SoftwareCupStudentProfile,
  courseHits: AiIntroSearchHit[],
): GeneratedResource[] {
  const weakPoints = profile.dimensions.knowledgeBase.weakPoints;
  const preferences = profile.dimensions.resourcePreference.value;
  const topicText = normalizeTopicText(weakPoints);
  const citedFiles = courseHits.map((hit) => hit.document.file).filter(Boolean);
  const preferredText = preferences.length > 0 ? preferences.join('、') : '讲义、练习和案例';

  return resources.map((resource, index) => {
    const sourceCitations = unique([...resource.sourceCitations, ...citedFiles]).slice(0, 4);
    const profileReason = `根据本轮画像识别到薄弱点集中在 ${topicText}，且偏好 ${preferredText}，因此优先生成该类型材料。`;
    const reason = resource.personalizationReason
      ? `${resource.personalizationReason} ${profileReason}`
      : profileReason;

    return {
      ...resource,
      title: personalizeResourceTitle(resource, weakPoints),
      personalizationReason: reason,
      sourceCitations,
      contentPreview:
        resource.contentPreview ??
        `围绕 ${topicText} 组织内容，匹配当前学习目标「${profile.dimensions.learningGoal.value}」，并保留课程来源引用。`,
      trust: {
        ...resource.trust,
        confidence: Number(Math.min(0.96, resource.trust.confidence + index * 0.005).toFixed(2)),
      },
    };
  });
}

function buildPersonalizedAgentTrace(
  profile: SoftwareCupStudentProfile,
  courseHits: AiIntroSearchHit[],
  resources: GeneratedResource[],
): AgentTraceItem[] {
  const weakPointText = normalizeTopicText(profile.dimensions.knowledgeBase.weakPoints);
  const resourceTypes = resources.map((resource) => resource.type).join(', ');
  return [
    {
      agent: 'ProfileAgent',
      status: 'completed',
      output: `从自然语言输入抽取专业背景、目标、薄弱点、节奏和资源偏好，当前重点为 ${weakPointText}。`,
      progress: 18,
    },
    {
      agent: 'CourseUnderstandingAgent',
      status: 'completed',
      output: `检索《人工智能导论》知识库，命中 ${courseHits.length} 个章节或案例来源。`,
      progress: 34,
    },
    {
      agent: 'ResourcePlannerAgent',
      status: 'completed',
      output: `依据画像选择资源组合：${resourceTypes}。`,
      progress: 52,
    },
    {
      agent: 'ContentAgentGroup',
      status: 'completed',
      output: `生成 ${resources.length} 类学习材料，并为每张资源卡补充个性化理由。`,
      progress: 74,
    },
    {
      agent: 'TrustReviewAgent',
      status: 'completed',
      output: '检查来源引用、敏感内容和过度确定性表述，输出置信度与复核建议。',
      progress: 88,
    },
    {
      agent: 'LearningPathAgent',
      status: 'completed',
      output: `按「${profile.dimensions.learningPace.value}」规划学习顺序，并将资源接入学习路径。`,
      progress: 100,
    },
  ];
}

function buildPersonalizedLearningPath(
  profile: SoftwareCupStudentProfile,
  resources: GeneratedResource[],
): LearningPathNode[] {
  const topicText = normalizeTopicText(profile.dimensions.knowledgeBase.weakPoints);
  const lecture = resources.find((resource) => resource.type === 'markdown_lecture')?.id;
  const mindMap = resources.find((resource) => resource.type === 'mind_map')?.id;
  const selfCheck = resources.find((resource) => resource.type === 'self_check')?.id;

  return [
    {
      dayRange: '第 1 步 · 学',
      goal: `建立 ${topicText} 的概念框架`,
      resources: unique([lecture, mindMap].filter(Boolean) as string[]),
      reason: '先补齐概念边界，降低后续自查和练习的理解成本。',
    },
    {
      dayRange: '第 2 步 · 查',
      goal: '逐条自查薄弱点',
      resources: unique([selfCheck].filter(Boolean) as string[]),
      reason: '用自查清单判断哪些点“能做到”、哪些“还不行”，为出题练习确定主题。',
    },
    {
      dayRange: '第 3 步 · 练',
      goal: '跳转出题引擎针对性练习',
      resources: [],
      reason: '打开平台出题引擎，把自查后仍薄弱的点作为主题完成练习，包内不埋题。',
    },
    {
      dayRange: '第 4 步 · 复盘',
      goal: '跳转错题复盘并更新学习顺序',
      resources: [],
      reason: '练习后回到错题画像与学习计划，把新错因回写并调整后续安排。',
    },
  ];
}

export async function buildSoftwareCupProfile(input: string): Promise<SoftwareCupStudentProfile> {
  const fallback = await readJson<SoftwareCupStudentProfile>('student-profile-sample.json');
  const text = input.trim() || (await getDefaultSoftwareCupInput());
  const weakPoints = inferWeakPoints(text);
  const resourcePreference = inferResourcePreference(text);
  const strongPoints = /Python/i.test(text)
    ? ['Python 基础']
    : fallback.dimensions.knowledgeBase.strongPoints;

  return {
    ...fallback,
    sourceInput: text,
    lastUpdated: new Date().toISOString(),
    dimensions: {
      majorBackground: {
        value: inferMajor(text),
        confidence: 0.9,
        evidence: ['由学生自然语言输入抽取'],
      },
      learningGoal: {
        value: inferGoal(text),
        confidence: 0.88,
        evidence: ['由“希望/目标/两周”等表达抽取'],
      },
      knowledgeBase: {
        strongPoints,
        weakPoints,
        confidence: 0.86,
        evidence: ['由“还可以/不太懂/困惑/薄弱”等表达抽取'],
      },
      cognitiveStyle: {
        value: resourcePreference.includes('代码实操案例')
          ? '案例驱动 + 实操验证'
          : '图解理解 + 分层练习',
        confidence: 0.84,
        evidence: ['由资源偏好推断'],
      },
      errorPatternPreference: {
        value: unique([
          weakPoints.includes('过拟合') ? '概念边界混淆' : '',
          weakPoints.includes('模型评估') ? '评价指标选择不稳' : '',
          weakPoints.includes('RAG') ? '检索与生成流程连接弱' : '',
          resourcePreference.includes('代码实操案例') ? '公式与代码连接弱' : '',
        ]),
        confidence: 0.78,
        evidence: ['由薄弱点和资源偏好综合推断'],
      },
      resourcePreference: {
        value: resourcePreference,
        confidence: 0.9,
        evidence: ['由学生直接表达的“图解/代码/练习/PPT/视频”等偏好抽取'],
      },
      learningPace: {
        value: inferPace(text),
        confidence: 0.88,
        evidence: ['由学习时间和目标周期抽取'],
      },
      currentLearningState: {
        value: `薄弱点集中在${weakPoints.join('、')}，适合先补前置概念，再进入案例和项目。`,
        confidence: 0.82,
        evidence: ['由知识基础、目标和偏好综合推断'],
      },
    },
  };
}

export function checkSoftwareCupContentSafety(input: string): SafetyCheckResult {
  const text = input.trim();
  const categories: string[] = [];

  if (!text) {
    return {
      passed: false,
      riskLevel: 'medium',
      categories: ['empty_input'],
      action: 'need_review',
      message: '输入为空，需要补充学习背景或学习目标。',
    };
  }

  if (/代写|直接写.*论文|直接写.*作业|帮我完成.*作业|伪造|抄袭/.test(text)) {
    categories.push('academic_integrity');
  }
  if (/(身份证|住址|银行卡|手机号|电话).{0,12}\d{6,}/.test(text) || /\b1[3-9]\d{9}\b/.test(text)) {
    categories.push('privacy');
  }
  if (/违法|攻击|木马|勒索|色情|仇恨/.test(text)) {
    categories.push('unsafe_content');
  }

  if (categories.includes('unsafe_content')) {
    return {
      passed: false,
      riskLevel: 'high',
      categories,
      action: 'reject',
      message: '请求包含高风险内容，系统拒绝生成相关材料。',
    };
  }

  if (categories.includes('academic_integrity')) {
    return {
      passed: true,
      riskLevel: 'medium',
      categories,
      action: 'rewrite_as_tutoring',
      message: '检测到学术诚信风险，系统将转为提纲、思路和自查清单式辅导。',
    };
  }

  if (categories.includes('privacy')) {
    return {
      passed: false,
      riskLevel: 'medium',
      categories,
      action: 'need_review',
      message: '输入可能包含个人隐私，建议脱敏后继续。',
    };
  }

  return {
    passed: true,
    riskLevel: 'low',
    categories: ['learning_request'],
    action: 'allow',
    message: '输入符合学习辅导场景，可进入画像构建和资源生成。',
  };
}

export async function verifySoftwareCupAcademicContent(params: {
  citations?: string[];
  content?: string;
}): Promise<ReviewResult> {
  const citations = params.citations ?? [];
  const content = params.content ?? '';
  const issues: string[] = [];

  if (citations.length === 0) issues.push('缺少课程来源引用');
  if (/一定|永远|完全消除|百分之百/.test(content))
    issues.push('存在过度确定表述，建议改为条件化表达');

  return {
    passed: issues.length === 0,
    confidence: citations.length > 0 ? 0.86 : 0.42,
    issues,
    suggestions:
      issues.length > 0
        ? ['补充课程章节来源', '对不确定结论标记需人工复核']
        : ['保留来源片段、置信度和人工复核入口'],
  };
}

export async function runSoftwareCupGeneration(
  input: string,
  options: RunSoftwareCupGenerationOptions = {},
): Promise<SoftwareCupGenerationResult> {
  const text = input.trim() || (await getDefaultSoftwareCupInput());
  const emit = (progress: SoftwareCupProgress) => {
    void Promise.resolve(options.onProgress?.(progress)).catch(() => {});
  };
  emit({ step: 'safety', progress: 8, message: '正在进行安全检查与风控校验' });

  const [baseProfile, demo, profileSignals] = await Promise.all([
    buildSoftwareCupProfile(text),
    readJson<{
      demoId: string;
      courseId: string;
      agentTrace: AgentTraceItem[];
      resources: GeneratedResource[];
      learningPath: LearningPathNode[];
      reviewResult: ReviewResult;
    }>('generated-resources.json'),
    resolveProfileSignals(options),
  ]);
  const conversationProfile = buildConversationProfileFromSignals(profileSignals);
  const profile = mergeConversationProfile(baseProfile, conversationProfile);
  emit({ step: 'profile', progress: 20, message: '已了解你的学习情况' });

  // 按需单生成：只保留用户选择的资源类型，避免「用户只要一样却等六样」。
  const selectedTypes = normalizeResourceTypes(options.resourceTypes);
  if (options.resourceTypes && options.resourceTypes.length > 0 && selectedTypes.length === 0) {
    throw new Error('所选资源类型无效，请选择支持的资源类型后重试。');
  }
  const resourceSlots =
    selectedTypes.length > 0
      ? demo.resources.filter((resource) =>
          selectedTypes.includes(resource.type as CourseResourceType),
        )
      : demo.resources;
  if (resourceSlots.length === 0) {
    throw new Error('未选择可生成的资源类型，请至少选择一种后重试。');
  }

  const query = unique([...profile.dimensions.knowledgeBase.weakPoints, '人工智能导论']).join(' ');
  const courseHits = await searchAiIntroCourse(query, 6);
  emit({ step: 'search', progress: 38, message: `已检索到 ${courseHits.length} 条课程资料` });
  const safety = checkSoftwareCupContentSafety(text);
  emit({ step: 'generate', progress: 42, message: '正在为你生成学习资料' });
  const fallbackResources = await hydrateResourceArtifacts(
    personalizeResources(resourceSlots, profile, courseHits),
    profile,
  );
  const llmGeneration: LlmRagEnhancement = options.enableLlm
    ? await enhanceResourcesWithLlmRag({
        input: text,
        profile,
        courseHits,
        resources: fallbackResources,
      })
    : {
        resources: fallbackResources.map((resource) => ({
          ...resource,
          generationSource: 'demo' as const,
        })),
        used: false,
        reason: 'LLM generation disabled for this call.',
      };
  const resources = llmGeneration.resources;
  emit({ step: 'generate', progress: 74, message: '正在整理并润色学习资料' });
  const qualityReview = reviewGeneratedResources({ resources, profile });
  const reviewedResources = qualityReview.resources;
  const review = await verifySoftwareCupAcademicContent({
    citations: reviewedResources.flatMap((resource) => resource.sourceCitations),
    content: reviewedResources
      .map((resource) => resource.content ?? resource.contentPreview ?? resource.title)
      .join('\n'),
  });
  const learningPath = buildPersonalizedLearningPath(profile, reviewedResources);
  emit({ step: 'review', progress: 88, message: '内容检查与来源核对完成' });
  const reviewConfidenceValues = [
    demo.reviewResult.confidence,
    review.confidence,
    qualityReview.summary.confidence,
    llmGeneration.reviewPatch?.confidence,
  ].filter((value): value is number => typeof value === 'number');
  const reviewConfidence = Number(
    (
      reviewConfidenceValues.reduce((sum, value) => sum + value, 0) / reviewConfidenceValues.length
    ).toFixed(2),
  );

  emit({ step: 'path', progress: 96, message: '正在安排后续学习顺序' });

  return {
    demoId: demo.demoId,
    jobId: `software-cup-${Date.now()}`,
    status: 'completed',
    progress: 100,
    courseId: demo.courseId,
    generatedAt: new Date().toISOString(),
    studentProfile: profile,
    safety,
    courseHits,
    agentTrace: buildPersonalizedAgentTrace(profile, courseHits, reviewedResources),
    resources: reviewedResources,
    learningPath,
    reviewResult: {
      ...demo.reviewResult,
      passed: demo.reviewResult.passed && review.passed && qualityReview.summary.passed,
      confidence: reviewConfidence,
      issues: [
        ...demo.reviewResult.issues,
        ...review.issues,
        ...qualityReview.summary.issues,
        ...(llmGeneration.reviewPatch?.issues ?? []),
      ],
      suggestions: unique([
        ...demo.reviewResult.suggestions,
        ...review.suggestions,
        ...qualityReview.summary.suggestions,
        ...(llmGeneration.reviewPatch?.suggestions ?? []),
      ]),
      resourceChecks: qualityReview.summary.resourceChecks,
    },
    generationMode: llmGeneration.used ? 'llm_rag' : 'demo_fallback',
    llmGeneration: {
      used: llmGeneration.used,
      reason: llmGeneration.reason,
      model: llmGeneration.model,
    },
    p2Enhancements: buildP2Enhancements({
      profile,
      resources: reviewedResources,
      learningPath,
    }),
  };
}

export function buildSoftwareCupProgressEvents(): AgentTraceItem[] {
  return [
    { agent: 'Director', status: 'completed', output: '识别学习目标并拆解任务。', progress: 12 },
    { agent: 'ProfileAgent', status: 'completed', output: '抽取 8 维学习画像。', progress: 25 },
    {
      agent: 'CourseUnderstandingAgent',
      status: 'completed',
      output: '检索《人工智能导论》知识库。',
      progress: 40,
    },
    {
      agent: 'ResourceDesignAgent',
      status: 'completed',
      output: '确定 4 类学习包产物。',
      progress: 55,
    },
    {
      agent: 'ResourceAgents',
      status: 'completed',
      output: '生成讲义、导图、自查清单与学习路径。',
      progress: 78,
    },
    {
      agent: 'QualityReviewAgent',
      status: 'completed',
      output: '完成来源引用、置信度和内容安全审核。',
      progress: 90,
    },
    {
      agent: 'LearningPathAgent',
      status: 'completed',
      output: '按“学→查→练→复盘”生成学习闭环与跳转指引。',
      progress: 100,
    },
  ];
}
